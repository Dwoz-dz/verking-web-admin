import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminUIContextType {
  isDark: boolean;
  toggleDark: () => void;
  t: ThemeTokens;
}

interface ThemeTokens {
  bg: string;
  card: string;
  cardSubtle: string;
  cardBorder: string;
  sidebar: string;
  text: string;
  textMuted: string;
  textSmall: string;
  textAccent: string;
  input: string;
  inputBorder: string;
  thead: string;
  theadText: string;
  rowBorder: string;
  rowHover: string;
  divider: string;
  badge: string;
  isDark: boolean;
}

function buildTokens(dark: boolean): ThemeTokens {
  return dark ? {
    bg: 'bg-[#0d1117]',
    card: 'bg-[#161b22]',
    cardSubtle: 'bg-[#0d1117]/50',
    cardBorder: 'border-[#30363d]',
    sidebar: 'bg-[#0d1117]',
    text: 'text-[#e6edf3]',
    textMuted: 'text-[#7d8590]',
    textSmall: 'text-[#8b949e]',
    textAccent: 'text-[#58a6ff]',
    input: 'bg-[#0d1117] border-[#30363d] text-[#e6edf3] placeholder:text-[#484f58] focus:border-[#58a6ff]',
    inputBorder: 'border-[#30363d]',
    thead: 'bg-[#161b22]',
    theadText: 'text-[#7d8590]',
    rowBorder: 'border-[#21262d]',
    rowHover: 'hover:bg-[#1c2128]',
    divider: 'border-[#21262d]',
    badge: 'bg-[#21262d] text-[#8b949e]',
    isDark: true,
  } : {
    bg: 'bg-gray-50',
    card: 'bg-white',
    cardSubtle: 'bg-gray-50',
    cardBorder: 'border-gray-100',
    sidebar: 'bg-[#1A3C6E]',
    text: 'text-gray-800',
    textMuted: 'text-gray-500',
    textSmall: 'text-gray-600',
    textAccent: 'text-[#1A3C6E]',
    input: 'bg-white border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-blue-400',
    inputBorder: 'border-gray-200',
    thead: 'bg-gray-50',
    theadText: 'text-gray-500',
    rowBorder: 'border-gray-50',
    rowHover: 'hover:bg-gray-50',
    divider: 'border-gray-100',
    badge: 'bg-gray-100 text-gray-600',
    isDark: false,
  };
}

const AdminUIContext = createContext<AdminUIContextType>({
  isDark: false,
  toggleDark: () => {},
  t: buildTokens(false),
});

export function AdminUIProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem('admin-dark-mode') === 'true'; } catch { return false; }
  });

  const toggleDark = () => {
    setIsDark(d => {
      const next = !d;
      try { localStorage.setItem('admin-dark-mode', String(next)); } catch {}
      return next;
    });
  };

  const t = buildTokens(isDark);

  return (
    <AdminUIContext.Provider value={{ isDark, toggleDark, t }}>
      {children}
    </AdminUIContext.Provider>
  );
}

export const useAdminUI = () => useContext(AdminUIContext);
