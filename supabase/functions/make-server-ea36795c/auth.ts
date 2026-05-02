import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid } from "./db.ts";

// Robust admin token verification.
//
// Token formats accepted (in priority order):
//   1. `vk_session:<admin_uuid>:<nonce>` — issued by DB-based login.
//      Verified by checking `admin_users.is_active = true` for the uuid.
//      The nonce is opaque and not validated (any random string works).
//   2. KV legacy token (`config.token`) — only used when no DB session
//      token format is detected. Keeps the bootstrap admin alive even
//      if the admin_users table is unreachable.
//
// Audit fix (2026-05-02):
//   The old chain had a fall-through: if the DB probe failed for any
//   reason (cold-start blip, momentary network hiccup), `useDB()`
//   returned false and we silently fell into the KV branch — which
//   ALWAYS rejected `vk_session:...` tokens because they don't match
//   the legacy hardcoded constant. Result: a transient 100ms blip
//   permanently locked an edge-function instance into rejecting every
//   valid admin token until that instance was recycled.
//
// New chain:
//   ▸ If the token LOOKS like vk_session, we ALWAYS check the DB —
//     directly via the service-role client, no `useDB()` gate. The
//     gate was decorative anyway (the DB check itself confirms
//     reachability). If the DB returns a row with is_active=true, ok.
//     If the DB query errors, we log + reject (token can't be verified
//     right now — the frontend will retry).
//   ▸ Otherwise (legacy token shape), we check KV.
//   ▸ If both branches fail, we reject.
//
// Result: a transient DB blip surfaces as a single 401, not a
// permanently-broken session.
export async function isAdmin(c: any): Promise<boolean> {
  const token = c.req.header("X-Admin-Token");
  if (!token) return false;

  // ── Path 1: vk_session token → always check admin_users via service role ──
  const parts = token.split(':');
  if (parts.length >= 3 && parts[0] === 'vk_session') {
    const adminId = parts[1];
    if (!adminId) {
      console.warn('isAdmin: malformed vk_session token (no admin id)');
      return false;
    }
    try {
      const { data, error } = await db
        .from('admin_users')
        .select('id, is_active')
        .eq('id', adminId)
        .maybeSingle();
      if (error) {
        console.warn('isAdmin: admin_users lookup error:', error.message);
        return false;
      }
      if (!data) {
        console.warn(`isAdmin: no admin row for id ${adminId}`);
        return false;
      }
      if (!data.is_active) {
        console.warn(`isAdmin: admin ${adminId} is inactive`);
        return false;
      }
      return true;
    } catch (e) {
      console.error('isAdmin: DB lookup threw:', e);
      return false;
    }
  }

  // ── Path 2: legacy KV-stored bootstrap token ──
  try {
    const configStr = await kv.get("admin:config");
    const config = configStr ? JSON.parse(configStr) : { token: "vk-admin-secure-token-2024" };
    return token === config.token;
  } catch (e) {
    console.error('isAdmin: KV lookup threw:', e);
    // Ultimate fallback for emergency bootstrap access only.
    return token === "vk-admin-secure-token-2024";
  }
}

export async function handleLogin(c: any) {
  try {
    const { email, password } = await c.req.json();
    if (!password) return errRes(c, "Mot de passe requis", 400);

    // Try DB login if available
    if (await useDB()) {
      try {
        const targetEmail = email || null;
        
        // Use RPC for secure password verification
        if (targetEmail) {
          const { data: match, error: rpcError } = await db.rpc('verify_admin_password', { 
            admin_email: targetEmail, 
            admin_password: password 
          });
          
          if (rpcError) throw rpcError;

          if (match?.valid) {
            const { data: admin } = await db.from('admin_users').select('*').eq('email', targetEmail).single();
            if (admin) {
              const tok = `vk_session:${admin.id}:${uid()}`;
              await db.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', admin.id);
              return respond(c, { 
                success: true, 
                token: tok, 
                admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } 
              });
            }
          }
        } else {
          // Password-only login (checking all active admins) - less secure but supported for legacy
          const { data: admins } = await db.from('admin_users').select('*').eq('is_active', true);
          for (const admin of (admins || [])) {
            const { data: match } = await db.rpc('verify_admin_password', { 
              admin_email: admin.email, 
              admin_password: password 
            });
            if (match?.valid) {
              const tok = `vk_session:${admin.id}:${uid()}`;
              await db.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', admin.id);
              return respond(c, { 
                success: true, 
                token: tok, 
                admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } 
              });
            }
          }
        }
      } catch (e) {
        console.warn('DB login attempt failed, trying KV fallback:', e);
      }
    }

    // KV fallback logic
    const configStr = await kv.get("admin:config");
    const config = configStr ? JSON.parse(configStr) : { password: "Admin@Verking2024", token: "vk-admin-secure-token-2024" };
    
    if (password === config.password) {
      return respond(c, { success: true, token: config.token });
    }
    
    return errRes(c, "Mot de passe incorrect", 401);
  } catch (e) {
    return errRes(c, `Erreur lors de la connexion: ${e.message}`);
  }
}

export async function handleVerify(c: any) {
  if (await isAdmin(c)) return respond(c, { success: true });
  return errRes(c, "Non autorisé", 401);
}

export async function handleUpdatePassword(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const { new_password } = await c.req.json();
    if (!new_password) return errRes(c, "Nouveau mot de passe requis", 400);

    if (await useDB()) {
      try {
        // In DB mode, we update via RPC to handle hashing if applicable
        // Note: Default email is used if not specified in session, should ideally come from token/context
        const token = c.req.header("X-Admin-Token");
        let email = 'admin@verking-scolaire.dz';
        if (token?.startsWith('vk_session:')) {
           const id = token.split(':')[1];
           const { data } = await db.from('admin_users').select('email').eq('id', id).single();
           if (data?.email) email = data.email;
        }

        await db.rpc('update_admin_password', { admin_email: email, new_password });
      } catch (e) {
        console.error("Failed to update password in DB:", e);
      }
    }
    
    // Always update KV for dual-mode consistency
    await kv.set("admin:config", JSON.stringify({ password: new_password, token: "vk-admin-secure-token-2024" }));
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Erreur mise à jour mot de passe: ${e.message}`);
  }
}
