import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, CreditCard, Headphones, ShieldCheck, Star, Truck } from 'lucide-react';
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
    lang === 'ar' ? 'مجموعة الدخول المدرسي الجديدة' : 'Nouvelle collection rentrée',
  );
  const heroSubtitle = pickLocalized(
    heroSection.subtitle_fr || heroBanner?.subtitle_fr,
    heroSection.subtitle_ar || heroBanner?.subtitle_ar,
    lang,
    lang === 'ar' ? 'اكتشف عروضنا المميزة للأطفال والمدارس.' : 'Découvrez nos offres scolaires pour enfants et écoles.',
  );
  const heroCtaText = pickLocalized(
    heroSection.cta_fr || heroBanner?.cta_fr,
    heroSection.cta_ar || heroBanner?.cta_ar,
    lang,
    lang === 'ar' ? 'تسوق الآن' : 'Acheter maintenant',
  );
  const heroLink = asText(heroSection.cta_link) || asText(heroBanner?.link) || '/shop';
  const heroImage =
    asText(heroSection.image) ||
    asText(heroBanner?.desktop_image) ||
    asText(heroBanner?.image) ||
    '/verking-hero.png';

  const showFeaturedSection = featuredSection.enabled !== false && theme.show_featured !== false;
  const showNewSection = newSection.enabled !== false && theme.show_new_arrivals !== false;
  const showBestSection = bestSection.enabled !== false && theme.show_best_sellers !== false;
  const showWholesaleSection = wholesaleSection.enabled !== false && theme.show_wholesale_section !== false;
  const showTestimonialsSection = testimonialsSection.enabled !== false && theme.show_testimonials !== false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div dir={dir} className="bg-[#FDFBF7] text-gray-900 font-sans w-full overflow-x-hidden">
      <section className="relative w-full pt-2 pb-0 px-2 md:px-4 max-w-[1400px] mx-auto">
        <div className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden min-h-[380px] md:min-h-[500px] bg-sky-100 flex flex-col justify-end shadow-xl shadow-sky-900/10 border-2 md:border-4 border-white/50">
          <div className="absolute inset-0 w-full h-full">
            <img
              src={heroImage}
              onError={(event) => {
                event.currentTarget.src = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2022&auto=format&fit=crop';
              }}
              alt={heroTitle}
              className="w-full h-full object-cover object-bottom"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A3C6E]/90 via-[#1A3C6E]/30 to-transparent" />
          </div>

          <div className="relative z-10 p-4 md:p-10 flex flex-col items-center text-center w-full max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 px-3 py-1 rounded-full mb-4 text-white shadow-lg">
              <Star size={12} className="text-amber-400 fill-amber-400" />
              <span className="font-bold text-[10px] md:text-xs tracking-wider">
                {lang === 'ar' ? 'تشكيلة مدرسية متكاملة' : 'Collection scolaire complète'}
              </span>
              <Star size={14} className="text-amber-400 fill-amber-400" />
            </div>

            <h2 className="text-white font-black text-4xl md:text-5xl lg:text-6xl leading-[1.1] mb-4 tracking-tight drop-shadow-xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {heroTitle}
            </h2>
            <p className="text-sky-50 text-sm md:text-lg font-bold mb-8 max-w-xl mx-auto leading-relaxed drop-shadow-md">
              {heroSubtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                to={heroLink}
                className="w-full sm:w-auto px-8 py-3 rounded-full font-black text-xs md:text-sm uppercase tracking-wider transition-all hover:scale-105 shadow-xl text-white"
                style={{ backgroundColor: theme.primary_color }}
              >
                {heroCtaText}
              </Link>
              <Link
                to="/shop?promo=true"
                className="w-full sm:w-auto bg-amber-400 text-[#1A3C6E] hover:bg-amber-500 px-8 py-3 rounded-full font-black text-xs md:text-sm uppercase tracking-wider transition-all hover:scale-105 shadow-xl shadow-amber-500/20"
              >
                {lang === 'ar' ? 'اكتشف العروض' : 'Découvrir les offres'}
              </Link>
            </div>
          </div>
        </div>

        {trustSection.enabled !== false && (
          <div className="relative -mt-4 z-20 mx-4 md:mx-auto max-w-4xl bg-white rounded-xl shadow-lg shadow-sky-900/5 p-3 md:p-4 grid grid-cols-2 md:grid-cols-4 gap-2 divide-x divide-gray-100 rtl:divide-x-reverse border border-gray-50">
            <div className="flex flex-col items-center justify-center text-center gap-1.5">
              <div className="w-10 h-10 bg-sky-50 text-[#1A3C6E] rounded-full flex items-center justify-center"><Truck size={20} /></div>
              <span className="font-bold text-[10px] md:text-xs text-gray-800">{lang === 'ar' ? 'توصيل سريع' : 'Livraison rapide'}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1.5">
              <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center"><CreditCard size={20} /></div>
              <span className="font-bold text-[10px] md:text-xs text-gray-800">{lang === 'ar' ? 'الدفع عند الاستلام' : 'Paiement à la livraison'}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1.5">
              <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center"><ShieldCheck size={20} /></div>
              <span className="font-bold text-[10px] md:text-xs text-gray-800">{lang === 'ar' ? 'جودة عالية' : 'Qualité premium'}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center gap-1.5">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center"><Headphones size={20} /></div>
              <span className="font-bold text-[10px] md:text-xs text-gray-800">{lang === 'ar' ? 'دعم العملاء' : 'Support client'}</span>
            </div>
          </div>
        )}
      </section>

      <section className="py-12 md:py-16 px-4 md:px-8 max-w-[1400px] mx-auto">
        {content?.categories_marquee_enabled === true ? (
          <div className="mb-4 md:mb-6">
            <InlineAnnouncementStrip content={content} lang={lang} className="rounded-2xl" />
          </div>
        ) : null}

        {categoriesStrip.enabled ? (
          <div className="mb-6 md:mb-8">
            <CategoriesMarketingStrip config={categoriesStrip} lang={lang} dir={dir} chips={[]} ctaHref={categoriesStrip.cta_link} />
          </div>
        ) : null}

        {categorySection.enabled !== false && (
          <>
            <h2 className="text-2xl md:text-3xl font-black text-center tracking-tight mb-8" style={{ color: theme.primary_color, fontFamily: 'Montserrat, sans-serif' }}>
              {pickLocalized(categorySection.title_fr, categorySection.title_ar, lang, lang === 'ar' ? 'فئاتنا الرئيسية' : 'Nos catégories')}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {categoryCards.map((category) => (
                <Link key={category.id} to={`/shop?category=${encodeURIComponent(category.id)}`} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-md border-2 border-transparent hover:border-amber-300 transition-all duration-300 hover:-translate-y-1">
                  <img
                    src={category.image || 'https://images.unsplash.com/photo-1588690153163-99b380cedad9?q=80&w=600'}
                    alt={pickLocalized(category.name_fr, category.name_ar, lang)}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A3C6E]/90 via-[#1A3C6E]/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col items-center text-center">
                    <h3 className="font-black text-white text-xl md:text-2xl mb-2 tracking-tight drop-shadow-md">
                      {pickLocalized(category.name_fr, category.name_ar, lang)}
                    </h3>
                    <span className="inline-flex items-center gap-1 bg-[#E5252A] text-white px-4 py-1.5 rounded-full font-bold text-[10px] md:text-xs shadow-md translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      {lang === 'ar' ? 'تسوق' : 'Shop'} <ChevronRight size={14} className="rtl:rotate-180" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {showFeaturedSection && featuredProducts.length > 0 && (
        <section className="py-10 bg-white rounded-3xl shadow-md shadow-sky-900/5 mx-2 md:mx-6 px-3 md:px-6 mb-8 border border-gray-50">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-6 h-1 bg-amber-400 rounded-full" />
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: theme.primary_color }}>
                    {pickLocalized(featuredSection.title_fr, featuredSection.title_ar, lang, lang === 'ar' ? 'منتجات مختارة' : 'Sélection Premium')}
                  </h2>
                </div>
                <p className="text-gray-500 font-medium text-xs md:text-sm md:ml-8 rtl:mr-8">
                  {pickLocalized(featuredSection.subtitle_fr, featuredSection.subtitle_ar, lang, lang === 'ar' ? 'اختياراتنا الأبرز لهذا الموسم.' : 'Nos produits les plus mis en avant.')}
                </p>
              </div>
              <Link to={asText(featuredSection.cta_link) || '/shop?featured=true'} className="inline-flex items-center gap-1 text-[#E5252A] font-bold hover:text-[#c91d22] transition-colors bg-red-50/50 px-4 py-2 rounded-full text-xs md:text-sm">
                {pickLocalized(featuredSection.cta_fr, featuredSection.cta_ar, lang, lang === 'ar' ? 'عرض الكل' : 'Voir tout')} <ChevronRight size={14} className="rtl:rotate-180" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
              {featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </div>
        </section>
      )}

      {(showNewSection || showBestSection) && (
        <section className="py-10 md:py-14 px-3 md:px-6 max-w-[1400px] mx-auto">
          <div className="grid gap-6 lg:grid-cols-2">
            {showNewSection && newProducts.length > 0 && (
              <div className="bg-white p-5 md:p-8 rounded-3xl shadow-md border border-gray-50 shadow-sky-900/5">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight mb-1 flex items-center gap-2" style={{ color: theme.primary_color }}>
                      <span className="text-xl">✨</span> {pickLocalized(newSection.title_fr, newSection.title_ar, lang, lang === 'ar' ? 'وصل حديثًا' : 'Nouveautés')}
                    </h2>
                    <p className="text-gray-500 font-medium text-xs md:text-sm">
                      {pickLocalized(newSection.subtitle_fr, newSection.subtitle_ar, lang, lang === 'ar' ? 'أحدث المنتجات المضافة.' : 'Les dernières références ajoutées.')}
                    </p>
                  </div>
                  <Link to={asText(newSection.cta_link) || '/shop?new=true'} className="text-sky-500 hover:text-sky-600 font-bold text-xs transition-colors shrink-0 bg-sky-50 w-8 h-8 flex items-center justify-center rounded-full shadow-sm">
                    <ChevronRight size={16} className="rtl:rotate-180" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {newProducts.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
              </div>
            )}

            {showBestSection && bestSellerProducts.length > 0 && (
              <div className="bg-white p-5 md:p-8 rounded-3xl shadow-md border border-gray-50">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight mb-1 flex items-center gap-2" style={{ color: theme.primary_color }}>
                      <span className="text-xl">🔥</span> {pickLocalized(bestSection.title_fr, bestSection.title_ar, lang, lang === 'ar' ? 'الأكثر مبيعًا' : 'Meilleures ventes')}
                    </h2>
                    <p className="text-gray-500 font-medium text-xs md:text-sm">
                      {pickLocalized(bestSection.subtitle_fr, bestSection.subtitle_ar, lang, lang === 'ar' ? 'الأعلى طلبًا من عملائنا.' : 'Les produits les plus demandés.')}
                    </p>
                  </div>
                  <Link to={asText(bestSection.cta_link) || '/shop?best_seller=true'} className="text-sky-500 hover:text-sky-600 font-bold text-xs transition-colors shrink-0 bg-sky-50 w-8 h-8 flex items-center justify-center rounded-full shadow-sm">
                    <ChevronRight size={16} className="rtl:rotate-180" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {bestSellerProducts.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {promoSection.enabled !== false && (
        <section className="py-12 bg-sky-50/50 px-3 md:px-6 border-t border-sky-100 border-dashed">
          <div className="max-w-[1400px] mx-auto space-y-6">
            {promoBanners.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {promoBanners.slice(0, 2).map((banner) => (
                  <Link key={banner.id} to={asText(banner.link) || '/shop?promo=true'} className="group relative block min-h-[180px] overflow-hidden rounded-3xl border border-red-100 shadow-sm">
                    <img
                      src={asText(banner.desktop_image) || asText(banner.image) || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=800'}
                      alt={pickLocalized(banner.title_fr, banner.title_ar, lang)}
                      className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#1A3C6E]/80 via-[#1A3C6E]/45 to-transparent" />
                    <div className="relative z-10 p-5 text-white max-w-[80%]">
                      <h3 className="text-lg md:text-xl font-black mb-1">{pickLocalized(banner.title_fr, banner.title_ar, lang)}</h3>
                      <p className="text-xs md:text-sm opacity-90 mb-3">{pickLocalized(banner.subtitle_fr, banner.subtitle_ar, lang)}</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-black">
                        {pickLocalized(banner.cta_fr, banner.cta_ar, lang, lang === 'ar' ? 'اكتشف' : 'Découvrir')} <ChevronRight size={12} className="rtl:rotate-180" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {promoProducts.length > 0 && (
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight mb-1 flex items-center gap-2" style={{ color: '#E5252A' }}>
                      <span className="text-xl">🏷️</span> {pickLocalized(promoSection.title_fr, promoSection.title_ar, lang, lang === 'ar' ? 'عروض خاصة' : 'Promotions')}
                    </h2>
                    <p className="text-red-700/80 font-medium text-xs md:text-sm">
                      {pickLocalized(promoSection.subtitle_fr, promoSection.subtitle_ar, lang, lang === 'ar' ? 'خصومات محدودة المدة.' : 'Remises limitées dans le temps.')}
                    </p>
                  </div>
                  <Link to={asText(promoSection.cta_link) || '/shop?promo=true'} className="text-[#E5252A] hover:text-red-700 font-bold text-xs transition-colors shrink-0 bg-red-50 w-8 h-8 flex items-center justify-center rounded-full shadow-sm">
                    <ChevronRight size={16} className="rtl:rotate-180" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
                  {promoProducts.map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {showTestimonialsSection && (
        <section className="py-12 px-4 md:px-8 max-w-[1200px] mx-auto">
          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl md:text-3xl font-black mb-2" style={{ color: theme.primary_color }}>
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
        </section>
      )}

      {showWholesaleSection && (
        <section className="py-16 px-4 md:px-8">
          <div className="max-w-[1000px] mx-auto text-center rounded-3xl p-8 md:p-14 shadow-xl relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${theme.primary_color}, ${theme.secondary_color || '#0A1A32'})` }}>
            <div className="absolute top-0 right-0 w-48 h-48 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -translate-x-1/2 translate-y-1/2" />

            <div className="relative z-10">
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight leading-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {pickLocalized(wholesaleSection.title_fr, wholesaleSection.title_ar, lang, lang === 'ar' ? 'فضاء الجملة للموزعين والتجار' : 'Espace grossiste pour distributeurs')}
              </h2>
              <p className="text-blue-100 text-xs md:text-sm font-medium mb-8 max-w-xl mx-auto leading-relaxed">
                {pickLocalized(
                  wholesaleSection.subtitle_fr,
                  wholesaleSection.subtitle_ar,
                  lang,
                  lang === 'ar' ? 'انضم إلى شبكة شركائنا للاستفادة من عروض الجملة.' : 'Rejoignez notre réseau B2B avec des offres dédiées.',
                )}
              </p>
              <Link
                to={asText(wholesaleSection.cta_link) || '/wholesale'}
                className="inline-block bg-amber-400 text-[#1A3C6E] hover:bg-amber-500 px-8 py-3 rounded-full font-black text-xs md:text-sm uppercase tracking-wider transition-transform hover:scale-105 shadow-md shadow-amber-500/20"
              >
                {pickLocalized(wholesaleSection.cta_fr, wholesaleSection.cta_ar, lang, lang === 'ar' ? 'اكتشف فضاء الجملة' : 'Découvrir l’espace grossiste')}
              </Link>
            </div>
          </div>
        </section>
      )}

      {newsletterSection.enabled !== false && (
        <section className="pb-12 px-4 md:px-8">
          <div className="max-w-[1000px] mx-auto rounded-3xl border border-gray-100 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl md:text-2xl font-black mb-1" style={{ color: theme.primary_color }}>
                  {pickLocalized(newsletterSection.title_fr, newsletterSection.title_ar, lang, pickLocalized(content?.newsletter_popup?.title_fr, content?.newsletter_popup?.title_ar, lang, lang === 'ar' ? 'النشرة البريدية' : 'Newsletter'))}
                </h3>
                <p className="text-sm text-gray-500">
                  {pickLocalized(newsletterSection.subtitle_fr, newsletterSection.subtitle_ar, lang, pickLocalized(content?.newsletter_popup?.description_fr, content?.newsletter_popup?.description_ar, lang))}
                </p>
              </div>
              <Link
                to={asText(newsletterSection.cta_link) || '#newsletter'}
                className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-black text-white"
                style={{ backgroundColor: theme.primary_color }}
              >
                {pickLocalized(newsletterSection.cta_fr, newsletterSection.cta_ar, lang, pickLocalized(content?.newsletter_popup?.button_text_fr, content?.newsletter_popup?.button_text_ar, lang, lang === 'ar' ? 'اشترك الآن' : 'Je m’abonne'))}
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
