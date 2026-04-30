/**
 * Mobile Dashboard — read-only KPI overview for the Expo app.
 *
 * Pulls data from three sources:
 *   ▸ Existing /stats admin endpoint    → orders count, revenue (web+app)
 *   ▸ Direct supabaseClient (anon RLS)  → counts of products, banners,
 *                                          mobile_home_sections enabled
 *   ▸ Direct supabaseClient (anon RLS)  → mobile_theme + mobile_cart_settings
 *                                          to surface "is the app config
 *                                          set up correctly?" health.
 *
 * Future (Phase B follow-up): add an admin RPC that aggregates
 * app_users / app_events safely so we can show DAU / MAU and the
 * top-viewed products funnel without exposing raw rows.
 *
 * Until that ships, this page is the single best place for the admin
 * to confirm the mobile config is healthy at a glance.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, Image as ImageIcon,
  Layers, Package, RefreshCw, Smartphone, ShoppingCart,
} from 'lucide-react';
import { adminApi } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useAdminUI } from '../../../context/AdminUIContext';
import { supabaseClient } from '../../../lib/supabaseClient';
import { toast } from 'sonner';

interface MobileSection {
  section_key: string;
  is_enabled: boolean;
  sort_order: number;
}

interface ThemeRow {
  primary_color: string | null;
  cta_color: string | null;
}

interface CartRow {
  min_order: number | null;
  free_delivery_threshold: number | null;
  default_delivery_price: number | null;
  whatsapp_enabled: boolean | null;
  cod_enabled: boolean | null;
  checkout_mode: string | null;
}

interface BannerRow {
  id: string;
  banner_type: string | null;
  placement: string | null;
  is_active: boolean | null;
}

interface ProductRow {
  id: string;
  is_active: boolean | null;
  promo_end_at: string | null;
  sale_price: number | null;
}

interface StatsResponse {
  orders?: { total?: number; new?: number };
  revenue?: { total?: number };
}

export function MobileDashboard() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [sections, setSections] = useState<MobileSection[]>([]);
  const [theme, setTheme] = useState<ThemeRow | null>(null);
  const [cart, setCart] = useState<CartRow | null>(null);
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const load = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [statsRes, sectionsRes, themeRes, cartRes, bannersRes, productsRes] =
        await Promise.all([
          adminApi.get('/stats', token).catch(() => null),
          supabaseClient
            .from('mobile_home_sections')
            .select('section_key,is_enabled,sort_order')
            .order('sort_order', { ascending: true }),
          supabaseClient
            .from('mobile_theme')
            .select('primary_color,cta_color')
            .eq('id', 'default')
            .maybeSingle(),
          supabaseClient
            .from('mobile_cart_settings')
            .select(
              'min_order,free_delivery_threshold,default_delivery_price,whatsapp_enabled,cod_enabled,checkout_mode',
            )
            .eq('id', 'default')
            .maybeSingle(),
          supabaseClient
            .from('banners')
            .select('id,banner_type,placement,is_active'),
          supabaseClient
            .from('products')
            .select('id,is_active,promo_end_at,sale_price'),
        ]);

      setStats((statsRes ?? null) as StatsResponse | null);
      setSections((sectionsRes.data ?? []) as MobileSection[]);
      setTheme((themeRes.data ?? null) as ThemeRow | null);
      setCart((cartRes.data ?? null) as CartRow | null);
      setBanners((bannersRes.data ?? []) as BannerRow[]);
      setProducts((productsRes.data ?? []) as ProductRow[]);
    } catch (err) {
      console.error('[mobile-dashboard] load failed:', err);
      toast.error('Impossible de charger les KPI mobiles.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ─── Derived KPIs ─────────────────────────────────────────────
  const enabledSections = useMemo(
    () => sections.filter((s) => s.is_enabled).length,
    [sections],
  );

  const mobileBanners = useMemo(
    () =>
      banners.filter((b) => {
        const tag = (b.banner_type ?? '').toLowerCase();
        const place = (b.placement ?? '').toLowerCase();
        return (
          tag === 'mobile_only' ||
          place.startsWith('mobile_') ||
          place === 'future_app_banner'
        );
      }),
    [banners],
  );

  const mobileBannersActive = useMemo(
    () => mobileBanners.filter((b) => b.is_active !== false).length,
    [mobileBanners],
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.is_active !== false).length,
    [products],
  );

  const liveFlashSales = useMemo(() => {
    const now = Date.now();
    return products.filter((p) => {
      if (p.sale_price == null || p.sale_price <= 0) return false;
      if (p.promo_end_at == null) return true; // sale with no end date
      const ts = Date.parse(p.promo_end_at);
      return Number.isFinite(ts) && ts > now;
    }).length;
  }, [products]);

  const expiredFlashSales = useMemo(() => {
    const now = Date.now();
    return products.filter((p) => {
      if (p.sale_price == null || p.sale_price <= 0 || p.promo_end_at == null) return false;
      const ts = Date.parse(p.promo_end_at);
      return Number.isFinite(ts) && ts <= now;
    }).length;
  }, [products]);

  const ordersTotal = stats?.orders?.total ?? 0;
  const ordersNew = stats?.orders?.new ?? 0;

  // ─── Health checks ─────────────────────────────────────────────
  const healthIssues: string[] = [];
  if (enabledSections === 0) healthIssues.push('Aucune section Home activée — l\'app mobile sera vide.');
  if (mobileBannersActive === 0) healthIssues.push('Aucune bannière mobile active — la home n\'aura pas de hero.');
  if (cart && (cart.checkout_mode ?? 'both') === 'whatsapp' && cart.whatsapp_enabled === false)
    healthIssues.push('Mode checkout = WhatsApp mais le bouton est désactivé.');
  if (expiredFlashSales > 0)
    healthIssues.push(`${expiredFlashSales} promotion(s) expirée(s) encore visibles côté DB.`);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-700" />
          <h2 className={`text-base font-black ${t.text}`}>Vue d&apos;ensemble</h2>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ShoppingCart}
          gradient="from-blue-500 to-blue-700"
          label="Commandes totales"
          value={ordersTotal.toString()}
          hint={`${ordersNew} nouvelles à traiter`}
          tone={t}
        />
        <KpiCard
          icon={Package}
          gradient="from-orange-500 to-orange-700"
          label="Produits actifs"
          value={activeProducts.toString()}
          hint={`${products.length - activeProducts} masqués`}
          tone={t}
        />
        <KpiCard
          icon={ImageIcon}
          gradient="from-rose-500 to-rose-700"
          label="Bannières mobiles"
          value={mobileBannersActive.toString()}
          hint={`${mobileBanners.length} configurées au total`}
          tone={t}
        />
        <KpiCard
          icon={Layers}
          gradient="from-fuchsia-500 to-purple-700"
          label="Sections Home actives"
          value={`${enabledSections} / ${sections.length}`}
          hint={enabledSections === 0 ? 'À activer' : 'Synchronisées'}
          tone={t}
        />
      </div>

      {/* Flash sales + cart + theme cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Offres Flash" icon={Activity} tone={t}>
          <div className="space-y-2">
            <KpiInline label="Promotions actives" value={String(liveFlashSales)} accent="text-emerald-600" tone={t} />
            <KpiInline label="Promotions expirées" value={String(expiredFlashSales)} accent="text-amber-600" tone={t} />
            <p className={`text-[11px] ${t.textMuted} pt-2 border-t ${t.divider}`}>
              Une promo est « active » si <code>sale_price</code> est défini et
              <code> promo_end_at</code> est dans le futur (ou null).
            </p>
          </div>
        </Panel>

        <Panel title="Paramètres Panier" icon={Smartphone} tone={t}>
          {cart ? (
            <div className="space-y-2">
              <KpiInline label="Min. commande" value={fmtPrice(cart.min_order)} tone={t} />
              <KpiInline label="Livraison gratuite dès" value={fmtPrice(cart.free_delivery_threshold)} tone={t} />
              <KpiInline label="Frais de livraison" value={fmtPrice(cart.default_delivery_price)} tone={t} />
              <KpiInline
                label="Mode checkout"
                value={(cart.checkout_mode ?? 'both').toUpperCase()}
                accent="text-blue-700"
                tone={t}
              />
            </div>
          ) : (
            <p className={`text-xs ${t.textMuted}`}>Aucune valeur — utilisez les défauts.</p>
          )}
        </Panel>

        <Panel title="Thème mobile" icon={CheckCircle2} tone={t}>
          {theme ? (
            <div className="space-y-2">
              <ColorRow label="Primary" value={theme.primary_color ?? '#2D7DD2 (par défaut)'} />
              <ColorRow label="CTA" value={theme.cta_color ?? '#FF7A1A (par défaut)'} />
              <p className={`text-[11px] ${t.textMuted} pt-2 border-t ${t.divider}`}>
                Couleurs vides = l&apos;app utilise les valeurs définies dans
                <code> constants/theme.ts</code>.
              </p>
            </div>
          ) : (
            <p className={`text-xs ${t.textMuted}`}>Aucun thème custom configuré.</p>
          )}
        </Panel>
      </div>

      {/* Sections list */}
      <Panel title={`Ordre des sections Home (${enabledSections}/${sections.length})`} icon={Layers} tone={t}>
        {sections.length === 0 ? (
          <p className={`text-xs ${t.textMuted}`}>Aucune section configurée.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((s) => (
              <li
                key={s.section_key}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${t.cardBorder} ${
                  s.is_enabled ? 'bg-emerald-50/40' : 'bg-gray-50/60 opacity-60'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    s.is_enabled ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                />
                <span className={`text-xs font-bold ${t.text} truncate`}>{s.section_key}</span>
                <span className={`ml-auto text-[10px] ${t.textMuted}`}>#{s.sort_order}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Health */}
      {healthIssues.length > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-700" />
            <h3 className="font-black text-amber-800 text-sm">Points d&apos;attention</h3>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-amber-800 list-disc list-inside">
            {healthIssues.map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-4 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-700" />
          <p className="text-xs font-semibold text-emerald-800">
            Configuration mobile saine — aucun problème détecté.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ElementType;
  gradient: string;
  label: string;
  value: string;
  hint: string;
  tone: ReturnType<typeof useAdminUI>['t'];
}

function KpiCard({ icon: Icon, gradient, label, value, hint, tone }: KpiCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${tone.cardBorder} ${tone.card} p-4 shadow-sm`}
    >
      <div
        className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 bg-gradient-to-br ${gradient}`}
      />
      <div className="relative">
        <div
          className={`inline-flex w-9 h-9 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}
        >
          <Icon size={16} className="text-white" />
        </div>
        <p className={`mt-3 text-[11px] font-black uppercase tracking-wide ${tone.textMuted}`}>
          {label}
        </p>
        <p className={`text-2xl font-black ${tone.text} mt-0.5`}>{value}</p>
        <p className={`text-[11px] ${tone.textMuted} mt-0.5 truncate`}>{hint}</p>
      </div>
    </div>
  );
}

interface PanelProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  tone: ReturnType<typeof useAdminUI>['t'];
}

function Panel({ title, icon: Icon, children, tone }: PanelProps) {
  return (
    <section className={`rounded-2xl border ${tone.cardBorder} ${tone.card} p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-blue-700" />
        <h3 className={`text-sm font-black ${tone.text}`}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

interface KpiInlineProps {
  label: string;
  value: string;
  accent?: string;
  tone: ReturnType<typeof useAdminUI>['t'];
}

function KpiInline({ label, value, accent = '', tone }: KpiInlineProps) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${tone.textMuted}`}>{label}</span>
      <span className={`text-sm font-black ${accent || tone.text}`}>{value}</span>
    </div>
  );
}

function ColorRow({ label, value }: { label: string; value: string }) {
  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="w-4 h-4 rounded-md border border-gray-200"
        style={{ background: isHex ? value : '#E5E7EB' }}
      />
      <span className="font-bold text-gray-700 w-14">{label}</span>
      <span className="text-gray-500 truncate font-mono">{value}</span>
    </div>
  );
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} DA`;
}

export default MobileDashboard;
