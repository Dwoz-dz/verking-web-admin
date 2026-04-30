import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, API_BASE, adminHeaders } from '../lib/api';

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
  isAdmin: boolean;
  isInitializing: boolean;
  /**
   * Phase 1.5 — true when the latest admin request returned a confirmed
   * 401 (after a verify roundtrip). UI can show a "Session expirée"
   * modal asking the admin to re-login WITHOUT yanking them off the
   * current page. Cleared on successful re-login or manual dismiss.
   */
  sessionExpired: boolean;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthCtx>({
  token: null, admin: null, login: async () => false, logout: () => {}, isAdmin: false, isInitializing: true,
  sessionExpired: false, dismissSessionExpired: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  // Phase 1.5 — session-expired UX flag. Wired to the existing
  // 'vk_admin_logout' event so the admin sees a graceful re-login modal
  // instead of being teleported back to /admin/login mid-edit.
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('vk_admin_token');
    const storedAdmin = localStorage.getItem('vk_admin_info');
    if (!stored || stored === 'null' || stored === 'undefined') {
      localStorage.removeItem('vk_admin_token');
      localStorage.removeItem('vk_admin_info');
      setIsInitializing(false);
      return;
    }

    fetch(`${API_BASE}/admin/verify`, { headers: adminHeaders(stored) })
      .then(async res => {
        if (res.status === 401) {
          setToken(null);
          setAdmin(null);
          localStorage.removeItem('vk_admin_token');
          localStorage.removeItem('vk_admin_info');
        } else if (res.ok) {
          setToken(stored);
          if (storedAdmin) {
            try { setAdmin(JSON.parse(storedAdmin)); } catch {}
          }
        }
      })
      .catch(() => {
        setToken(stored);
        if (storedAdmin) try { setAdmin(JSON.parse(storedAdmin)); } catch {}
      })
      .finally(() => setIsInitializing(false));
  }, []);

  useEffect(() => {
    // Phase 1.5 — flag the session as expired and let the UI render a
    // modal. The `logout()` call still fires (token cleared) so any
    // subsequent admin call short-circuits cleanly, but the admin
    // doesn't lose their place — they re-authenticate from a modal and
    // pick up where they left off. The "Se reconnecter" CTA inside the
    // modal handles the routing.
    const handleSessionExpired = () => {
      setSessionExpired(true);
      logout();
    };
    window.addEventListener('vk_admin_logout', handleSessionExpired);
    return () => window.removeEventListener('vk_admin_logout', handleSessionExpired);
  }, []);

  const login = async (emailOrPassword: string, password?: string): Promise<boolean> => {
    try {
      let body: any;
      if (password) {
        // New: email + password login
        body = { email: emailOrPassword, password };
      } else {
        // Legacy: password-only login
        body = { password: emailOrPassword };
      }
      const data = await api.post('/admin/login', body);
      if (data.success && data.token) {
        setToken(data.token);
        localStorage.setItem('vk_admin_token', data.token);
        if (data.admin) {
          setAdmin(data.admin);
          localStorage.setItem('vk_admin_info', JSON.stringify(data.admin));
        }
        // Successful re-login clears any pending "Session expirée" flag.
        setSessionExpired(false);
        return true;
      }
      return false;
    } catch { return false; }
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem('vk_admin_token');
    localStorage.removeItem('vk_admin_info');
  };

  const dismissSessionExpired = () => setSessionExpired(false);

  return (
    <AuthContext.Provider value={{
      token, admin, login, logout, isAdmin: !!token, isInitializing,
      sessionExpired, dismissSessionExpired,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
