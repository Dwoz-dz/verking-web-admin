import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

export interface ThemeSettings {
  primary_color: string;
  accent_color: string;
  bg_color: string;
  show_featured: boolean;
  show_new_arrivals: boolean;
  show_best_sellers: boolean;
  show_wholesale_section: boolean;
  show_testimonials: boolean;
  logo_text: string;
}

const defaults: ThemeSettings = {
  primary_color: '#1A3C6E',
  accent_color: '#F57C00',
  bg_color: '#F8FAFC',
  show_featured: true,
  show_new_arrivals: true,
  show_best_sellers: true,
  show_wholesale_section: true,
  show_testimonials: true,
  logo_text: 'VERKING SCOLAIRE',
};

const ThemeContext = createContext<{ theme: ThemeSettings; refreshTheme: () => void }>({ theme: defaults, refreshTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(defaults);

  const applyTheme = (t: ThemeSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--vk-primary', t.primary_color);
    root.style.setProperty('--vk-accent', t.accent_color);
    root.style.setProperty('--vk-bg', t.bg_color);
  };

  const refreshTheme = async () => {
    try {
      const data = await api.get('/theme');
      const t = { ...defaults, ...data.theme };
      setTheme(t);
      applyTheme(t);
    } catch (e) { console.error('Theme load error:', e); }
  };

  useEffect(() => { refreshTheme(); }, []);

  return <ThemeContext.Provider value={{ theme, refreshTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
