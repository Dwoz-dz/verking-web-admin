import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, ChevronLeft, Star, Package, Users, Award, Shield, Truck, Clock, Heart, CreditCard, Headphones, Quote } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import { CategoriesMarketingStrip } from '../components/home/CategoriesMarketingStrip';
import { InlineAnnouncementStrip } from '../components/home/InlineAnnouncementStrip';
import { HeroCarousel } from '../components/home/HeroCarousel';
import { normalizeCategoriesStrip } from '../lib/categoriesStrip';
import { CATEGORIES_UPDATED_EVENT, CATEGORIES_UPDATED_KEY, CONTENT_UPDATED_KEY } from '../lib/realtime';
import { ProductCard, DiscoverMoreCard } from '../components/ProductCard';
import {
  CarouselAnimationConfig,
  DEFAULT_PROMO_ANIMATION,
  normalizeCarouselAnimation,
} from '../lib/carouselAnimation';

type SourceMode = 'manual' | 'products' | 'categories' | 'banners';

type TrustItemConfig = {
  id?: string;
  icon?: string;
  value_fr?: string;
  value_ar?: string;
  label_fr?: string;
  label_ar?: string;
  color?: string;
};

type TestimonialItemConfig = {
  id?: string;
  author_fr?: string;
  author_ar?: string;
  wilaya_fr?: string;
  wilaya_ar?: string;
  quote_fr?: string;
  quote_ar?: string;
  avatar?: string;
  rating?: number;
};

type PromoImageConfig = {
  id?: string;
  image_url?: string;
  title_fr?: string;
  title_ar?: string;
  link?: string;
};

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
  trust_items?: TrustItemConfig[];
  testimonial_items?: TestimonialItemConfig[];
  promo_images?: PromoImageConfig[];
};

const TRUST_ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  shield: Shield,
  truck: Truck,
  award: Award,
  users: Users,
  package: Package,
  clock: Clock,
  star: Star,
  heart: Heart,
  'credit-card': CreditCard,
  headphones: Headphones,
};

function renderTrustIcon(iconKey: string | undefined, size = 22) {
  const Cmp = TRUST_ICON_MAP[iconKey || 'shield'] || Shield;
  return <Cmp size={size} />;
}

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

const LOCAL_HERO_PRIMARY = '/hero-marcelo.png';
const LOCAL_HERO_ALT = '/verking-hero.png';
const LOCAL_MAIN_LOGO = '/Logostp.png';
const LOCAL_SCREEN_BG = '/screen.png';
const ETHEREAL_PRIMARY = '#9b3f00';
const ETHEREAL_PRIMARY_LIGHT = '#ff7a2e';
const ETHEREAL_SECONDARY = '#17618b';

const GLASS_PANEL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(155deg, rgba(236,246,255,0.64) 0%, rgba(221,239,255,0.52) 100%)',
  backdropFilter: 'blur(28px) saturate(130%)',
  WebkitBackdropFilter: 'blur(28px) saturate(130%)',
  border: '1px solid rgba(255,255,255,0.38)',
  boxShadow: '0 24px 60px -22px rgba(39,92,150,0.30), inset 0 1px 0 rgba(255,255,255,0.60)',
};

const GLASS_CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.62)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.42)',
  boxShadow: '0 14px 36px -18px rgba(32,83,137,0.30)',
};

const HOME_PRODUCT_GRID_CLASS = 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4';

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
  const [testimonialIndex, setTestimonialIndex] = useState(0);

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

      const fallbackMatches = activeProducts.filter(fallbackFilter);

      if (pool.length === 0) {
        pool = fallbackMatches;
      }

      if (pool.length < limit) {
        const deduped = new Map<string, any>();
        const supplementalPool = sectionKey === 'promotions' ? fallbackMatches : [...fallbackMatches, ...activeProducts];
        [...pool, ...supplementalPool].forEach((item) => {
          if (item?.id && !deduped.has(item.id)) deduped.set(item.id, item);
        });
        pool = Array.from(deduped.values());
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

  // testimonials auto-rotate
  useEffect(() => {
    if (!testimonialsSection?.enabled) return undefined;
    const items = (testimonialsSection as any)?.testimonial_items;
    const count = Array.isArray(items) ? items.length : 3;
    if (count <= 1) return undefined;
    const timer = window.setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % count);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [testimonialsSection]);

  const testimonialItems: TestimonialItemConfig[] = useMemo(() => {
    const raw = (testimonialsSection as any)?.testimonial_items;
    if (Array.isArray(raw) && raw.length > 0) return raw as TestimonialItemConfig[];
    return [
      { id: 'd1', author_fr: 'Amina B.', author_ar: 'أمينة ب.', wilaya_fr: 'Alger', wilaya_ar: 'الجزائر', quote_fr: 'Livraison rapide et produits de qualité. Mes enfants adorent les cahiers colorés !', quote_ar: 'توصيل سريع ومنتجات عالية الجودة. أطفالي يحبون الكراسات الملونة!', avatar: '', rating: 5 },
      { id: 'd2', author_fr: 'Karim M.', author_ar: 'كريم م.', wilaya_fr: 'Oran', wilaya_ar: 'وهران', quote_fr: 'Service client à l’écoute et prix imbattables sur les fournitures scolaires.', quote_ar: 'خدمة عملاء ممتازة وأسعار لا تُضاهى للأدوات المدرسية.', avatar: '', rating: 5 },
      { id: 'd3', author_fr: 'Sofia L.', author_ar: 'صوفيا ل.', wilaya_fr: 'Constantine', wilaya_ar: 'قسنطينة', quote_fr: 'Je recommande Verking Scolaire à toutes les mamans de la wilaya !', quote_ar: 'أنصح بـ Verking Scolaire لجميع الأمهات في الولاية!', avatar: '', rating: 5 },
    ];
  }, [testimonialsSection]);

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
    asText(theme?.hero_background_url) ||
    LOCAL_HERO_PRIMARY;
  const brandHeadline = ((theme.logo_text || 'VERKING').replace(/\bSCOLAIRE\b/gi, '').replace(/\s+/g, ' ').trim()) || 'VERKING';
  const brandSubtitle = asText(theme.logo_subtitle) || 'S.T.P Stationery';
  const promoLeadBanner = promoBanners[0];
  const promoTitle = pickLocalized(
    promoSection.title_fr || promoLeadBanner?.title_fr,
    promoSection.title_ar || promoLeadBanner?.title_ar,
    lang,
    lang === 'ar' ? 'عروض -20% على مستلزمات المدرسة' : 'Promo -20% Fournitures Scolaires',
  );
  const promoSubtitle = pickLocalized(
    promoSection.subtitle_fr || promoLeadBanner?.subtitle_fr,
    promoSection.subtitle_ar || promoLeadBanner?.subtitle_ar,
    lang,
    lang === 'ar' ? 'عروض محدودة للموسم المدرسي' : 'Offres limitees pour la saison scolaire',
  );
  const promoVisual =
    asText(promoSection.image) ||
    asText(promoLeadBanner?.desktop_image) ||
    asText(promoLeadBanner?.image) ||
    LOCAL_SCREEN_BG;
  const promoLink = promoLeadBanner
    ? resolveBannerHref({ ...promoLeadBanner, link: asText(promoSection.cta_link) || asText(promoLeadBanner.link) })
    : (asText(promoSection.cta_link) || '/shop?promo=true');

  // Build promo carousel images: 1) admin-configured promo_images, 2) promo banners, 3) fallback to promoVisual
  const promoCarouselImages: PromoImageConfig[] = useMemo(() => {
    const configured = Array.isArray((promoSection as any).promo_images)
      ? (((promoSection as any).promo_images as PromoImageConfig[]) || []).filter((entry) => asText(entry?.image_url))
      : [];
    if (configured.length > 0) return configured;

    const bannerImages: PromoImageConfig[] = promoBanners
      .map((banner, idx) => {
        const url = asText(banner.desktop_image) || asText(banner.image);
        if (!url) return null;
        return {
          id: `promo-banner-${banner.id || idx}`,
          image_url: url,
          title_fr: asText(banner.title_fr),
          title_ar: asText(banner.title_ar),
          link: resolveBannerHref(banner),
        } as PromoImageConfig;
      })
      .filter(Boolean) as PromoImageConfig[];
    if (bannerImages.length > 0) return bannerImages;

    if (asText(promoSection.image)) {
      return [{
        id: 'promo-fallback',
        image_url: asText(promoSection.image),
        title_fr: promoTitle,
        title_ar: promoTitle,
        link: promoLink,
      }];
    }
    return [];
  }, [promoSection, promoBanners, promoTitle, promoLink]);

  const showFeaturedSection = featuredSection.enabled !== false && theme.show_featured !== false;
  const showNewSection = newSection.enabled !== false && theme.show_new_arrivals !== false;
  const showBestSection = bestSection.enabled !== false && theme.show_best_sellers !== false;
  const showWholesaleSection = theme.show_wholesale_section !== false;
  const showTestimonialsSection = theme.show_testimonials !== false;

  if (loading) {
    return (
      <div
        dir={dir}
        className="min-h-screen w-full overflow-x-hidden"
        style={{ background: 'linear-gradient(160deg,#bbd8f0 0%,#cce6ff 20%,#dbeeff 45%,#f0f8ff 80%,#f8fbff 100%)' }}
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-8 space-y-8">
          {/* Hero skeleton */}
          <div className="relative overflow-hidden rounded-3xl bg-white/50 backdrop-blur-sm shadow-xl aspect-[16/7] w-full">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-sky-100/50 via-blue-100/60 to-sky-100/50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 border-4 border-sky-200 rounded-full animate-spin shadow-lg" style={{ borderTopColor: ETHEREAL_PRIMARY }} />
            </div>
          </div>

          {/* Trust bar skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`trust-sk-${i}`} className="h-24 rounded-2xl bg-white/60 backdrop-blur-sm animate-pulse" />
            ))}
          </div>

          {/* Categories skeleton */}
          <div className="space-y-3">
            <div className="h-7 w-56 rounded-lg bg-white/60 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`cat-sk-${i}`} className="aspect-square rounded-2xl bg-white/60 backdrop-blur-sm animate-pulse" />
              ))}
            </div>
          </div>

          {/* Product grid skeleton */}
          <div className="space-y-3">
            <div className="h-7 w-64 rounded-lg bg-white/60 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`prod-sk-${i}`} className="space-y-3 rounded-2xl bg-white/60 backdrop-blur-sm p-3 animate-pulse">
                  <div className="aspect-square rounded-xl bg-sky-100/60" />
                  <div className="h-4 w-3/4 rounded bg-sky-100/60" />
                  <div className="h-3 w-1/2 rounded bg-sky-100/60" />
                  <div className="h-6 w-1/3 rounded bg-sky-100/60" />
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-sky-700 font-semibold text-sm tracking-wide">
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
      style={{
        background:
          'linear-gradient(165deg, rgba(255,255,255,0.28) 0%, rgba(229,242,255,0.24) 36%, rgba(213,236,255,0.18) 64%, rgba(240,248,255,0.16) 100%), url("/screen.png") center top / cover no-repeat fixed',
        fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* Atmospheric blur blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
        <div className="absolute inset-0 opacity-20" style={{ background: 'url("/screen.png") center top / cover no-repeat' }} />
        <div className="absolute -top-40 left-1/3 w-[700px] h-[700px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle,rgba(147,197,253,0.34) 0%,transparent 70%)' }} />
        <div className="absolute top-1/2 -right-32 w-[500px] h-[500px] rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle,rgba(186,230,255,0.26) 0%,transparent 70%)' }} />
        <div className="absolute bottom-0 -left-24 w-[400px] h-[400px] rounded-full blur-[90px]" style={{ background: 'radial-gradient(circle,rgba(199,210,254,0.24) 0%,transparent 70%)' }} />
      </div>

      <div className="relative z-10">

        {/* ─── HERO (Carrousel publicitaire principal) ─── */}
        <section className="px-3 md:px-5 pt-4 pb-0 max-w-[1260px] mx-auto">
          <HeroCarousel
            lang={lang}
            dir={dir}
            className="mb-0"
            animation={(heroSection as any)?.hero_animation || null}
            showOverlayGlobal={(heroSection as any)?.show_text_overlay_global !== false}
          />
        </section>
        {/* Legacy static hero — used only as auto-fallback when admin has no active slides (wrapped below in conditional) */}
        {false && (
        <section className="px-3 md:px-5 pt-4 pb-0 max-w-[1260px] mx-auto">
          <div className="relative overflow-hidden rounded-[2rem] p-3 md:p-5" style={GLASS_PANEL_STYLE}>
            <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl opacity-40" style={{ background: 'radial-gradient(circle,rgba(255,255,255,0.9) 0%, transparent 70%)' }} />
            <div className="pointer-events-none absolute -bottom-16 left-6 h-48 w-48 rounded-full blur-3xl opacity-35" style={{ background: 'radial-gradient(circle,rgba(191,229,255,0.9) 0%, transparent 70%)' }} />

            <div className="relative z-10 grid gap-4 md:gap-5 lg:grid-cols-[1.12fr_0.88fr] items-stretch">
              <div className="rounded-[1.75rem] p-5 md:p-9 flex flex-col justify-center" style={GLASS_CARD_STYLE}>
                <div className="inline-flex items-center gap-3 mb-4 md:mb-6">
                  <div className="h-11 w-11 md:h-12 md:w-12 rounded-2xl p-1.5 bg-white/70 shadow-[0_10px_24px_-14px_rgba(23,97,139,0.55)]">
                    <img
                      src={(theme.logo_url || '').trim() || LOCAL_MAIN_LOGO}
                      alt={brandHeadline}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div dir="ltr">
                    <p className="font-black text-lg md:text-2xl leading-none text-[#10223c]">{brandHeadline}</p>
                    <p className="mt-1 text-[10px] md:text-[11px] font-bold tracking-[0.2em] text-[#456c96] uppercase">{brandSubtitle}</p>
                  </div>
                </div>

                <h1
                  className="text-[#10223c] font-black text-[2.15rem] md:text-6xl leading-[1.08] mb-3 md:mb-4 tracking-tight"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {heroTitle}
                </h1>
                <p className="text-[#3f5f83] text-sm md:text-xl font-medium mb-6 md:mb-8 max-w-xl leading-relaxed">
                  {heroSubtitle}
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link
                    to={heroLink}
                    className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full font-black text-sm uppercase tracking-[0.12em] transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] shadow-xl text-white"
                    style={{ background: `linear-gradient(135deg,${ETHEREAL_PRIMARY},${ETHEREAL_PRIMARY_LIGHT})`, boxShadow: '0 10px 28px rgba(155,63,0,0.34)' }}
                  >
                    {heroCtaText}
                    <ChevronRight size={16} className="rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                  </Link>
                  <Link
                    to={promoLink}
                    className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full font-black text-sm text-[#173a60] transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                    style={{ background: 'rgba(255,255,255,0.72)', boxShadow: '0 8px 22px rgba(40,84,130,0.14)' }}
                  >
                    {pickLocalized(promoSection.cta_fr, promoSection.cta_ar, lang, lang === 'ar' ? 'العروض الخاصة' : 'Offres Speciales')}
                  </Link>
                </div>
              </div>

              <div className="relative rounded-[1.75rem] overflow-hidden min-h-[290px] md:min-h-[430px]" style={GLASS_CARD_STYLE}>
                <img
                  src={heroImage}
                  onError={(e) => { e.currentTarget.src = LOCAL_HERO_PRIMARY; }}
                  alt={heroTitle}
                  fetchPriority="high"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a518720] via-[#78b7e61f] to-white/15" />
                <img
                  src={LOCAL_HERO_ALT}
                  alt="hero alternate"
                  loading="lazy"
                  decoding="async"
                  className="absolute bottom-4 end-4 h-24 w-24 md:h-28 md:w-28 rounded-2xl object-cover shadow-[0_18px_28px_-18px_rgba(12,40,84,0.55)]"
                />
              </div>
            </div>
          </div>
        </section>
        )}
        <section className="pt-8 pb-0 px-3 md:px-5 max-w-[1260px] mx-auto">
          {false && content?.categories_marquee_enabled === true && (
            <div className="mb-4">
              <InlineAnnouncementStrip content={content} lang={lang} className="rounded-2xl" />
            </div>
          )}
          {false && categoriesStrip.enabled && (
            <div className="mb-4">
              <CategoriesMarketingStrip config={categoriesStrip} lang={lang} dir={dir} chips={[]} ctaHref={categoriesStrip.cta_link} />
            </div>
          )}
        </section>

        {/* ─── MAIN BENTO CONTENT ─── */}
        <section className="px-3 md:px-5 py-6 max-w-[1260px] mx-auto space-y-5">

          {/* Bento Row 1: Featured Products + Categories */}
          {(showFeaturedSection && featuredProducts.length > 0) || categorySection.enabled !== false ? (
            <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">

              {/* Featured Products Panel */}
              {showFeaturedSection && featuredProducts.length > 0 && (
                <div
                  className="rounded-[1.75rem] p-5 md:p-7"
                  style={GLASS_PANEL_STYLE}
                >
                  {/* Panel header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow"
                        style={{ background: `linear-gradient(135deg,${ETHEREAL_PRIMARY},${ETHEREAL_PRIMARY_LIGHT})` }}
                      >
                        <Star size={12} className="fill-white" />
                        {lang === 'ar' ? 'مختار' : 'Premium'}
                      </div>
                      <h2 className="font-black text-xl md:text-2xl text-gray-900 tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {pickLocalized(featuredSection.title_fr, featuredSection.title_ar, lang, lang === 'ar' ? 'منتجات مختارة' : 'Produits Phare')}
                      </h2>
                    </div>
                    <Link
                      to={asText(featuredSection.cta_link) || '/shop?featured=true'}
                      className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold transition-all px-4 py-2 rounded-xl hover:brightness-95"
                      style={{ color: ETHEREAL_PRIMARY, background: 'rgba(155,63,0,0.10)' }}
                    >
                      {pickLocalized(featuredSection.cta_fr, featuredSection.cta_ar, lang, lang === 'ar' ? 'عرض الكل' : 'Voir tout')}
                      <ChevronRight size={13} className="rtl:rotate-180" />
                    </Link>
                  </div>
                  <p className="text-gray-500 text-xs md:text-sm font-medium mb-5 -mt-2">
                    {pickLocalized(featuredSection.subtitle_fr, featuredSection.subtitle_ar, lang, lang === 'ar' ? 'اختياراتنا الأبرز لهذا الموسم' : 'Nos sélections phares de la saison')}
                  </p>
                  <div className={HOME_PRODUCT_GRID_CLASS}>
                    {featuredProducts.slice(0, 8).map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                    {featuredProducts.length === 1 && (
                      <DiscoverMoreCard href={asText(featuredSection.cta_link) || '/shop?featured=true'} />
                    )}
                  </div>
                  <div className="sm:hidden mt-4 flex justify-center">
                    <Link
                      to={asText(featuredSection.cta_link) || '/shop?featured=true'}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-xl"
                      style={{ color: ETHEREAL_PRIMARY, background: 'rgba(155,63,0,0.10)' }}
                    >
                      {pickLocalized(featuredSection.cta_fr, featuredSection.cta_ar, lang, lang === 'ar' ? 'عرض الكل' : 'Voir tout')} <ChevronRight size={13} className="rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Categories Panel */}
              {categorySection.enabled !== false && categoryCards.length > 0 && (
                <div
                  className="rounded-[1.75rem] p-5 md:p-7"
                  style={GLASS_PANEL_STYLE}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow"
                        style={{ background: `linear-gradient(135deg,${ETHEREAL_SECONDARY},#2d7aa4)` }}
                      >
                        {lang === 'ar' ? 'تصفح' : 'Explorer'}
                      </div>
                      <h2 className="font-black text-xl md:text-2xl text-gray-900 tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {pickLocalized(categorySection.title_fr, categorySection.title_ar, lang, lang === 'ar' ? 'الفئات' : 'Catégories')}
                      </h2>
                    </div>
                    <Link
                      to="/shop"
                      className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold transition-all px-4 py-2 rounded-xl hover:brightness-95"
                      style={{ color: ETHEREAL_SECONDARY, background: 'rgba(23,97,139,0.10)' }}
                    >
                      {lang === 'ar' ? 'عرض الكل' : 'Voir tout'}
                      <ChevronRight size={13} className="rtl:rotate-180" />
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {categoryCards.slice(0, 4).map((category) => (
                      <Link
                        key={category.id}
                        to={`/shop?category=${encodeURIComponent(category.id)}`}
                        className="group flex items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5"
                        style={GLASS_CARD_STYLE}
                      >
                        <img
                          src={category.image || LOCAL_HERO_ALT}
                          alt={pickLocalized(category.name_fr, category.name_ar, lang)}
                          loading="lazy"
                          decoding="async"
                          className="h-14 w-14 rounded-xl object-cover shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-[#173a60] text-sm md:text-base tracking-tight leading-tight line-clamp-2">
                            {pickLocalized(category.name_fr, category.name_ar, lang)}
                          </h3>
                        </div>
                        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[#17618b] bg-white/65">
                          <ChevronRight size={14} className="rtl:rotate-180" />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
          {/* Bento Row 2: Promo Block — unified text + integrated carousel */}
          {promoSection.enabled !== false && (promoCarouselImages.length > 0 || promoProducts.length > 0 || asText(promoSection.image)) && (
            <div className="rounded-[1.75rem] overflow-hidden p-4 md:p-5" style={GLASS_PANEL_STYLE}>
              {/* Unified integrated frame: text zone + carousel in one seamless card */}
              <div
                className="rounded-[1.5rem] overflow-hidden grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-0"
                style={GLASS_CARD_STYLE}
              >
                {/* LEFT ZONE — bilingual text + CTA (mobile: appears below carousel) */}
                <div className="order-2 lg:order-1 p-6 md:p-8 lg:p-10 flex flex-col justify-center">
                  <div
                    className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.14em] text-white self-start"
                    style={{ background: `linear-gradient(135deg,${ETHEREAL_PRIMARY},${ETHEREAL_PRIMARY_LIGHT})` }}
                  >
                    {lang === 'ar' ? 'عروض' : 'Promo'}
                  </div>
                  <h2
                    className="font-black text-2xl md:text-4xl lg:text-5xl text-[#11233d] tracking-tight leading-[1.05] mb-2"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {promoTitle}
                  </h2>
                  <p className="text-[#3f5f83] text-sm md:text-base lg:text-lg font-medium mb-6">
                    {promoSubtitle}
                  </p>
                  <Link
                    to={promoLink}
                    className="self-start inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-black text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                    style={{
                      background: `linear-gradient(135deg,${ETHEREAL_PRIMARY},${ETHEREAL_PRIMARY_LIGHT})`,
                      boxShadow: '0 10px 26px rgba(155,63,0,0.34)',
                    }}
                  >
                    {pickLocalized(promoSection.cta_fr, promoSection.cta_ar, lang, lang === 'ar' ? 'شاهد العروض' : 'Voir Offres')}
                    <ChevronRight size={14} className="rtl:rotate-180" />
                  </Link>
                </div>

                {/* RIGHT ZONE — integrated carousel (mobile: on top) */}
                <div className="order-1 lg:order-2 relative min-h-[220px] md:min-h-[300px] lg:min-h-[360px]">
                  <PromoCarousel
                    images={promoCarouselImages}
                    lang={lang}
                    fallbackTitle={promoTitle}
                    fallbackLink={promoLink}
                    onFallbackImage={promoVisual !== LOCAL_SCREEN_BG ? promoVisual : LOCAL_SCREEN_BG}
                    animation={(promoSection as any)?.promo_animation || null}
                  />
                </div>
              </div>

              {promoProducts.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  {promoProducts.slice(0, 8).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                  {promoProducts.length === 1 && (
                    <DiscoverMoreCard href={promoLink || '/shop?promo=true'} />
                  )}
                </div>
              )}
            </div>
          )}


          {/* Bento Row 3: New Arrivals + Best Sellers */}
          {(showNewSection && newProducts.length > 0) || (showBestSection && bestSellerProducts.length > 0) ? (
            <div className={`grid gap-5 ${showNewSection ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
              {showNewSection && newProducts.length > 0 && (
                <div
                  className="rounded-[1.75rem] p-5 md:p-7"
                  style={GLASS_PANEL_STYLE}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <div className="flex items-center mb-1.5">
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
                  <div className={HOME_PRODUCT_GRID_CLASS}>
                    {newProducts.slice(0, 8).map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                    {newProducts.length === 1 && (
                      <DiscoverMoreCard href={asText(newSection.cta_link) || '/shop?new=true'} />
                    )}
                  </div>
                </div>
              )}

              {showBestSection && bestSellerProducts.length > 0 && (
                <div
                  className="rounded-[1.75rem] p-5 md:p-7"
                  style={GLASS_PANEL_STYLE}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <div className="flex items-center mb-1.5">
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
                  <div className={HOME_PRODUCT_GRID_CLASS}>
                    {bestSellerProducts.slice(0, 8).map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                    {bestSellerProducts.length === 1 && (
                      <DiscoverMoreCard href={asText(bestSection.cta_link) || '/shop?best_seller=true'} />
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Bento Row 4: Trust Stats — configurable from admin */}
          {trustSection.enabled !== false && (
            <div className="space-y-4">
              {(trustSection.title_fr || trustSection.title_ar) && (
                <div className="text-center">
                  <h2 className="font-black text-2xl md:text-3xl text-gray-900 mb-1" style={{ fontFamily: 'Montserrat, sans-serif', color: theme.primary_color }}>
                    {pickLocalized(trustSection.title_fr, trustSection.title_ar, lang, lang === 'ar' ? 'لماذا نحن' : 'Pourquoi nous choisir')}
                  </h2>
                  {(trustSection.subtitle_fr || trustSection.subtitle_ar) && (
                    <p className="text-gray-500 text-sm max-w-xl mx-auto">
                      {pickLocalized(trustSection.subtitle_fr, trustSection.subtitle_ar, lang, '')}
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {(Array.isArray(trustSection.trust_items) && trustSection.trust_items.length > 0
                  ? trustSection.trust_items
                  : [
                      { id: 'd1', icon: 'truck', value_fr: '48h', value_ar: '48 ساعة', label_fr: 'Livraison 58 wilayas', label_ar: 'توصيل لـ 58 ولاية', color: '#145f8e' },
                      { id: 'd2', icon: 'package', value_fr: '15 000+', value_ar: '+15 000', label_fr: 'Commandes livrées', label_ar: 'طلبات مُسلَّمة', color: '#8b3f14' },
                      { id: 'd3', icon: 'award', value_fr: '300+', value_ar: '+300', label_fr: 'Produits éducatifs', label_ar: 'منتجات تعليمية', color: '#0EA5E9' },
                      { id: 'd4', icon: 'users', value_fr: '50 000+', value_ar: '+50 000', label_fr: 'Clients satisfaits', label_ar: 'عملاء راضون', color: '#15803d' },
                    ]
                ).map((item: TrustItemConfig, i: number) => {
                  const value = pickLocalized(item.value_fr, item.value_ar, lang, item.value_fr || '');
                  const label = pickLocalized(item.label_fr, item.label_ar, lang, item.label_fr || '');
                  const accent = item.color || '#0EA5E9';
                  return (
                    <div
                      key={item.id || i}
                      className="relative overflow-hidden rounded-[2rem] p-5 md:p-6 flex flex-col items-center justify-center text-center gap-3 transition-all duration-300 hover:-translate-y-1"
                      style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.54) 0%, rgba(255,255,255,0.38) 100%)',
                        backdropFilter: 'blur(24px) saturate(135%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(135%)',
                        border: '1px solid rgba(255,255,255,0.42)',
                        boxShadow: '0 10px 32px rgba(123,168,207,0.16), inset 0 1px 0 rgba(255,255,255,0.58)',
                      }}
                    >
                      <div
                        className="w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-sm"
                        style={{
                          background: 'rgba(255,255,255,0.58)',
                          border: '1px solid rgba(255,255,255,0.46)',
                          color: accent,
                        }}
                      >
                        {renderTrustIcon(item.icon, 22)}
                      </div>
                      <p
                        className="font-black text-xl md:text-2xl lg:text-3xl leading-none tracking-tight"
                        style={{ fontFamily: 'Montserrat, sans-serif', color: accent, textShadow: '0 4px 16px rgba(255,255,255,0.45)' }}
                      >
                        {value}
                      </p>
                      <p className="text-slate-700 font-semibold text-[11px] md:text-sm leading-tight">{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Testimonials — carousel with avatars + wilayas */}
          {showTestimonialsSection && testimonialsSection.enabled !== false && testimonialItems.length > 0 && (() => {
            const total = testimonialItems.length;
            const safeIndex = ((testimonialIndex % total) + total) % total;
            const active = testimonialItems[safeIndex];
            const authorName = pickLocalized(active.author_fr, active.author_ar, lang, active.author_fr || '');
            const wilayaName = pickLocalized(active.wilaya_fr, active.wilaya_ar, lang, active.wilaya_fr || '');
            const quoteText = pickLocalized(active.quote_fr, active.quote_ar, lang, active.quote_fr || '');
            const rating = Math.max(1, Math.min(5, Number(active.rating) || 5));
            const initials = (authorName || '?').trim().split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase();
            const goPrev = () => setTestimonialIndex((prev) => (prev - 1 + total) % total);
            const goNext = () => setTestimonialIndex((prev) => (prev + 1) % total);
            return (
              <div
                className="rounded-[1.75rem] p-6 md:p-10"
                style={{
                  background: 'rgba(255,255,255,0.78)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 60px -10px rgba(30,80,140,0.10)',
                }}
              >
                <div className="text-center mb-6 md:mb-8">
                  <h2 className="font-black text-2xl md:text-3xl text-gray-900 mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: theme.primary_color }}>
                    {pickLocalized(testimonialsSection.title_fr, testimonialsSection.title_ar, lang, lang === 'ar' ? 'يثقون بنا' : 'Ils nous font confiance')}
                  </h2>
                  {(testimonialsSection.subtitle_fr || testimonialsSection.subtitle_ar) && (
                    <p className="text-gray-500 text-sm max-w-xl mx-auto">
                      {pickLocalized(testimonialsSection.subtitle_fr, testimonialsSection.subtitle_ar, lang, '')}
                    </p>
                  )}
                </div>

                <div className="relative max-w-3xl mx-auto">
                  <div
                    key={active.id || safeIndex}
                    className="relative rounded-[1.5rem] p-6 md:p-8 transition-all"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.72) 100%)',
                      border: '1px solid rgba(255,255,255,0.55)',
                      boxShadow: '0 14px 40px -12px rgba(30,80,140,0.14), inset 0 1px 0 rgba(255,255,255,0.7)',
                    }}
                  >
                    <div className="absolute -top-4 left-6 md:left-10 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${theme.primary_color || '#1A3C6E'}, ${theme.secondary_color || '#0f3853'})`, boxShadow: '0 8px 22px rgba(30,80,140,0.25)' }} aria-hidden>
                      <Quote size={16} />
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      {active.avatar ? (
                        <img src={active.avatar} alt={authorName} loading="lazy" decoding="async" className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover border-2 border-white shadow-md" />
                      ) : (
                        <div
                          className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center font-black text-white text-lg md:text-xl border-2 border-white shadow-md"
                          style={{ background: `linear-gradient(135deg, ${theme.primary_color || '#1A3C6E'}, ${theme.secondary_color || '#0f3853'})` }}
                          aria-hidden
                        >
                          {initials || '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-base md:text-lg text-gray-900 truncate" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                          {authorName || (lang === 'ar' ? 'عميل' : 'Client')}
                        </p>
                        <p className="text-xs md:text-sm text-gray-500 font-semibold truncate">
                          {wilayaName}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0" aria-label={`${rating}/5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={14}
                            className={n <= rating ? 'text-amber-400' : 'text-gray-200'}
                            fill={n <= rating ? 'currentColor' : 'none'}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-gray-700 text-sm md:text-base leading-relaxed font-medium" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                      “{quoteText}”
                    </p>
                  </div>

                  {total > 1 && (
                    <div className="mt-5 flex items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-white/80 border border-white/70 text-gray-700 hover:bg-white shadow-sm transition"
                        aria-label={lang === 'ar' ? 'السابق' : 'Précédent'}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div className="flex items-center gap-2">
                        {testimonialItems.map((_, dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            onClick={() => setTestimonialIndex(dotIdx)}
                            className={`h-2 rounded-full transition-all ${dotIdx === safeIndex ? 'w-6 bg-sky-600' : 'w-2 bg-gray-300 hover:bg-gray-400'}`}
                            aria-label={`Témoignage ${dotIdx + 1}`}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={goNext}
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-white/80 border border-white/70 text-gray-700 hover:bg-white shadow-sm transition"
                        aria-label={lang === 'ar' ? 'التالي' : 'Suivant'}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Wholesale CTA — homepage conversion block (separate from /wholesale page) */}
          {showWholesaleSection && (
            <div
              className="rounded-[1.75rem] overflow-hidden relative"
              style={{ background: `linear-gradient(135deg, ${theme.primary_color || ETHEREAL_SECONDARY}, ${theme.secondary_color || '#0f3853'})` }}
            >
              {/* Decorative blobs inside */}
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full mix-blend-screen blur-3xl opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle,${ETHEREAL_PRIMARY},transparent)`, transform: 'translate(30%,-30%)' }} aria-hidden />
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
              style={GLASS_PANEL_STYLE}
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
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full md:w-auto">
                  <input
                    type="email"
                    placeholder={lang === 'ar' ? 'بريدك الإلكتروني…' : 'Entrer votre email…'}
                    className="flex-1 md:w-[25rem] px-5 py-3.5 rounded-full text-sm font-medium text-gray-700 outline-none transition-all bg-white/70 border border-white/55 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    readOnly
                  />
                  <Link
                    to={asText(newsletterSection.cta_link) || '#newsletter'}
                    className="inline-flex items-center justify-center px-8 py-3.5 rounded-full text-sm font-black text-white whitespace-nowrap transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] shadow-lg"
                    style={{ background: `linear-gradient(135deg,${ETHEREAL_PRIMARY},${ETHEREAL_PRIMARY_LIGHT})`, boxShadow: '0 10px 26px rgba(155,63,0,0.34)' }}
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
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * PromoCarousel — lightweight auto-advance carousel for the promo
 * section. No external deps: CSS-only fade/Ken-Burns + React state.
 * Features: auto-advance 5s, dots nav, hover-pause, swipe (touch),
 * lazy-load images, fallback gradient when empty.
 * ───────────────────────────────────────────────────────────── */
type PromoCarouselProps = {
  images: PromoImageConfig[];
  lang: 'fr' | 'ar';
  fallbackTitle: string;
  fallbackLink: string;
  onFallbackImage?: string;
  animation?: Partial<CarouselAnimationConfig> | null;
};

const KEN_BURNS_SCALE: Record<string, number> = {
  none: 1.0,
  subtle: 1.04,
  medium: 1.08,
  strong: 1.15,
};

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduce;
}

function PromoCarousel({ images, lang, fallbackTitle, fallbackLink, onFallbackImage, animation }: PromoCarouselProps) {
  const cfg = useMemo(() => normalizeCarouselAnimation(animation, DEFAULT_PROMO_ANIMATION), [animation]);
  const reduce = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = React.useRef<number | null>(null);
  const dirSign = React.useRef<1 | -1>(1);

  const count = images.length;
  const effectiveReduce = reduce && cfg.respect_reduced_motion;
  const transType = effectiveReduce ? 'fade' : cfg.transition_type;
  const transDur = effectiveReduce ? 300 : cfg.transition_duration_ms;
  const kenScale = KEN_BURNS_SCALE[cfg.ken_burns_intensity] ?? 1.0;
  const isRtl = lang === 'ar';

  useEffect(() => {
    if (count <= 1 || !cfg.autoplay) return undefined;
    if (cfg.pause_on_hover && paused) return undefined;
    const t = window.setInterval(() => {
      setIndex((prev) => {
        if (cfg.direction === 'forward') {
          const next = prev + 1;
          if (next >= count) return cfg.loop ? 0 : prev;
          return next;
        }
        if (cfg.direction === 'reverse') {
          const next = prev - 1;
          if (next < 0) return cfg.loop ? count - 1 : prev;
          return next;
        }
        // alternate
        let next = prev + dirSign.current;
        if (next >= count) { dirSign.current = -1; next = prev - 1; }
        if (next < 0) { dirSign.current = 1; next = prev + 1; }
        return Math.max(0, Math.min(count - 1, next));
      });
    }, cfg.slide_duration_ms);
    return () => window.clearInterval(t);
  }, [count, paused, cfg.autoplay, cfg.pause_on_hover, cfg.slide_duration_ms, cfg.direction, cfg.loop]);

  // Clamp index if images shrink
  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || count <= 1) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      setIndex((prev) => {
        const dir = delta < 0 ? 1 : -1;
        return (prev + dir + count) % count;
      });
    }
    touchStartX.current = null;
  };

  const buildSlideStyle = (active: boolean): React.CSSProperties => {
    const ease = 'cubic-bezier(0.4, 0, 0.2, 1)';
    const dur = `${transDur}ms`;
    if (transType === 'fade') {
      return { opacity: active ? 1 : 0, transition: `opacity ${dur} ${ease}`, pointerEvents: active ? 'auto' : 'none' };
    }
    if (transType === 'slide-horizontal') {
      const off = isRtl ? -100 : 100;
      return {
        opacity: active ? 1 : 0,
        transform: active ? 'translateX(0)' : `translateX(${off}%)`,
        transition: `opacity ${dur} ${ease}, transform ${dur} ${ease}`,
        pointerEvents: active ? 'auto' : 'none',
      };
    }
    if (transType === 'slide-vertical') {
      return {
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(100%)',
        transition: `opacity ${dur} ${ease}, transform ${dur} ${ease}`,
        pointerEvents: active ? 'auto' : 'none',
      };
    }
    if (transType === 'zoom-in') {
      return {
        opacity: active ? 1 : 0,
        transform: active ? 'scale(1)' : 'scale(0.8)',
        transition: `opacity ${dur} ${ease}, transform ${dur} ${ease}`,
        pointerEvents: active ? 'auto' : 'none',
      };
    }
    if (transType === 'zoom-out') {
      return {
        opacity: active ? 1 : 0,
        transform: active ? 'scale(1)' : 'scale(1.2)',
        transition: `opacity ${dur} ${ease}, transform ${dur} ${ease}`,
        pointerEvents: active ? 'auto' : 'none',
      };
    }
    if (transType === 'ken-burns') {
      return { opacity: active ? 1 : 0, transition: `opacity ${dur} ${ease}`, pointerEvents: active ? 'auto' : 'none' };
    }
    if (transType === 'flip') {
      return {
        opacity: active ? 1 : 0,
        transform: active ? 'rotateY(0)' : 'rotateY(90deg)',
        transformStyle: 'preserve-3d',
        transition: `opacity ${dur} ${ease}, transform ${dur} ${ease}`,
        pointerEvents: active ? 'auto' : 'none',
      };
    }
    // none
    return { opacity: active ? 1 : 0, pointerEvents: active ? 'auto' : 'none' };
  };

  const buildImgStyle = (active: boolean): React.CSSProperties => {
    if (transType === 'ken-burns' && !effectiveReduce && active && kenScale > 1) {
      return {
        animation: `verking-promo-ken-burns ${Math.max(3000, cfg.slide_duration_ms)}ms ease-out forwards`,
      };
    }
    return { transform: 'scale(1)' };
  };

  // Empty fallback: gradient + animated pulse
  if (count === 0) {
    return (
      <Link
        to={fallbackLink}
        className="relative block w-full h-full min-h-[240px] md:min-h-[320px] rounded-[1.5rem] overflow-hidden group"
        style={{
          background: 'linear-gradient(135deg,#ff8c4a 0%,#e06d2c 45%,#9b3f00 100%)',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), transparent 55%), radial-gradient(circle at 70% 70%, rgba(255,255,255,0.25), transparent 60%)',
              animation: 'promoPulse 4s ease-in-out infinite',
            }}
          />
          <div className="relative z-10 text-center text-white px-6">
            <div
              className="inline-flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm mb-3"
              style={{ animation: 'promoFloat 3.5s ease-in-out infinite' }}
            >
              <Star size={32} className="text-white drop-shadow" />
            </div>
            <p className="font-black text-xl md:text-2xl tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {fallbackTitle}
            </p>
          </div>
        </div>
        {onFallbackImage && (
          <img
            src={onFallbackImage}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover mix-blend-overlay opacity-30"
          />
        )}
        <style>{`
          @keyframes promoPulse { 0%,100% { opacity: 0.25; } 50% { opacity: 0.55; } }
          @keyframes promoFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        `}</style>
      </Link>
    );
  }

  const current = images[Math.min(index, count - 1)];
  const currentTitle = (lang === 'ar' ? current.title_ar : current.title_fr) || (lang === 'ar' ? current.title_fr : current.title_ar) || fallbackTitle;
  const currentLink = current.link || fallbackLink;

  return (
    <div
      className="relative w-full h-full min-h-[240px] md:min-h-[320px] rounded-[1.5rem] overflow-hidden group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
      style={transType === 'flip' ? { perspective: '1200px' } : undefined}
    >
      <style>{`@keyframes verking-promo-ken-burns { from { transform: scale(1); } to { transform: scale(${kenScale}); } }`}</style>
      {/* Slides layered absolutely — animation-driven transitions */}
      {images.map((img, i) => {
        const active = i === index;
        const titleForImg = (lang === 'ar' ? img.title_ar : img.title_fr) || (lang === 'ar' ? img.title_fr : img.title_ar) || fallbackTitle;
        const url = img.image_url || '';
        const isVideo = /\.(mp4|webm)(\?|$)/i.test(url);
        return (
          <Link
            key={img.id || i}
            to={img.link || fallbackLink}
            className="absolute inset-0"
            style={buildSlideStyle(active)}
            aria-hidden={!active}
            tabIndex={active ? 0 : -1}
          >
            {isVideo ? (
              <video
                src={url}
                autoPlay
                muted
                loop
                playsInline
                preload={i === 0 ? 'auto' : 'metadata'}
                className="absolute inset-0 h-full w-full object-cover"
                style={buildImgStyle(active)}
              />
            ) : (
              <img
                src={url}
                onError={(e) => { if (onFallbackImage) e.currentTarget.src = onFallbackImage; }}
                alt={titleForImg}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                style={buildImgStyle(active)}
              />
            )}
            {/* soft bottom overlay for legibility */}
            <div
              className="absolute inset-x-0 bottom-0 h-2/5"
              style={{ background: 'linear-gradient(to top, rgba(17,35,61,0.55), transparent)' }}
            />
            {titleForImg && (
              <div className="absolute left-4 right-4 bottom-4 md:left-6 md:right-6 md:bottom-6 text-white">
                <p className="font-black text-base md:text-xl tracking-tight drop-shadow-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  {titleForImg}
                </p>
              </div>
            )}
          </Link>
        );
      })}

      {/* Pagination dots */}
      {cfg.show_dots && count > 1 && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-3 flex items-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${lang === 'ar' ? 'الشريحة' : 'Slide'} ${i + 1}`}
              onClick={() => setIndex(i)}
              className="h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50"
              style={{
                width: i === index ? 22 : 8,
                background: i === index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
                boxShadow: i === index ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            />
          ))}
        </div>
      )}
      {/* Optional arrows (admin-configurable per promo_animation.show_arrows) */}
      {cfg.show_arrows && count > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((prev) => (prev - 1 + count) % count)}
            aria-label={lang === 'ar' ? 'السابق' : 'Précédent'}
            className="absolute z-20 top-1/2 -translate-y-1/2 start-3 h-10 w-10 rounded-full text-white flex items-center justify-center transition"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            <ChevronLeft size={18} className="rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((prev) => (prev + 1) % count)}
            aria-label={lang === 'ar' ? 'التالي' : 'Suivant'}
            className="absolute z-20 top-1/2 -translate-y-1/2 end-3 h-10 w-10 rounded-full text-white flex items-center justify-center transition"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            <ChevronRight size={18} className="rtl:rotate-180" />
          </button>
        </>
      )}
      {/* Hidden title/link for a11y (announces current slide) */}
      <span className="sr-only">{currentTitle}</span>
      <a href={currentLink} className="sr-only">{currentTitle}</a>
    </div>
  );
}
