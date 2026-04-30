/**
 * MobileFlashSalesManager — admin CRUD for mobile_flash_sales.
 *
 * Layout:
 *   ▸ Toolbar with stats (live now / upcoming / expired) + "Nouvelle vente flash"
 *   ▸ Filter chips (Toutes / En cours / À venir / Expirées / Inactives)
 *   ▸ Sale cards — banner image, title, discount, product count, time bar
 *     showing live/upcoming/expired window, quick toggle / edit / delete.
 *   ▸ Modal form for create/edit: bilingual titles, dates, discount,
 *     product picker (multi-select dropdown), targeting (wilayas), flags.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, Loader2, Plus, Search, Trash2, Zap, X, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';

import { MediaField } from '../../../components/MediaField';
import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteFlashSale,
  listAllFlashSales,
  upsertFlashSale,
  type FlashSaleDiscountType,
  type MobileFlashSalePatch,
  type MobileFlashSaleRow,
} from '../../../lib/adminMobileApi';
import { supabaseClient } from '../../../lib/supabaseClient';

type Filter = 'all' | 'live' | 'upcoming' | 'expired' | 'inactive';

interface ProductLite {
  id: string;
  name_fr: string;
  price: number | null;
}

function classifyWindow(s: MobileFlashSaleRow, now: number): 'live' | 'upcoming' | 'expired' {
  const start = new Date(s.starts_at).getTime();
  const end = new Date(s.ends_at).getTime();
  if (now < start) return 'upcoming';
  if (now > end) return 'expired';
  return 'live';
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtRelative(target: number, now: number): string {
  const ms = target - now;
  if (ms <= 0) return '0 j';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}j ${hours}h`;
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

export function MobileFlashSalesManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [sales, setSales] = useState<MobileFlashSaleRow[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MobileFlashSaleRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Live tick — drives the "live now" badges + countdown labels.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [salesList, prodRes] = await Promise.all([
        listAllFlashSales(token),
        supabaseClient.from('products').select('id,name_fr,price').eq('is_active', true).order('name_fr'),
      ]);
      setSales(salesList);
      setProducts(((prodRes.data ?? []) as unknown) as ProductLite[]);
    } catch (err) {
      console.error('[flash-mgr] load failed:', err);
      toast.error('Impossible de charger les ventes flash.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token]);

  const stats = useMemo(() => {
    const live = sales.filter((s) => s.is_active && classifyWindow(s, now) === 'live').length;
    const upcoming = sales.filter((s) => s.is_active && classifyWindow(s, now) === 'upcoming').length;
    const expired = sales.filter((s) => classifyWindow(s, now) === 'expired').length;
    const inactive = sales.filter((s) => !s.is_active).length;
    return { total: sales.length, live, upcoming, expired, inactive };
  }, [sales, now]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      const cls = classifyWindow(s, now);
      if (filter === 'live' && (!s.is_active || cls !== 'live')) return false;
      if (filter === 'upcoming' && (!s.is_active || cls !== 'upcoming')) return false;
      if (filter === 'expired' && cls !== 'expired') return false;
      if (filter === 'inactive' && s.is_active) return false;
      if (!q) return true;
      return s.title_fr.toLowerCase().includes(q) || s.title_ar.includes(q);
    });
  }, [sales, filter, search, now]);

  const onToggleActive = async (s: MobileFlashSaleRow) => {
    if (!token) return;
    const next = !s.is_active;
    setSales((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: next } : x)));
    try {
      await upsertFlashSale({ id: s.id, is_active: next }, token);
    } catch (err) {
      setSales((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !next } : x)));
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  const onDelete = async (s: MobileFlashSaleRow) => {
    if (!token) return;
    if (!window.confirm(`Supprimer "${s.title_fr}" ?`)) return;
    try {
      await deleteFlashSale(s.id, token);
      setSales((prev) => prev.filter((x) => x.id !== s.id));
      toast.success('Vente flash supprimée.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (s: MobileFlashSaleRow) => { setEditing(s); setShowForm(true); };
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
              Ventes flash ({stats.total} · 🟢 {stats.live} live · ⏳ {stats.upcoming} à venir · ⚫ {stats.expired} expirées)
            </h2>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-bold text-white"
          >
            <Plus size={14} /> Nouvelle vente flash
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {(['all','live','upcoming','expired','inactive'] as const).map((f) => {
              const counts: Record<typeof f, number> = {
                all: stats.total, live: stats.live, upcoming: stats.upcoming, expired: stats.expired, inactive: stats.inactive,
              } as const;
              const labels: Record<typeof f, string> = {
                all: 'Toutes', live: 'En cours', upcoming: 'À venir', expired: 'Expirées', inactive: 'Inactives',
              } as const;
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
              placeholder="Titre..."
              className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-10 text-center`}>
          <Zap size={28} className="mx-auto text-gray-400" />
          <p className={`mt-3 text-sm font-semibold ${t.textMuted}`}>
            {sales.length === 0 ? 'Aucune vente flash — crée la première.' : 'Aucune vente flash ne correspond.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <SaleCard
              key={s.id}
              sale={s}
              now={now}
              onToggle={() => void onToggleActive(s)}
              onEdit={() => openEdit(s)}
              onDelete={() => void onDelete(s)}
              t={t}
            />
          ))}
        </div>
      )}

      {showForm && (
        <FlashSaleForm
          initial={editing}
          products={products}
          onClose={() => setShowForm(false)}
          onSaved={onFormSaved}
          token={token}
        />
      )}
    </div>
  );
}

function SaleCard({
  sale, now, onToggle, onEdit, onDelete, t,
}: {
  sale: MobileFlashSaleRow;
  now: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useAdminUI>['t'];
}) {
  const cls = classifyWindow(sale, now);
  const start = new Date(sale.starts_at).getTime();
  const end = new Date(sale.ends_at).getTime();

  let badgeText = '';
  let badgeColor = '';
  let timeText = '';
  if (!sale.is_active) {
    badgeText = 'Inactive'; badgeColor = 'bg-gray-200 text-gray-700';
    timeText = '—';
  } else if (cls === 'live') {
    badgeText = '● Live'; badgeColor = 'bg-emerald-100 text-emerald-700';
    timeText = `Termine dans ${fmtRelative(end, now)}`;
  } else if (cls === 'upcoming') {
    badgeText = '⏳ À venir'; badgeColor = 'bg-blue-100 text-blue-700';
    timeText = `Démarre dans ${fmtRelative(start, now)}`;
  } else {
    badgeText = 'Expirée'; badgeColor = 'bg-gray-200 text-gray-600';
    timeText = `Terminée le ${formatDateTime(sale.ends_at)}`;
  }

  const discountLabel =
    sale.discount_type === 'percent' ? `-${sale.discount_value}%` : `-${sale.discount_value} DA`;

  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} overflow-hidden flex flex-col`}>
      <div
        className="relative aspect-[16/8] flex items-center justify-center"
        style={{
          backgroundImage: sale.banner_image
            ? `linear-gradient(to right, rgba(0,0,0,0.45), rgba(0,0,0,0.15)), url(${sale.banner_image})`
            : 'linear-gradient(135deg, #FF7A1A, #E85D6B)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}
      >
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${badgeColor}`}>
            {badgeText}
          </span>
        </div>
        <span className="text-3xl font-black text-white drop-shadow tracking-tight">
          {discountLabel}
        </span>
      </div>
      <div className="space-y-2 p-3 flex-1">
        <h3 className={`text-sm font-black ${t.text} truncate`}>{sale.title_fr}</h3>
        <p className={`text-[11px] ${t.textMuted} truncate`} dir="rtl">{sale.title_ar}</p>
        <div className={`flex flex-wrap gap-1.5 text-[10px] ${t.textMuted}`}>
          <span className="rounded bg-gray-100 px-1.5 py-0.5">
            {sale.product_ids.length} produit(s)
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5">
            Max {sale.max_qty_per_user}/util.
          </span>
          {sale.target_wilayas && sale.target_wilayas.length > 0 && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{sale.target_wilayas.length} wilaya(s)</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Clock size={10} />
          {timeText}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Calendar size={10} />
          {formatDateTime(sale.starts_at)} → {formatDateTime(sale.ends_at)}
        </div>
      </div>
      <div className={`flex items-center justify-end gap-1 border-t ${t.divider} px-2 py-1.5 bg-gray-50/50`}>
        <button onClick={onToggle} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${
          sale.is_active ? 'border-orange-200 text-orange-700 hover:bg-orange-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
        }`}>
          {sale.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
          {sale.is_active ? 'Désactiver' : 'Activer'}
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

function FlashSaleForm({
  initial, products, onClose, onSaved, token,
}: {
  initial: MobileFlashSaleRow | null;
  products: ProductLite[];
  onClose: () => void;
  onSaved: () => void;
  token: string | null;
}) {
  const isEdit = initial !== null;
  const [submitting, setSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState<MobileFlashSalePatch>(() => ({
    id: initial?.id,
    title_fr: initial?.title_fr ?? '',
    title_ar: initial?.title_ar ?? '',
    subtitle_fr: initial?.subtitle_fr ?? '',
    subtitle_ar: initial?.subtitle_ar ?? '',
    banner_image: initial?.banner_image ?? '',
    video_url: (initial as { video_url?: string | null } | null)?.video_url ?? '',
    discount_type: initial?.discount_type ?? 'percent',
    discount_value: initial?.discount_value ?? 10,
    product_ids: initial?.product_ids ?? [],
    max_qty_per_user: initial?.max_qty_per_user ?? 5,
    total_stock_override: initial?.total_stock_override ?? null,
    starts_at: initial?.starts_at ?? new Date().toISOString(),
    ends_at: initial?.ends_at ?? new Date(Date.now() + 7 * 86400_000).toISOString(),
    display_priority: initial?.display_priority ?? 50,
    is_active: initial?.is_active ?? true,
    target_wilayas: initial?.target_wilayas ?? null,
  }));

  const setField = <K extends keyof MobileFlashSalePatch>(key: K, value: MobileFlashSalePatch[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectedIds = useMemo(() => new Set(form.product_ids ?? []), [form.product_ids]);
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products.filter((p) => p.name_fr.toLowerCase().includes(q)).slice(0, 50);
  }, [products, productSearch]);

  const toggleProduct = (id: string) => {
    const cur = new Set(form.product_ids ?? []);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    setField('product_ids', Array.from(cur));
  };

  const onSubmit = async () => {
    if (!token) return;
    if (!form.title_fr?.trim()) { toast.error('Titre FR requis.'); return; }
    if (!form.title_ar?.trim()) { toast.error('Titre AR requis.'); return; }
    if (!form.starts_at || !form.ends_at) { toast.error('Dates requises.'); return; }
    if (Date.parse(form.ends_at) <= Date.parse(form.starts_at)) { toast.error('Fin doit être après début.'); return; }

    setSubmitting(true);
    try {
      const wilayas = Array.isArray(form.target_wilayas)
        ? form.target_wilayas.map((w) => String(w).trim()).filter((w) => /^[0-9]{1,2}$/.test(w)).map((w) => w.padStart(2, '0'))
        : null;
      const patch: MobileFlashSalePatch = {
        ...form,
        discount_value: Number(form.discount_value ?? 0),
        max_qty_per_user: Number(form.max_qty_per_user ?? 1),
        total_stock_override: form.total_stock_override == null ? null : Number(form.total_stock_override),
        display_priority: Number(form.display_priority ?? 0),
        product_ids: form.product_ids ?? [],
        target_wilayas: wilayas && wilayas.length > 0 ? wilayas : null,
      };
      await upsertFlashSale(patch, token);
      toast.success(isEdit ? 'Vente flash mise à jour.' : 'Vente flash créée.');
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
            {isEdit ? `Modifier vente flash` : 'Nouvelle vente flash'}
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Titre FR *">
              <input type="text" value={form.title_fr ?? ''} onChange={(e) => setField('title_fr', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="Flash Cartables -20%" />
            </Field>
            <Field label="العنوان AR *">
              <input type="text" value={form.title_ar ?? ''} onChange={(e) => setField('title_ar', e.target.value)} dir="rtl"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="تخفيض المحافظ" />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Sous-titre FR">
              <input type="text" value={form.subtitle_fr ?? ''} onChange={(e) => setField('subtitle_fr', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
            <Field label="العنوان الفرعي AR">
              <input type="text" value={form.subtitle_ar ?? ''} onChange={(e) => setField('subtitle_ar', e.target.value)} dir="rtl"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <MediaField
              label="Image bannière"
              kind="image"
              module="flash-sales"
              value={form.banner_image ?? ''}
              onChange={(url) => setField('banner_image', url ?? '')}
              helper="Visible en hero du carousel et des cartes produit en promo flash."
            />
            <MediaField
              label="Vidéo (optionnelle)"
              kind="video"
              module="flash-sales"
              value={(form as { video_url?: string | null }).video_url ?? ''}
              onChange={(url) => setField('video_url' as keyof MobileFlashSalePatch, (url ?? '') as never)}
              helper="MP4 ≤ 15 MB. Lue uniquement en Wi-Fi côté mobile."
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Type *">
              <select value={form.discount_type ?? 'percent'} onChange={(e) => setField('discount_type', e.target.value as FlashSaleDiscountType)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                <option value="percent">Pourcentage (%)</option>
                <option value="fixed">Fixe (DA)</option>
              </select>
            </Field>
            <Field label={form.discount_type === 'percent' ? 'Pourcentage *' : 'Valeur (DA) *'}>
              <input type="number" min={0} value={form.discount_value ?? 0} onChange={(e) => setField('discount_value', Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
            <Field label="Max / utilisateur">
              <input type="number" min={1} value={form.max_qty_per_user ?? 5} onChange={(e) => setField('max_qty_per_user', Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Début *">
              <input type="datetime-local"
                value={form.starts_at ? form.starts_at.slice(0, 16) : ''}
                onChange={(e) => setField('starts_at', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
            <Field label="Fin *">
              <input type="datetime-local"
                value={form.ends_at ? form.ends_at.slice(0, 16) : ''}
                onChange={(e) => setField('ends_at', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
          </div>

          {/* Products picker */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">
              Produits ciblés ({(form.product_ids ?? []).length} sélectionné(s))
            </p>
            <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Aucun produit trouvé.</p>
              ) : filteredProducts.map((p) => {
                const checked = selectedIds.has(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50">
                    <input type="checkbox" checked={checked} onChange={() => toggleProduct(p.id)} />
                    <span className="flex-1 text-xs font-semibold text-gray-700 truncate">{p.name_fr}</span>
                    {p.price != null && <span className="text-[10px] text-gray-500">{p.price} DA</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <Field label="Wilayas ciblées (codes séparés par virgule, vide = toutes)">
            <input type="text"
              value={Array.isArray(form.target_wilayas) ? form.target_wilayas.join(',') : ''}
              onChange={(e) => {
                const list = e.target.value.split(/[,\s]+/).filter(Boolean);
                setField('target_wilayas', list.length > 0 ? list : null);
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
              placeholder="16, 31, 25" />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Priorité d'affichage">
              <input type="number" value={form.display_priority ?? 0} onChange={(e) => setField('display_priority', Number(e.target.value))}
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

export default MobileFlashSalesManager;
