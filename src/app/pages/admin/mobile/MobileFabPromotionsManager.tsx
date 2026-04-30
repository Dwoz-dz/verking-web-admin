/**
 * MobileFabPromotionsManager — admin CRUD for mobile_fab_promotions.
 *
 * The FAB is the floating pill above the bottom tab bar in the
 * mobile app. The mobile picks ONE promo at a time per active
 * screen, by AND-targeting on cart total + wilaya + screen + auth
 * state. Highest-priority winner takes the slot. If no candidate
 * matches, the FAB hides cleanly.
 *
 * The list cards surface a live preview of the pill (bg color +
 * label + icon emoji) plus impression / click counters and CTR.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Calendar, Eye, EyeOff, Loader2, Plus, Search, Sparkles, Trash2, Zap, X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteFabPromotion,
  listAllFabPromotions,
  upsertFabPromotion,
  type FabLinkType,
  type MobileFabPromotionPatch,
  type MobileFabPromotionRow,
} from '../../../lib/adminMobileApi';

type Filter = 'all' | 'active' | 'inactive';

const SCREEN_OPTIONS = ['home', 'search', 'profile', 'cart', 'orders'] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
}

function ctr(p: MobileFabPromotionRow): string {
  if (p.impressions_count === 0) return '—';
  return `${((p.clicks_count / p.impressions_count) * 100).toFixed(1)}%`;
}

export function MobileFabPromotionsManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [promos, setPromos] = useState<MobileFabPromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MobileFabPromotionRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listAllFabPromotions(token);
      setPromos(list);
    } catch (err) {
      console.error('[fab-mgr] load failed:', err);
      toast.error('Impossible de charger les FAB promos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token]);

  const stats = useMemo(() => {
    const active = promos.filter((p) => p.is_active).length;
    const totalImp = promos.reduce((acc, p) => acc + (p.impressions_count || 0), 0);
    const totalClicks = promos.reduce((acc, p) => acc + (p.clicks_count || 0), 0);
    return { total: promos.length, active, inactive: promos.length - active, totalImp, totalClicks };
  }, [promos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return promos.filter((p) => {
      if (filter === 'active' && !p.is_active) return false;
      if (filter === 'inactive' && p.is_active) return false;
      if (!q) return true;
      return p.label_fr.toLowerCase().includes(q) || p.label_ar.includes(q);
    });
  }, [promos, filter, search]);

  const onToggleActive = async (p: MobileFabPromotionRow) => {
    if (!token) return;
    const next = !p.is_active;
    setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: next } : x)));
    try {
      await upsertFabPromotion({ id: p.id, is_active: next }, token);
    } catch (err) {
      setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !next } : x)));
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  const onDelete = async (p: MobileFabPromotionRow) => {
    if (!token) return;
    if (!window.confirm(`Supprimer "${p.label_fr}" ?`)) return;
    try {
      await deleteFabPromotion(p.id, token);
      setPromos((prev) => prev.filter((x) => x.id !== p.id));
      toast.success('Promo supprimée.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (p: MobileFabPromotionRow) => { setEditing(p); setShowForm(true); };
  const onFormSaved = () => { setShowForm(false); setEditing(null); void load(); };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="animate-spin text-blue-700" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-600" />
            <h2 className={`text-sm font-black ${t.text}`}>
              FAB Promotions ({stats.total} · {stats.active} actives ·
              <Activity size={12} className="inline mx-1" />
              {stats.totalImp.toLocaleString('fr-FR')} impr · {stats.totalClicks.toLocaleString('fr-FR')} clicks)
            </h2>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-bold text-white"
          >
            <Plus size={14} /> Nouvelle promo
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {(['all','active','inactive'] as const).map((f) => {
              const counts: Record<typeof f, number> = { all: stats.total, active: stats.active, inactive: stats.inactive } as const;
              const labels: Record<typeof f, string> = { all: 'Toutes', active: 'Actives', inactive: 'Inactives' } as const;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-colors ${
                    filter === f ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {labels[f]} ({counts[f]})
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Label FR / AR..."
              className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-10 text-center`}>
          <Zap size={28} className="mx-auto text-gray-400" />
          <p className={`mt-3 text-sm font-semibold ${t.textMuted}`}>
            {promos.length === 0 ? 'Aucune promo — crée la première.' : 'Aucune promo ne correspond.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <PromoCard
              key={p.id}
              promo={p}
              onToggle={() => void onToggleActive(p)}
              onEdit={() => openEdit(p)}
              onDelete={() => void onDelete(p)}
              t={t}
            />
          ))}
        </div>
      )}

      {showForm && (
        <FabPromotionForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={onFormSaved}
          token={token}
        />
      )}
    </div>
  );
}

function PromoCard({
  promo, onToggle, onEdit, onDelete, t,
}: {
  promo: MobileFabPromotionRow;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useAdminUI>['t'];
}) {
  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} overflow-hidden flex flex-col`}>
      {/* Live preview */}
      <div className="px-4 py-6 flex justify-center" style={{ background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)' }}>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black shadow-md"
          style={{ background: promo.bg_color, color: promo.text_color }}
        >
          {promo.icon ? <span>{promo.icon.length <= 2 ? promo.icon : '⚡'}</span> : null}
          {promo.label_fr}
        </span>
      </div>

      <div className="p-3 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${t.text} truncate`} dir="rtl">{promo.label_ar}</p>
          </div>
          {!promo.is_active && (
            <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-black text-gray-600 uppercase">Inactive</span>
          )}
        </div>

        <div className={`flex flex-wrap gap-1.5 text-[10px] ${t.textMuted}`}>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 inline-flex items-center gap-1">
            <Sparkles size={9} /> p{promo.priority}
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5">{promo.link_type}{promo.link_target ? `:${promo.link_target}` : ''}</span>
          {promo.target_screens && promo.target_screens.length > 0 && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{promo.target_screens.length} écran(s)</span>
          )}
          {promo.target_wilayas && promo.target_wilayas.length > 0 && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{promo.target_wilayas.length} wilaya(s)</span>
          )}
          {promo.min_cart_amount != null && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5">cart ≥ {promo.min_cart_amount}</span>
          )}
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-3 text-[10px] text-gray-600 pt-1">
          <span><Eye size={10} className="inline mr-0.5" /> {promo.impressions_count.toLocaleString('fr-FR')}</span>
          <span>👆 {promo.clicks_count.toLocaleString('fr-FR')}</span>
          <span className="font-bold">CTR {ctr(promo)}</span>
        </div>

        {(promo.starts_at || promo.ends_at) && (
          <div className={`flex items-center gap-1 text-[10px] ${t.textMuted}`}>
            <Calendar size={10} />
            {formatDate(promo.starts_at)} → {formatDate(promo.ends_at)}
          </div>
        )}
      </div>

      <div className={`flex items-center justify-end gap-1 border-t ${t.divider} px-2 py-1.5 bg-gray-50/50`}>
        <button onClick={onToggle} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${promo.is_active ? 'border-orange-200 text-orange-700 hover:bg-orange-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
          {promo.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
          {promo.is_active ? 'Désactiver' : 'Activer'}
        </button>
        <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50">
          Edit
        </button>
        <button onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function FabPromotionForm({
  initial, onClose, onSaved, token,
}: {
  initial: MobileFabPromotionRow | null;
  onClose: () => void;
  onSaved: () => void;
  token: string | null;
}) {
  const isEdit = initial !== null;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<MobileFabPromotionPatch>(() => ({
    id: initial?.id,
    label_fr: initial?.label_fr ?? '',
    label_ar: initial?.label_ar ?? '',
    bg_color: initial?.bg_color ?? '#FF7A1A',
    text_color: initial?.text_color ?? '#FFFFFF',
    icon: initial?.icon ?? '',
    link_type: initial?.link_type ?? 'none',
    link_target: initial?.link_target ?? '',
    min_cart_amount: initial?.min_cart_amount ?? null,
    max_cart_amount: initial?.max_cart_amount ?? null,
    target_wilayas: initial?.target_wilayas ?? null,
    target_screens: initial?.target_screens ?? null,
    show_only_logged_in: initial?.show_only_logged_in ?? false,
    show_only_logged_out: initial?.show_only_logged_out ?? false,
    starts_at: initial?.starts_at ?? null,
    ends_at: initial?.ends_at ?? null,
    priority: initial?.priority ?? 50,
    is_active: initial?.is_active ?? true,
  }));

  const setField = <K extends keyof MobileFabPromotionPatch>(key: K, value: MobileFabPromotionPatch[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleScreen = (s: string) => {
    const cur = new Set(form.target_screens ?? []);
    if (cur.has(s)) cur.delete(s); else cur.add(s);
    setField('target_screens', cur.size > 0 ? Array.from(cur) : null);
  };

  const onSubmit = async () => {
    if (!token) return;
    if (!form.label_fr?.trim()) { toast.error('Label FR requis.'); return; }
    if (!form.label_ar?.trim()) { toast.error('Label AR requis.'); return; }

    setSubmitting(true);
    try {
      const wilayas = Array.isArray(form.target_wilayas)
        ? form.target_wilayas.map((w) => String(w).trim()).filter((w) => /^[0-9]{1,2}$/.test(w)).map((w) => w.padStart(2, '0'))
        : null;
      const patch: MobileFabPromotionPatch = {
        ...form,
        priority: Number(form.priority ?? 0),
        min_cart_amount: form.min_cart_amount == null || (form.min_cart_amount as unknown as string) === '' ? null : Number(form.min_cart_amount),
        max_cart_amount: form.max_cart_amount == null || (form.max_cart_amount as unknown as string) === '' ? null : Number(form.max_cart_amount),
        target_wilayas: wilayas && wilayas.length > 0 ? wilayas : null,
      };
      await upsertFabPromotion(patch, token);
      toast.success(isEdit ? 'FAB mise à jour.' : 'FAB créée.');
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
            {isEdit ? 'Modifier promo FAB' : 'Nouvelle promo FAB'}
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Live preview */}
          <div className="rounded-2xl border border-gray-200 p-6 flex justify-center" style={{ background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)' }}>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-black shadow-md"
              style={{ background: form.bg_color || '#FF7A1A', color: form.text_color || '#FFFFFF' }}
            >
              {form.icon ? <span>{form.icon.length <= 2 ? form.icon : '⚡'}</span> : null}
              {form.label_fr || 'Label FR'}
            </span>
          </div>

          {/* Identity */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Label FR *">
              <input type="text" value={form.label_fr ?? ''} onChange={(e) => setField('label_fr', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="EXTRA 500 DA OFF" />
            </Field>
            <Field label="Label AR *">
              <input type="text" value={form.label_ar ?? ''} onChange={(e) => setField('label_ar', e.target.value)} dir="rtl"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="خصم 500 دج" />
            </Field>
          </div>

          {/* Visual */}
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Couleur fond">
              <div className="flex items-center gap-2">
                <input type="color" value={form.bg_color ?? '#FF7A1A'} onChange={(e) => setField('bg_color', e.target.value)} className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer" />
                <input type="text" value={form.bg_color ?? ''} onChange={(e) => setField('bg_color', e.target.value)} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono" />
              </div>
            </Field>
            <Field label="Couleur texte">
              <div className="flex items-center gap-2">
                <input type="color" value={form.text_color ?? '#FFFFFF'} onChange={(e) => setField('text_color', e.target.value)} className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer" />
                <input type="text" value={form.text_color ?? ''} onChange={(e) => setField('text_color', e.target.value)} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono" />
              </div>
            </Field>
            <Field label="Icône (emoji ou ionicon)">
              <input type="text" value={form.icon ?? ''} onChange={(e) => setField('icon', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="🎒  ou  pricetag" />
            </Field>
          </div>

          {/* Link */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Type de lien">
              <select value={form.link_type ?? 'none'} onChange={(e) => setField('link_type', e.target.value as FabLinkType)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                <option value="none">Aucun (juste affichage)</option>
                <option value="coupons">Coupons (/coupons)</option>
                <option value="themed_page">Page thématique (slug)</option>
                <option value="product">Produit (uuid)</option>
                <option value="category">Catégorie (uuid)</option>
                <option value="flash_sale">Vente flash</option>
                <option value="external">Externe (ignoré v1)</option>
              </select>
            </Field>
            <Field label="Cible du lien">
              <input type="text" value={form.link_target ?? ''} onChange={(e) => setField('link_target', e.target.value || null)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
                placeholder={form.link_type === 'themed_page' ? 'rentree' : form.link_type === 'product' ? 'uuid' : ''}
                disabled={form.link_type === 'none' || form.link_type === 'coupons' || form.link_type === 'flash_sale'} />
            </Field>
          </div>

          {/* Targeting */}
          <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50 space-y-3">
            <p className="text-xs font-black uppercase tracking-wide text-gray-600">Conditions (AND, vide = pas de filtre)</p>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Cart minimum (DA)">
                <input type="number" min={0}
                  value={form.min_cart_amount ?? ''}
                  onChange={(e) => setField('min_cart_amount', e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="∅" />
              </Field>
              <Field label="Cart maximum (DA)">
                <input type="number" min={0}
                  value={form.max_cart_amount ?? ''}
                  onChange={(e) => setField('max_cart_amount', e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="∅" />
              </Field>
            </div>

            <Field label="Wilayas ciblées (codes séparés par virgule, vide = toutes)">
              <input type="text"
                value={Array.isArray(form.target_wilayas) ? form.target_wilayas.join(',') : ''}
                onChange={(e) => {
                  const list = e.target.value.split(/[,\s]+/).filter(Boolean);
                  setField('target_wilayas', list.length > 0 ? list : null);
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono" placeholder="16, 31, 25" />
            </Field>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Écrans ciblés (vide = tous)</p>
              <div className="flex flex-wrap gap-1.5">
                {SCREEN_OPTIONS.map((s) => {
                  const checked = (form.target_screens ?? []).includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleScreen(s)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold border ${
                        checked ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {checked ? '✓ ' : ''}{s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <FlagField label="Logged-in only" value={form.show_only_logged_in ?? false} onChange={(v) => setField('show_only_logged_in', v)} />
              <FlagField label="Logged-out only" value={form.show_only_logged_out ?? false} onChange={(v) => setField('show_only_logged_out', v)} />
            </div>
          </div>

          {/* Validity */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Début">
              <input type="datetime-local"
                value={form.starts_at ? form.starts_at.slice(0, 16) : ''}
                onChange={(e) => setField('starts_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
            <Field label="Fin">
              <input type="datetime-local"
                value={form.ends_at ? form.ends_at.slice(0, 16) : ''}
                onChange={(e) => setField('ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
          </div>

          {/* Priority + active */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Priorité (plus haut = gagne)">
              <input type="number" value={form.priority ?? 50} onChange={(e) => setField('priority', Number(e.target.value))}
                className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
            <FlagField label="Active" value={form.is_active ?? true} onChange={(v) => setField('is_active', v)} />
          </div>
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

export default MobileFabPromotionsManager;
