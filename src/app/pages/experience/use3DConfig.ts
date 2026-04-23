import { useCallback, useEffect, useState } from 'react';
import { adminApi, api } from '../../lib/api';

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
  showroom_background_url: string;
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

type ConfigSource = 'default' | 'local' | 'backend';

export const DEFAULT_CONFIG: Config3D = {
  brand_title: 'VERKING',
  brand_subtitle: 'S.T.P Stationery',
  showroom_background_url: '',
  primary_color: '#E5252A',
  secondary_color: '#FFD700',
  accent_color: '#1D4ED8',
  floor_color: '#1A2033',
  wall_color: '#2F385D',
  fog_color: '#111827',
  fog_near: 24,
  fog_far: 58,
  ambient_intensity: 0.72,
  show_particles: true,
  waypoints: [
    {
      id: 'entrance',
      label_fr: 'Entree',
      label_ar: '\u0627\u0644\u0645\u062f\u062e\u0644',
      position: [0, 1.72, 10.8],
      lookAt: [0, 2.3, 2.2],
    },
    {
      id: 'cartables',
      label_fr: 'Cartables',
      label_ar: '\u0627\u0644\u0643\u0631\u0637\u0627\u0628\u0644',
      position: [-7.6, 1.72, 2.6],
      lookAt: [-12.8, 2.9, 0.8],
    },
    {
      id: 'trousses',
      label_fr: 'Trousses',
      label_ar: '\u0627\u0644\u0645\u0642\u0644\u0645\u0627\u062a',
      position: [7.6, 1.72, 2.6],
      lookAt: [12.8, 2.9, 0.8],
    },
    {
      id: 'center',
      label_fr: 'Nouveautes',
      label_ar: '\u0627\u0644\u062c\u062f\u064a\u062f',
      position: [0, 1.72, 1.4],
      lookAt: [0, 2.8, -3.8],
    },
    {
      id: 'back',
      label_fr: 'Fond du magasin',
      label_ar: '\u0639\u0645\u0642 \u0627\u0644\u0645\u062d\u0644',
      position: [0, 1.72, -6.8],
      lookAt: [0, 2.7, -11.5],
    },
  ],
  section_label_cartables_fr: 'Cartables & Sacs',
  section_label_cartables_ar: '\u0643\u0631\u0637\u0627\u0628\u0644 \u0648 \u0634\u0646\u0637',
  section_label_trousses_fr: 'Trousses & Stylos',
  section_label_trousses_ar: '\u0645\u0642\u0644\u0645\u0627\u062a \u0648 \u0627\u0642\u0644\u0627\u0645',
  section_label_center_fr: 'Nouveautes',
  section_label_center_ar: '\u0627\u0644\u062c\u062f\u064a\u062f',
};

const STORAGE_KEY = 'verking_3d_config';
const FALLBACK_WAYPOINT = DEFAULT_CONFIG.waypoints[0];

function parseNumber(value: unknown, fallback: number, min?: number, max?: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (typeof min === 'number' && parsed < min) return min;
  if (typeof max === 'number' && parsed > max) return max;
  return parsed;
}

function normalizePoint3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (Array.isArray(value)) {
    return [
      parseNumber(value[0], fallback[0]),
      parseNumber(value[1], fallback[1], 1.2, 3.2),
      parseNumber(value[2], fallback[2]),
    ];
  }

  if (typeof value === 'string') {
    const parts = value.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length >= 3) {
      return [
        parseNumber(parts[0], fallback[0]),
        parseNumber(parts[1], fallback[1], 1.2, 3.2),
        parseNumber(parts[2], fallback[2]),
      ];
    }
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    if (source.x !== undefined && source.y !== undefined && source.z !== undefined) {
      return [
        parseNumber(source.x, fallback[0]),
        parseNumber(source.y, fallback[1], 1.2, 3.2),
        parseNumber(source.z, fallback[2]),
      ];
    }
  }

  return [...fallback] as [number, number, number];
}

function normalizeWaypoint(raw: unknown, index: number): Waypoint {
  const source = raw && typeof raw === 'object' ? (raw as Partial<Waypoint>) : {};
  const fallback = DEFAULT_CONFIG.waypoints[index] || FALLBACK_WAYPOINT;
  const id = typeof source.id === 'string' && source.id.trim()
    ? source.id.trim()
    : `waypoint-${index + 1}`;

  return {
    id,
    label_fr: typeof source.label_fr === 'string' && source.label_fr.trim()
      ? source.label_fr
      : fallback.label_fr,
    label_ar: typeof source.label_ar === 'string' && source.label_ar.trim()
      ? source.label_ar
      : fallback.label_ar,
    position: normalizePoint3(source.position, fallback.position),
    lookAt: normalizePoint3(source.lookAt, fallback.lookAt),
  };
}

function normalizeWaypoints(raw: unknown): Waypoint[] {
  if (!Array.isArray(raw)) {
    return DEFAULT_CONFIG.waypoints.map((waypoint, index) => normalizeWaypoint(waypoint, index));
  }
  const normalized = raw.map((item, index) => normalizeWaypoint(item, index));
  return normalized.length > 0 ? normalized : DEFAULT_CONFIG.waypoints;
}

export function normalize3DConfig(raw: unknown): Config3D {
  const source = raw && typeof raw === 'object' ? (raw as Partial<Config3D>) : {};
  return {
    ...DEFAULT_CONFIG,
    ...source,
    brand_title: typeof source.brand_title === 'string' && source.brand_title.trim()
      ? source.brand_title
      : DEFAULT_CONFIG.brand_title,
    brand_subtitle: typeof source.brand_subtitle === 'string' && source.brand_subtitle.trim()
      ? source.brand_subtitle
      : DEFAULT_CONFIG.brand_subtitle,
    showroom_background_url: typeof source.showroom_background_url === 'string'
      ? source.showroom_background_url.trim()
      : DEFAULT_CONFIG.showroom_background_url,
    primary_color: typeof source.primary_color === 'string' && source.primary_color.trim()
      ? source.primary_color
      : DEFAULT_CONFIG.primary_color,
    secondary_color: typeof source.secondary_color === 'string' && source.secondary_color.trim()
      ? source.secondary_color
      : DEFAULT_CONFIG.secondary_color,
    accent_color: typeof source.accent_color === 'string' && source.accent_color.trim()
      ? source.accent_color
      : DEFAULT_CONFIG.accent_color,
    floor_color: typeof source.floor_color === 'string' && source.floor_color.trim()
      ? source.floor_color
      : DEFAULT_CONFIG.floor_color,
    wall_color: typeof source.wall_color === 'string' && source.wall_color.trim()
      ? source.wall_color
      : DEFAULT_CONFIG.wall_color,
    fog_color: typeof source.fog_color === 'string' && source.fog_color.trim()
      ? source.fog_color
      : DEFAULT_CONFIG.fog_color,
    fog_near: parseNumber(source.fog_near, DEFAULT_CONFIG.fog_near, 8, 80),
    fog_far: parseNumber(source.fog_far, DEFAULT_CONFIG.fog_far, 18, 120),
    ambient_intensity: parseNumber(source.ambient_intensity, DEFAULT_CONFIG.ambient_intensity, 0.25, 1.5),
    show_particles: typeof source.show_particles === 'boolean'
      ? source.show_particles
      : DEFAULT_CONFIG.show_particles,
    waypoints: normalizeWaypoints(source.waypoints),
    section_label_cartables_fr: typeof source.section_label_cartables_fr === 'string' && source.section_label_cartables_fr.trim()
      ? source.section_label_cartables_fr
      : DEFAULT_CONFIG.section_label_cartables_fr,
    section_label_cartables_ar: typeof source.section_label_cartables_ar === 'string' && source.section_label_cartables_ar.trim()
      ? source.section_label_cartables_ar
      : DEFAULT_CONFIG.section_label_cartables_ar,
    section_label_trousses_fr: typeof source.section_label_trousses_fr === 'string' && source.section_label_trousses_fr.trim()
      ? source.section_label_trousses_fr
      : DEFAULT_CONFIG.section_label_trousses_fr,
    section_label_trousses_ar: typeof source.section_label_trousses_ar === 'string' && source.section_label_trousses_ar.trim()
      ? source.section_label_trousses_ar
      : DEFAULT_CONFIG.section_label_trousses_ar,
    section_label_center_fr: typeof source.section_label_center_fr === 'string' && source.section_label_center_fr.trim()
      ? source.section_label_center_fr
      : DEFAULT_CONFIG.section_label_center_fr,
    section_label_center_ar: typeof source.section_label_center_ar === 'string' && source.section_label_center_ar.trim()
      ? source.section_label_center_ar
      : DEFAULT_CONFIG.section_label_center_ar,
  };
}

function readLocalConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize3DConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persistLocalConfig(config: Config3D) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore local persistence errors
  }
}

export function use3DConfig() {
  const [config, setConfigState] = useState<Config3D>(DEFAULT_CONFIG);
  const [source, setSource] = useState<ConfigSource>('default');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadRemoteConfig = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const data = await api.get('/3d-config');
      const next = normalize3DConfig(data?.config ?? data);
      setConfigState(next);
      setSource('backend');
      persistLocalConfig(next);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load 3D config';
      setSyncError(message);
      const localFallback = readLocalConfig();
      if (localFallback) {
        setConfigState(localFallback);
        setSource('local');
        return localFallback;
      }
      setConfigState(DEFAULT_CONFIG);
      setSource('default');
      return DEFAULT_CONFIG;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const localInitial = readLocalConfig();
    if (localInitial) {
      setConfigState(localInitial);
      setSource('local');
    }
    void loadRemoteConfig();
  }, [loadRemoteConfig]);

  const setConfig = useCallback((updater: Partial<Config3D> | ((prev: Config3D) => Config3D)) => {
    setConfigState((prev) => {
      const candidate = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      const next = normalize3DConfig(candidate);
      persistLocalConfig(next);
      return next;
    });
    setSource('local');
  }, []);

  const resetConfig = useCallback(() => {
    const next = normalize3DConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setConfigState(next);
    setSource('default');
    setSyncError(null);
    return next;
  }, []);

  const saveRemoteConfig = useCallback(async (token: string, overrideConfig?: Config3D) => {
    if (!token) throw new Error('Missing admin token');
    setIsSyncing(true);
    setSyncError(null);
    try {
      const payload = normalize3DConfig(overrideConfig ?? config);
      const data = await adminApi.put('/3d-config', payload, token);
      const persisted = normalize3DConfig(data?.config ?? payload);
      setConfigState(persisted);
      setSource('backend');
      persistLocalConfig(persisted);
      return persisted;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save 3D config';
      setSyncError(message);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [config]);

  return {
    config,
    setConfig,
    resetConfig,
    loadRemoteConfig,
    saveRemoteConfig,
    source,
    isSyncing,
    syncError,
  };
}
