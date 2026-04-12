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
}

const AuthContext = createContext<AuthCtx>({
  token: null, admin: null, login: async () => false, logout: () => {}, isAdmin: false, isInitializing: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

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
    const handleLogout = () => logout();
    window.addEventListener('vk_admin_logout', handleLogout);
    return () => window.removeEventListener('vk_admin_logout', handleLogout);
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

  return (
    <AuthContext.Provider value={{ token, admin, login, logout, isAdmin: !!token, isInitializing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
