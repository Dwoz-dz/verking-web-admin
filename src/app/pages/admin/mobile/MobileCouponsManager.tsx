/**
 * MobileCouponsManager — admin CRUD for mobile_coupons.
 *
 * Layout:
 *   ▸ Toolbar with stats (active/inactive/auto-apply ratio) + "Nouveau coupon"
 *   ▸ Filter chips (All / Active / Inactive / Auto-apply)
 *   ▸ Search box (code, title_fr, title_ar)
 *   ▸ Coupon cards grid — each card shows discount slab, code, title,
 *     min cart, validity window, flags, and quick toggle / edit / delete.
 *   ▸ Modal form for create / edit with FR + AR titles, discount config,
 *     targeting (wilayas multi-select), validity window, and flags.
 *
 * Realtime: this page reads via `coupons-list-all` (admin route), which
 * returns every coupon including inactive. The mobile app reads the
 * filtered subset via anon SELECT and is updated by the mobile_coupons
 * Realtime broadcast — no extra wiring needed here.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Eye, EyeOff, Loader2, Plus, Search, Sparkles, Trash2, Ticket, X,
} from 'lucide-react';
import { toast } from 'sonner';

import { MediaField } from '../../../components/MediaField';
import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteCoupon,
  listAllCoupons,
  upsertCoupon,
  type CouponDiscountType,
  type MobileCouponPatch,
  type MobileCouponRow,
} from '../../../lib/adminMobileApi';

type Filter = 'all' | 'active' | 'inactive' | 'auto';

const DISCOUNT_LABEL: Record<CouponDiscountType, string> = {
  percent: '%',
  fixed: 'DA',
  free_shipping: 'Livraison',
};

const DISCOUNT_TONE: Record<CouponDiscountType, string> = {
  percent: '#FF7A1A',
  fixed: '#22C55E',
  free_shipping: '#0EA5E9',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
}

export function MobileCouponsManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [coupons, setCoupons] = useState<MobileCouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MobileCouponRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listAllCoupons(token);
      setCoupons(list);
    } catch (err) {
      console.error('[coupons-mgr] load failed:', err);
      toast.error('Impossible de charger les coupons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token]);

  const stats = useMemo(() => {
    const active = coupons.filter((c) => c.is_active).length;
    const inactive = coupons.length - active;
    const auto = coupons.filter((c) => c.is_active && c.is_auto_applicable).length;
    return { total: coupons.length, active, inactive, auto };
  }, [coupons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return coupons.filter((c) => {
      if (filter === 'active' && !c.is_active) return false;
      if (filter === 'inactive' && c.is_active) return false;
      if (filter === 'auto' && !c.is_auto_applicable) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.title_fr.toLowerCase().includes(q) ||
        c.title_ar.includes(q)
      );
    });
  }, [coupons, filter, search]);

  const onToggleActive = async (c: MobileCouponRow) => {
    if (!token) return;
    const next = !c.is_active;
    setCoupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: next } : x)));
    try {
      await upsertCoupon({ id: c.id, is_active: next }, token);
    } catch (err) {
      setCoupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !next } : x)));
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  const onDelete = async (c: MobileCouponRow) => {
    if (!token) return;
    if (!window.confirm(`Supprimer le coupon "${c.code}" ?`)) return;
    try {
      await deleteCoupon(c.id, token);
      setCoupons((prev) => prev.filter((x) => x.id !== c.id));
      toast.success('Coupon supprimé.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (c: MobileCouponRow) => {
    setEditing(c);
    setShowForm(true);
  };
  const onFormSaved = () => {
    setShowForm(false);
    setEditing(null);
    void load();
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
      {/* Toolbar */}
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ticket size={16} className="text-rose-700" />
            <h2 className={`text-sm font-black ${t.text}`}>
              Coupons ({stats.total} · {stats.active} actifs · {stats.auto} auto-apply)
            </h2>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-bold text-white"
          >
            <Plus size={14} /> Nouveau coupon
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {(['all', 'active', 'inactive', 'auto'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-colors ${
                  filter === f
                    ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? `Tous (${stats.total})`
                  : f === 'active' ? `Actifs (${stats.active})`
                  : f === 'inactive' ? `Inactifs (${stats.inactive})`
                  : `Auto-apply (${stats.auto})`}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code, titre FR / AR..."
              className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-10 text-center`}>
          <Ticket size={28} className="mx-auto text-gray-400" />
          <p className={`mt-3 text-sm font-semibold ${t.textMuted}`}>
            {coupons.length === 0 ? 'Aucun coupon — crée le premier.' : 'Aucun coupon ne correspond.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              onToggle={() => void onToggleActive(c)}
              onEdit={() => openEdit(c)}
              onDelete={() => void onDelete(c)}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <CouponForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={onFormSaved}
          token={token}
        />
      )}
    </div>
  );
}

function CouponCard({
  coupon, onToggle, onEdit, onDelete, t,
}: {
  coupon: MobileCouponRow;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useAdminUI>['t'];
}) {
  const tone = DISCOUNT_TONE[coupon.discount_type];
  const usesCap =
    typeof coupon.max_uses === 'number' && coupon.max_uses > 0
      ? `${coupon.uses_count}/${coupon.max_uses}`
      : `${coupon.uses_count}`;

  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} overflow-hidden flex flex-col`}>
      {/* Slab + content row */}
      <div className="flex">
        <div
          className="w-24 flex flex-col items-center justify-center py-4 text-white relative"
          style={{ backgroundColor: tone }}
        >
          <span className="text-2xl font-black tracking-tight leading-none">
            {coupon.discount_type === 'percent'
              ? `-${coupon.value}`
              : coupon.discount_type === 'fixed'
              ? `-${coupon.value}`
              : ''}
          </span>
          <span className="text-[10px] font-black uppercase mt-1">
            {DISCOUNT_LABEL[coupon.discount_type]}
          </span>
        </div>
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <code className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-700 tracking-wider">
                  {coupon.code}
                </code>
                {!coupon.is_active && (
                  <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-black text-gray-600 uppercase">
                    Inactif
                  </span>
                )}
                {coupon.is_active && coupon.is_auto_applicable && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700 uppercase flex items-center gap-1">
                    <Sparkles size={9} /> Auto
                  </span>
                )}
              </div>
              <h3 className={`text-sm font-black ${t.text} truncate`}>{coupon.title_fr}</h3>
              <p className={`text-[11px] ${t.textMuted} truncate`} dir="rtl">
                {coupon.title_ar}
              </p>
            </div>
          </div>

          <div className={`mt-2 flex flex-wrap gap-1.5 text-[10px] ${t.textMuted}`}>
            {coupon.min_cart_amount > 0 && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5">
                Min {coupon.min_cart_amount} DA
              </span>
            )}
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{usesCap} util.</span>
            {coupon.target_wilayas && coupon.target_wilayas.length > 0 && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5">
                {coupon.target_wilayas.length} wilaya(s)
              </span>
            )}
          </div>

          {(coupon.starts_at || coupon.ends_at) && (
            <div className={`mt-2 flex items-center gap-1 text-[10px] ${t.textMuted}`}>
              <Calendar size={10} />
              {formatDate(coupon.starts_at)} → {formatDate(coupon.ends_at)}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={`flex items-center justify-end gap-1 border-t ${t.divider} px-2 py-1.5 bg-gray-50/50`}>
        <button
          onClick={onToggle}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${
            coupon.is_active
              ? 'border-orange-200 text-orange-700 hover:bg-orange-50'
              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          {coupon.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
          {coupon.is_active ? 'Désactiver' : 'Activer'}
        </button>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Form modal ───────────────────────────────────────────────────────

interface CouponFormProps {
  initial: MobileCouponRow | null;
  onClose: () => void;
  onSaved: () => void;
  token: string | null;
}

function CouponForm({ initial, onClose, onSaved, token }: CouponFormProps) {
  const isEdit = initial !== null;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<MobileCouponPatch>(() => ({
    id: initial?.id,
    code: initial?.code ?? '',
    title_fr: initial?.title_fr ?? '',
    title_ar: initial?.title_ar ?? '',
    description_fr: initial?.description_fr ?? '',
    description_ar: initial?.description_ar ?? '',
    discount_type: initial?.discount_type ?? 'fixed',
    value: initial?.value ?? 0,
    max_discount: initial?.max_discount ?? null,
    min_cart_amount: initial?.min_cart_amount ?? 0,
    max_uses: initial?.max_uses ?? null,
    max_uses_per_user: initial?.max_uses_per_user ?? 1,
    target_wilayas: initial?.target_wilayas ?? null,
    starts_at: initial?.starts_at ?? null,
    ends_at: initial?.ends_at ?? null,
    is_active: initial?.is_active ?? true,
    is_claimable: initial?.is_claimable ?? true,
    is_auto_applicable: initial?.is_auto_applicable ?? true,
    source: initial?.source ?? 'manual',
    display_priority: initial?.display_priority ?? 0,
  }));

  const setField = <K extends keyof MobileCouponPatch>(key: K, value: MobileCouponPatch[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async () => {
    if (!token) return;
    if (!form.code?.trim()) { toast.error('Code requis.'); return; }
    if (!form.title_fr?.trim()) { toast.error('Titre FR requis.'); return; }
    if (!form.title_ar?.trim()) { toast.error('Titre AR requis.'); return; }
    setSubmitting(true);
    try {
      // Normalise wilaya codes to 2-digit strings, drop empty entries.
      const wilayas =
        Array.isArray(form.target_wilayas)
          ? form.target_wilayas.map((w) => String(w).trim()).filter((w) => /^[0-9]{1,2}$/.test(w)).map((w) => w.padStart(2, '0'))
          : null;
      const patch: MobileCouponPatch = {
        ...form,
        target_wilayas: wilayas && wilayas.length > 0 ? wilayas : null,
        // Numbers as numbers, never strings.
        value: Number(form.value ?? 0),
        max_discount: form.max_discount == null || form.max_discount === ('' as unknown as number) ? null : Number(form.max_discount),
        min_cart_amount: Number(form.min_cart_amount ?? 0),
        max_uses: form.max_uses == null || form.max_uses === ('' as unknown as number) ? null : Number(form.max_uses),
        max_uses_per_user: Number(form.max_uses_per_user ?? 1),
        display_priority: Number(form.display_priority ?? 0),
      };
      await upsertCoupon(patch, token);
      toast.success(isEdit ? 'Coupon mis à jour.' : 'Coupon créé.');
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
            {isEdit ? `Modifier coupon ${initial?.code ?? ''}` : 'Nouveau coupon'}
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Code + flags */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Code *">
              <input
                type="text"
                value={form.code ?? ''}
                onChange={(e) => setField('code', e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono uppercase"
                placeholder="RENTREE500"
                disabled={isEdit}
              />
            </Field>
            <Field label="Source">
              <select
                value={form.source ?? 'manual'}
                onChange={(e) => setField('source', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="manual">manual</option>
                <option value="rewards">rewards</option>
                <option value="referral">referral</option>
                <option value="challenge">challenge</option>
                <option value="flash_sale">flash_sale</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Titre FR *">
              <input
                type="text"
                value={form.title_fr ?? ''}
                onChange={(e) => setField('title_fr', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="Rentrée -500 DA"
              />
            </Field>
            <Field label="العنوان AR *">
              <input
                type="text"
                value={form.title_ar ?? ''}
                onChange={(e) => setField('title_ar', e.target.value)}
                dir="rtl"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="الدخول المدرسي"
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Description FR">
              <textarea
                value={form.description_fr ?? ''}
                onChange={(e) => setField('description_fr', e.target.value)}
                rows={2}
                className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="الوصف AR">
              <textarea
                value={form.description_ar ?? ''}
                onChange={(e) => setField('description_ar', e.target.value)}
                rows={2}
                dir="rtl"
                className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {/* Visual assets (Phase 12) */}
          <div className="grid gap-3 md:grid-cols-2">
            <MediaField
              label="Image bannière"
              kind="image"
              module="coupons"
              value={(form as { banner_image?: string | null }).banner_image ?? ''}
              onChange={(url) => setField('banner_image' as keyof MobileCouponPatch, (url ?? '') as never)}
              helper="Vue dans la liste « Mes coupons » et la card claim sur la home."
            />
            <MediaField
              label="Vidéo (optionnelle)"
              kind="video"
              module="coupons"
              value={(form as { video_url?: string | null }).video_url ?? ''}
              onChange={(url) => setField('video_url' as keyof MobileCouponPatch, (url ?? '') as never)}
              helper="MP4 ≤ 15 MB. Lue uniquement en Wi-Fi côté mobile."
            />
          </div>

          {/* Discount */}
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Type *">
              <select
                value={form.discount_type ?? 'fixed'}
                onChange={(e) => setField('discount_type', e.target.value as CouponDiscountType)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="fixed">Fixe (DA)</option>
                <option value="percent">Pourcentage (%)</option>
                <option value="free_shipping">Livraison offerte</option>
              </select>
            </Field>
            <Field label={form.discount_type === 'percent' ? 'Pourcentage *' : 'Valeur (DA) *'}>
              <input
                type="number"
                min={0}
                value={form.value ?? 0}
                onChange={(e) => setField('value', Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Plafond max (% only)">
              <input
                type="number"
                min={0}
                value={form.max_discount ?? ''}
                onChange={(e) => setField('max_discount', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="Ex: 1000"
                disabled={form.discount_type !== 'percent'}
              />
            </Field>
          </div>

          {/* Limits */}
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Min panier (DA)">
              <input
                type="number"
                min={0}
                value={form.min_cart_amount ?? 0}
                onChange={(e) => setField('min_cart_amount', Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Max usages (global)">
              <input
                type="number"
                min={0}
                value={form.max_uses ?? ''}
                onChange={(e) => setField('max_uses', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="∞"
              />
            </Field>
            <Field label="Max / utilisateur">
              <input
                type="number"
                min={1}
                value={form.max_uses_per_user ?? 1}
                onChange={(e) => setField('max_uses_per_user', Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {/* Wilayas */}
          <Field label="Wilayas ciblées (codes séparés par virgule, vide = toutes)">
            <input
              type="text"
              value={Array.isArray(form.target_wilayas) ? form.target_wilayas.join(',') : ''}
              onChange={(e) => {
                const list = e.target.value.split(/[,\s]+/).filter(Boolean);
                setField('target_wilayas', list.length > 0 ? list : null);
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
              placeholder="16, 31, 25"
            />
          </Field>

          {/* Validity */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Début">
              <input
                type="datetime-local"
                value={form.starts_at ? form.starts_at.slice(0, 16) : ''}
                onChange={(e) => setField('starts_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Fin">
              <input
                type="datetime-local"
                value={form.ends_at ? form.ends_at.slice(0, 16) : ''}
                onChange={(e) => setField('ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {/* Flags */}
          <div className="grid gap-3 md:grid-cols-3">
            <FlagField label="Actif" value={form.is_active ?? true} onChange={(v) => setField('is_active', v)} />
            <FlagField label="Visible (claimable)" value={form.is_claimable ?? true} onChange={(v) => setField('is_claimable', v)} />
            <FlagField label="Auto-apply" value={form.is_auto_applicable ?? true} onChange={(v) => setField('is_auto_applicable', v)} />
          </div>

          <Field label="Priorité d'affichage (plus haut = en premier)">
            <input
              type="number"
              value={form.display_priority ?? 0}
              onChange={(e) => setField('display_priority', Number(e.target.value))}
              className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Annuler
          </button>
          <button
            onClick={() => void onSubmit()}
            disabled={submitting}
            className="rounded-xl bg-[#1A3C6E] px-5 py-2 text-sm font-black text-white disabled:opacity-60"
          >
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
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-xl border px-2 py-1.5 text-xs font-bold ${
            value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          Oui
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-xl border px-2 py-1.5 text-xs font-bold ${
            !value ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          Non
        </button>
      </div>
    </div>
  );
}

export default MobileCouponsManager;
