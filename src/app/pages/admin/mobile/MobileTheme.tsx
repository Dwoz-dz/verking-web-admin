/**
 * MobileTheme — editable color + style settings for the Expo app.
 *
 * Reads mobile_theme.default on mount, lets the admin tweak colors via
 * native color pickers (or freeform hex input), then saves through the
 * `admin-mobile-config/theme` edge function.
 *
 * The defaults shown in placeholders match `constants/theme.ts` in the
 * mobile app — leaving a field empty falls back to that value at runtime.
 */
import { useEffect, useState } from 'react';
import { Loader2, Palette, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { useAdminUI } from '../../../context/AdminUIContext';
import { supabaseClient } from '../../../lib/supabaseClient';
import { saveMobileTheme, type MobileThemePatch } from '../../../lib/adminMobileApi';
import { MediaField } from '../../../components/MediaField';

interface ThemeRow {
  primary_color: string | null;
  cta_color: string | null;
  background_color: string | null;
  card_radius: number | null;
  badges_style: string | null;
  glass_mode: boolean | null;
  // Phase 12 — premium background + tab bar style
  background_image_url: string | null;
  background_video_url: string | null;
  overlay_opacity: number | null;
  blur_amount: number | null;
  tab_bar_style: string | null;
}

const DEFAULTS = {
  primary_color: '#2D7DD2',
  cta_color: '#FF7A1A',
  background_color: '#F9F9FC',
  card_radius: 20,
  badges_style: 'pill',
  glass_mode: true,
  overlay_opacity: 40,
  blur_amount: 8,
  tab_bar_style: 'floating',
};

export function MobileTheme() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ThemeRow>({
    primary_color: null, cta_color: null, background_color: null,
    card_radius: null, badges_style: null, glass_mode: null,
    background_image_url: null, background_video_url: null,
    overlay_opacity: null, blur_amount: null, tab_bar_style: null,
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('mobile_theme')
        .select('primary_color,cta_color,background_color,card_radius,badges_style,glass_mode,background_image_url,background_video_url,overlay_opacity,blur_amount,tab_bar_style')
        .eq('id', 'default')
        .maybeSingle();
      if (error) throw error;
      if (data) setForm(data as ThemeRow);
    } catch (err) {
      console.error('[mobile-theme] load failed:', err);
      toast.error('Impossible de charger le thème mobile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const setField = <K extends keyof ThemeRow>(key: K, value: ThemeRow[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const patch: MobileThemePatch = {
        primary_color: form.primary_color || null,
        cta_color: form.cta_color || null,
        background_color: form.background_color || null,
        card_radius: form.card_radius,
        badges_style: form.badges_style || null,
        glass_mode: form.glass_mode,
        // Phase 12 — premium background + tab bar style
        background_image_url: form.background_image_url || null,
        background_video_url: form.background_video_url || null,
        overlay_opacity: form.overlay_opacity,
        blur_amount: form.blur_amount,
        tab_bar_style: form.tab_bar_style || null,
      } as MobileThemePatch & {
        background_image_url: string | null;
        background_video_url: string | null;
        overlay_opacity: number | null;
        blur_amount: number | null;
        tab_bar_style: string | null;
      };
      await saveMobileTheme(patch, token);
      toast.success('Thème mobile enregistré.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec enregistrement.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onResetDefaults = () => {
    setForm({
      primary_color: null, cta_color: null, background_color: null,
      card_radius: null, badges_style: null, glass_mode: null,
      background_image_url: null, background_video_url: null,
      overlay_opacity: null, blur_amount: null, tab_bar_style: null,
    });
  };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="animate-spin text-blue-700" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between rounded-2xl border ${t.cardBorder} ${t.card} p-4`}>
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-purple-700" />
          <h2 className={`text-sm font-black ${t.text}`}>Thème de l&apos;app mobile</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetDefaults}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw size={13} /> Tout réinitialiser
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
            {saving ? 'Enregistrement…' : 'Publier'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ColorField label="Couleur primaire (blue trust)"
          value={form.primary_color}
          fallback={DEFAULTS.primary_color}
          onChange={(v) => setField('primary_color', v)}
        />
        <ColorField label="Couleur CTA (orange action)"
          value={form.cta_color}
          fallback={DEFAULTS.cta_color}
          onChange={(v) => setField('cta_color', v)}
        />
        <ColorField label="Fond"
          value={form.background_color}
          fallback={DEFAULTS.background_color}
          onChange={(v) => setField('background_color', v)}
        />
        <NumberField label="Rayon des cartes (px)"
          value={form.card_radius}
          fallback={DEFAULTS.card_radius}
          onChange={(v) => setField('card_radius', v)}
        />
        <SelectField label="Style des badges"
          value={form.badges_style}
          options={[
            { value: 'pill', label: 'Pill (arrondi total)' },
            { value: 'rounded', label: 'Rounded (8px)' },
            { value: 'square', label: 'Square (sharp)' },
          ]}
          fallback={DEFAULTS.badges_style}
          onChange={(v) => setField('badges_style', v)}
        />
        <BoolField label="Mode glass (transparence)"
          value={form.glass_mode}
          fallback={DEFAULTS.glass_mode}
          onChange={(v) => setField('glass_mode', v)}
        />
      </div>

      {/* Phase 12 — Premium app background */}
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 space-y-4`}>
        <div className="flex items-center gap-2">
          <Palette size={14} className="text-orange-600" />
          <h3 className={`text-sm font-black ${t.text}`}>Arrière-plan premium (image / vidéo)</h3>
        </div>
        <p className={`text-xs ${t.textMuted}`}>
          Image affichée derrière toute la home mobile. La vidéo est lue
          uniquement en Wi-Fi (et seulement si le mode économie de données
          est désactivé) — sinon on retombe sur l&apos;image, puis sur la
          couleur de fond.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <MediaField
            label="Image de fond"
            kind="image"
            module="theme"
            value={form.background_image_url ?? ''}
            onChange={(url) => setField('background_image_url', url)}
            helper="Format vertical conseillé. Vide = couleur de fond unie."
          />
          <MediaField
            label="Vidéo de fond (optionnelle)"
            kind="video"
            module="theme"
            value={form.background_video_url ?? ''}
            onChange={(url) => setField('background_video_url', url)}
            helper="MP4 ≤ 15 MB. Boucle muette, lue uniquement en Wi-Fi."
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <SliderField
            label="Opacité du voile (overlay)"
            value={form.overlay_opacity}
            fallback={DEFAULTS.overlay_opacity}
            min={0} max={100} suffix="%"
            onChange={(v) => setField('overlay_opacity', v)}
          />
          <SliderField
            label="Flou (blur)"
            value={form.blur_amount}
            fallback={DEFAULTS.blur_amount}
            min={0} max={20} suffix="px"
            onChange={(v) => setField('blur_amount', v)}
          />
          <SelectField
            label="Style de la barre d&apos;onglets"
            value={form.tab_bar_style}
            options={[
              { value: 'floating', label: 'Floating (glass pill)' },
              { value: 'flat',     label: 'Flat (full width)' },
              { value: 'minimal',  label: 'Minimal (icons only)' },
            ]}
            fallback={DEFAULTS.tab_bar_style}
            onChange={(v) => setField('tab_bar_style', v)}
          />
        </div>
      </div>

      <div className={`rounded-2xl border border-blue-200 bg-blue-50/40 p-4 text-xs ${t.text}`}>
        <strong className="text-blue-700">Astuce :</strong> Une cellule vide
        signifie « utiliser la valeur définie dans <code>constants/theme.ts</code> ».
        Les changements sont visibles dans l&apos;app dès la prochaine ouverture (ou
        après pull-to-refresh).
      </div>
    </div>
  );
}

function SliderField({
  label, value, fallback, min, max, suffix, onChange,
}: {
  label: string; value: number | null; fallback: number;
  min: number; max: number; suffix?: string;
  onChange: (v: number | null) => void;
}) {
  const display = value ?? fallback;
  return (
    <div className="rounded-2xl border border-gray-200 p-4 bg-white">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={display}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-blue-700"
        />
        <span className="w-14 rounded-lg bg-gray-100 px-2 py-1 text-right text-xs font-mono">
          {display}{suffix ?? ''}
        </span>
      </div>
      {value === null && (
        <p className="text-[10px] text-gray-500 italic mt-1.5">
          Vide = utilisera {fallback}{suffix ?? ''}
        </p>
      )}
    </div>
  );
}

function ColorField({
  label, value, fallback, onChange,
}: { label: string; value: string | null; fallback: string; onChange: (v: string | null) => void }) {
  const display = value || fallback;
  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(display);
  return (
    <div className="rounded-2xl border border-gray-200 p-4 bg-white">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="color"
          value={isHex ? display : fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-12 rounded-xl border border-gray-200 cursor-pointer"
        />
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={fallback}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
        />
      </div>
      {!value && (
        <p className="text-[10px] text-gray-500 italic mt-1.5">Vide = utilisera {fallback}</p>
      )}
    </div>
  );
}

function NumberField({
  label, value, fallback, onChange,
}: { label: string; value: number | null; fallback: number; onChange: (v: number | null) => void }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 bg-white">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        placeholder={String(fallback)}
        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
      />
      {value === null && (
        <p className="text-[10px] text-gray-500 italic mt-1.5">Vide = utilisera {fallback}</p>
      )}
    </div>
  );
}

function SelectField({
  label, value, options, fallback, onChange,
}: {
  label: string; value: string | null;
  options: { value: string; label: string }[];
  fallback: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 bg-white">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
      >
        <option value="">— Par défaut ({fallback})</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function BoolField({
  label, value, fallback, onChange,
}: { label: string; value: boolean | null; fallback: boolean; onChange: (v: boolean | null) => void }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 bg-white">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${
            value === true ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          Activé
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${
            value === false ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          Désactivé
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-xl border px-3 py-2 text-xs font-bold ${
            value === null ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
          title="Utiliser la valeur par défaut"
        >
          Auto ({fallback ? 'on' : 'off'})
        </button>
      </div>
    </div>
  );
}

export default MobileTheme;
