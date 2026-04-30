/**
 * MobileEmptyStatesManager — admin CRUD for `mobile_empty_states`.
 *
 * Each row drives the empty-state shown for one mobile screen
 * (cart, wishlist, orders, search…). Admin can swap titles, CTAs
 * and toggle which "smart surfaces" the mobile renders below the
 * empty-state card (recently viewed / trending / recommendations /
 * referral CTA).
 *
 * Layout:
 *   ▸ Toolbar with + Nouvelle entrée
 *   ▸ Cards listing each screen_key with bilingual title preview
 *     and the four smart-surface flags
 *   ▸ Modal form for create/edit
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Eye, EyeOff, Layers, Loader2, Plus, Search, Sparkles, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteEmptyState,
  listAllEmptyStates,
  upsertEmptyState,
  type MobileEmptyStatePatch,
  type MobileEmptyStateRow,
} from '../../../lib/adminMobileApi';

const SCREEN_PRESETS = ['cart', 'wishlist', 'orders', 'search'] as const;

export function MobileEmptyStatesManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [rows, setRows] = useState<MobileEmptyStateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MobileEmptyStateRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listAllEmptyStates(token);
      setRows(list);
    } catch (err) {
      console.error('[empty-states] load failed:', err);
      toast.error('Impossible de charger les empty states.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length;
    return { total: rows.length, active };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.screen_key.includes(q) ||
      (r.title_fr ?? '').toLowerCase().includes(q) ||
      (r.title_ar ?? '').includes(q),
    );
  }, [rows, search]);

  const onToggleActive = async (r: MobileEmptyStateRow) => {
    if (!token) return;
    const next = !r.is_active;
    setRows((prev) => prev.map((x) => (x.screen_key === r.screen_key ? { ...x, is_active: next } : x)));
    try {
      await upsertEmptyState({ screen_key: r.screen_key, is_active: next }, token);
    } catch (err) {
      setRows((prev) => prev.map((x) => (x.screen_key === r.screen_key ? { ...x, is_active: !next } : x)));
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  const onDelete = async (r: MobileEmptyStateRow) => {
    if (!token) return;
    if (!window.confirm(`Supprimer "${r.screen_key}" ?`)) return;
    try {
      await deleteEmptyState(r.screen_key, token);
      setRows((prev) => prev.filter((x) => x.screen_key !== r.screen_key));
      toast.success('Supprimé.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="animate-spin text-blue-700" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-violet-700" />
            <h2 className={`text-sm font-black ${t.text}`}>
              Empty states ({stats.total} · {stats.active} actifs)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-bold text-white"
          >
            <Plus size={14} /> Nouvelle entrée
          </button>
        </div>
        <div className="relative max-w-xs mt-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Screen key / titre..."
            className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2 text-xs"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-10 text-center`}>
          <Layers size={28} className="mx-auto text-gray-400" />
          <p className={`mt-3 text-sm font-semibold ${t.textMuted}`}>
            {rows.length === 0 ? 'Aucune entrée — créez la première.' : 'Rien ne correspond.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <Card
              key={r.screen_key}
              row={r}
              onToggle={() => void onToggleActive(r)}
              onEdit={() => { setEditing(r); setShowForm(true); }}
              onDelete={() => void onDelete(r)}
              t={t}
            />
          ))}
        </div>
      )}

      {showForm && (
        <Form
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); setEditing(null); void load(); }}
          token={token}
        />
      )}
    </div>
  );
}

function Card({
  row, onToggle, onEdit, onDelete, t,
}: {
  row: MobileEmptyStateRow;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useAdminUI>['t'];
}) {
  const surfaces: { label: string; on: boolean }[] = [
    { label: 'Vu récemment', on: row.show_recently_viewed },
    { label: 'Tendances', on: row.show_trending },
    { label: 'Recommandés', on: row.show_recommendations },
    { label: 'Parrainage', on: row.show_referral_cta },
  ];
  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} overflow-hidden flex flex-col`}>
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-blue-50">
        <div className="flex items-start justify-between gap-2">
          <code className="rounded bg-white px-2 py-1 text-[11px] font-bold text-violet-700">
            /{row.screen_key}
          </code>
          {!row.is_active && (
            <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-black text-gray-600 uppercase">Inactif</span>
          )}
        </div>
      </div>
      <div className="p-3 flex-1 space-y-2">
        <h3 className={`text-sm font-black ${t.text}`}>{row.title_fr ?? '—'}</h3>
        <p className={`text-[11px] ${t.textMuted}`} dir="rtl">{row.title_ar ?? '—'}</p>
        {row.subtitle_fr && (
          <p className={`text-[11px] ${t.textMuted} line-clamp-2`}>{row.subtitle_fr}</p>
        )}
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {surfaces.map((s) => (
            <span
              key={s.label}
              className={`rounded-full px-2 py-0.5 font-bold ${s.on ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}
            >
              {s.on ? '✓' : '·'} {s.label}
            </span>
          ))}
        </div>
        {row.cta_primary_label_fr && (
          <div className={`flex items-center gap-1 text-[10px] ${t.textMuted}`}>
            <Sparkles size={10} /> {row.cta_primary_label_fr} → <code>{row.cta_primary_link ?? '?'}</code>
          </div>
        )}
      </div>
      <div className={`flex items-center justify-end gap-1 border-t ${t.divider} px-2 py-1.5 bg-gray-50/50`}>
        <button onClick={onToggle} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${row.is_active ? 'border-orange-200 text-orange-700 hover:bg-orange-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
          {row.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
          {row.is_active ? 'Désactiver' : 'Activer'}
        </button>
        <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50">Edit</button>
        <button onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function Form({
  initial, onClose, onSaved, token,
}: {
  initial: MobileEmptyStateRow | null;
  onClose: () => void;
  onSaved: () => void;
  token: string | null;
}) {
  const isEdit = initial !== null;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<MobileEmptyStatePatch>(() => ({
    screen_key: initial?.screen_key ?? '',
    illustration_url: initial?.illustration_url ?? '',
    title_fr: initial?.title_fr ?? '',
    title_ar: initial?.title_ar ?? '',
    subtitle_fr: initial?.subtitle_fr ?? '',
    subtitle_ar: initial?.subtitle_ar ?? '',
    cta_primary_label_fr: initial?.cta_primary_label_fr ?? '',
    cta_primary_label_ar: initial?.cta_primary_label_ar ?? '',
    cta_primary_link: initial?.cta_primary_link ?? '',
    cta_secondary_label_fr: initial?.cta_secondary_label_fr ?? '',
    cta_secondary_label_ar: initial?.cta_secondary_label_ar ?? '',
    cta_secondary_link: initial?.cta_secondary_link ?? '',
    show_recently_viewed: initial?.show_recently_viewed ?? true,
    show_trending: initial?.show_trending ?? true,
    show_recommendations: initial?.show_recommendations ?? true,
    show_referral_cta: initial?.show_referral_cta ?? false,
    is_active: initial?.is_active ?? true,
  }));

  const setField = <K extends keyof MobileEmptyStatePatch>(key: K, value: MobileEmptyStatePatch[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async () => {
    if (!token) return;
    if (!form.screen_key?.trim()) { toast.error('screen_key requis.'); return; }
    setSubmitting(true);
    try {
      await upsertEmptyState(form, token);
      toast.success(isEdit ? 'Mis à jour.' : 'Créé.');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-lg font-black text-gray-900">
            {isEdit ? `Modifier ${initial?.screen_key ?? ''}` : 'Nouvelle empty state'}
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <Field label="Screen key *">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={form.screen_key ?? ''}
                onChange={(e) => setField('screen_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
                placeholder="cart, wishlist, orders, search..."
                disabled={isEdit}
              />
              {!isEdit && (
                <div className="flex gap-1.5 flex-wrap">
                  {SCREEN_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setField('screen_key', p)}
                      className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field label="Image illustration (URL)">
            <input type="text" value={form.illustration_url ?? ''} onChange={(e) => setField('illustration_url', e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="https://..." />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Titre FR">
              <input type="text" value={form.title_fr ?? ''} onChange={(e) => setField('title_fr', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="Pas encore d'articles ?" />
            </Field>
            <Field label="العنوان AR">
              <input type="text" value={form.title_ar ?? ''} onChange={(e) => setField('title_ar', e.target.value)} dir="rtl"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Sous-titre FR">
              <textarea value={form.subtitle_fr ?? ''} onChange={(e) => setField('subtitle_fr', e.target.value)} rows={2}
                className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
            <Field label="العنوان الفرعي AR">
              <textarea value={form.subtitle_ar ?? ''} onChange={(e) => setField('subtitle_ar', e.target.value)} dir="rtl" rows={2}
                className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
          </div>

          {/* Primary CTA */}
          <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50 space-y-3">
            <p className="text-xs font-black uppercase tracking-wide text-gray-600">CTA primaire</p>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Label FR">
                <input type="text" value={form.cta_primary_label_fr ?? ''} onChange={(e) => setField('cta_primary_label_fr', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Field>
              <Field label="Label AR">
                <input type="text" value={form.cta_primary_label_ar ?? ''} onChange={(e) => setField('cta_primary_label_ar', e.target.value)} dir="rtl"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Field>
              <Field label="Link">
                <input type="text" value={form.cta_primary_link ?? ''} onChange={(e) => setField('cta_primary_link', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono" placeholder="/(tabs)/explore" />
              </Field>
            </div>
          </div>

          {/* Secondary CTA */}
          <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50 space-y-3">
            <p className="text-xs font-black uppercase tracking-wide text-gray-600">CTA secondaire (optionnel)</p>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Label FR">
                <input type="text" value={form.cta_secondary_label_fr ?? ''} onChange={(e) => setField('cta_secondary_label_fr', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Field>
              <Field label="Label AR">
                <input type="text" value={form.cta_secondary_label_ar ?? ''} onChange={(e) => setField('cta_secondary_label_ar', e.target.value)} dir="rtl"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Field>
              <Field label="Link">
                <input type="text" value={form.cta_secondary_link ?? ''} onChange={(e) => setField('cta_secondary_link', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono" />
              </Field>
            </div>
          </div>

          {/* Smart surfaces */}
          <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50 space-y-3">
            <p className="text-xs font-black uppercase tracking-wide text-gray-600">Smart surfaces (rendus en dessous de l&apos;empty state)</p>
            <div className="grid gap-3 md:grid-cols-2">
              <FlagField label="Vu récemment" value={form.show_recently_viewed ?? true} onChange={(v) => setField('show_recently_viewed', v)} />
              <FlagField label="Tendances aujourd'hui" value={form.show_trending ?? true} onChange={(v) => setField('show_trending', v)} />
              <FlagField label="Recommandés" value={form.show_recommendations ?? true} onChange={(v) => setField('show_recommendations', v)} />
              <FlagField label="Parrainage CTA" value={form.show_referral_cta ?? false} onChange={(v) => setField('show_referral_cta', v)} />
            </div>
          </div>

          <FlagField label="Active" value={form.is_active ?? true} onChange={(v) => setField('is_active', v)} />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
            Annuler
          </button>
          <button onClick={() => void onSubmit()} disabled={submitting}
            className="rounded-xl bg-[#1A3C6E] px-5 py-2 text-sm font-black text-white disabled:opacity-60">
            {submitting ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FlagField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-3 bg-white">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={() => onChange(true)}
          className={`flex-1 rounded-xl border px-2 py-1.5 text-xs font-bold ${value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          Oui
        </button>
        <button type="button" onClick={() => onChange(false)}
          className={`flex-1 rounded-xl border px-2 py-1.5 text-xs font-bold ${!value ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          Non
        </button>
      </div>
    </div>
  );
}

export default MobileEmptyStatesManager;
