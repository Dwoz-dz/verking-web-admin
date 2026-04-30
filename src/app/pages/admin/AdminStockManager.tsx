import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Boxes,
  Package,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  PackageX,
  Sparkles,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
  History,
  RefreshCw,
  X,
  Tag,
  TrendingUp,
  Save,
  Loader2,
  Layers,
  Eye,
  EyeOff,
  Target,
  DollarSign,
  Image as ImageIcon,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { subscribeRealtimeResources } from '../../lib/realtimeLiveSync';
import {
  adjustStock,
  listStockMovements,
  type StockAdjustMode,
  type StockMovement,
} from '../../lib/stockApi';

// ─── Types ─────────────────────────────────────────────────────────
type Product = {
  id: string;
  name_fr: string;
  name_ar?: string;
  images?: string[];
  category_id?: string | null;
  sku?: string | null;
  price?: number;
  sale_price?: number | null;
  cost_price?: number | null;
  stock: number;
  low_stock_threshold?: number | null;
  is_active: boolean;
  updated_at?: string;
};

type Category = { id: string; name_fr: string; name_ar?: string };

type StockHealth = 'ok' | 'low' | 'out' | 'over';

type StatusFilter = 'all' | 'ok' | 'low' | 'out';
type ActiveFilter = 'all' | 'active' | 'inactive';
type SortField = 'stock_asc' | 'stock_desc' | 'name' | 'updated' | 'value_desc';

// ─── Helpers ───────────────────────────────────────────────────────
function getStockHealth(product: Product): StockHealth {
  const stock = Number(product.stock ?? 0);
  const threshold = Number(product.low_stock_threshold ?? 5);
  if (stock <= 0) return 'out';
  if (stock <= threshold) return 'low';
  if (threshold > 0 && stock >= threshold * 10) return 'over';
  return 'ok';
}

function healthBadge(health: StockHealth) {
  switch (health) {
    case 'out':
      return {
        label: 'Rupture',
        icon: PackageX,
        cls: 'bg-red-100 text-red-700 border-red-200',
        dot: 'bg-red-500',
      };
    case 'low':
      return {
        label: 'Stock faible',
        icon: AlertTriangle,
        cls: 'bg-amber-100 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'over':
      return {
        label: 'Surstock',
        icon: Layers,
        cls: 'bg-blue-100 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
      };
    default:
      return {
        label: 'OK',
        icon: CheckCircle2,
        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
  }
}

function movementTone(source: string, delta: number) {
  if (source === 'admin_manual') {
    return delta >= 0
      ? { icon: ArrowUpRight, cls: 'text-emerald-600', tone: 'bg-emerald-50 border-emerald-200' }
      : { icon: ArrowDownRight, cls: 'text-rose-600', tone: 'bg-rose-50 border-rose-200' };
  }
  // System auto (order-driven): amber for deducts, emerald for restores.
  return delta >= 0
    ? { icon: ArrowUp, cls: 'text-emerald-600', tone: 'bg-emerald-50/60 border-emerald-100' }
    : { icon: ArrowDown, cls: 'text-amber-600', tone: 'bg-amber-50/60 border-amber-100' };
}

function relativeTime(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'à l\'instant';
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const days = Math.round(hr / 24);
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Skeleton rows ─────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 bg-gray-100 rounded animate-pulse" />
            <div className="h-2.5 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="h-6 w-20 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────
export function AdminStockManager() {
  const { token, admin } = useAuth();
  const { t, isDark } = useAdminUI();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pulseProduct, setPulseProduct] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterActive, setFilterActive] = useState<ActiveFilter>('all');
  const [sort, setSort] = useState<SortField>('stock_asc');

  // Dialogs
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyScope, setHistoryScope] = useState<Product | null>(null);

  // ── Loading ──
  const loadProductsAndCategories = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [p, c] = await Promise.all([
        api.get('/products'),
        api.get('/categories'),
      ]);
      const mappedProducts: Product[] = (p?.products || []).map((row: any) => ({
        id: String(row.id),
        name_fr: row.name_fr || '',
        name_ar: row.name_ar || '',
        images: Array.isArray(row.images) ? row.images : [],
        category_id: row.category_id || null,
        sku: row.sku || null,
        price: Number(row.price ?? 0),
        sale_price: row.sale_price != null ? Number(row.sale_price) : null,
        cost_price: row.cost_price != null ? Number(row.cost_price) : null,
        stock: Number(row.stock ?? 0),
        low_stock_threshold: row.low_stock_threshold != null ? Number(row.low_stock_threshold) : 5,
        is_active: row.is_active !== false,
        updated_at: row.updated_at || row.created_at || '',
      }));
      setProducts(mappedProducts);
      setCategories(
        (c?.categories || []).map((row: any) => ({
          id: String(row.id),
          name_fr: row.name_fr || '',
          name_ar: row.name_ar || '',
        })),
      );
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger l\'inventaire.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMovements = useCallback(async (productId?: string) => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const rows = await listStockMovements({
        token,
        productId,
        limit: productId ? 200 : 60,
      });
      setMovements(rows);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Historique indisponible.');
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  useEffect(() => { loadProductsAndCategories(); }, [loadProductsAndCategories]);

  // Live sync — any stock mutation (admin or order-driven) hits the
  // products table, and the trigger writes a row to stock_movements.
  // Both tables are watched by realtimeLiveSync. Including 'stocks'
  // ensures we also refresh when an audit-trail row is inserted via
  // RPC (e.g. another admin tab adjusting stock).
  useEffect(() => {
    const unsubscribe = subscribeRealtimeResources(
      ['products', 'categories', 'orders', 'stocks'],
      (event) => {
        loadProductsAndCategories(true);
        // If the history drawer is open, refresh movements too so the
        // ledger updates live alongside the products grid.
        if (event.resource === 'stocks' && historyOpen) {
          loadMovements(historyScope?.id);
        }
      },
    );
    return unsubscribe;
  }, [loadProductsAndCategories, loadMovements, historyOpen, historyScope]);

  // ── Computed ──
  const categoryById = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const cat of categories) map[cat.id] = cat;
    return map;
  }, [categories]);

  const kpis = useMemo(() => {
    const total = products.length;
    let inStock = 0;
    let low = 0;
    let out = 0;
    let totalUnits = 0;
    let stockValue = 0;
    let hiddenDueStock = 0;
    for (const p of products) {
      const health = getStockHealth(p);
      const stock = Number(p.stock || 0);
      totalUnits += Math.max(0, stock);
      const unitCost = Number(p.cost_price ?? p.sale_price ?? p.price ?? 0);
      stockValue += Math.max(0, stock) * (Number.isFinite(unitCost) ? unitCost : 0);
      if (health === 'out') {
        out += 1;
        if (!p.is_active) hiddenDueStock += 1;
      } else if (health === 'low') {
        low += 1;
      } else {
        inStock += 1;
      }
    }
    return { total, inStock, low, out, totalUnits, stockValue, hiddenDueStock };
  }, [products]);

  const categoryInsights = useMemo(() => {
    const rollup: Record<string, { id: string; name: string; total: number; low: number; out: number; units: number }> = {};
    for (const p of products) {
      const catId = p.category_id || '__none__';
      const name = catId === '__none__'
        ? 'Sans catégorie'
        : (categoryById[catId]?.name_fr || 'Catégorie supprimée');
      const bucket = rollup[catId] || (rollup[catId] = {
        id: catId, name, total: 0, low: 0, out: 0, units: 0,
      });
      bucket.total += 1;
      bucket.units += Math.max(0, Number(p.stock || 0));
      const health = getStockHealth(p);
      if (health === 'out') bucket.out += 1;
      else if (health === 'low') bucket.low += 1;
    }
    return Object.values(rollup).sort((a, b) => (b.low + b.out) - (a.low + a.out));
  }, [products, categoryById]);

  const filtered = useMemo(() => {
    let rows = [...products];
    if (filterCategory) rows = rows.filter((p) => p.category_id === filterCategory);
    if (filterActive === 'active') rows = rows.filter((p) => p.is_active);
    if (filterActive === 'inactive') rows = rows.filter((p) => !p.is_active);
    if (filterStatus !== 'all') rows = rows.filter((p) => {
      const health = getStockHealth(p);
      if (filterStatus === 'out') return health === 'out';
      if (filterStatus === 'low') return health === 'low';
      if (filterStatus === 'ok') return health === 'ok' || health === 'over';
      return true;
    });
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter((p) =>
        (p.name_fr || '').toLowerCase().includes(s) ||
        (p.name_ar || '').includes(s) ||
        (p.sku || '').toLowerCase().includes(s),
      );
    }
    rows.sort((a, b) => {
      switch (sort) {
        case 'stock_desc': return Number(b.stock || 0) - Number(a.stock || 0);
        case 'name':       return a.name_fr.localeCompare(b.name_fr, 'fr');
        case 'updated':    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
        case 'value_desc': {
          const va = Math.max(0, Number(a.stock || 0)) * Number(a.cost_price ?? a.price ?? 0);
          const vb = Math.max(0, Number(b.stock || 0)) * Number(b.cost_price ?? b.price ?? 0);
          return vb - va;
        }
        case 'stock_asc':
        default:
          return Number(a.stock || 0) - Number(b.stock || 0);
      }
    });
    return rows;
  }, [products, filterCategory, filterActive, filterStatus, search, sort]);

  // ── Stock actions ──
  const performAdjust = useCallback(async (input: {
    product: Product;
    mode: StockAdjustMode;
    value: number;
    reason?: string;
  }) => {
    if (!token) {
      toast.error('Session admin requise.');
      return;
    }
    try {
      const result = await adjustStock({
        productId: input.product.id,
        mode: input.mode,
        value: input.value,
        reason: input.reason,
        adminLabel: admin?.name || admin?.email || 'admin',
        token,
      });
      // Optimistic local update
      setProducts((prev) => prev.map((p) => {
        if (p.id !== input.product.id) return p;
        if (input.mode === 'threshold') {
          return { ...p, low_stock_threshold: result.new_threshold ?? p.low_stock_threshold };
        }
        return {
          ...p,
          stock: result.new_stock ?? p.stock,
          updated_at: new Date().toISOString(),
        };
      }));
      setPulseProduct(input.product.id);
      window.setTimeout(() => setPulseProduct(null), 1800);

      if (input.mode === 'threshold') {
        toast.success('Seuil mis à jour.');
      } else {
        const delta = result.delta ?? 0;
        toast.success(`Stock ${delta >= 0 ? '+' : ''}${delta} — nouveau stock ${result.new_stock}`);
      }
      return result;
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Échec de l\'ajustement.');
      throw error;
    }
  }, [token, admin]);

  const quickDelta = useCallback(async (product: Product, delta: number) => {
    await performAdjust({
      product,
      mode: delta >= 0 ? 'increase' : 'decrease',
      value: Math.abs(delta),
      reason: delta >= 0 ? 'Quick +1 adjustment' : 'Quick -1 adjustment',
    });
  }, [performAdjust]);

  const openHistoryFor = useCallback((product?: Product) => {
    setHistoryScope(product || null);
    setHistoryOpen(true);
    loadMovements(product?.id);
  }, [loadMovements]);

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      {/* ═══ Premium header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-6 shadow-xl shadow-emerald-500/20"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,white_0%,transparent_50%)] opacity-20" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-white shadow-lg backdrop-blur">
                  <Boxes size={22} strokeWidth={2.5} />
                </div>
                <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                </span>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-sm">
                  Gestionnaire de stock
                </h1>
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/80">
                  Inventory Control Center
                </p>
              </div>
            </div>
            <p className="text-sm text-white/90 max-w-2xl">
              Pilotez l'inventaire en temps réel — ajustements manuels, mouvements automatiques liés
              aux commandes et alertes de réappro. Chaque changement est persisté dans Supabase et
              enregistré dans le journal de mouvements.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-black uppercase tracking-wider text-white backdrop-blur">
                <Sparkles size={10} />
                Live sync Supabase
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-black uppercase tracking-wider text-white backdrop-blur">
                <Target size={10} />
                Connecté aux commandes
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openHistoryFor()}
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 backdrop-blur px-4 py-2.5 text-sm font-bold text-white border border-white/30 hover:bg-white/30 transition-all"
            >
              <History size={15} />
              Historique global
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => loadProductsAndCategories(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white text-emerald-700 px-4 py-2.5 text-sm font-black shadow hover:shadow-lg disabled:opacity-60 transition-all"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Actualiser
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ═══ KPI grid ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        {[
          { label: 'Total produits', value: kpis.total, icon: Package, tone: 'from-blue-500 to-blue-600', soft: 'from-blue-50 to-blue-100/50' },
          { label: 'En stock', value: kpis.inStock, icon: CheckCircle2, tone: 'from-emerald-500 to-emerald-600', soft: 'from-emerald-50 to-emerald-100/50' },
          { label: 'Stock faible', value: kpis.low, icon: AlertTriangle, tone: 'from-amber-500 to-amber-600', soft: 'from-amber-50 to-amber-100/50' },
          { label: 'Rupture', value: kpis.out, icon: PackageX, tone: 'from-rose-500 to-rose-600', soft: 'from-rose-50 to-rose-100/50' },
          { label: 'Unités totales', value: kpis.totalUnits.toLocaleString('fr-FR'), icon: Layers, tone: 'from-indigo-500 to-indigo-600', soft: 'from-indigo-50 to-indigo-100/50' },
          { label: 'Valeur stock', value: `${Math.round(kpis.stockValue).toLocaleString('fr-FR')} DA`, icon: DollarSign, tone: 'from-cyan-500 to-cyan-600', soft: 'from-cyan-50 to-cyan-100/50' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={`${t.card} ${t.cardBorder} group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.soft} opacity-70 group-hover:opacity-100 transition-opacity`} />
            <div className="relative flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className={`text-2xl font-black leading-tight ${t.text}`}>{kpi.value}</div>
                <div className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted} mt-1 truncate`}>{kpi.label}</div>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${kpi.tone} text-white shadow-md`}>
                <kpi.icon size={16} strokeWidth={2.4} />
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ═══ Category insights ═══ */}
      {categoryInsights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className={`${t.card} ${t.cardBorder} rounded-2xl border p-5 shadow-sm`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className={`text-sm font-black uppercase tracking-wider ${t.text}`}>Santé par catégorie</h2>
              <p className={`text-xs ${t.textMuted} mt-0.5`}>Les catégories avec le plus d'alertes sont affichées en premier.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categoryInsights.slice(0, 8).map((cat) => {
              const alertTotal = cat.low + cat.out;
              const alertLevel = alertTotal === 0 ? 'ok' : cat.out > 0 ? 'out' : 'low';
              const tone = alertLevel === 'out'
                ? 'from-rose-50 to-rose-100/40 border-rose-200'
                : alertLevel === 'low'
                  ? 'from-amber-50 to-amber-100/40 border-amber-200'
                  : 'from-emerald-50 to-emerald-100/40 border-emerald-200';
              return (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(cat.id === '__none__' ? '' : cat.id)}
                  className={`text-left relative overflow-hidden rounded-xl border p-3 bg-gradient-to-br ${tone} hover:shadow-md transition-all`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Tag size={14} className="text-gray-700" />
                    {alertTotal > 0 && (
                      <span className="rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-black text-gray-700">
                        {alertTotal} alertes
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-black truncate ${t.text}`}>{cat.name}</p>
                  <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] font-bold">
                    <div className="text-gray-700">
                      <span className="block text-base font-black">{cat.total}</span>
                      <span className="opacity-70">produits</span>
                    </div>
                    <div className={cat.low > 0 ? 'text-amber-700' : 'text-gray-400'}>
                      <span className="block text-base font-black">{cat.low}</span>
                      <span className="opacity-70">faible</span>
                    </div>
                    <div className={cat.out > 0 ? 'text-rose-700' : 'text-gray-400'}>
                      <span className="block text-base font-black">{cat.out}</span>
                      <span className="opacity-70">rupture</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══ Filters toolbar ═══ */}
      <div className={`${t.card} ${t.cardBorder} rounded-2xl border p-3 shadow-sm`}>
        <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] items-center">
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, SKU…"
              className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm ${t.input}`}
            />
          </label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={`rounded-xl border px-3 py-2.5 text-sm ${t.input}`}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
            className={`rounded-xl border px-3 py-2.5 text-sm ${t.input}`}
          >
            <option value="all">Tous statuts stock</option>
            <option value="ok">Stock OK</option>
            <option value="low">Stock faible</option>
            <option value="out">Rupture</option>
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as ActiveFilter)}
            className={`rounded-xl border px-3 py-2.5 text-sm ${t.input}`}
          >
            <option value="all">Actifs + inactifs</option>
            <option value="active">Actifs uniquement</option>
            <option value="inactive">Inactifs uniquement</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortField)}
            className={`rounded-xl border px-3 py-2.5 text-sm ${t.input}`}
          >
            <option value="stock_asc">Stock croissant</option>
            <option value="stock_desc">Stock décroissant</option>
            <option value="value_desc">Valeur stock (+)</option>
            <option value="name">Nom (A-Z)</option>
            <option value="updated">Dernière MAJ</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className={`flex items-center gap-2 ${t.textMuted} font-semibold`}>
            <span>{filtered.length} produit(s) affiché(s)</span>
            <span>•</span>
            <span>{kpis.low + kpis.out} alerte(s) active(s)</span>
          </div>
          <button
            onClick={() => setFilterStatus(filterStatus === 'low' ? 'all' : 'low')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-bold transition-colors ${
              filterStatus === 'low'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle size={12} />
            Stock faible ({kpis.low})
          </button>
        </div>
      </div>

      {/* ═══ Stock table ═══ */}
      <div className={`${t.card} ${t.cardBorder} rounded-2xl border shadow-sm overflow-hidden`}>
        {loading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-lg mb-3">
              <Boxes size={26} />
            </div>
            <p className={`text-base font-black ${t.text}`}>
              {products.length === 0
                ? 'Aucun produit dans votre catalogue'
                : 'Aucun produit ne correspond aux filtres'}
            </p>
            <p className={`text-xs ${t.textMuted} mt-1`}>
              {products.length === 0
                ? 'Créez vos produits dans le module Produits pour commencer à gérer le stock.'
                : 'Ajustez la recherche ou les filtres pour élargir la sélection.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={`${isDark ? 'bg-gray-900/40' : 'bg-gray-50/80'} border-b ${t.divider}`}>
                <tr className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted}`}>
                  <th className="px-4 py-3 text-left">Produit</th>
                  <th className="px-3 py-3 text-left">Catégorie</th>
                  <th className="px-3 py-3 text-center">Stock</th>
                  <th className="px-3 py-3 text-center">Seuil</th>
                  <th className="px-3 py-3 text-center">Statut</th>
                  <th className="px-3 py-3 text-center">Actif</th>
                  <th className="px-3 py-3 text-left">MAJ</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filtered.map((product) => {
                    const health = getStockHealth(product);
                    const badge = healthBadge(health);
                    const BadgeIcon = badge.icon;
                    const catName = categoryById[product.category_id || '']?.name_fr || '—';
                    const isPulsing = pulseProduct === product.id;
                    return (
                      <motion.tr
                        layout
                        key={product.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, backgroundColor: isPulsing ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0)' }}
                        transition={{ duration: 0.4 }}
                        className={`border-b ${t.divider} transition-colors`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200">
                              {product.images?.[0] ? (
                                <img src={product.images[0]} alt={product.name_fr} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-gray-400">
                                  <ImageIcon size={14} />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-bold ${t.text} truncate`}>{product.name_fr || 'Sans nom'}</p>
                              {product.sku && (
                                <p className={`text-[10px] font-mono ${t.textMuted} truncate`}>{product.sku}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <span className={`inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700`}>
                            <Tag size={10} />
                            {catName}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => quickDelta(product, -1)}
                              disabled={product.stock <= 0}
                              title="-1"
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600 hover:bg-rose-100 hover:text-rose-600 disabled:opacity-40 transition-colors"
                            >
                              <Minus size={12} />
                            </button>
                            <span className={`min-w-[2.5rem] text-center text-base font-black ${
                              health === 'out' ? 'text-rose-600' : health === 'low' ? 'text-amber-600' : t.text
                            }`}>
                              {product.stock}
                            </span>
                            <button
                              onClick={() => quickDelta(product, +1)}
                              title="+1"
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-bold ${t.textMuted}`}>{product.low_stock_threshold ?? 5}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${badge.cls}`}>
                            <BadgeIcon size={10} />
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {product.is_active ? (
                            <Eye size={14} className="mx-auto text-emerald-600" />
                          ) : (
                            <EyeOff size={14} className="mx-auto text-gray-400" />
                          )}
                        </td>
                        <td className={`px-3 py-3 text-[11px] ${t.textMuted}`}>
                          {product.updated_at ? relativeTime(product.updated_at) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setAdjustTarget(product)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <Save size={11} />
                              Ajuster
                            </button>
                            <button
                              onClick={() => openHistoryFor(product)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                              title="Voir l'historique"
                            >
                              <History size={11} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ Adjust modal ═══ */}
      <AnimatePresence>
        {adjustTarget && (
          <StockAdjustDialog
            product={adjustTarget}
            saving={false}
            onClose={() => setAdjustTarget(null)}
            onSave={async (payload) => {
              await performAdjust({ product: adjustTarget, ...payload });
              setAdjustTarget(null);
            }}
            onOpenHistory={() => {
              const product = adjustTarget;
              setAdjustTarget(null);
              if (product) openHistoryFor(product);
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══ History drawer ═══ */}
      <AnimatePresence>
        {historyOpen && (
          <StockHistoryDrawer
            product={historyScope}
            movements={movements}
            loading={loadingHistory}
            categoryById={categoryById}
            onClose={() => { setHistoryOpen(false); setHistoryScope(null); }}
            onRefresh={() => loadMovements(historyScope?.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Adjust dialog — premium modal with mode tabs and live preview.
// ═══════════════════════════════════════════════════════════════════
type AdjustDialogProps = {
  product: Product;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: { mode: StockAdjustMode; value: number; reason?: string }) => Promise<void>;
  onOpenHistory: () => void;
};

function StockAdjustDialog({ product, onClose, onSave, onOpenHistory }: AdjustDialogProps) {
  const { t } = useAdminUI();
  const [mode, setMode] = useState<StockAdjustMode>('increase');
  const [value, setValue] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const computedNewStock = useMemo(() => {
    const current = Number(product.stock || 0);
    const safeValue = Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0));
    switch (mode) {
      case 'set':       return safeValue;
      case 'increase':  return current + safeValue;
      case 'decrease':  return Math.max(0, current - safeValue);
      case 'threshold': return current;
    }
  }, [mode, value, product.stock]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSave({ mode, value, reason: reason.trim() || undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const modes: { key: StockAdjustMode; label: string; description: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: 'increase',  label: 'Augmenter',  description: 'Ajouter des unités (réception, retour).', icon: Plus },
    { key: 'decrease',  label: 'Diminuer',   description: 'Retirer des unités (casse, perte).',     icon: Minus },
    { key: 'set',       label: 'Quantité exacte', description: 'Remplacer la valeur actuelle par une valeur précise.', icon: Target },
    { key: 'threshold', label: 'Seuil alerte',  description: 'Met à jour uniquement le seuil de stock faible.', icon: AlertCircle },
  ];

  const delta = computedNewStock - Number(product.stock || 0);
  const deltaColor = delta === 0 ? 'text-gray-500' : delta > 0 ? 'text-emerald-600' : 'text-rose-600';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className={`${t.card} ${t.cardBorder} w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl`}
      >
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                <Boxes size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/80">Ajustement de stock</p>
                <h3 className="text-lg font-black truncate max-w-[18rem]">{product.name_fr}</h3>
                {product.sku && <p className="text-xs font-mono text-white/70">{product.sku}</p>}
              </div>
            </div>
            <button onClick={onClose} disabled={submitting} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-2">
            {modes.map(({ key, label, description, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  mode === key
                    ? 'border-emerald-400 bg-emerald-50 shadow-inner'
                    : `${t.cardBorder} ${t.rowHover}`
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={14} />
                  <span className={`text-sm font-black ${t.text}`}>{label}</span>
                </div>
                <p className={`text-[11px] ${t.textMuted} mt-1 leading-snug`}>{description}</p>
              </button>
            ))}
          </div>

          {/* Value input */}
          <div>
            <label className={`text-[11px] font-black uppercase tracking-wider ${t.textMuted} mb-1.5 block`}>
              {mode === 'threshold' ? 'Nouveau seuil' : mode === 'set' ? 'Quantité exacte' : 'Nombre d\'unités'}
            </label>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
              className={`w-full rounded-xl border px-4 py-3 text-2xl font-black ${t.input}`}
            />
          </div>

          {/* Live preview */}
          {mode !== 'threshold' && (
            <div className="flex items-center justify-between rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3 text-sm">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted}`}>Stock actuel</p>
                <p className={`text-xl font-black ${t.text}`}>{product.stock}</p>
              </div>
              <div className={`text-xl font-black ${deltaColor}`}>
                {delta >= 0 ? `+${delta}` : delta}
              </div>
              <div className="text-right">
                <p className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted}`}>Nouveau stock</p>
                <p className="text-xl font-black text-emerald-700">{computedNewStock}</p>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className={`text-[11px] font-black uppercase tracking-wider ${t.textMuted} mb-1.5 block`}>
              Raison (optionnelle mais recommandée)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex: Réception fournisseur, inventaire mensuel, retour client…"
              className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input} resize-none`}
            />
          </div>

          {/* Guidance */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-2.5 text-[11px] text-blue-800">
            <Sparkles size={12} className="mt-0.5 shrink-0" />
            <span>
              Les ajustements sont <strong>persistés immédiatement dans Supabase</strong> et
              enregistrés dans l'historique des mouvements avec votre nom et l'heure.
            </span>
          </div>
        </div>

        <div className={`flex items-center justify-between gap-2 border-t ${t.divider} px-6 py-4 bg-gray-50/60`}>
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-1.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 px-3 py-2"
          >
            <History size={12} />
            Voir l'historique
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={`rounded-xl border ${t.cardBorder} px-4 py-2.5 text-sm font-semibold ${t.text} ${t.rowHover}`}
            >
              Annuler
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={submitting || (mode !== 'threshold' && value <= 0 && mode !== 'set')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {submitting ? 'Sauvegarde…' : 'Enregistrer'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// History drawer — timeline of stock movements (admin or system).
// ═══════════════════════════════════════════════════════════════════
type HistoryDrawerProps = {
  product: Product | null;
  movements: StockMovement[];
  loading: boolean;
  categoryById: Record<string, Category>;
  onClose: () => void;
  onRefresh: () => void;
};

function StockHistoryDrawer({ product, movements, loading, onClose, onRefresh }: HistoryDrawerProps) {
  const { t } = useAdminUI();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[85] flex justify-end bg-black/55 backdrop-blur-sm"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className={`${t.card} ${t.cardBorder} w-full max-w-lg h-full overflow-y-auto border-l shadow-2xl flex flex-col`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white/95 backdrop-blur px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <History size={18} />
            </div>
            <div>
              <h3 className={`text-base font-black ${t.text}`}>
                {product ? `Historique — ${product.name_fr}` : 'Historique global'}
              </h3>
              <p className={`text-[11px] ${t.textMuted}`}>
                {product
                  ? 'Tous les mouvements enregistrés pour ce produit.'
                  : 'Derniers mouvements d\'inventaire (admin + automatiques).'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title="Actualiser"
            >
              <RefreshCw size={14} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 px-5 py-4 space-y-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 animate-pulse" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-500 mb-3">
                <Clock size={22} />
              </div>
              <p className={`text-sm font-black ${t.text}`}>Aucun mouvement pour le moment</p>
              <p className={`text-xs ${t.textMuted} mt-1 max-w-xs`}>
                Les ajustements manuels et les mouvements liés aux commandes apparaîtront ici.
              </p>
            </div>
          ) : (
            movements.map((m) => {
              const tone = movementTone(m.source, m.delta);
              const Icon = tone.icon;
              return (
                <div
                  key={m.id}
                  className={`relative rounded-xl border ${tone.tone} p-3 pl-4`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ${tone.cls}`}>
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-black ${t.text}`}>
                            {m.action_type === 'order_deduct' && 'Déduction commande'}
                            {m.action_type === 'order_restore' && 'Restauration commande'}
                            {m.action_type === 'set' && 'Quantité exacte'}
                            {m.action_type === 'increase' && 'Augmentation manuelle'}
                            {m.action_type === 'decrease' && 'Diminution manuelle'}
                          </span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            m.source === 'admin_manual'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {m.source === 'admin_manual' ? 'Admin' : 'Auto'}
                          </span>
                        </div>
                        <div className={`text-[11px] ${t.textMuted} mt-0.5`}>
                          {m.old_quantity} → <strong>{m.new_quantity}</strong> unités
                          {m.admin_label && <span className="ml-1.5">• par {m.admin_label}</span>}
                        </div>
                        {m.reason && (
                          <p className={`text-xs italic ${t.textMuted} mt-1 truncate`}>"{m.reason}"</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-black ${tone.cls}`}>
                        {m.delta >= 0 ? `+${m.delta}` : m.delta}
                      </p>
                      <p className={`text-[10px] ${t.textMuted} mt-0.5`}>{relativeTime(m.created_at)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={`border-t ${t.divider} px-5 py-3 text-[11px] ${t.textMuted} flex items-start gap-2 bg-gray-50/60`}>
          <Sparkles size={12} className="mt-0.5 shrink-0 text-indigo-500" />
          <span>
            <strong>Astuce :</strong> les mouvements <em>Auto</em> proviennent des commandes (déduction à
            la création, restauration à l'annulation). Les mouvements <em>Admin</em> viennent de ce module.
          </span>
        </div>
      </motion.aside>
    </motion.div>
  );
}
