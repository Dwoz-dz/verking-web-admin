import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, CreditCard, Headphones, ShieldCheck, Star, Truck, Package, Users, Award } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import { CategoriesMarketingStrip } from '../components/home/CategoriesMarketingStrip';
import { InlineAnnouncementStrip } from '../components/home/InlineAnnouncementStrip';
import { normalizeCategoriesStrip } from '../lib/categoriesStrip';
import { CATEGORIES_UPDATED_EVENT, CATEGORIES_UPDATED_KEY, CONTENT_UPDATED_KEY } from '../lib/realtime';
import { ProductCard } from '../components/ProductCard';

type SourceMode = 'manual' | 'products' | 'categories' | 'banners';

type HomepageSectionConfig = {
  enabled?: boolean;
  title_fr?: string;
  title_ar?: string;
  subtitle_fr?: string;
  subtitle_ar?: string;
  cta_fr?: string;
  cta_ar?: string;
  cta_link?: string;
  image?: string;
  source_mode?: SourceMode;
  source_ref?: string;
  style_variant?: string;
  limit?: number;
};

type HomepageConfig = {
  sections_order?: string[];
  [key: string]: any;
};

type BannerRecord = {
  id: string;
  title_fr?: string;
  title_ar?: string;
  subtitle_fr?: string;
  subtitle_ar?: string;
  cta_fr?: string;
  cta_ar?: string;
  image?: string;
  desktop_image?: string;
  mobile_image?: string;
  link?: string;
  is_active?: boolean;
  order?: number;
  sort_order?: number;
  placement?: string;
  start_at?: string | null;
  end_at?: string | null;
};

const DEFAULT_SECTION: HomepageSectionConfig = {
  enabled: true,
  title_fr: '',
  title_ar: '',
  subtitle_fr: '',
  subtitle_ar: '',
  cta_fr: '',
  cta_ar: '',
  cta_link: '',
  image: '',
  source_mode: 'manual',
  source_ref: '',
  style_variant: 'default',
};

const PRODUCT_SOURCE_KEYS = new Set(['featured', 'new_arrivals', 'best_sellers', 'promotions', 'all']);
const CATEGORY_SOURCE_KEYS = new Set(['homepage', 'all']);
const BANNER_SOURCE_KEYS = new Set([
  'homepage_hero',
  'homepage_secondary',
  'promotion_strip',
  'category_banner',
  'future_app_banner',
]);

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function pickLocalized(fr: unknown, ar: unknown, lang: 'fr' | 'ar', fallback = '') {
  const primary = asText(lang === 'ar' ? ar : fr);
  const secondary = asText(lang === 'ar' ? fr : ar);
  return primary || secondary || fallback;
}

function parseSourceRefs(value: unknown) {
  return asText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isBannerVisibleNow(banner: BannerRecord, nowTs: number) {
  if (banner.is_active === false) return false;
  const start = banner.start_at ? Date.parse(String(banner.start_at)) : NaN;
  const end = banner.end_at ? Date.parse(String(banner.end_at)) : NaN;
  if (Number.isFinite(start) && nowTs < start) return false;
  if (Number.isFinite(end) && nowTs > end) return false;
  return true;
}

export function resolveBannerHref(banner: any): string {
  const mode = typeof banner?.link_mode === 'string' ? banner.link_mode : 'url';
  const target = typeof banner?.link_target_id === 'string' ? banner.link_target_id : '';
  if (mode === 'product' && target) return `/product/${target}`;
  if (mode === 'category' && target) return `/shop?category=${encodeURIComponent(target)}`;
  const raw = (banner?.link || banner?.cta_link || '').toString().trim();
  return raw || '/shop';
}

export function HomePage() {
  const { lang, dir } = useLang();
  const { theme } = useTheme();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [content, setContent] = useState<any>({});
  const [homepageConfig, setHomepageConfig] = useState<HomepageConfig>({});
  const [banners, setBanners] = useState<BannerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHomeData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);

    const [productsResponse, categoriesResponse, contentResponse, homepageResponse, bannersResponse] = await Promise.all([
      api.get('/products?active=true').catch(() => ({ products: [] })),
      api.get('/categories').catch(() => ({ categories: [] })),
      api.get('/content').catch(() => ({ content: {} })),
      api.get('/homepage-config').catch(() => ({ config: {} })),
      api.get('/banners').catch(() => ({ banners: [] })),
    ]);

    setProducts(Array.isArray(productsResponse?.products) ? productsResponse.products : []);
    setCategories(Array.isArray(categoriesResponse?.categories) ? categoriesResponse.categories : []);
    setContent(contentResponse?.content || {});
    setHomepageConfig(homepageResponse?.config || {});
    setBanners(Array.isArray(bannersResponse?.banners) ? bannersResponse.banners : []);

    if (showLoader) setLoading(false);
  }, []);

  useEffect(() => {
    loadHomeData(true);
  }, [loadHomeData]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === CATEGORIES_UPDATED_KEY || event.key === CONTENT_UPDATED_KEY) {
        loadHomeData();
      }
    };

    const onCategoriesUpdated = () => loadHomeData();
    const onFocus = () => loadHomeData();

    window.addEventListener('storage', onStorage);
    window.addEventListener(CATEGORIES_UPDATED_EVENT, onCategoriesUpdated);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CATEGORIES_UPDATED_EVENT, onCategoriesUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadHomeData]);

  const nowTs = Date.now();

  const activeProducts = useMemo(
    () => products.filter((product) => product?.is_active !== false),
    [products],
  );

  const activeCategories = useMemo(
    () =>
      categories
        .filter((category) => category?.is_active !== false)
        .sort(
          (left, right) =>
            (left?.sort_order ?? left?.order ?? 0) - (right?.sort_order ?? right?.order ?? 0),
        ),
    [categories],
  );

  const visibleBanners = useMemo(
    () =>
      banners
        .filter((banner) => isBannerVisibleNow(banner, nowTs))
        .sort(
          (left, right) =>
            (left?.order ?? left?.sort_order ?? 0) - (right?.order ?? right?.sort_order ?? 0),
        ),
    [banners, nowTs],
  );

  const getSection = useCallback(
    (key: string): HomepageSectionConfig => ({
      ...DEFAULT_SECTION,
      ...(homepageConfig?.[key] || {}),
    }),
    [homepageConfig],
  );

  const resolveProductsBySource = useCallback(
    (sectionKey: string, fallbackFilter: (product: any) => boolean) => {
      const section = getSection(sectionKey);
      const refs = parseSourceRefs(section.source_ref);
      const limit = Math.min(24, Math.max(1, Number(section.limit || 8)));

      let pool: any[] = [];
      if (section.source_mode === 'products') {
        const selectedByPreset: any[] = [];
        const selectedById: any[] = [];
        for (const ref of refs) {
          if (!PRODUCT_SOURCE_KEYS.has(ref)) {
            const product = activeProducts.find((item) => item.id === ref);
            if (product) selectedById.push(product);
            continue;
          }
          if (ref === 'featured') {
            selectedByPreset.push(...activeProducts.filter((product) => product?.is_featured || product?.show_on_homepage || product?.show_in_featured));
          } else if (ref === 'new_arrivals') {
            selectedByPreset.push(...activeProducts.filter((product) => product?.is_new || product?.show_in_new_arrivals));
          } else if (ref === 'best_sellers') {
            selectedByPreset.push(...activeProducts.filter((product) => product?.is_best_seller || product?.show_in_best_sellers));
          } else if (ref === 'promotions') {
            selectedByPreset.push(...activeProducts.filter((product) => product?.show_in_promotions || (product?.sale_price && product.sale_price < product.price)));
          } else if (ref === 'all') {
            selectedByPreset.push(...activeProducts);
          }
        }

        const deduped = new Map<string, any>();
        [...selectedByPreset, ...selectedById].forEach((item) => {
          if (item?.id && !deduped.has(item.id)) deduped.set(item.id, item);
        });
        pool = Array.from(deduped.values());
      } else {
        pool = activeProducts.filter(fallbackFilter);
      }

      if (pool.length === 0) {
        pool = activeProducts.filter(fallbackFilter);
      }
      return pool.slice(0, limit);
    },
    [activeProducts, getSection],
  );

  const resolveCategoriesBySource = useCallback(
    (sectionKey: string) => {
      const section = getSection(sectionKey);
      const refs = parseSourceRefs(section.source_ref);
      const limit = Math.min(12, Math.max(1, Number(section.limit || 6)));

      if (section.source_mode !== 'categories') {
        const homepageCategories = activeCategories.filter((category) => category?.show_on_homepage === true);
        const fallback = homepageCategories.length > 0 ? homepageCategories : activeCategories;
        return fallback.slice(0, limit);
      }

      if (refs.length === 0 || refs.includes('all')) {
        return activeCategories.slice(0, limit);
      }

      const selected: any[] = [];
      if (refs.includes('homepage')) {
        selected.push(...activeCategories.filter((category) => category?.show_on_homepage === true));
      }
      for (const ref of refs) {
        if (CATEGORY_SOURCE_KEYS.has(ref)) continue;
        const category = activeCategories.find((item) => item.id === ref);
        if (category) selected.push(category);
      }

      const deduped = new Map<string, any>();
      selected.forEach((item) => {
        if (item?.id && !deduped.has(item.id)) deduped.set(item.id, item);
      });
      const result = Array.from(deduped.values());
      return (result.length > 0 ? result : activeCategories).slice(0, limit);
    },
    [activeCategories, getSection],
  );

  const resolveBannersBySource = useCallback(
    (sectionKey: string, defaultPlacement?: string) => {
      const section = getSection(sectionKey);
      const refs = parseSourceRefs(section.source_ref);

      let pool: BannerRecord[] = [];
      if (section.source_mode === 'banners') {
        if (refs.length === 0 && defaultPlacement) {
          pool = visibleBanners.filter((banner) => asText(banner.placement) === defaultPlacement);
        } else {
          for (const ref of refs) {
            if (BANNER_SOURCE_KEYS.has(ref)) {
              pool.push(...visibleBanners.filter((banner) => asText(banner.placement) === ref));
            } else {
              const banner = visibleBanners.find((item) => item.id === ref);
              if (banner) pool.push(banner);
            }
          }
        }
      } else if (defaultPlacement) {
        pool = visibleBanners.filter((banner) => asText(banner.placement) === defaultPlacement);
      }

      const deduped = new Map<string, BannerRecord>();
      pool.forEach((item) => {
        if (item?.id && !deduped.has(item.id)) deduped.set(item.id, item);
      });
      return Array.from(deduped.values());
    },
    [getSection, visibleBanners],
  );

  const categoriesStrip = useMemo(() => normalizeCategoriesStrip(content), [content]);

  const featuredProducts = useMemo(
    () =>
      resolveProductsBySource(
        'featured',
        (product) => product?.is_featured || product?.show_on_homepage || product?.show_in_featured,
      ),
    [resolveProductsBySource],
  );

  const newProducts = useMemo(
    () =>
      resolveProductsBySource(
        'new_arrivals',
        (product) => product?.is_new || product?.show_in_new_arrivals,
      ),
    [resolveProductsBySource],
  );

  const bestSellerProducts = useMemo(
    () =>
      resolveProductsBySource(
        'best_sellers',
        (product) => product?.is_best_seller || product?.show_in_best_sellers,
      ),
    [resolveProductsBySource],
  );

  const promoProducts = useMemo(
    () =>
      resolveProductsBySource(
        'promotions',
        (product) => product?.show_in_promotions || (product?.sale_price && product.sale_price < product.price),
      ),
    [resolveProductsBySource],
  );

  const categoryCards = useMemo(
    () => resolveCategoriesBySource('categories'),
    [resolveCategoriesBySource],
  );

  const heroSection = getSection('hero');
  const categorySection = getSection('categories');
  const featuredSection = getSection('featured');
  const newSection = getSection('new_arrivals');
  const bestSection = getSection('best_sellers');
  const promoSection = getSection('promotions');
  const newsletterSection = getSection('newsletter');
  const wholesaleSection = getSection('wholesale');
  const testimonialsSection = getSection('testimonials');
  const trustSection = getSection('trust');

  const heroBanner = resolveBannersBySource('hero', 'homepage_hero')[0];
  const promoBanners = resolveBannersBySource('promotions', 'promotion_strip');

  const heroTitle = pickLocalized(
    heroSection.title_fr || heroBanner?.title_fr,
    heroSection.title_ar || heroBanner?.title_ar,
    lang,
    lang === 'ar' ? 'مجموعة الدخول المدرسي الجديدة' : 'Prêt pour la Rentrée ?',
  );
  const heroSubtitle = pickLocalized(
    heroSection.subtitle_fr || heroBanner?.subtitle_fr,
    heroSection.subtitle_ar || heroBanner?.subtitle_ar,
    lang,
    lang === 'ar' ? 'اكتشف عروضنا المميزة للأطفال والمدارس.' : 'Découvrez Nos Offres Spéciales pour enfants et écoles.',
  );
  const heroCtaText = pickLocalized(
    heroSection.cta_fr || heroBanner?.cta_fr,
    heroSection.cta_ar || heroBanner?.cta_ar,
    lang,
    lang === 'ar' ? 'تسوق الآن' : 'Découvrir',
  );
  const heroLink = heroBanner
    ? resolveBannerHref({ ...heroBanner, link: asText(heroSection.cta_link) || asText(heroBanner?.link) })
    : (asText(heroSection.cta_link) || '/shop');
  const heroImage =
    asText(heroSection.image) ||
    asText(heroBanner?.desktop_image) ||
    asText(heroBanner?.image) ||
    '/hero-marcelo.jpg';

  const showFeaturedSection = featuredSection.enabled !== false && theme.show_featured !== false;
  const showNewSection = newSection.enabled !== false && theme.show_new_arrivals !== false;
  const showBestSection = bestSection.enabled !== false && theme.show_best_sellers !== false;
  const showWholesaleSection = wholesaleSection.enabled !== false && theme.show_wholesale_section !== false;
  const showTestimonialsSection = testimonialsSection.enabled !== false && theme.show_testimonials !== false;

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg,#bbd8f0 0%,#cce6ff 20%,#dbeeff 45%,#f0f8ff 80%,#f8fbff 100%)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-sky-200 border-t-[#E5252A] rounded-full animate-spin shadow-lg" />
          <p className="text-sky-700 font-semibold text-sm tracking-wide">
            {lang === 'ar' ? 'جاري التحميل…' : 'Chargement…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      className="min-h-screen font-sans w-full overflow-x-hidden relative"
      style={{ background: 'linear-gradient(160deg,#bbd8f0 0%,#cce6ff 18%,#dbeeff 38%,#eaf5ff 58%,#f4f9ff 78%,#fafcff 100%)' }}
    >
      {/* Atmospheric blur blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
        <div className="absolute -top-40 left-1/3 w-[700px] h-[700px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle,rgba(147,197,253,0.35) 0%,transparent 70%)' }} />
        <div className="absolute top-1/2 -right-32 w-[500px] h-[500px] rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle,rgba(186,230,255,0.28) 0%,transparent 70%)' }} />
        <div className="absolute bottom-0 -left-24 w-[400px] h-[400px] rounded-full blur-[90px]" style={{ background: 'radial-gradient(circle,rgba(199,210,254,0.25) 0%,transparent 70%)' }} />
      </div>

      <div className="relative z-10">

        {/* ─── HERO ─── */}
        <section className="px-3 md:px-5 pt-4 pb-0 max-w-[1400px] mx-auto">
          <div
            className="relative rounded-[2rem] overflow-hidden min-h-[440px] md:min-h-[560px] shadow-2xl border-2 border-white/60"
            style={{ boxShadow: '0 32px 80px -8px rgba(30,80,140,0.25), 0 0 0 1px rgba(255,255,255,0.5) inset' }}
          >
            {/* Hero image */}
            <div className="absolute inset-0">
              <img
                src={heroImage}
                onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2022&auto=format&fit=crop'; }}
                alt={heroTitle}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10 rtl:from-black/10 rtl:via-black/50 rtl:to-black/80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>

            {/* Hero content */}
            <div className="relative z-10 flex flex-col justify-end h-full min-h-[440px] md:min-h-[560px] p-6 md:p-14">
              <div className="max-w-2xl rtl:ml-auto">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full border border-white/25 shadow-lg"
                  style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                  <span className="font-black text-[10px] md:text-[11px] tracking-[0.22em] uppercase text-white">
                    Marcelo · Collection 2026
                  </span>
                </div>

                {/* Title */}
                <h1
                  className="text-white font-black text-4xl md:text-6xl lg:text-7xl leading-[1.02] mb-4 tracking-tight drop-shadow-2xl"
                  style={{ fontFamily: 'Montserrat, sans-serif', textShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
                >
                  {heroTitle}
                </h1>

                {/* Subtitle */}
                <p className="text-white/90 text-sm md:text-xl font-medium mb-8 max-w-lg leading-relaxed drop-shadow-md">
                  {heroSubtitle}
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link
                    to={heroLink}
                    className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.16em] transition-all duration-200 hover:scale-[1.04] active:scale-[0.98] shadow-xl text-white"
                    style={{ background: 'linear-gradient(135deg,#E5252A,#c41e23)', boxShadow: '0 8px 32px rgba(229,37,42,0.45)' }}
                  >
                    {heroCtaText}
                    <ChevronRight size={16} className="rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                  </Link>
                  <Link
                    to="/shop?promo=true"
                    className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.16em] transition-all duration-200 hover:scale-[1.04] active:scale-[0.98] text-gray-900"
                    style={{ background: 'linear-gradient(135deg,#FFD700,#FFC107)', boxShadow: '0 8px 32px rgba(255,193,7,0.45)' }}
                  >
                    {lang === 'ar' ? 'العروض الخاصة' : 'Offres Spéciales'}
                  </Link>
                </div>
              </div>
            </div>

            {/* Decorative corner blobs inside hero */}
            <div className="absolute top-6 right-8 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none" style={{ background: 'radial-gradient(circle,#60a5fa,transparent)' }} aria-hidden />
            <div className="absolute bottom-0 right-1/3 w-48 h-24 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle,#fbbf24,transparent)' }} aria-hidden />
          </div>

          {/* Trust badges bar — floats below hero */}
          {trustSection.enabled !== false && (
            <div
              className="relative -mt-5 z-20 mx-3 md:mx-8 lg:mx-16 rounded-[1.25rem] p-3 md:p-4 grid grid-cols-2 md:grid-cols-4 gap-2"
              style={{
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(18px)',
                border: '1.5px solid rgba(255,255,255,0.9)',
                boxShadow: '0 20px 60px -10px rgba(30,80,140,0.18), 0 1px 0 rgba(255,255,255,0.9) inset',
              }}
            >
              {[
                { icon: <Truck size={20} />, bg: 'bg-sky-50', color: 'text-sky-600', label: lang === 'ar' ? 'توصيل سريع' : 'Livraison rapide' },
                { icon: <CreditCard size={20} />, bg: 'bg-green-50', color: 'text-green-600', label: lang === 'ar' ? 'الدفع عند الاستلام' : 'Paiement à la livraison' },
                { icon: <ShieldCheck size={20} />, bg: 'bg-amber-50', color: 'text-amber-500', label: lang === 'ar' ? 'جودة عالية' : 'Qualité premium' },
                { icon: <Headphones size={20} />, bg: 'bg-purple-50', color: 'text-purple-600', label: lang === 'ar' ? 'دعم العملاء' : 'Support client' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center justify-center text-center gap-2 py-1">
                  <div className={`w-10 h-10 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center shadow-sm`}>{item.icon}</div>
                  <span className="font-bold text-[10px] md:text-[11px] text-gray-700 leading-tight">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── ANNOUNCEMENT / CATEGORIES STRIP ─── */}
        <section className="pt-8 pb-0 px-3 md:px-5 max-w-[1400px] mx-auto">
          {content?.categories_marquee_enabled === true && (
            <div className="mb-4">
              <InlineAnnouncementStrip content={content} lang={lang} className="rounded-2xl" />
            </div>
          )}
          {categoriesStrip.enabled && (
            <div className="mb-4">
              <CategoriesMarketingStrip config={categoriesStrip} lang={lang} dir={dir} chips={[]} ctaHref={categoriesStrip.cta_link} />
            </div>
          )}
        </section>

        {/* ─── MAIN BENTO CONTENT ─── */}
        <section className="px-3 md:px-5 py-6 max-w-[1400px] mx-auto space-y-5">

          {/* Bento Row 1: Featured Products + Categories */}
          {(showFeaturedSection && featuredProducts.length > 0) || categorySection.enabled !== false ? (
            <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">

              {/* Featured Products Panel */}
              {showFeaturedSection && featuredProducts.length > 0 && (
                <div
                  className="rounded-[1.75rem] p-5 md:p-7"
                  style={{
                    background: 'rgba(255,255,255,0.78)',
                    backdropFilter: 'blur(20px)',
                    border: '1.5px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 20px 60px -10px rgba(30,80,140,0.12)',
                  }}
                >
                  {/* Panel header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow"
                        style={{ background: 'linear-gradient(135deg,#E5252A,#c41e23)' }}>
                        <Star size={12} className="fill-white" />
                        {lang === 'ar' ? 'مختار' : 'Premium'}
                      </div>
                      <h2 className="font-black text-xl md:text-2xl text-gray-900 tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {pickLocalized(featuredSection.title_fr, featuredSection.title_ar, lang, lang === 'ar' ? 'منتجات مختارة' : 'Produits Phare')}
                      </h2>
                    </div>
                    <Link
                      to={asText(featuredSection.cta_link) || '/shop?featured=true'}
                      className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[#E5252A] hover:text-[#c41e23] transition-colors px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100"
                    >
                      {pickLocalized(featuredSection.cta_fr, featuredSection.cta_ar, lang, lang === 'ar' ? 'عرض الكل' : 'Voir tout')}
                      <ChevronRight size={13} className="rtl:rotate-180" />
                    </Link>
                  </div>
                  <p className="text-gray-500 text-xs md:text-sm font-medium mb-5 -mt-2">
                    {pickLocalized(featuredSection.subtitle_fr, featuredSection.subtitle_ar, lang, lang === 'ar' ? 'اختياراتنا الأبرز لهذا الموسم' : 'Nos sélections phares de la saison')}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {featuredProducts.slice(0, 6).map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                  <div className="sm:hidden mt-4 flex justify-center">
                    <Link to={asText(featuredSection.cta_link) || '/shop?featured=true'} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E5252A] px-5 py-2.5 rounded-xl bg-red-50">
                      {pickLocalized(featuredSection.cta_fr, featuredSection.cta_ar, lang, lang === 'ar' ? 'عرض الكل' : 'Voir tout')} <ChevronRight size={13} className="rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Categories Panel */}
              {categorySection.enabled !== false && categoryCards.length > 0 && (
                <div
                  className="rounded-[1.75rem] p-5 md:p-7"
                  style={{
                    background: 'rgba(255,255,255,0.78)',
                    backdropFilter: 'blur(20px)',
                    border: '1.5px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 20px 60px -10px rgba(30,80,140,0.12)',
                  }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow"
                        style={{ background: 'linear-gradient(135deg,#1A3C6E,#1D4ED8)' }}>
                        {lang === 'ar' ? 'تصفح' : 'Explorer'}
                      </div>
                      <h2 className="font-black text-xl md:text-2xl text-gray-900 tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {pickLocalized(categorySection.title_fr, categorySection.title_ar, lang, lang === 'ar' ? 'الفئات' : 'Catégories')}
                      </h2>
                    </div>
                    <Link
                      to="/shop"
                      className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[#1D4ED8] hover:text-[#1A3C6E] transition-colors px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100"
                    >
                      {lang === 'ar' ? 'عرض الكل' : 'Voir tout'}
                      <ChevronRight size={13} className="rtl:rotate-180" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {categoryCards.slice(0, 4).map((category, idx) => (
                      <Link
                        key={category.id}
                        to={`/shop?category=${encodeURIComponent(category.id)}`}
                        className="group relative overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                        style={{ aspectRatio: idx < 2 ? '1.1/1' : '1/1' }}
                      >
                        <img
                          src={category.image || 'https://images.unsplash.com/photo-1588690153163-99b380cedad9?q=80&w=600'}
                          alt={pickLocalized(category.name_fr, category.name_ar, lang)}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A3C6E]/85 via-[#1A3C6E]/30 to-transparent" />
                        {/* Category name */}
                        <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-1">
                          <h3 className="font-black text-white text-sm md:text-base tracking-tight leading-tight drop-shadow-md line-clamp-2">
                            {pickLocalized(category.name_fr, category.name_ar, lang)}
                          </h3>
                          <span className="inline-flex items-center gap-1 self-start bg-white/20 backdrop-blur-sm border border-white/25 text-white text-[9px] font-bold px-2 py-0.5 rounded-full transition-all duration-300 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
                            {lang === 'ar' ? 'تسوق' : 'Shop'} <ChevronRight size={9} className="rtl:rotate-180" />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Bento Row 2: Promo Block */}
          {promoSection.enabled !== false && (promoBanners.length > 0 || promoProducts.length > 0) && (
            <div
              className="rounded-[1.75rem] overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(20px)',
                border: '1.5px solid rgba(255,255,255,0.85)',
                boxShadow: '0 20px 60px -10px rgba(229,37,42,0.15)',
              }}
            >
              {/* Promo header band */}
              <div
                className="px-6 md:px-8 py-5 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg,rgba(229,37,42,0.08),rgba(229,37,42,0.04))' }}
              >
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow"
                    style={{ background: 'linear-gradient(135deg,#E5252A,#c41e23)' }}>
                    🏷️ {lang === 'ar' ? 'تخفيضات' : 'Promo'}
                  </div>
                  <div>
                    <h2 className="font-black text-xl md:text-2xl text-gray-900 tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {pickLocalized(promoSection.title_fr, promoSection.title_ar, lang, lang === 'ar' ? 'عروض خاصة' : 'Promotions')}
                    </h2>
                    <p className="text-red-600/70 text-xs font-medium mt-0.5">
                      {pickLocalized(promoSection.subtitle_fr, promoSection.subtitle_ar, lang, lang === 'ar' ? 'خصومات محدودة المدة' : 'Remises limitées dans le temps')}
                    </p>
                  </div>
                </div>
                <Link
                  to={asText(promoSection.cta_link) || '/shop?promo=true'}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E5252A] hover:text-[#c41e23] transition-colors px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100"
                >
                  {lang === 'ar' ? 'عرض الكل' : 'Voir tout'} <ChevronRight size={13} className="rtl:rotate-180" />
                </Link>
              </div>

              <div className="p-5 md:p-7 space-y-5">
                {/* Promo banners */}
                {promoBanners.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {promoBanners.slice(0, 2).map((banner) => (
                      <Link
                        key={banner.id}
                        to={resolveBannerHref(banner)}
                        className="group relative block min-h-[160px] md:min-h-[200px] overflow-hidden rounded-2xl shadow-lg border border-white/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                      >
                        <img
                          src={asText(banner.desktop_image) || asText(banner.image) || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=800'}
                          alt={pickLocalized(banner.title_fr, banner.title_ar, lang)}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#1A3C6E]/85 via-[#1A3C6E]/50 to-transparent rtl:from-transparent rtl:via-[#1A3C6E]/50 rtl:to-[#1A3C6E]/85" />
                        <div className="relative z-10 h-full flex flex-col justify-center p-5 max-w-[80%] rtl:max-w-none rtl:ml-auto">
                          <h3 className="text-lg md:text-xl font-black text-white mb-1 leading-tight">{pickLocalized(banner.title_fr, banner.title_ar, lang)}</h3>
                          <p className="text-xs md:text-sm text-white/85 mb-4">{pickLocalized(banner.subtitle_fr, banner.subtitle_ar, lang)}</p>
                          <span className="inline-flex items-center gap-1.5 self-start text-xs font-black text-white px-4 py-2 rounded-full transition-all"
                            style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}>
                            {pickLocalized(banner.cta_fr, banner.cta_ar, lang, lang === 'ar' ? 'اكتشف' : 'Découvrir')}
                            <ChevronRight size={12} className="rtl:rotate-180" />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Promo products */}
                {promoProducts.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {promoProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bento Row 3: New Arrivals + Best Sellers */}
          {(showNewSection && newProducts.length > 0) || (showBestSection && bestSellerProducts.length > 0) ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {showNewSection && newProducts.length > 0 && (
                <div
                  className="rounded-[1.75rem] p-5 md:p-7"
                  style={{
                    background: 'rgba(255,255,255,0.78)',
                    backdropFilter: 'blur(20px)',
                    border: '1.5px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 20px 60px -10px rgba(30,80,140,0.12)',
                  }}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-lg">✨</span>
                        <h2 className="font-black text-xl md:text-2xl text-gray-900 tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                          {pickLocalized(newSection.title_fr, newSection.title_ar, lang, lang === 'ar' ? 'وصل حديثًا' : 'Nouveautés')}
                        </h2>
                      </div>
                      <p className="text-gray-500 text-xs md:text-sm font-medium">
                        {pickLocalized(newSection.subtitle_fr, newSection.subtitle_ar, lang, lang === 'ar' ? 'أحدث المنتجات المضافة' : 'Les dernières références ajoutées')}
                      </p>
                    </div>
                    <Link
                      to={asText(newSection.cta_link) || '/shop?new=true'}
                      className="shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center bg-sky-50 text-sky-500 hover:bg-sky-100 hover:text-sky-700 transition-colors shadow-sm"
                    >
                      <ChevronRight size={16} className="rtl:rotate-180" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {newProducts.slice(0, 4).map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              )}

              {showBestSection && bestSellerProducts.length > 0 && (
                <div
                  className="rounded-[1.75rem] p-5 md:p-7"
                  style={{
                    background: 'rgba(255,255,255,0.78)',
                    backdropFilter: 'blur(20px)',
                    border: '1.5px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 20px 60px -10px rgba(30,80,140,0.12)',
                  }}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-lg">🔥</span>
                        <h2 className="font-black text-xl md:text-2xl text-gray-900 tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                          {pickLocalized(bestSection.title_fr, bestSection.title_ar, lang, lang === 'ar' ? 'الأكثر مبيعًا' : 'Meilleures Ventes')}
                        </h2>
                      </div>
                      <p className="text-gray-500 text-xs md:text-sm font-medium">
                        {pickLocalized(bestSection.subtitle_fr, bestSection.subtitle_ar, lang, lang === 'ar' ? 'الأعلى طلبًا من عملائنا' : 'Les produits les plus demandés')}
                      </p>
                    </div>
                    <Link
                      to={asText(bestSection.cta_link) || '/shop?best_seller=true'}
                      className="shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors shadow-sm"
                    >
                      <ChevronRight size={16} className="rtl:rotate-180" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {bestSellerProducts.slice(0, 4).map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Bento Row 4: Trust Stats */}
          {trustSection.enabled !== false && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: <Package size={22} />, num: '15 000+', label: lang === 'ar' ? 'طلبات مُسلَّمة' : 'Commandes Livrées', color: 'text-[#E5252A]', bg: 'bg-red-50', iconBg: 'bg-red-100 text-[#E5252A]' },
                { icon: <Award size={22} />, num: '300+', label: lang === 'ar' ? 'منتجات تعليمية' : 'Produits Éducatifs', color: 'text-[#1D4ED8]', bg: 'bg-blue-50', iconBg: 'bg-blue-100 text-[#1D4ED8]' },
                { icon: <Users size={22} />, num: '50 000+', label: lang === 'ar' ? 'عملاء راضون' : 'Clients Satisfaits', color: 'text-green-600', bg: 'bg-green-50', iconBg: 'bg-green-100 text-green-600' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="rounded-[1.5rem] p-4 md:p-6 flex flex-col items-center justify-center text-center gap-2 md:gap-3 transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: 'rgba(255,255,255,0.82)',
                    backdropFilter: 'blur(18px)',
                    border: '1.5px solid rgba(255,255,255,0.9)',
                    boxShadow: '0 16px 48px -8px rgba(30,80,140,0.12)',
                  }}
                >
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-sm ${stat.iconBg}`}>
                    {stat.icon}
                  </div>
                  <p className={`font-black text-2xl md:text-3xl lg:text-4xl leading-none ${stat.color}`} style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {stat.num}
                  </p>
                  <p className="text-gray-600 font-semibold text-[10px] md:text-xs leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Testimonials */}
          {showTestimonialsSection && (
            <div
              className="rounded-[1.75rem] p-7 md:p-10 text-center"
              style={{
                background: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(20px)',
                border: '1.5px solid rgba(255,255,255,0.85)',
                boxShadow: '0 20px 60px -10px rgba(30,80,140,0.10)',
              }}
            >
              <h2 className="font-black text-2xl md:text-3xl text-gray-900 mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: theme.primary_color }}>
                {pickLocalized(testimonialsSection.title_fr, testimonialsSection.title_ar, lang, lang === 'ar' ? 'آراء العملاء' : 'Témoignages')}
              </h2>
              <p className="text-gray-500 text-sm">
                {pickLocalized(
                  testimonialsSection.subtitle_fr,
                  testimonialsSection.subtitle_ar,
                  lang,
                  lang === 'ar' ? 'نقوم بتحديث هذه المساحة باستمرار من لوحات الإدارة.' : 'Cette section est pilotée depuis le back-office.',
                )}
              </p>
            </div>
          )}

          {/* Wholesale */}
          {showWholesaleSection && (
            <div
              className="rounded-[1.75rem] overflow-hidden relative"
              style={{ background: `linear-gradient(135deg, ${theme.primary_color || '#1A3C6E'}, ${theme.secondary_color || '#0A1A32'})` }}
            >
              {/* Decorative blobs inside */}
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full mix-blend-screen blur-3xl opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle,#E5252A,transparent)', transform: 'translate(30%,-30%)' }} aria-hidden />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full mix-blend-screen blur-3xl opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle,#FFD700,transparent)', transform: 'translate(-30%,30%)' }} aria-hidden />

              <div className="relative z-10 px-7 py-10 md:px-14 md:py-14 text-center">
                <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest text-white"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  {lang === 'ar' ? '🏢 فضاء الجملة' : '🏢 Espace B2B'}
                </div>
                <h2
                  className="font-black text-2xl md:text-4xl lg:text-5xl text-white mb-4 leading-tight tracking-tight"
                  style={{ fontFamily: 'Montserrat, sans-serif', textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  {pickLocalized(wholesaleSection.title_fr, wholesaleSection.title_ar, lang, lang === 'ar' ? 'فضاء الجملة للموزعين والتجار' : 'Espace grossiste pour distributeurs')}
                </h2>
                <p className="text-blue-100/90 text-sm md:text-base font-medium mb-8 max-w-xl mx-auto leading-relaxed">
                  {pickLocalized(
                    wholesaleSection.subtitle_fr,
                    wholesaleSection.subtitle_ar,
                    lang,
                    lang === 'ar' ? 'انضم إلى شبكة شركائنا للاستفادة من عروض الجملة.' : 'Rejoignez notre réseau B2B avec des offres dédiées.',
                  )}
                </p>
                <Link
                  to={asText(wholesaleSection.cta_link) || '/wholesale'}
                  className="inline-block px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-200 hover:scale-[1.04] active:scale-[0.98] shadow-xl text-[#1A3C6E]"
                  style={{ background: 'linear-gradient(135deg,#FFD700,#FFC107)', boxShadow: '0 8px 32px rgba(255,193,7,0.4)' }}
                >
                  {pickLocalized(wholesaleSection.cta_fr, wholesaleSection.cta_ar, lang, lang === 'ar' ? 'اكتشف فضاء الجملة' : "Découvrir l'espace grossiste")}
                </Link>
              </div>
            </div>
          )}

          {/* Newsletter */}
          {newsletterSection.enabled !== false && (
            <div
              className="rounded-[1.75rem] p-6 md:p-8"
              style={{
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(18px)',
                border: '1.5px solid rgba(255,255,255,0.9)',
                boxShadow: '0 20px 60px -10px rgba(30,80,140,0.10)',
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">📩</span>
                    <h3 className="font-black text-xl md:text-2xl text-gray-900 tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {pickLocalized(
                        newsletterSection.title_fr,
                        newsletterSection.title_ar,
                        lang,
                        pickLocalized(content?.newsletter_popup?.title_fr, content?.newsletter_popup?.title_ar, lang,
                          lang === 'ar' ? 'اشترك في النشرة البريدية' : 'Inscrivez-vous à la Newsletter'),
                      )}
                    </h3>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">
                    {pickLocalized(
                      newsletterSection.subtitle_fr,
                      newsletterSection.subtitle_ar,
                      lang,
                      pickLocalized(content?.newsletter_popup?.description_fr, content?.newsletter_popup?.description_ar, lang,
                        lang === 'ar' ? 'احصل على آخر العروض والمنتجات الجديدة' : 'Recevez nos offres et nouveautés en avant-première'),
                    )}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="email"
                    placeholder={lang === 'ar' ? 'بريدك الإلكتروني…' : 'Entrer votre email…'}
                    className="flex-1 md:w-64 px-4 py-3 rounded-2xl text-sm font-medium text-gray-700 outline-none transition-all border border-gray-200 bg-gray-50 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 focus:bg-white"
                    readOnly
                  />
                  <Link
                    to={asText(newsletterSection.cta_link) || '#newsletter'}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-2xl text-sm font-black text-white whitespace-nowrap transition-all duration-200 hover:scale-[1.04] active:scale-[0.98] shadow-lg"
                    style={{ background: 'linear-gradient(135deg,#E5252A,#c41e23)', boxShadow: '0 8px 24px rgba(229,37,42,0.35)' }}
                  >
                    {pickLocalized(
                      newsletterSection.cta_fr,
                      newsletterSection.cta_ar,
                      lang,
                      pickLocalized(content?.newsletter_popup?.button_text_fr, content?.newsletter_popup?.button_text_ar, lang,
                        lang === 'ar' ? 'اشترك' : "S'inscrire"),
                    )}
                  </Link>
                </div>
              </div>
            </div>
          )}

        </section>
        {/* bottom padding */}
        <div className="h-10" />
      </div>
    </div>
  );
}
