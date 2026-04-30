/**
 * MobileHomeBuilder — editable section list for the mobile Home tab.
 *
 * Reorder via up/down arrows (no DnD library needed — keeps the bundle
 * small) and toggle each section on/off. Each interaction queues a
 * change locally; the "Publier" button writes the full ordered list to
 * the `admin-mobile-config/home-sections` endpoint in one round-trip.
 *
 * Save / discard model:
 *   ▸ Edits accumulate in `draft` until you press Publier.
 *   ▸ "Annuler les changements" reverts to the last fetched copy.
 *   ▸ A small "modified" badge on the toolbar makes the dirty state
 *     unmissable so the admin doesn't navigate away by accident.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Eye, EyeOff, Layers, Loader2, RotateCcw, Save, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { useAdminUI } from '../../../context/AdminUIContext';
import { supabaseClient } from '../../../lib/supabaseClient';
import { saveMobileSections, type MobileSectionPatch } from '../../../lib/adminMobileApi';

interface SectionRow {
  id: string;
  section_key: string;
  is_enabled: boolean;
  sort_order: number;
  config: Record<string, unknown> | null;
}

const SECTION_DESCRIPTIONS: Record<string, string> = {
  announcement_strip: 'Bandeau annonce — fin haut de la home, slim.',
  hero_carousel:      'Carousel principal de bannières (slides).',
  categories_grid:    'Grille de catégories.',
  best_sellers:       'Rail des meilleures ventes.',
  flash_deals:        'Offres flash avec compte à rebours.',
  new_arrivals:       'Nouveautés du catalogue.',
  wholesale_promo:    'Bloc promo Gros (mint).',
  seasonal_banner:    'Bannière saisonnière (rentrée, fêtes…).',
  featured:           'Coups de cœur éditeur.',
  recommended:        'Recommandés (basé sur historique).',
  footer_promo:       'Carte promo en pied de page.',
};

function sameSections(a: SectionRow[], b: SectionRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].section_key !== b[i].section_key ||
      a[i].is_enabled !== b[i].is_enabled ||
      a[i].sort_order !== b[i].sort_order ||
      JSON.stringify(a[i].config ?? {}) !== JSON.stringify(b[i].config ?? {})
    ) return false;
  }
  return true;
}

export function MobileHomeBuilder() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [remote, setRemote] = useState<SectionRow[]>([]);
  const [draft, setDraft] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('mobile_home_sections')
        .select('id,section_key,is_enabled,sort_order,config')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as SectionRow[];
      setRemote(rows);
      setDraft(rows);
    } catch (err) {
      console.error('[home-builder] load failed:', err);
      toast.error('Impossible de charger les sections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const dirty = useMemo(() => !sameSections(remote, draft), [remote, draft]);
  const enabledCount = useMemo(() => draft.filter((s) => s.is_enabled).length, [draft]);

  const move = (idx: number, direction: -1 | 1) => {
    const next = [...draft];
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    // Re-number sort_order so the persisted state is monotonically increasing.
    next.forEach((s, i) => { s.sort_order = i; });
    setDraft(next);
  };

  const toggle = (idx: number) => {
    const next = [...draft];
    next[idx] = { ...next[idx], is_enabled: !next[idx].is_enabled };
    setDraft(next);
  };

  const updateConfig = (idx: number, raw: string) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw || '{}');
    } catch {
      toast.error('Config JSON invalide.');
      return;
    }
    const next = [...draft];
    next[idx] = { ...next[idx], config: parsed };
    setDraft(next);
  };

  const onPublish = async () => {
    if (!token || !dirty) return;
    setSaving(true);
    try {
      const payload: MobileSectionPatch[] = draft.map((s) => ({
        section_key: s.section_key,
        is_enabled: s.is_enabled,
        sort_order: s.sort_order,
        config: s.config ?? {},
      }));
      await saveMobileSections(payload, token);
      setRemote(draft);
      toast.success('Sections publiées.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec publication.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => setDraft(remote);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="animate-spin text-blue-700" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between rounded-2xl border ${t.cardBorder} ${t.card} p-4`}>
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-fuchsia-700" />
          <h2 className={`text-sm font-black ${t.text}`}>
            Sections Home mobile ({enabledCount}/{draft.length} actives)
          </h2>
          {dirty && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
              <Sparkles size={10} /> Modifié
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={!dirty}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <RotateCcw size={13} /> Annuler
          </button>
          <button
            type="button"
            onClick={() => void onPublish()}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
            {saving ? 'Publication…' : 'Publier'}
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {draft.map((s, idx) => {
          const desc = SECTION_DESCRIPTIONS[s.section_key] ?? '—';
          return (
            <li
              key={s.id}
              className={`flex items-center gap-3 rounded-2xl border ${t.cardBorder} ${t.card} p-3 ${
                s.is_enabled ? '' : 'opacity-60'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="rounded-md p-1 text-gray-500 hover:bg-blue-50 disabled:opacity-30"
                  title="Monter"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === draft.length - 1}
                  className="rounded-md p-1 text-gray-500 hover:bg-blue-50 disabled:opacity-30"
                  title="Descendre"
                >
                  <ArrowDown size={12} />
                </button>
              </div>

              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-black">
                {idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-black ${t.text}`}>{s.section_key}</p>
                <p className={`text-xs ${t.textMuted} truncate`}>{desc}</p>
              </div>

              <input
                type="text"
                defaultValue={JSON.stringify(s.config ?? {})}
                onBlur={(e) => updateConfig(idx, e.currentTarget.value)}
                className="hidden md:block w-44 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-mono"
                placeholder="{}"
                title="Config JSON (limit, etc.)"
              />

              <button
                type="button"
                onClick={() => toggle(idx)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  s.is_enabled
                    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {s.is_enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                {s.is_enabled ? 'Active' : 'Inactive'}
              </button>
            </li>
          );
        })}
      </ul>

      <div className={`rounded-2xl border border-blue-200 bg-blue-50/40 p-4 text-xs ${t.text}`}>
        <strong className="text-blue-700">Publier</strong> envoie l&apos;ordre,
        les toggles et les configs JSON dans une seule requête. Le champ
        <code> config </code>accepte n&apos;importe quel objet (ex. <code>{`{"limit": 8}`}</code>) —
        c&apos;est l&apos;app qui décide quels champs sont supportés par section.
      </div>
    </div>
  );
}

export default MobileHomeBuilder;
