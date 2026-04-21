import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Waypoint {
  id: string;
  label_fr: string;
  label_ar: string;
  position: [number, number, number];
  lookAt: [number, number, number];
}

export interface Config3D {
  brand_title: string;
  brand_subtitle: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  floor_color: string;
  wall_color: string;
  fog_color: string;
  fog_near: number;
  fog_far: number;
  ambient_intensity: number;
  show_particles: boolean;
  waypoints: Waypoint[];
  section_label_cartables_fr: string;
  section_label_cartables_ar: string;
  section_label_trousses_fr: string;
  section_label_trousses_ar: string;
  section_label_center_fr: string;
  section_label_center_ar: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: Config3D = {
  brand_title: 'VERKING',
  brand_subtitle: 'S.T.P Stationery',
  primary_color: '#E5252A',
  secondary_color: '#FFD700',
  accent_color: '#1D4ED8',
  floor_color: '#1a1c2e',
  wall_color: '#12141f',
  fog_color: '#0a0c18',
  fog_near: 14,
  fog_far: 36,
  ambient_intensity: 0.35,
  show_particles: true,
  waypoints: [
    {
      id: 'entrance',
      label_fr: 'Entrée',
      label_ar: 'المدخل',
      position: [0, 1.7, 9],
      lookAt: [0, 1.5, 0],
    },
    {
      id: 'cartables',
      label_fr: 'Cartables',
      label_ar: 'الكرطابل',
      position: [-7, 1.7, 2],
      lookAt: [-12, 1.4, 2],
    },
    {
      id: 'trousses',
      label_fr: 'Trousses',
      label_ar: 'المقلمات',
      position: [7, 1.7, 2],
      lookAt: [12, 1.4, 2],
    },
    {
      id: 'center',
      label_fr: 'Nouveautés',
      label_ar: 'الجديد',
      position: [0, 1.7, 0],
      lookAt: [0, 1.4, -8],
    },
    {
      id: 'back',
      label_fr: 'Fond du magasin',
      label_ar: 'عمق المحل',
      position: [0, 1.7, -7],
      lookAt: [0, 1.5, -13],
    },
  ],
  section_label_cartables_fr: 'Cartables & Sacs',
  section_label_cartables_ar: 'كرطابل وشنط',
  section_label_trousses_fr: 'Trousses & Stylos',
  section_label_trousses_ar: 'مقلمات وأقلام',
  section_label_center_fr: 'Nouveautés',
  section_label_center_ar: 'الجديد',
};

const STORAGE_KEY = 'verking_3d_config';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function use3DConfig() {
  const [config, setConfigState] = useState<Config3D>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Config3D>;
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_CONFIG;
  });

  const setConfig = useCallback((updater: Partial<Config3D> | ((prev: Config3D) => Config3D)) => {
    setConfigState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setConfigState(DEFAULT_CONFIG);
  }, []);

  return { config, setConfig, resetConfig };
}
