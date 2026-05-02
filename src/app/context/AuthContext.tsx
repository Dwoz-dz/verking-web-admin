/**
 * AuthContext — single source of truth for the admin's auth state.
 *
 * Audit 2026-05-02 hardening:
 *   ▸ Boot: stored token is verified against `/admin/verify`. ANY 401
 *     hard-clears localStorage + sessionStorage so the admin lands on
 *     /admin/login with a clean slate. No more silent toasts about
 *     stale tokens.
 *   ▸ Login: writes through `writeAdminSession()` which OVERWRITES any
 *     prior values (no leftover `vk_admin_info` from another account).
 *   ▸ Logout: best-effort server-side invalidation (DELETE the
 *     admin_sessions row) + full clear via `clearAdminSession()`.
 *   ▸ vk_admin_logout event: hard-clear and route to login. The old
 *     "Session expirée" modal still renders for users mid-edit, but
 *     the storage is wiped so no further request can carry the dead
 *     token.
 *   ▸ Every state change is logged so DevTools shows exactly when /
 *     why the admin was deauthenticated.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, API_BASE, adminHeaders } from '../lib/api';
import {
  clearAdminSession,
  hardResetAdminSession,
  readAdminInfo,
  readAdminToken,
  writeAdminSession,
} from '../lib/session';

interface AdminInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthCtx {
  token: string | null;
  admin: AdminInfo | null;
  login: (emailOrPassword: string, password?: string) => Promise<boolean>;
  logout: () => void;
  /** Hard recovery: wipes storage + reloads /admin/login. Bound to the
   *  "Reset Session" debug button in the sidebar. */
  resetSession: () => void;
  isAdmin: boolean;
  isInitializing: boolean;
  /**
   * True when the latest admin request returned a confirmed 401 AFTER
   * a verify roundtrip. UI can show a "Session expirée" modal so the
   * admin re-authenticates without losing in-progress edits.
   */
  sessionExpired: boolean;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthCtx>({
  token: null,
  admin: null,
  login: async () => false,
  logout: () => {},
  resetSession: () => {},
  isAdmin: false,
  isInitializing: true,
  sessionExpired: false,
  dismissSessionExpired: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // ── Boot: verify the stored token, hard-clear if dead ────────────────
  useEffect(() => {
    const stored = readAdminToken();
    const storedAdmin = readAdminInfo<AdminInfo>();
    if (!stored) {
      // Already clean (or sentinel value 'null'/'undefined' was written).
      // Run clearAdminSession anyway to ensure sessionStorage is wiped.
      clearAdminSession('boot-no-token');
      setIsInitializing(false);
      return;
    }

    fetch(`${API_BASE}/admin/verify`, { headers: adminHeaders(stored) })
      .then(async (res) => {
        if (res.status === 401) {
          // Confirmed dead — wipe everything so subsequent code paths
          // don't keep hitting backend with a token that will never work.
          console.warn('[auth] boot verify returned 401 → clearing stale session');
          clearAdminSession('boot-401');
          setToken(null);
          setAdmin(null);
        } else if (res.ok) {
          setToken(stored);
          if (storedAdmin) setAdmin(storedAdmin);
        } else {
          // 5xx / network error → keep the token (probably transient).
          console.warn(`[auth] boot verify returned ${res.status}, keeping token (transient)`);
          setToken(stored);
          if (storedAdmin) setAdmin(storedAdmin);
        }
      })
      .catch((e) => {
        // Genuine network failure (offline) — assume token is fine, let
        // individual page calls handle their own 401s.
        console.warn('[auth] boot verify network error, keeping token:', e?.message ?? e);
        setToken(stored);
        if (storedAdmin) setAdmin(storedAdmin);
      })
      .finally(() => setIsInitializing(false));
  }, []);

  // ── vk_admin_logout event: confirmed expiry from a per-page call ────
  useEffect(() => {
    const handleSessionExpired = () => {
      console.warn('[auth] vk_admin_logout event → wiping session + showing modal');
      setSessionExpired(true);
      // Clear synchronously so any next request can't carry the dead token.
      clearAdminSession('vk_admin_logout');
      setToken(null);
      setAdmin(null);
    };
    window.addEventListener('vk_admin_logout', handleSessionExpired);
    return () => window.removeEventListener('vk_admin_logout', handleSessionExpired);
  }, []);

  // ── Login: ALWAYS overwrite previous state + storage ────────────────
  const login = useCallback(async (emailOrPassword: string, password?: string): Promise<boolean> => {
    try {
      const body = password
        ? { email: emailOrPassword, password }
        : { password: emailOrPassword };
      const data = await api.post('/admin/login', body);
      if (data?.success && data?.token) {
        // Wipe FIRST so any leftover from a different account is gone.
        clearAdminSession('login-overwrite');
        setToken(data.token);
        if (data.admin) setAdmin(data.admin);
        writeAdminSession(data.token, data.admin);
        setSessionExpired(false);
        console.log('[auth] login success');
        return true;
      }
      console.warn('[auth] login response missing success/token:', data);
      return false;
    } catch (e: any) {
      console.warn('[auth] login error:', e?.message ?? e);
      return false;
    }
  }, []);

  // ── Logout: best-effort server invalidation + full clear ────────────
  const logout = useCallback(() => {
    const stale = token;
    if (stale) {
      // Fire-and-forget: don't await so a network blip can't block UI.
      void fetch(`${API_BASE}/admin/logout`, {
        method: 'POST',
        headers: adminHeaders(stale),
      }).catch(() => { /* non-blocking */ });
    }
    setToken(null);
    setAdmin(null);
    clearAdminSession('logout');
    console.log('[auth] logout');
  }, [token]);

  const resetSession = useCallback(() => {
    setToken(null);
    setAdmin(null);
    setSessionExpired(false);
    hardResetAdminSession('manual-reset-button');
  }, []);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  return (
    <AuthContext.Provider
      value={{
        token,
        admin,
        login,
        logout,
        resetSession,
        isAdmin: !!token,
        isInitializing,
        sessionExpired,
        dismissSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
