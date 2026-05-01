/**
 * MobileComingSoonManager — admin editor for `mobile_coming_soon_config`.
 *
 * Single-row config (id='default') that drives the placeholder cards
 * + countdown banner shown on every empty/under-stocked rail in the
 * mobile app. Marketing can:
 *   ▸ Toggle the whole feature on/off
 *   ▸ Edit the title/emoji pools used by ComingSoonCard
 *   ▸ Set a launch date for the live countdown banner
 *   ▸ Enable/disable the "🔔 Préviens-moi" CTA
 *   ▸ Change the minimum slot count per rail
 *
 * Saves are atomic — one upsert hits the single 'default' row.
 */
import { useEffect, useState } from 'react';
import { Loader2, Rocket, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  getComingSoonConfig,
  upsertComingSoonConfig,
  type ComingSoonConfigRow,
  type ComingSoonConfigPatch,
} from '../../../lib/adminMobileApi';

const DEFAULT: ComingSoonConfigRow = {
  id: 'default',
  enabled: true,
  banner_text_fr: null,
  banner_text_ar: null,
  banner_emoji: '🚀',
  expected_launch_date: null,
  pool_titles_fr: [],
  pool_titles_ar: [],
  pool_emojis: ['📦', '🚀', '🎁', '⭐', '✨', '🎉', '🆕', '💝'],
  show_notify_cta: true,
  min_grid_slots: 8,
  category_overrides: {},
  updated_at: new Date().toISOString(),
};

export function MobileComingSoonManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [config, setConfig] = useState<ComingSoonConfigRow>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Local string buffers for the array fields (one item per line, easier to edit).
  const [titlesFrText, setTitlesFrText] = useState('');
  const [titlesArText, setTitlesArText] = useState('');
  const [emojisText, setEmojisText] = useState('');

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const fresh = await getComingSoonConfig(token);
        if (fresh) {
          setConfig(fresh);
          setTitlesFrText((fresh.pool_titles_fr ?? []).join('\n'));
          setTitlesArText((fresh.pool_titles_ar ?? []).join('\n'));
          setEmojisText((fresh.pool_emojis ?? []).join(' '));
        }
      } catch (err) {
        console.error('[coming-soon] load failed:', err);
        toast.error('Impossible de charger la configuration.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const update = <K extends keyof ComingSoonConfigRow>(key: K, value: ComingSoonConfigRow[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const patch: ComingSoonConfigPatch = {
        enabled: config.enabled,
        banner_text_fr: config.banner_text_fr,
        banner_text_ar: config.banner_text_ar,
        banner_emoji: config.banner_emoji,
        expected_launch_date: config.expected_launch_date,
        pool_titles_fr: titlesFrText
          .split('\n').map((s) => s.trim()).filter(Boolean),
        pool_titles_ar: titlesArText
          .split('\n').map((s) => s.trim()).filter(Boolean),
        pool_emojis: emojisText
          .split(/\s+/).map((s) => s.trim()).filter(Boolean),
        show_notify_cta: config.show_notify_cta,
        min_grid_slots: config.min_grid_slots,
      };
      await upsertComingSoonConfig(patch, token);
      toast.success('Configuration enregistrée.');
      setDirty(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Échec de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  if (!token) return <p className={t.textMuted}>Token admin requis.</p>;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className={`text-xl font-black ${t.text}`}>🚀 Coming Soon Cards</h2>
          <p className={`text-sm ${t.textMuted}`}>
            Configurez les placeholders affichés à la place des produits manquants dans l'app.
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={saving || !dirty}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-black text-white shadow-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
          type="button"
        >
          <Save size={14} className="inline-block mr-1" />
          {saving ? 'Enregistrement…' : dirty ? 'Enregistrer' : 'Enregistré'}
        </button>
      </div>

      {/* Master toggle */}
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4`}>
        <label className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className={`font-bold ${t.text}`}>Activer le système</p>
            <p className={`text-sm ${t.textMuted}`}>
              Quand désactivé, les rails vides restent vides au lieu d'afficher des placeholders.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
            className="h-5 w-10 cursor-pointer appearance-none rounded-full bg-slate-300 transition checked:bg-emerald-500"
          />
        </label>
      </div>

      {/* Banner config */}
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-violet-600" />
          <h3 className={`font-black ${t.text}`}>Bannière "Bientôt"</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Emoji bannière">
            <input
              value={config.banner_emoji}
              onChange={(e) => update('banner_emoji', e.target.value)}
              maxLength={4}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-2xl outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </Field>
          <Field label="Date de lancement (optionnel)">
            <input
              type="date"
              value={config.expected_launch_date ?? ''}
              onChange={(e) => update('expected_launch_date', e.target.value || null)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Si renseigné, la bannière affiche un compte à rebours.
            </p>
          </Field>
          <Field label="Slots minimum par rail">
            <input
              type="number"
              min={0}
              max={20}
              value={config.min_grid_slots}
              onChange={(e) => update('min_grid_slots', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Texte bannière (FR)">
            <input
              value={config.banner_text_fr ?? ''}
              onChange={(e) => update('banner_text_fr', e.target.value || null)}
              placeholder="Nouveaux produits en route !"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </Field>
          <Field label="Texte bannière (AR)">
            <input
              value={config.banner_text_ar ?? ''}
              onChange={(e) => update('banner_text_ar', e.target.value || null)}
              placeholder="منتجات جديدة في الطريق!"
              dir="rtl"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </Field>
        </div>
      </div>

      {/* Pool config */}
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 space-y-3`}>
        <h3 className={`font-black ${t.text}`}>📚 Pool de messages</h3>
        <p className={`text-sm ${t.textMuted}`}>
          Un message par ligne. Les placeholders piochent dedans de manière déterministe
          pour éviter le scintillement entre les re-renders.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Titres FR (un par ligne)">
            <textarea
              value={titlesFrText}
              onChange={(e) => { setTitlesFrText(e.target.value); setDirty(true); }}
              rows={6}
              placeholder={'Bientôt là\nNouveauté qui arrive\nSurprise s\'approche'}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </Field>
          <Field label="Titres AR (un par ligne)">
            <textarea
              value={titlesArText}
              onChange={(e) => { setTitlesArText(e.target.value); setDirty(true); }}
              rows={6}
              placeholder={'قريباً هنا\nمفاجأة قادمة\nجديد قريباً'}
              dir="rtl"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </Field>
        </div>

        <Field label="Emojis (séparés par espaces)">
          <input
            value={emojisText}
            onChange={(e) => { setEmojisText(e.target.value); setDirty(true); }}
            placeholder="📦 🚀 🎁 ⭐ ✨ 🎉 🆕 💝"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-2xl outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </Field>

        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.show_notify_cta}
            onChange={(e) => update('show_notify_cta', e.target.checked)}
            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
          />
          <span className={`text-sm font-bold ${t.text}`}>
            Afficher le bouton "🔔 Préviens-moi" sur chaque placeholder
          </span>
        </label>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export default MobileComingSoonManager;
