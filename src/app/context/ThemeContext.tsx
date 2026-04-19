import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface ThemeSettings {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  bg_color: string;
  card_color: string;
  border_color: string;
  font_heading: string;
  font_body: string;
  type_scale: 'compact' | 'comfortable' | 'spacious';
  button_radius: string;
  button_shadow: 'none' | 'soft' | 'medium' | 'strong';
  component_density: 'compact' | 'comfortable' | 'spacious';
  header_style: 'classic' | 'minimal' | 'bold' | 'immersive';
  footer_style: 'classic' | 'minimal' | 'bold' | 'immersive';
  homepage_style: 'classic' | 'minimal' | 'bold' | 'immersive';
  show_featured: boolean;
  show_new_arrivals: boolean;
  show_best_sellers: boolean;
  show_wholesale_section: boolean;
  show_testimonials: boolean;
  logo_text: string;
  logo_subtitle: string;
  theme_name?: string;
  theme_description?: string;
  imported_from?: string;
  tokens_source?: string;
  published_at?: string | null;
}

const defaults: ThemeSettings = {
  primary_color: '#1A3C6E',
  secondary_color: '#12335E',
  accent_color: '#F57C00',
  bg_color: '#F8FAFC',
  card_color: '#FFFFFF',
  border_color: '#E5E7EB',
  font_heading: 'Montserrat',
  font_body: 'Inter',
  type_scale: 'comfortable',
  button_radius: 'xl',
  button_shadow: 'medium',
  component_density: 'comfortable',
  header_style: 'classic',
  footer_style: 'classic',
  homepage_style: 'classic',
  show_featured: true,
  show_new_arrivals: true,
  show_best_sellers: true,
  show_wholesale_section: true,
  show_testimonials: true,
  logo_text: 'VERKING SCOLAIRE',
  logo_subtitle: 'STP STATIONERY',
  theme_name: 'Theme principal',
  theme_description: '',
  imported_from: '',
  tokens_source: '',
  published_at: null,
};

const ThemeContext = createContext<{
  theme: ThemeSettings;
  refreshTheme: () => Promise<void>;
}>({
  theme: defaults,
  refreshTheme: async () => {},
});

function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement;
  root.style.setProperty('--vk-primary', theme.primary_color);
  root.style.setProperty('--vk-secondary', theme.secondary_color);
  root.style.setProperty('--vk-accent', theme.accent_color);
  root.style.setProperty('--vk-bg', theme.bg_color);
  root.style.setProperty('--vk-card', theme.card_color);
  root.style.setProperty('--vk-border', theme.border_color);
  root.style.setProperty('--vk-font-heading', theme.font_heading);
  root.style.setProperty('--vk-font-body', theme.font_body);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(defaults);

  const refreshTheme = async () => {
    try {
      const data = await api.get('/theme');
      const next = { ...defaults, ...(data?.theme || {}) };
      setTheme(next);
      applyTheme(next);
    } catch (error) {
      console.error('Theme load error:', error);
      setTheme(defaults);
      applyTheme(defaults);
    }
  };

  useEffect(() => {
    refreshTheme();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, refreshTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
