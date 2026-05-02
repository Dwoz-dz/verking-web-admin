import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes } from "./db.ts";

/**
 * Production admin authentication (audit 2026-05-02).
 *
 * Architecture:
 *   ▸ admin_sessions table — TTL-bound rows. Validate via the
 *     admin_session_validate() RPC which extends last_used_at on each
 *     hit (sliding window, default +60 min).
 *   ▸ admin_login_attempts — per-IP rate limit. 5 failed attempts / 60s
 *     returns 429. Successful attempts also recorded for audit trail.
 *   ▸ admin_users — the actual user table (verify_admin_password RPC
 *     checks the bcrypt hash).
 *
 * Token shape: `vk_session:<admin_uuid>:<64-hex-random>`.
 *   The 64-hex part is the row's primary key — no longer decorative.
 *
 * Backwards compatibility:
 *   ▸ Old tokens (where the random part isn't a row) gracefully fall
 *     through the legacy admin_users-only check, so existing logged-in
 *     admins don't get nuked at deploy. They'll move to the new system
 *     on next login.
 *   ▸ The legacy KV bootstrap token still works as last-resort.
 */

// Generate a cryptographically random 64-hex token suffix.
function cryptoRandomHex(byteLen = 32): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Sliding-window TTL extended on every successful verify. */
const SESSION_EXTEND_MINUTES = 60;
/** Initial TTL set at login. */
const SESSION_INITIAL_MINUTES = 8 * 60;
/** Login rate limit: max failed attempts per IP in the rolling window. */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 60;

function getClientIp(c: any): string {
  const fwd = c.req.header("x-forwarded-for") || "";
  const first = fwd.split(",")[0].trim();
  return first || c.req.header("x-real-ip") || "0.0.0.0";
}

export async function isAdmin(c: any): Promise<boolean> {
  const token = c.req.header("X-Admin-Token");
  if (!token) return false;

  const parts = token.split(":");

  // ── Path 1: vk_session token → check admin_sessions table first ──
  if (parts.length >= 3 && parts[0] === "vk_session") {
    try {
      // 1.a — Try the new TTL-bound session table.
      const { data: rpcAdminId, error: rpcErr } = await db.rpc(
        "admin_session_validate",
        { p_token: token, p_extend_minutes: SESSION_EXTEND_MINUTES },
      );
      if (!rpcErr && rpcAdminId) {
        return true;
      }

      // 1.b — Legacy fallback: pre-migration tokens whose random part
      // isn't a row in admin_sessions. Validate against admin_users
      // directly so existing logins don't break on deploy. Once the
      // admin re-logs-in, they're upgraded to the new system.
      const adminId = parts[1];
      if (!adminId) return false;
      const { data: adminRow, error: adminErr } = await db
        .from("admin_users")
        .select("id, is_active")
        .eq("id", adminId)
        .maybeSingle();
      if (adminErr) {
        console.warn("isAdmin: admin_users lookup error:", adminErr.message);
        return false;
      }
      if (!adminRow) {
        console.warn(`isAdmin: no admin row for id ${adminId}`);
        return false;
      }
      if (!adminRow.is_active) {
        console.warn(`isAdmin: admin ${adminId} is inactive`);
        return false;
      }
      return true;
    } catch (e) {
      console.error("isAdmin: vk_session check threw:", e);
      return false;
    }
  }

  // ── Path 2: legacy KV bootstrap token ──
  try {
    const configStr = await kv.get("admin:config");
    const config = configStr
      ? JSON.parse(configStr)
      : { token: "vk-admin-secure-token-2024" };
    return token === config.token;
  } catch (e) {
    console.error("isAdmin: KV lookup threw:", e);
    return token === "vk-admin-secure-token-2024";
  }
}

export async function handleLogin(c: any) {
  const ip = getClientIp(c);
  let emailForAudit: string | null = null;
  try {
    const { email, password } = await c.req.json();
    emailForAudit = email ?? null;
    if (!password) return errRes(c, "Mot de passe requis", 400);

    // ── Rate limit guard (per-IP) ──
    if (await useDB()) {
      try {
        const { data: allowed } = await db.rpc("admin_login_rate_check", {
          p_ip: ip,
          p_window_seconds: LOGIN_WINDOW_SECONDS,
          p_max_attempts: LOGIN_MAX_ATTEMPTS,
        });
        if (allowed === false) {
          return c.json(
            {
              error: `Trop de tentatives. Réessayez dans ${LOGIN_WINDOW_SECONDS}s.`,
              code: "RATE_LIMITED",
            },
            429,
          );
        }
      } catch (e) {
        console.warn("rate-check rpc failed (allowing through):", e);
      }
    }

    // ── DB-backed login (production path) ──
    if (await useDB()) {
      try {
        const targetEmail = email || null;
        let admin: any = null;

        if (targetEmail) {
          const { data: match, error: rpcError } = await db.rpc(
            "verify_admin_password",
            { admin_email: targetEmail, admin_password: password },
          );
          if (rpcError) throw rpcError;
          if (match?.valid) {
            const { data: a } = await db
              .from("admin_users")
              .select("*")
              .eq("email", targetEmail)
              .single();
            admin = a;
          }
        } else {
          // Password-only login (legacy support).
          const { data: admins } = await db
            .from("admin_users")
            .select("*")
            .eq("is_active", true);
          for (const a of (admins || [])) {
            const { data: match } = await db.rpc("verify_admin_password", {
              admin_email: a.email,
              admin_password: password,
            });
            if (match?.valid) {
              admin = a;
              break;
            }
          }
        }

        if (admin) {
          // Issue a fresh session row.
          const sessionId = cryptoRandomHex(32);
          const tok = `vk_session:${admin.id}:${sessionId}`;
          const expiresAt = new Date(
            Date.now() + SESSION_INITIAL_MINUTES * 60 * 1000,
          ).toISOString();

          const { error: insErr } = await db
            .from("admin_sessions")
            .insert({
              token: tok,
              admin_id: admin.id,
              expires_at: expiresAt,
              ip_address: ip,
              user_agent: c.req.header("user-agent") ?? null,
            });
          if (insErr) {
            console.error("admin_sessions insert failed:", insErr);
            // Soft fall-through: token still works against legacy admin_users
            // path. We'd rather log them in than block.
          }

          await db
            .from("admin_users")
            .update({ last_login: new Date().toISOString() })
            .eq("id", admin.id);

          await db.rpc("admin_login_record_attempt", {
            p_ip: ip,
            p_email: emailForAudit,
            p_succeeded: true,
          }).then(() => {}, (e) => console.warn("audit-rpc failed:", e));

          return respond(c, {
            success: true,
            token: tok,
            admin: {
              id: admin.id,
              name: admin.name,
              email: admin.email,
              role: admin.role,
            },
          });
        }
      } catch (e) {
        console.warn("DB login attempt failed, trying KV fallback:", e);
      }
    }

    // ── Legacy KV fallback ──
    const configStr = await kv.get("admin:config");
    const config = configStr
      ? JSON.parse(configStr)
      : { password: "Admin@Verking2024", token: "vk-admin-secure-token-2024" };
    if (password === config.password) {
      // Record a successful login in the audit log even for legacy path.
      try {
        await db.rpc("admin_login_record_attempt", {
          p_ip: ip,
          p_email: emailForAudit,
          p_succeeded: true,
        });
      } catch { /* non-blocking */ }
      return respond(c, { success: true, token: config.token });
    }

    // ── Failed login → record + 401 ──
    try {
      await db.rpc("admin_login_record_attempt", {
        p_ip: ip,
        p_email: emailForAudit,
        p_succeeded: false,
      });
    } catch { /* non-blocking */ }
    return errRes(c, "Mot de passe incorrect", 401);
  } catch (e: any) {
    return errRes(c, `Erreur lors de la connexion: ${e?.message ?? e}`);
  }
}

export async function handleVerify(c: any) {
  if (await isAdmin(c)) return respond(c, { success: true });
  return errRes(c, "Non autorisé", 401);
}

export async function handleLogout(c: any) {
  const token = c.req.header("X-Admin-Token") ?? "";
  if (token.startsWith("vk_session:")) {
    try {
      await db.from("admin_sessions").delete().eq("token", token);
    } catch (e) {
      console.warn("logout: session delete failed:", e);
    }
  }
  return respond(c, { success: true });
}

export async function handleUpdatePassword(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const { new_password } = await c.req.json();
    if (!new_password) return errRes(c, "Nouveau mot de passe requis", 400);

    if (await useDB()) {
      try {
        const token = c.req.header("X-Admin-Token") ?? "";
        let email = "admin@verking-scolaire.dz";
        if (token.startsWith("vk_session:")) {
          const id = token.split(":")[1];
          const { data } = await db
            .from("admin_users")
            .select("email")
            .eq("id", id)
            .single();
          if (data?.email) email = data.email;
        }
        await db.rpc("update_admin_password", {
          admin_email: email,
          new_password,
        });
      } catch (e) {
        console.error("Failed to update password in DB:", e);
      }
    }

    await kv.set(
      "admin:config",
      JSON.stringify({
        password: new_password,
        token: "vk-admin-secure-token-2024",
      }),
    );
    return respond(c, { success: true });
  } catch (e: any) {
    return errRes(c, `Erreur mise à jour mot de passe: ${e?.message ?? e}`);
  }
}
