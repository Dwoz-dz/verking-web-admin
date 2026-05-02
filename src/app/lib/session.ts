/**
 * Admin session storage helpers — single source of truth for token I/O.
 *
 * All read/write of the admin token MUST go through this module so we
 * can:
 *   ▸ Log every state change (visible in DevTools + Sentry breadcrumbs)
 *   ▸ Clear consistently from every entry point (login retry, 401
 *     handler, manual reset, AuthContext logout)
 *   ▸ Future-proof against moving the token to a cookie / secure
 *     storage if needed.
 *
 * Audit 2026-05-02: introduced after the user's browser kept a stale
 * `vk_admin_token` from a session created before the auth refactor,
 * which caused every protected page to flash an "Impossible de
 * charger…" toast even though all backend fixes were live.
 */

const TOKEN_KEY = 'vk_admin_token';
const ADMIN_KEY = 'vk_admin_info';

/** Read the stored admin token, normalised to `null` if absent/empty/invalid sentinel. */
export function readAdminToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw || raw === 'null' || raw === 'undefined') return null;
    return raw;
  } catch {
    return null;
  }
}

/** Read the stored admin profile blob, or null if missing/corrupted. */
export function readAdminInfo<T = Record<string, unknown>>(): T | null {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw || raw === 'null' || raw === 'undefined') return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Persist a fresh token + admin profile, OVERWRITING any prior values. */
export function writeAdminSession(token: string, admin?: unknown): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (admin !== undefined && admin !== null) {
      localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    }
    console.log('[session] admin token persisted');
  } catch (e) {
    console.warn('[session] write failed:', e);
  }
}

/**
 * Wipe ALL admin session state. Call from:
 *   ▸ AuthContext.logout()
 *   ▸ The 401 handler when verify confirms the token is dead
 *   ▸ The "Reset Session" recovery button
 *   ▸ Boot-time, when /admin/verify rejects the stored token
 *
 * Optional `reason` string is logged for traceability.
 */
export function clearAdminSession(reason: string = 'manual'): void {
  try {
    const hadToken = !!localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    // Wipe any short-lived in-memory cache the admin pages may have
    // stashed (filters, drafts) — sessionStorage is per-tab so this
    // doesn't cross-contaminate other admins on the same machine.
    try { sessionStorage.clear(); } catch { /* sessionStorage may be blocked in private mode */ }
    if (hadToken) {
      console.log(`[session] cleared (reason: ${reason})`);
    }
  } catch (e) {
    console.warn('[session] clear failed:', e);
  }
}

/**
 * Hard reset — clears storage AND reloads the page so every in-flight
 * request is cancelled and React state goes through a clean boot.
 * Bound to the "Reset Session" debug button.
 */
export function hardResetAdminSession(reason: string = 'manual-reset'): void {
  clearAdminSession(reason);
  // Defer slightly so the console log lands before the reload.
  setTimeout(() => { window.location.replace('/admin/login'); }, 50);
}
