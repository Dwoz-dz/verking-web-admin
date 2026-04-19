import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  RotateCcw,
  Palette,
  Type,
  Sparkles,
  Download,
  Upload,
  Copy,
  CheckCircle2,
  Monitor,
  Smartphone,
  Paintbrush,
  Layout,
  BadgeCheck,
  Brush,
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';
import {
  normalizeBoolean,
  normalizeHexColor,
  normalizeSafeText,
} from '../../lib/textPipeline';

type TabKey =
  | 'brand'
  | 'colors'
  | 'typography'
  | 'buttons'
  | 'homepage'
  | 'presets'
  | 'import_export'
  | 'preview';

type ThemePreset = {
  id: string;
  name: string;
  created_at: string;
  theme: ThemePayload;
};

type ThemePayload = {
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
  theme_name: string;
  theme_description: string;
  imported_from: string;
  tokens_source: string;
  published_at: string | null;
};

const PRESETS_KEY = 'vk_theme_presets_v2';
const SNAPSHOT_KEY = 'vk_theme_last_published_v2';

const DEFAULT_THEME: ThemePayload = {
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

const TAB_ITEMS: Array<{ id: TabKey; label: string; icon: React.ElementType }> = [
  { id: 'brand', label: 'Brand identity', icon: BadgeCheck },
  { id: 'colors', label: 'Colors', icon: Palette },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'buttons', label: 'Buttons & UI', icon: Paintbrush },
  { id: 'homepage', label: 'Homepage style', icon: Layout },
  { id: 'presets', label: 'Theme presets', icon: Sparkles },
  { id: 'import_export', label: 'Import / Export', icon: Upload },
  { id: 'preview', label: 'Preview Lab', icon: Monitor },
];

const SCALE_OPTIONS: ThemePayload['type_scale'][] = ['compact', 'comfortable', 'spacious'];
const DENSITY_OPTIONS: ThemePayload['component_density'][] = ['compact', 'comfortable', 'spacious'];
const SHADOW_OPTIONS: ThemePayload['button_shadow'][] = ['none', 'soft', 'medium', 'strong'];
const LAYOUT_OPTIONS: ThemePayload['header_style'][] = ['classic', 'minimal', 'bold', 'immersive'];

function readPresets(): ThemePreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePresets(items: ThemePreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(items));
}

function readSnapshot(): ThemePayload | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return normalizeTheme(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeSnapshot(theme: ThemePayload) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(theme));
}

function normalizeTheme(raw: any): ThemePayload {
  const source = { ...DEFAULT_THEME, ...(raw || {}) };
  return {
    ...DEFAULT_THEME,
    ...source,
    primary_color: normalizeHexColor(source.primary_color, DEFAULT_THEME.primary_color),
    secondary_color: normalizeHexColor(source.secondary_color, DEFAULT_THEME.secondary_color),
    accent_color: normalizeHexColor(source.accent_color, DEFAULT_THEME.accent_color),
    bg_color: normalizeHexColor(source.bg_color, DEFAULT_THEME.bg_color),
    card_color: normalizeHexColor(source.card_color, DEFAULT_THEME.card_color),
    border_color: normalizeHexColor(source.border_color, DEFAULT_THEME.border_color),
    font_heading: normalizeSafeText(source.font_heading, DEFAULT_THEME.font_heading),
    font_body: normalizeSafeText(source.font_body, DEFAULT_THEME.font_body),
    type_scale: SCALE_OPTIONS.includes(source.type_scale) ? source.type_scale : DEFAULT_THEME.type_scale,
    button_radius: normalizeSafeText(source.button_radius, DEFAULT_THEME.button_radius),
    button_shadow: SHADOW_OPTIONS.includes(source.button_shadow) ? source.button_shadow : DEFAULT_THEME.button_shadow,
    component_density: DENSITY_OPTIONS.includes(source.component_density) ? source.component_density : DEFAULT_THEME.component_density,
    header_style: LAYOUT_OPTIONS.includes(source.header_style) ? source.header_style : DEFAULT_THEME.header_style,
    footer_style: LAYOUT_OPTIONS.includes(source.footer_style) ? source.footer_style : DEFAULT_THEME.footer_style,
    homepage_style: LAYOUT_OPTIONS.includes(source.homepage_style) ? source.homepage_style : DEFAULT_THEME.homepage_style,
    show_featured: normalizeBoolean(source.show_featured, true),
    show_new_arrivals: normalizeBoolean(source.show_new_arrivals, true),
    show_best_sellers: normalizeBoolean(source.show_best_sellers, true),
    show_wholesale_section: normalizeBoolean(source.show_wholesale_section, true),
    show_testimonials: normalizeBoolean(source.show_testimonials, true),
    logo_text: normalizeSafeText(source.logo_text, DEFAULT_THEME.logo_text),
    logo_subtitle: normalizeSafeText(source.logo_subtitle, DEFAULT_THEME.logo_subtitle),
    theme_name: normalizeSafeText(source.theme_name, DEFAULT_THEME.theme_name),
    theme_description: normalizeSafeText(source.theme_description, ''),
    imported_from: normalizeSafeText(source.imported_from, ''),
    tokens_source: normalizeSafeText(source.tokens_source, ''),
    published_at: source.published_at ? normalizeSafeText(source.published_at, '') : null,
  };
}

function applyThemeToDom(theme: ThemePayload) {
  const root = document.documentElement;
  root.style.setProperty('--vk-primary', theme.primary_color);
  root.style.setProperty('--vk-secondary', theme.secondary_color);
  root.style.setProperty('--vk-accent', theme.accent_color);
  root.style.setProperty('--vk-bg', theme.bg_color);
  root.style.setProperty('--vk-card', theme.card_color);
  root.style.setProperty('--vk-border', theme.border_color);
}

function parseCssVariables(raw: string) {
  const result: Record<string, string> = {};
  const regex = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null = regex.exec(raw);
  while (match) {
    result[match[1]] = match[2].trim();
    match = regex.exec(raw);
  }
  return result;
}

export function AdminTheme() {
  const { token } = useAuth();
  const { theme: currentTheme, refreshTheme } = useTheme();
  const { t } = useAdminUI();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cssInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('brand');
  const [publishing, setPublishing] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [presets, setPresets] = useState<ThemePreset[]>(() => readPresets());
  const [form, setForm] = useState<ThemePayload>(() => normalizeTheme(currentTheme));

  useEffect(() => {
    setForm((prev) => normalizeTheme({ ...prev, ...currentTheme }));
  }, [currentTheme]);

  useEffect(() => {
    applyThemeToDom(form);
  }, [form]);

  const setField = <K extends keyof ThemePayload>(key: K, value: ThemePayload[K]) => {
    setForm((prev) => normalizeTheme({ ...prev, [key]: value }));
  };

  const saveCurrentAsPreset = (nameFromUser?: string) => {
    const baseName = normalizeSafeText(nameFromUser || presetName, '');
    const name = baseName || `Theme ${new Date().toLocaleString('fr-FR')}`;
    const nextPreset: ThemePreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      created_at: new Date().toISOString(),
      theme: normalizeTheme(form),
    };
    const next = [nextPreset, ...presets].slice(0, 40);
    setPresets(next);
    writePresets(next);
    setPresetName('');
    toast.success('Preset sauvegardé.');
  };

  const duplicateCurrentTheme = () => {
    const duplicate = normalizeTheme({
      ...form,
      theme_name: `${form.theme_name || 'Theme'} (copy)`,
    });
    setForm(duplicate);
    toast.success('Thème dupliqué en mémoire.');
  };

  const publishTheme = async () => {
    if (!token) return;
    setPublishing(true);
    try {
      const previousSnapshot = normalizeTheme(currentTheme);
      writeSnapshot(previousSnapshot);
      const payload = normalizeTheme({
        ...form,
        published_at: new Date().toISOString(),
        rollback_available: true,
        last_snapshot: previousSnapshot,
      });
      await adminApi.put('/theme', payload, token);
      await refreshTheme();
      setForm(payload);
      toast.success('Thème publié.');
    } catch (error) {
      console.error(error);
      toast.error('Échec de publication du thème.');
    } finally {
      setPublishing(false);
    }
  };

  const rollbackTheme = async () => {
    if (!token) return;
    const snapshot = readSnapshot();
    if (!snapshot) {
      toast.error('Aucun snapshot précédent disponible.');
      return;
    }
    try {
      await adminApi.put('/theme', snapshot, token);
      await refreshTheme();
      setForm(snapshot);
      toast.success('Rollback appliqué.');
    } catch (error) {
      console.error(error);
      toast.error('Rollback impossible.');
    }
  };

  const applyPreset = (preset: ThemePreset) => {
    setForm(normalizeTheme(preset.theme));
    toast.success(`Preset "${preset.name}" appliqué.`);
  };

  const removePreset = (presetId: string) => {
    const next = presets.filter((item) => item.id !== presetId);
    setPresets(next);
    writePresets(next);
  };

  const exportThemeJson = () => {
    const payload = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      source: 'VERKING Theme Studio',
      theme: normalizeTheme(form),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `verking-theme-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importThemeJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = normalizeTheme(parsed?.theme || parsed?.tokens || parsed);
      setForm(payload);
      toast.success('Thème JSON importé.');
    } catch (error) {
      console.error(error);
      toast.error('Fichier JSON invalide.');
    }
  };

  const importCssVariables = async (file: File) => {
    try {
      const text = await file.text();
      const vars = parseCssVariables(text);
      const payload = normalizeTheme({
        ...form,
        primary_color: vars['vk-primary'] || vars['primary-color'] || form.primary_color,
        secondary_color: vars['vk-secondary'] || vars['secondary-color'] || form.secondary_color,
        accent_color: vars['vk-accent'] || vars['accent-color'] || form.accent_color,
        bg_color: vars['vk-bg'] || vars['background-color'] || form.bg_color,
        card_color: vars['vk-card'] || vars['card-color'] || form.card_color,
        border_color: vars['vk-border'] || vars['border-color'] || form.border_color,
        imported_from: file.name,
        tokens_source: 'css-variables',
      });
      setForm(payload);
      toast.success('Variables CSS importées.');
    } catch (error) {
      console.error(error);
      toast.error('Fichier CSS invalide.');
    }
  };

  const sortedPresets = useMemo(() => {
    return [...presets].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [presets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-black ${t.text}`}>Theme Studio</h1>
          <p className={`mt-1 text-sm ${t.textMuted}`}>
            Brand identity, design tokens, import/export et preview lab web + mobile.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={duplicateCurrentTheme}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
          >
            <Copy size={14} />
            Dupliquer
          </button>
          <button
            type="button"
            onClick={rollbackTheme}
            className="inline-flex items-center gap-1 rounded-xl border border-orange-200 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-50"
          >
            <RotateCcw size={14} />
            Rollback
          </button>
          <button
            type="button"
            onClick={publishTheme}
            disabled={publishing}
            className="inline-flex items-center gap-1 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            <Save size={14} />
            {publishing ? 'Publication...' : 'Publish theme'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <div className={`${t.card} ${t.cardBorder} rounded-2xl border p-3 shadow-sm`}>
          <div className="space-y-1">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {React.createElement(tab.icon, { size: 15 })}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`${t.card} ${t.cardBorder} rounded-2xl border p-5 shadow-sm`}>
          {activeTab === 'brand' && (
            <div className="space-y-4">
              <h2 className={`text-xl font-black ${t.text}`}>Brand identity</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <LabeledInput
                  label="Logo text"
                  value={form.logo_text}
                  onChange={(value) => setField('logo_text', normalizeSafeText(value, DEFAULT_THEME.logo_text))}
                />
                <LabeledInput
                  label="Logo subtitle"
                  value={form.logo_subtitle}
                  onChange={(value) => setField('logo_subtitle', normalizeSafeText(value, DEFAULT_THEME.logo_subtitle))}
                />
              </div>
              <LabeledInput
                label="Theme name"
                value={form.theme_name}
                onChange={(value) => setField('theme_name', normalizeSafeText(value, DEFAULT_THEME.theme_name))}
              />
              <LabeledTextarea
                label="Theme description"
                value={form.theme_description}
                onChange={(value) => setField('theme_description', normalizeSafeText(value, ''))}
              />
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center">
                <p className="text-xs font-semibold text-gray-500">Brand preview</p>
                <p className="mt-2 text-2xl font-black" style={{ color: form.primary_color }}>{form.logo_text}</p>
                <p className="text-xs font-black tracking-[0.2em]" style={{ color: form.accent_color }}>{form.logo_subtitle}</p>
              </div>
            </div>
          )}

          {activeTab === 'colors' && (
            <div className="space-y-4">
              <h2 className={`text-xl font-black ${t.text}`}>Colors</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <ColorField label="Primary" value={form.primary_color} onChange={(value) => setField('primary_color', value)} />
                <ColorField label="Secondary" value={form.secondary_color} onChange={(value) => setField('secondary_color', value)} />
                <ColorField label="Accent" value={form.accent_color} onChange={(value) => setField('accent_color', value)} />
                <ColorField label="Background" value={form.bg_color} onChange={(value) => setField('bg_color', value)} />
                <ColorField label="Card" value={form.card_color} onChange={(value) => setField('card_color', value)} />
                <ColorField label="Border" value={form.border_color} onChange={(value) => setField('border_color', value)} />
              </div>
            </div>
          )}

          {activeTab === 'typography' && (
            <div className="space-y-4">
              <h2 className={`text-xl font-black ${t.text}`}>Typography</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <LabeledInput
                  label="Heading font"
                  value={form.font_heading}
                  onChange={(value) => setField('font_heading', normalizeSafeText(value, 'Montserrat'))}
                />
                <LabeledInput
                  label="Body font"
                  value={form.font_body}
                  onChange={(value) => setField('font_body', normalizeSafeText(value, 'Inter'))}
                />
              </div>
              <label className="space-y-1 text-xs font-semibold text-gray-600">
                <span>Type scale</span>
                <select
                  value={form.type_scale}
                  onChange={(event) => setField('type_scale', event.target.value as ThemePayload['type_scale'])}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  {SCALE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {activeTab === 'buttons' && (
            <div className="space-y-4">
              <h2 className={`text-xl font-black ${t.text}`}>Buttons & UI</h2>
              <LabeledInput
                label="Button radius token"
                value={form.button_radius}
                onChange={(value) => setField('button_radius', normalizeSafeText(value, 'xl'))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold text-gray-600">
                  <span>Button shadow</span>
                  <select
                    value={form.button_shadow}
                    onChange={(event) => setField('button_shadow', event.target.value as ThemePayload['button_shadow'])}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  >
                    {SHADOW_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold text-gray-600">
                  <span>Component density</span>
                  <select
                    value={form.component_density}
                    onChange={(event) => setField('component_density', event.target.value as ThemePayload['component_density'])}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  >
                    {DENSITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'homepage' && (
            <div className="space-y-4">
              <h2 className={`text-xl font-black ${t.text}`}>Homepage style</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <SelectField
                  label="Header style"
                  value={form.header_style}
                  options={LAYOUT_OPTIONS}
                  onChange={(value) => setField('header_style', value as ThemePayload['header_style'])}
                />
                <SelectField
                  label="Footer style"
                  value={form.footer_style}
                  options={LAYOUT_OPTIONS}
                  onChange={(value) => setField('footer_style', value as ThemePayload['footer_style'])}
                />
                <SelectField
                  label="Homepage style"
                  value={form.homepage_style}
                  options={LAYOUT_OPTIONS}
                  onChange={(value) => setField('homepage_style', value as ThemePayload['homepage_style'])}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <ToggleField label="Show featured products" value={form.show_featured} onChange={(next) => setField('show_featured', next)} />
                <ToggleField label="Show new arrivals" value={form.show_new_arrivals} onChange={(next) => setField('show_new_arrivals', next)} />
                <ToggleField label="Show best sellers" value={form.show_best_sellers} onChange={(next) => setField('show_best_sellers', next)} />
                <ToggleField label="Show wholesale section" value={form.show_wholesale_section} onChange={(next) => setField('show_wholesale_section', next)} />
                <ToggleField label="Show testimonials" value={form.show_testimonials} onChange={(next) => setField('show_testimonials', next)} />
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="space-y-4">
              <h2 className={`text-xl font-black ${t.text}`}>Theme presets</h2>
              <div className="flex flex-wrap gap-2">
                <input
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder="Nom du preset"
                  className="min-w-[220px] rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => saveCurrentAsPreset()}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-black text-white"
                >
                  <CheckCircle2 size={14} />
                  Sauvegarder preset
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {sortedPresets.map((preset) => (
                  <div key={preset.id} className="rounded-2xl border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-gray-800">{preset.name}</p>
                        <p className="text-[11px] text-gray-500">
                          {new Date(preset.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => removePreset(preset.id)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <span className="h-6 w-6 rounded-full border border-gray-200" style={{ backgroundColor: preset.theme.primary_color }} />
                      <span className="h-6 w-6 rounded-full border border-gray-200" style={{ backgroundColor: preset.theme.secondary_color }} />
                      <span className="h-6 w-6 rounded-full border border-gray-200" style={{ backgroundColor: preset.theme.accent_color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'import_export' && (
            <div className="space-y-4">
              <h2 className={`text-xl font-black ${t.text}`}>Import / Export</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 p-4">
                  <p className="text-sm font-black text-gray-800">Import JSON / tokens</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Compatible JSON: theme object, tokens object, exported payload.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
                  >
                    <Upload size={14} />
                    Import JSON
                  </button>
                </div>

                <div className="rounded-2xl border border-gray-200 p-4">
                  <p className="text-sm font-black text-gray-800">Import CSS variables</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Parse automatiquement --vk-* ou équivalents.
                  </p>
                  <button
                    type="button"
                    onClick={() => cssInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
                  >
                    <Brush size={14} />
                    Import CSS
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={exportThemeJson}
                className="inline-flex items-center gap-1 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-black text-white"
              >
                <Download size={14} />
                Export theme JSON
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) importThemeJson(file);
                  event.target.value = '';
                }}
              />
              <input
                ref={cssInputRef}
                type="file"
                accept=".css,text/css"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) importCssVariables(file);
                  event.target.value = '';
                }}
              />
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-black ${t.text}`}>Preview Lab</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`rounded-lg p-2 ${previewDevice === 'desktop' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    <Monitor size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`rounded-lg p-2 ${previewDevice === 'mobile' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    <Smartphone size={16} />
                  </button>
                </div>
              </div>

              <div className={`mx-auto overflow-hidden rounded-2xl border border-gray-200 ${previewDevice === 'mobile' ? 'max-w-[360px]' : ''}`}>
                <div style={{ backgroundColor: form.bg_color }}>
                  <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: form.primary_color }}>
                    <div>
                      <p className="text-sm font-black">{form.logo_text}</p>
                      <p className="text-[10px] font-bold tracking-wider opacity-80">{form.logo_subtitle}</p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-[10px] font-black" style={{ backgroundColor: form.accent_color }}>
                      CTA
                    </span>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="rounded-xl p-4 text-white" style={{ backgroundColor: form.secondary_color }}>
                      <p className="text-lg font-black">Hero banner preview</p>
                      <p className="text-xs opacity-90">Desktop / mobile storefront section</p>
                    </div>
                    <div
                      className="rounded-xl border p-4"
                      style={{
                        backgroundColor: form.card_color,
                        borderColor: form.border_color,
                      }}
                    >
                      <p className="text-sm font-black" style={{ color: form.primary_color }}>Product card</p>
                      <p className="text-xs text-gray-600">Component density: {form.component_density}</p>
                      <button
                        type="button"
                        className="mt-3 rounded-full px-4 py-2 text-xs font-black text-white"
                        style={{ backgroundColor: form.accent_color }}
                      >
                        Ajouter au panier
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-300 focus:outline-none"
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-300 focus:outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold ${
        value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-gray-100 text-gray-600'
      }`}
    >
      <span>{label}</span>
      <span>{value ? 'ON' : 'OFF'}</span>
    </button>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 rounded-xl border border-gray-200 p-3 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-8 w-10 rounded border border-gray-200"
        />
        <input
          value={value}
          onChange={(event) => onChange(normalizeHexColor(event.target.value, value))}
          className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-700"
        />
      </div>
    </label>
  );
}
