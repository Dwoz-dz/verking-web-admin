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

  // Type scale — drives base font-size globally.
  const typeScaleMap: Record<string, string> = {
    compact: '15px',
    comfortable: '16px',
    spacious: '17px',
  };
  root.style.setProperty('--vk-font-size', typeScaleMap[theme.type_scale] || '16px');

  // Button shadow — consumed by buttons via var(--vk-btn-shadow).
  const shadowMap: Record<string, string> = {
    none: 'none',
    soft: '0 2px 6px rgba(0,0,0,.06)',
    medium: '0 10px 24px -10px rgba(0,0,0,.18)',
    strong: '0 18px 40px -14px rgba(0,0,0,.28)',
  };
  root.style.setProperty('--vk-btn-shadow', shadowMap[theme.button_shadow] || shadowMap.medium);

  // Density — controls padding rhythm across cards/rows.
  const densityMap: Record<string, string> = {
    compact: '0.75rem',
    comfortable: '1rem',
    spacious: '1.5rem',
  };
  root.style.setProperty('--vk-density', densityMap[theme.component_density] || densityMap.comfortable);

  // Radius family — shared with Tailwind via class utilities.
  root.style.setProperty('--vk-radius', {
    none: '0',
    sm: '.375rem',
    md: '.75rem',
    lg: '1rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '2rem',
  }[theme.button_radius as string] || '1.25rem');

  // Expose layout styles as data attributes so CSS can branch.
  root.setAttribute('data-vk-header', theme.header_style);
  root.setAttribute('data-vk-footer', theme.footer_style);
  root.setAttribute('data-vk-home', theme.homepage_style);

  // Section-level toggles exposed for any component that needs to gate itself.
  root.setAttribute('data-vk-show-featured', String(theme.show_featured));
  root.setAttribute('data-vk-show-new', String(theme.show_new_arrivals));
  root.setAttribute('data-vk-show-best', String(theme.show_best_sellers));
  root.setAttribute('data-vk-show-wholesale', String(theme.show_wholesale_section));
  root.setAttribute('data-vk-show-testimonials', String(theme.show_testimonials));
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
