import React, { useEffect, useMemo, useState } from 'react';
import {
  Save,
  Smartphone,
  Monitor,
  Send,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Layers,
  BadgeCheck,
  Star,
  Package,
  Megaphone,
  ShieldCheck,
  MessageSquare,
  Mail,
  X,
  Plus,
  Trash2,
  Star as StarIcon,
  GripVertical,
  AlertTriangle,
  UploadCloud,
  Loader2,
  CheckCircle2,
  Film,
  Eye,
  Link as LinkIcon,
} from 'lucide-react';
import { adminApi, api, API_BASE, apiHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';
import { HeroCarouselManager } from '../../components/admin/HeroCarouselManager';
import {
  normalizeBoolean,
  normalizeOrder,
  normalizeSafeText,
  normalizeUrlOrPath,
} from '../../lib/textPipeline';
import { validateHomepageConfig } from '../../lib/homepageValidator';
import {
  CarouselAnimationConfig,
  DEFAULT_HERO_ANIMATION,
  DEFAULT_PROMO_ANIMATION,
  normalizeCarouselAnimation,
} from '../../lib/carouselAnimation';
import { AnimationControlPanel } from '../../components/admin/AnimationControlPanel';
import { useLang } from '../../context/LanguageContext';
import {
  SPLASH_TEMPLATES,
  SPLASH_THEME_FILTERS,
  SplashTemplate,
  SplashThemeFilter,
} from '../../data/splashTemplates';

type PreviewDevice = 'desktop' | 'mobile';
type SourceMode = 'manual' | 'products' | 'categories' | 'banners';

type SectionKey =
  | 'hero'
  | 'categories'
  | 'featured'
  | 'new_arrivals'
  | 'best_sellers'
  | 'promotions'
  | 'trust'
  | 'testimonials'
  | 'newsletter'
  | 'wholesale';

type MediaItem = {
  id: string;
  url: string;
  filename?: string;
  content_type?: string;
};

type TrustItem = {
  id: string;
  icon: string;
  value_fr: string;
  value_ar: string;
  label_fr: string;
  label_ar: string;
  color: string;
};

type TestimonialItem = {
  id: string;
  author_fr: string;
  author_ar: string;
  wilaya_fr: string;
  wilaya_ar: string;
  quote_fr: string;
  quote_ar: string;
  avatar: string;
  rating: number;
};

type PromoImage = {
  id: string;
  image_url: string;
  title_fr: string;
  title_ar: string;
  link: string;
};

type HomepageSection = {
  enabled: boolean;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string;
  subtitle_ar: string;
  cta_fr: string;
  cta_ar: string;
  cta_link: string;
  image: string;
  source_mode: SourceMode;
  source_ref: string;
  style_variant: string;
  limit?: number;
  trust_items?: TrustItem[];
  testimonial_items?: TestimonialItem[];
  promo_images?: PromoImage[];
  hero_animation?: CarouselAnimationConfig;
  promo_animation?: CarouselAnimationConfig;
};

const TRUST_ICON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'shield', label: 'Bouclier' },
  { value: 'truck', label: 'Camion' },
  { value: 'award', label: 'Trophée' },
  { value: 'users', label: 'Clients' },
  { value: 'package', label: 'Colis' },
  { value: 'clock', label: 'Horloge' },
  { value: 'star', label: 'Étoile' },
  { value: 'heart', label: 'Cœur' },
  { value: 'credit-card', label: 'Paiement' },
  { value: 'headphones', label: 'Support' },
];

const WILAYA_PRESETS_FR = [
  'Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna',
  'Sétif', 'Tizi Ouzou', 'Béjaïa', 'Tlemcen', 'Ghardaïa', 'Ouargla',
];

const WILAYA_PRESETS_AR = [
  'الجزائر', 'وهران', 'قسنطينة', 'عنابة', 'البليدة', 'باتنة',
  'سطيف', 'تيزي وزو', 'بجاية', 'تلمسان', 'غرداية', 'ورقلة',
];

type HomepageConfig = {
  sections_order: SectionKey[];
} & Record<SectionKey, HomepageSection>;

type ProductLookup = {
  id: string;
  name_fr: string;
  name_ar: string;
};

type CategoryLookup = {
  id: string;
  name_fr: string;
  name_ar: string;
};

type BannerLookup = {
  id: string;
  title_fr: string;
  title_ar: string;
  placement: string;
  is_active: boolean;
};

const DRAFT_KEY = 'vk_homepage_draft_v2';
const SYNC_KEY = 'vk_homepage_sync_state_v2';

const SECTION_META: Record<SectionKey, { labelFr: string; labelAr: string; icon: React.ElementType; color: string }> = {
  hero: { labelFr: 'Hero', labelAr: 'البانر الرئيسي', icon: ImageIcon, color: '#1A3C6E' },
  categories: { labelFr: 'Catégories', labelAr: 'الفئات', icon: Layers, color: '#7C3AED' },
  featured: { labelFr: 'Produits vedettes', labelAr: 'منتجات مختارة', icon: Star, color: '#F57C00' },
  new_arrivals: { labelFr: 'Nouveautés', labelAr: 'وصل حديثا', icon: BadgeCheck, color: '#0891B2' },
  best_sellers: { labelFr: 'Best sellers', labelAr: 'الأكثر مبيعا', icon: Package, color: '#DC2626' },
  promotions: { labelFr: 'Promotions', labelAr: 'عروض خاصة', icon: Megaphone, color: '#16A34A' },
  trust: { labelFr: 'Section confiance', labelAr: 'قسم الثقة', icon: ShieldCheck, color: '#0EA5E9' },
  testimonials: { labelFr: 'Témoignages', labelAr: 'آراء العملاء', icon: MessageSquare, color: '#8B5CF6' },
  newsletter: { labelFr: 'Newsletter CTA', labelAr: 'دعوة النشرة البريدية', icon: Mail, color: '#2563EB' },
  wholesale: { labelFr: 'Wholesale CTA', labelAr: 'دعوة قسم الجملة', icon: Package, color: '#065F46' },
};

const SOURCE_MODE_OPTIONS: Array<{ value: SourceMode; label: string }> = [
  { value: 'manual', label: 'Manuel' },
  { value: 'products', label: 'Produits' },
  { value: 'categories', label: 'Catégories' },
  { value: 'banners', label: 'Bannières' },
];

const PRODUCT_SOURCE_PRESETS = [
  { value: 'featured', label: 'Produits vedettes' },
  { value: 'new_arrivals', label: 'Nouveautés' },
  { value: 'best_sellers', label: 'Best sellers' },
  { value: 'promotions', label: 'Promotions' },
  { value: 'all', label: 'Tous les produits' },
];

const CATEGORY_SOURCE_PRESETS = [
  { value: 'homepage', label: 'Catégories homepage' },
  { value: 'all', label: 'Toutes les catégories' },
];

const BANNER_SOURCE_PRESETS = [
  { value: 'homepage_hero', label: 'Placement: Homepage hero' },
  { value: 'homepage_secondary', label: 'Placement: Homepage secondary' },
  { value: 'promotion_strip', label: 'Placement: Promotion strip' },
  { value: 'category_banner', label: 'Placement: Category banner' },
  { value: 'future_app_banner', label: 'Placement: Future app banner' },
];

function splitSourceRefValues(sourceRef: string) {
  return sourceRef
    .split(',')
    .map((value) => normalizeSafeText(value, ''))
    .filter((value) => value.length > 0);
}

const DEFAULT_SECTION: HomepageSection = {
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

const DEFAULT_TRUST_ITEMS: TrustItem[] = [
  { id: 'trust-delivery', icon: 'truck', value_fr: '48h', value_ar: '48 ساعة', label_fr: 'Livraison 58 wilayas', label_ar: 'توصيل لـ 58 ولاية', color: '#145f8e' },
  { id: 'trust-orders', icon: 'package', value_fr: '15 000+', value_ar: '+15 000', label_fr: 'Commandes livrées', label_ar: 'طلبات مُسلَّمة', color: '#8b3f14' },
  { id: 'trust-products', icon: 'award', value_fr: '300+', value_ar: '+300', label_fr: 'Produits éducatifs', label_ar: 'منتجات تعليمية', color: '#0EA5E9' },
  { id: 'trust-clients', icon: 'users', value_fr: '50 000+', value_ar: '+50 000', label_fr: 'Clients satisfaits', label_ar: 'عملاء راضون', color: '#15803d' },
  { id: 'trust-payment', icon: 'credit-card', value_fr: 'Dahabia / CIB / COD', value_ar: 'ذهبية / CIB / الدفع عند التسليم', label_fr: 'Paiement sécurisé', label_ar: 'دفع آمن', color: '#7C3AED' },
  { id: 'trust-support', icon: 'headphones', value_fr: '7j/7', value_ar: '7 أيام / 7', label_fr: 'Support dédié', label_ar: 'دعم مخصص', color: '#DC2626' },
];

const DEFAULT_TESTIMONIAL_ITEMS: TestimonialItem[] = [
  {
    id: 'testi-amina',
    author_fr: 'Amina B.',
    author_ar: 'أمينة ب.',
    wilaya_fr: 'Alger',
    wilaya_ar: 'الجزائر',
    quote_fr: 'Livraison rapide et produits de qualité. Mes enfants adorent les cahiers colorés !',
    quote_ar: 'توصيل سريع ومنتجات عالية الجودة. أطفالي يحبون الكراسات الملونة!',
    avatar: '',
    rating: 5,
  },
  {
    id: 'testi-karim',
    author_fr: 'Karim M.',
    author_ar: 'كريم م.',
    wilaya_fr: 'Oran',
    wilaya_ar: 'وهران',
    quote_fr: 'Service client à l’écoute et prix imbattables sur les fournitures scolaires.',
    quote_ar: 'خدمة عملاء ممتازة وأسعار لا تُضاهى للأدوات المدرسية.',
    avatar: '',
    rating: 5,
  },
  {
    id: 'testi-sofia',
    author_fr: 'Sofia L.',
    author_ar: 'صوفيا ل.',
    wilaya_fr: 'Constantine',
    wilaya_ar: 'قسنطينة',
    quote_fr: 'Je recommande Verking Scolaire à toutes les mamans de la wilaya !',
    quote_ar: 'أنصح بـ Verking Scolaire لجميع الأمهات في الولاية!',
    avatar: '',
    rating: 5,
  },
];

const DEFAULT_PROMO_IMAGES: PromoImage[] = [
  {
    id: 'promo-img-1',
    image_url: '',
    title_fr: 'Pack rentrée scolaire',
    title_ar: 'حزمة الدخول المدرسي',
    link: '/shop?promo=true',
  },
  {
    id: 'promo-img-2',
    image_url: '',
    title_fr: 'Fournitures premium',
    title_ar: 'أدوات مكتبية فاخرة',
    link: '/shop?promo=true',
  },
  {
    id: 'promo-img-3',
    image_url: '',
    title_fr: 'Offres limitées',
    title_ar: 'عروض محدودة',
    link: '/shop?promo=true',
  },
];

const DEFAULT_CONFIG: HomepageConfig = {
  sections_order: [
    'hero',
    'categories',
    'featured',
    'new_arrivals',
    'best_sellers',
    'promotions',
    'trust',
    'testimonials',
    'newsletter',
    'wholesale',
  ],
  hero: {
    ...DEFAULT_SECTION,
    title_fr: 'Nouvelle collection',
    title_ar: 'مجموعة جديدة',
    subtitle_fr: 'Découvrez les meilleures offres',
    subtitle_ar: 'اكتشف أفضل العروض',
    cta_fr: 'Découvrir',
    cta_ar: 'اكتشف',
    cta_link: '/shop',
    style_variant: 'hero',
    hero_animation: DEFAULT_HERO_ANIMATION,
  },
  categories: {
    ...DEFAULT_SECTION,
    title_fr: 'Nos catégories',
    title_ar: 'فئاتنا',
    source_mode: 'categories',
    style_variant: 'grid',
  },
  featured: {
    ...DEFAULT_SECTION,
    title_fr: 'Produits vedettes',
    title_ar: 'منتجات مختارة',
    source_mode: 'products',
    source_ref: 'featured',
    limit: 8,
    style_variant: 'carousel',
  },
  new_arrivals: {
    ...DEFAULT_SECTION,
    title_fr: 'Nouveautés',
    title_ar: 'وصل حديثا',
    source_mode: 'products',
    source_ref: 'new_arrivals',
    limit: 8,
    style_variant: 'carousel',
  },
  best_sellers: {
    ...DEFAULT_SECTION,
    title_fr: 'Best sellers',
    title_ar: 'الأكثر مبيعا',
    source_mode: 'products',
    source_ref: 'best_sellers',
    limit: 8,
    style_variant: 'carousel',
  },
  promotions: {
    ...DEFAULT_SECTION,
    title_fr: 'Promotions',
    title_ar: 'عروض خاصة',
    subtitle_fr: 'Découvrez nos offres exclusives du moment',
    subtitle_ar: 'اكتشف أحدث العروض الحصرية',
    cta_fr: 'Voir Offres',
    cta_ar: 'شاهد العروض',
    cta_link: '/shop?promo=true',
    source_mode: 'banners',
    source_ref: 'promotion_strip',
    style_variant: 'banner',
    promo_images: DEFAULT_PROMO_IMAGES,
    promo_animation: DEFAULT_PROMO_ANIMATION,
  },
  trust: {
    ...DEFAULT_SECTION,
    title_fr: 'Pourquoi nous choisir',
    title_ar: 'لماذا نحن',
    subtitle_fr: 'Votre partenaire de confiance pour la rentrée scolaire en Algérie.',
    subtitle_ar: 'شريككم الموثوق للدخول المدرسي في الجزائر.',
    style_variant: 'trust',
    trust_items: DEFAULT_TRUST_ITEMS,
  },
  testimonials: {
    ...DEFAULT_SECTION,
    title_fr: 'Ils nous font confiance',
    title_ar: 'يثقون بنا',
    subtitle_fr: 'Retours de parents à travers les 58 wilayas.',
    subtitle_ar: 'آراء الأولياء عبر 58 ولاية.',
    style_variant: 'testimonials',
    testimonial_items: DEFAULT_TESTIMONIAL_ITEMS,
  },
  newsletter: {
    ...DEFAULT_SECTION,
    title_fr: 'Newsletter',
    title_ar: 'النشرة البريدية',
    subtitle_fr: 'Recevez nos nouveautés et promos',
    subtitle_ar: 'توصل بالجديد والعروض',
    cta_fr: 'Je m’abonne',
    cta_ar: 'اشترك الآن',
    cta_link: '/newsletter',
    style_variant: 'cta',
  },
  wholesale: {
    ...DEFAULT_SECTION,
    title_fr: 'Espace grossiste',
    title_ar: 'فضاء الجملة',
    cta_fr: 'Demande grossiste',
    cta_ar: 'طلب الجملة',
    cta_link: '/wholesale',
    style_variant: 'cta',
  },
};

function isSectionKey(value: string): value is SectionKey {
  return Object.prototype.hasOwnProperty.call(SECTION_META, value);
}

function normalizeTrustItem(raw: any, fallback: TrustItem): TrustItem {
  const merged = { ...fallback, ...(raw || {}) };
  return {
    id: normalizeSafeText(merged.id, fallback.id) || `trust-${Math.random().toString(36).slice(2, 8)}`,
    icon: normalizeSafeText(merged.icon, fallback.icon) || 'shield',
    value_fr: normalizeSafeText(merged.value_fr, fallback.value_fr),
    value_ar: normalizeSafeText(merged.value_ar, fallback.value_ar),
    label_fr: normalizeSafeText(merged.label_fr, fallback.label_fr),
    label_ar: normalizeSafeText(merged.label_ar, fallback.label_ar),
    color: normalizeSafeText(merged.color, fallback.color) || '#0EA5E9',
  };
}

function normalizeTestimonialItem(raw: any, fallback: TestimonialItem): TestimonialItem {
  const merged = { ...fallback, ...(raw || {}) };
  const ratingNum = Number(merged.rating);
  const rating = Number.isFinite(ratingNum) ? Math.max(1, Math.min(5, Math.round(ratingNum))) : fallback.rating;
  return {
    id: normalizeSafeText(merged.id, fallback.id) || `testi-${Math.random().toString(36).slice(2, 8)}`,
    author_fr: normalizeSafeText(merged.author_fr, fallback.author_fr),
    author_ar: normalizeSafeText(merged.author_ar, fallback.author_ar),
    wilaya_fr: normalizeSafeText(merged.wilaya_fr, fallback.wilaya_fr),
    wilaya_ar: normalizeSafeText(merged.wilaya_ar, fallback.wilaya_ar),
    quote_fr: normalizeSafeText(merged.quote_fr, fallback.quote_fr),
    quote_ar: normalizeSafeText(merged.quote_ar, fallback.quote_ar),
    avatar: normalizeSafeText(merged.avatar, fallback.avatar),
    rating,
  };
}

function normalizeTrustItems(raw: any, fallback: TrustItem[]): TrustItem[] {
  if (!Array.isArray(raw)) return fallback.map((item) => ({ ...item }));
  const fb = fallback[0] || DEFAULT_TRUST_ITEMS[0];
  return raw.slice(0, 12).map((entry: any, idx: number) => normalizeTrustItem(entry, fallback[idx] || fb));
}

function normalizePromoImage(raw: any, fallback: PromoImage): PromoImage {
  const merged = { ...fallback, ...(raw || {}) };
  return {
    id: normalizeSafeText(merged.id, fallback.id) || `promo-img-${Math.random().toString(36).slice(2, 8)}`,
    image_url: normalizeSafeText(merged.image_url, fallback.image_url),
    title_fr: normalizeSafeText(merged.title_fr, fallback.title_fr),
    title_ar: normalizeSafeText(merged.title_ar, fallback.title_ar),
    link: normalizeUrlOrPath(merged.link, fallback.link),
  };
}

function normalizePromoImages(raw: any, fallback: PromoImage[]): PromoImage[] {
  if (!Array.isArray(raw)) return fallback.map((item) => ({ ...item }));
  const fb = fallback[0] || DEFAULT_PROMO_IMAGES[0];
  return raw.slice(0, 12).map((entry: any, idx: number) => normalizePromoImage(entry, fallback[idx] || fb));
}

function normalizeTestimonialItems(raw: any, fallback: TestimonialItem[]): TestimonialItem[] {
  if (!Array.isArray(raw)) return fallback.map((item) => ({ ...item }));
  const fb = fallback[0] || DEFAULT_TESTIMONIAL_ITEMS[0];
  return raw.slice(0, 24).map((entry: any, idx: number) => normalizeTestimonialItem(entry, fallback[idx] || fb));
}

function normalizeSection(value: any, fallback: HomepageSection): HomepageSection {
  const merged = { ...fallback, ...(value || {}) };
  const base: HomepageSection = {
    enabled: normalizeBoolean(merged.enabled, fallback.enabled),
    title_fr: normalizeSafeText(merged.title_fr, fallback.title_fr),
    title_ar: normalizeSafeText(merged.title_ar, fallback.title_ar),
    subtitle_fr: normalizeSafeText(merged.subtitle_fr, fallback.subtitle_fr),
    subtitle_ar: normalizeSafeText(merged.subtitle_ar, fallback.subtitle_ar),
    cta_fr: normalizeSafeText(merged.cta_fr, fallback.cta_fr),
    cta_ar: normalizeSafeText(merged.cta_ar, fallback.cta_ar),
    cta_link: normalizeUrlOrPath(merged.cta_link, fallback.cta_link),
    image: normalizeSafeText(merged.image, fallback.image),
    source_mode: ['manual', 'products', 'categories', 'banners'].includes(String(merged.source_mode))
      ? (merged.source_mode as SourceMode)
      : fallback.source_mode,
    source_ref: normalizeSafeText(merged.source_ref, fallback.source_ref),
    style_variant: normalizeSafeText(merged.style_variant, fallback.style_variant) || 'default',
    limit: merged.limit === undefined ? fallback.limit : normalizeOrder(merged.limit, fallback.limit || 8, 48),
  };
  if (Array.isArray(fallback.trust_items) || Array.isArray(merged.trust_items)) {
    base.trust_items = normalizeTrustItems(merged.trust_items, fallback.trust_items || DEFAULT_TRUST_ITEMS);
  }
  if (Array.isArray(fallback.testimonial_items) || Array.isArray(merged.testimonial_items)) {
    base.testimonial_items = normalizeTestimonialItems(merged.testimonial_items, fallback.testimonial_items || DEFAULT_TESTIMONIAL_ITEMS);
  }
  if (Array.isArray(fallback.promo_images) || Array.isArray(merged.promo_images)) {
    base.promo_images = normalizePromoImages(merged.promo_images, fallback.promo_images || DEFAULT_PROMO_IMAGES);
  }
  if (fallback.hero_animation || merged.hero_animation) {
    base.hero_animation = normalizeCarouselAnimation(
      merged.hero_animation,
      fallback.hero_animation || DEFAULT_HERO_ANIMATION,
    );
  }
  if (fallback.promo_animation || merged.promo_animation) {
    base.promo_animation = normalizeCarouselAnimation(
      merged.promo_animation,
      fallback.promo_animation || DEFAULT_PROMO_ANIMATION,
    );
  }
  return base;
}

function normalizeHomepageConfig(raw: any): HomepageConfig {
  const source = raw || {};
  const requestedOrder = Array.isArray(source.sections_order)
    ? source.sections_order.filter((key: string) => isSectionKey(String(key)))
    : [];
  const deduped = Array.from(new Set(requestedOrder));
  const sections_order = deduped.length
    ? [...deduped, ...DEFAULT_CONFIG.sections_order.filter((key) => !deduped.includes(key))]
    : [...DEFAULT_CONFIG.sections_order];

  const next: HomepageConfig = { ...DEFAULT_CONFIG, sections_order };
  for (const key of DEFAULT_CONFIG.sections_order) {
    next[key] = normalizeSection(source[key], DEFAULT_CONFIG[key]);
  }
  return next;
}

// Validation is now centralized in src/app/lib/homepageValidator.ts —
// the `publish()` handler calls `validateHomepageConfig` directly so it
// can separate blocking errors from advisory warnings.

function persistSyncState(lastDraftAt: string | null, lastPublishedAt: string | null) {
  localStorage.setItem(SYNC_KEY, JSON.stringify({ lastDraftAt, lastPublishedAt }));
}

function readSyncState() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return { lastDraftAt: null, lastPublishedAt: null };
    const parsed = JSON.parse(raw);
    return {
      lastDraftAt: typeof parsed?.lastDraftAt === 'string' ? parsed.lastDraftAt : null,
      lastPublishedAt: typeof parsed?.lastPublishedAt === 'string' ? parsed.lastPublishedAt : null,
    };
  } catch {
    return { lastDraftAt: null, lastPublishedAt: null };
  }
}

export function AdminHomepage() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const { lang } = useLang();

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [expandedKey, setExpandedKey] = useState<SectionKey | null>('hero');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [pickerSection, setPickerSection] = useState<SectionKey | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [products, setProducts] = useState<ProductLookup[]>([]);
  const [categories, setCategories] = useState<CategoryLookup[]>([]);
  const [banners, setBanners] = useState<BannerLookup[]>([]);
  const [remoteConfig, setRemoteConfig] = useState<HomepageConfig>(DEFAULT_CONFIG);
  const [draftConfig, setDraftConfig] = useState<HomepageConfig>(DEFAULT_CONFIG);
  const [lastDraftAt, setLastDraftAt] = useState<string | null>(null);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [heroAnimSavingState, setHeroAnimSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [heroAnimSavedAt, setHeroAnimSavedAt] = useState<number | null>(null);
  const [promoAnimSavingState, setPromoAnimSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [promoAnimSavedAt, setPromoAnimSavedAt] = useState<number | null>(null);

  const loadData = async () => {
    if (!token) return;
    try {
      const [configResponse, mediaResponse, productsResponse, categoriesResponse, bannersResponse] = await Promise.all([
        api.get('/homepage-config'),
        adminApi.get('/media', token),
        api.get('/products?active=true').catch(() => ({ products: [] })),
        api.get('/categories').catch(() => ({ categories: [] })),
        api.get('/banners').catch(() => ({ banners: [] })),
      ]);
      const serverConfig = normalizeHomepageConfig(configResponse?.config || {});
      const draftRaw = localStorage.getItem(DRAFT_KEY);
      const draftFromStorage = draftRaw ? normalizeHomepageConfig(JSON.parse(draftRaw)) : null;
      const sync = readSyncState();

      setRemoteConfig(serverConfig);
      setDraftConfig(draftFromStorage || serverConfig);
      setLastDraftAt(sync.lastDraftAt);
      setLastPublishedAt(sync.lastPublishedAt);

      const mediaItems = Array.isArray(mediaResponse?.media) ? mediaResponse.media : [];
      setMedia(mediaItems.filter((item: MediaItem) => item?.content_type?.startsWith('image/')));

      const nextProducts = Array.isArray(productsResponse?.products)
        ? productsResponse.products.map((item: any) => ({
            id: String(item?.id || ''),
            name_fr: normalizeSafeText(item?.name_fr, ''),
            name_ar: normalizeSafeText(item?.name_ar, ''),
          }))
        : [];
      const nextCategories = Array.isArray(categoriesResponse?.categories)
        ? categoriesResponse.categories.map((item: any) => ({
            id: String(item?.id || ''),
            name_fr: normalizeSafeText(item?.name_fr, ''),
            name_ar: normalizeSafeText(item?.name_ar, ''),
          }))
        : [];
      const nextBanners = Array.isArray(bannersResponse?.banners)
        ? bannersResponse.banners.map((item: any) => ({
            id: String(item?.id || ''),
            title_fr: normalizeSafeText(item?.title_fr, ''),
            title_ar: normalizeSafeText(item?.title_ar, ''),
            placement: normalizeSafeText(item?.placement, 'homepage_hero'),
            is_active: item?.is_active !== false,
          }))
        : [];

      setProducts(nextProducts.filter((item: ProductLookup) => item.id));
      setCategories(nextCategories.filter((item: CategoryLookup) => item.id));
      setBanners(nextBanners.filter((item: BannerLookup) => item.id));

      if (draftFromStorage) {
        toast.info('Brouillon local restauré.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erreur de chargement de la page d’accueil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const updateSection = (sectionKey: SectionKey, patch: Partial<HomepageSection>) => {
    setDraftConfig((prev) => ({
      ...prev,
      [sectionKey]: normalizeSection({ ...prev[sectionKey], ...patch }, prev[sectionKey]),
    }));
  };

  // Auto-persist a single section's config to the server without going through
  // the full Publier pipeline (no validator gating). This powers the
  // debounced animation panels for Hero & Promo, so Amélioration 2 (animation
  // controls) lands immediately in homepage_sections.config without waiting
  // for the admin to click Publier.
  const persistSectionPartial = async (sectionKey: SectionKey, patch: Partial<HomepageSection>) => {
    if (!token) return;
    try {
      const next = normalizeHomepageConfig({
        ...draftConfig,
        [sectionKey]: { ...draftConfig[sectionKey], ...patch },
      });
      await adminApi.put('/homepage-config', next, token);
      setRemoteConfig(next);
      const timestamp = new Date().toISOString();
      setLastPublishedAt(timestamp);
      persistSyncState(lastDraftAt, timestamp);
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const handleHeroAnimationChange = async (cfg: CarouselAnimationConfig) => {
    updateSection('hero', { hero_animation: cfg });
    setHeroAnimSavingState('saving');
    try {
      await persistSectionPartial('hero', { hero_animation: cfg });
      setHeroAnimSavingState('saved');
      setHeroAnimSavedAt(Date.now());
    } catch {
      setHeroAnimSavingState('error');
    }
  };

  // ─── Priority 5 · Hero overlay master toggle ─────────────────────────────
  const [heroOverlaySavingState, setHeroOverlaySavingState] =
    useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [heroOverlaySavedAt, setHeroOverlaySavedAt] = useState<number | null>(null);
  const heroOverlayGlobal = (draftConfig.hero as any)?.show_text_overlay_global !== false;
  const handleHeroOverlayGlobalToggle = async (next: boolean) => {
    updateSection('hero', { show_text_overlay_global: next } as any);
    setHeroOverlaySavingState('saving');
    try {
      await persistSectionPartial('hero', { show_text_overlay_global: next } as any);
      setHeroOverlaySavingState('saved');
      setHeroOverlaySavedAt(Date.now());
    } catch {
      setHeroOverlaySavingState('error');
    }
  };

  const handlePromoAnimationChange = async (cfg: CarouselAnimationConfig) => {
    updateSection('promotions', { promo_animation: cfg });
    setPromoAnimSavingState('saving');
    try {
      await persistSectionPartial('promotions', { promo_animation: cfg });
      setPromoAnimSavingState('saved');
      setPromoAnimSavedAt(Date.now());
    } catch {
      setPromoAnimSavingState('error');
    }
  };

  const updateOrder = (sectionKey: SectionKey, direction: 'up' | 'down') => {
    setDraftConfig((prev) => {
      const current = [...prev.sections_order];
      const index = current.indexOf(sectionKey);
      if (index < 0) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return prev;
      [current[index], current[target]] = [current[target], current[index]];
      return { ...prev, sections_order: current };
    });
  };

  const moveSectionTo = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setDraftConfig((prev) => {
      const current = [...prev.sections_order];
      if (fromIndex < 0 || fromIndex >= current.length) return prev;
      const clampedTo = Math.max(0, Math.min(current.length - 1, toIndex));
      const [moved] = current.splice(fromIndex, 1);
      current.splice(clampedTo, 0, moved);
      return { ...prev, sections_order: current };
    });
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const normalized = normalizeHomepageConfig(draftConfig);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(normalized));
      const timestamp = new Date().toISOString();
      setLastDraftAt(timestamp);
      persistSyncState(timestamp, lastPublishedAt);
      toast.success('Brouillon sauvegardé.');
    } catch (error) {
      console.error(error);
      toast.error('Impossible de sauvegarder le brouillon.');
    } finally {
      setSavingDraft(false);
    }
  };

  const publish = async () => {
    if (!token) return;
    const payload = normalizeHomepageConfig(draftConfig);
    // Run the structured validator once and split errors from warnings:
    // errors gate the publish, warnings are surfaced as a secondary toast
    // so the admin sees them without being blocked.
    const report = validateHomepageConfig(payload);
    if (!report.canPublish) {
      const head = report.errors[0]?.messageFr || 'Configuration invalide.';
      const extra = report.errors.length > 1 ? ` (+${report.errors.length - 1} autre${report.errors.length > 2 ? 's' : ''})` : '';
      toast.error(head + extra);
      return;
    }
    if (report.warnings.length) {
      const head = report.warnings[0].messageFr;
      const extra = report.warnings.length > 1 ? ` (+${report.warnings.length - 1} autre${report.warnings.length > 2 ? 's' : ''})` : '';
      toast.message(`Avertissement: ${head}${extra}`);
    }

    setPublishing(true);
    try {
      await adminApi.put('/homepage-config', payload, token);
      setRemoteConfig(payload);
      const timestamp = new Date().toISOString();
      setLastPublishedAt(timestamp);
      persistSyncState(lastDraftAt, timestamp);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      toast.success('Homepage publiée avec succès.');
    } catch (error) {
      console.error(error);
      toast.error('Publication échouée.');
    } finally {
      setPublishing(false);
    }
  };

  const resetExpandedSection = () => {
    if (!expandedKey) return;
    if (!window.confirm(`Réinitialiser la section "${SECTION_META[expandedKey].labelFr}" ? Les modifications non publiées seront perdues.`)) return;
    setDraftConfig((prev) => ({
      ...prev,
      [expandedKey]: normalizeSection(remoteConfig[expandedKey], DEFAULT_CONFIG[expandedKey]),
    }));
    toast.success(`Section ${SECTION_META[expandedKey].labelFr} réinitialisée.`);
  };

  const clearSyncState = () => {
    if (!window.confirm('Supprimer le brouillon local et restaurer la version publiée ? Cette action est irréversible.')) return;
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(SYNC_KEY);
    setLastDraftAt(null);
    setLastPublishedAt(null);
    setDraftConfig(remoteConfig);
    toast.success('État local nettoyé.');
  };

  const statusLine = useMemo(() => {
    const parts: string[] = [];
    if (lastDraftAt) {
      parts.push(`Brouillon: ${new Date(lastDraftAt).toLocaleString('fr-FR')}`);
    }
    if (lastPublishedAt) {
      parts.push(`Publié: ${new Date(lastPublishedAt).toLocaleString('fr-FR')}`);
    }
    return parts.join(' • ');
  }, [lastDraftAt, lastPublishedAt]);

  const productSourceOptions = useMemo(
    () => [
      ...PRODUCT_SOURCE_PRESETS,
      ...products.map((item) => ({
        value: item.id,
        label: `Produit: ${item.name_fr || item.name_ar || item.id}`,
      })),
    ],
    [products],
  );

  const categorySourceOptions = useMemo(
    () => [
      ...CATEGORY_SOURCE_PRESETS,
      ...categories.map((item) => ({
        value: item.id,
        label: `Catégorie: ${item.name_fr || item.name_ar || item.id}`,
      })),
    ],
    [categories],
  );

  const bannerSourceOptions = useMemo(
    () => [
      ...BANNER_SOURCE_PRESETS,
      ...banners
        .filter((item) => item.is_active)
        .map((item) => ({
          value: item.id,
          label: `Bannière: ${item.title_fr || item.title_ar || item.id} (${item.placement})`,
        })),
    ],
    [banners],
  );

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    );
  }

  const hasDraftAhead = !!(lastDraftAt && (!lastPublishedAt || lastDraftAt > lastPublishedAt));
  const liveReport = validateHomepageConfig(draftConfig);
  const liveErrors = liveReport.errors;
  const liveWarnings = liveReport.warnings;

  return (
    <div className="space-y-6">
      {hasDraftAhead && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="shrink-0 text-lg">⚠️</span>
          <span className="font-semibold">Brouillon local non publié — les modifications ne sont pas encore visibles sur le site.</span>
          <button type="button" onClick={publish} disabled={publishing} className="ml-auto shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-700 disabled:opacity-60">
            Publier maintenant
          </button>
        </div>
      )}
      {(liveErrors.length > 0 || liveWarnings.length > 0) && (
        <div className="space-y-2">
          {liveErrors.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="mb-2 flex items-center gap-2 font-black">
                <AlertTriangle size={16} />
                <span>Erreurs ({liveErrors.length}) — la publication est bloquée</span>
              </div>
              <ul className="list-inside list-disc space-y-1 text-xs">
                {liveErrors.slice(0, 6).map((err, idx) => (
                  <li key={`err-${idx}`}>{err.messageFr}</li>
                ))}
                {liveErrors.length > 6 && (
                  <li className="opacity-70">… +{liveErrors.length - 6} autre(s)</li>
                )}
              </ul>
            </div>
          )}
          {liveWarnings.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="mb-2 flex items-center gap-2 font-black">
                <AlertTriangle size={16} />
                <span>Avertissements ({liveWarnings.length}) — la publication reste possible</span>
              </div>
              <ul className="list-inside list-disc space-y-1 text-xs">
                {liveWarnings.slice(0, 6).map((warn, idx) => (
                  <li key={`warn-${idx}`}>{warn.messageFr}</li>
                ))}
                {liveWarnings.length > 6 && (
                  <li className="opacity-70">… +{liveWarnings.length - 6} autre(s)</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
      {/* ─── Priority 5 · Master overlay switch (show/hide the hero text card globally) ─── */}
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="relative overflow-hidden rounded-2xl border border-sky-200/60 bg-gradient-to-br from-white via-sky-50/70 to-indigo-50/50 p-5 shadow-[0_10px_30px_-20px_rgba(30,64,175,0.35)]"
      >
        <div className="pointer-events-none absolute -top-16 -end-16 h-40 w-40 rounded-full bg-gradient-to-br from-sky-200/70 to-transparent blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${heroOverlayGlobal ? 'bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-md' : 'bg-gray-200 text-gray-500'}`}>
              <Eye size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-black text-gray-900 leading-tight">
                {lang === 'ar' ? 'بطاقة العنوان فوق الفيديو' : 'Carte de titre sur la vidéo'}
              </h3>
              <p className="mt-0.5 text-xs text-gray-600 leading-snug max-w-xl">
                {lang === 'ar'
                  ? 'شغّل أو أطفئ نافذة "Nouvelle Collection" البيضاء التي تظهر فوق الفيديو/الصورة. عند الإطفاء، يُعرض الوسيط بكامل شاشة البطل دون أي نص.'
                  : 'Activez ou désactivez la carte blanche "Nouvelle Collection" qui s’affiche au-dessus de la vidéo/image. Quand elle est désactivée, le média occupe tout le hero sans aucun texte superposé.'}
              </p>
              {heroOverlaySavingState !== 'idle' && (
                <p className="mt-1 text-[11px] font-semibold text-sky-700">
                  {heroOverlaySavingState === 'saving' && (lang === 'ar' ? 'جارٍ الحفظ…' : 'Sauvegarde…')}
                  {heroOverlaySavingState === 'saved' && (lang === 'ar' ? '✓ تم الحفظ' : '✓ Enregistré')}
                  {heroOverlaySavingState === 'error' && (lang === 'ar' ? 'خطأ في الحفظ' : 'Erreur de sauvegarde')}
                  {heroOverlaySavedAt && heroOverlaySavingState === 'saved' && (
                    <span className="ms-2 opacity-60">
                      {new Date(heroOverlaySavedAt).toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-bold ${heroOverlayGlobal ? 'text-emerald-700' : 'text-gray-400'}`}>
              {heroOverlayGlobal
                ? (lang === 'ar' ? 'مُفعَّلة' : 'Activée')
                : (lang === 'ar' ? 'مُعطَّلة' : 'Désactivée')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={heroOverlayGlobal}
              aria-label={lang === 'ar' ? 'زر تشغيل/إطفاء بطاقة العنوان' : 'Interrupteur carte de titre'}
              onClick={() => handleHeroOverlayGlobalToggle(!heroOverlayGlobal)}
              className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 ${heroOverlayGlobal ? 'bg-gradient-to-r from-sky-500 to-indigo-500' : 'bg-gray-300'}`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${heroOverlayGlobal ? 'translate-x-7 rtl:-translate-x-7' : 'translate-x-1 rtl:-translate-x-1'}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Gestionnaire du Hero Carousel (Carrousel publicitaire principal) ─── */}
      <HeroCarouselManager
        heroAnimation={draftConfig.hero?.hero_animation || DEFAULT_HERO_ANIMATION}
        onHeroAnimationChange={handleHeroAnimationChange}
        animationSavedAt={heroAnimSavedAt}
        animationSavingState={heroAnimSavingState}
      />

      {/* ─── Priority 6 · Sticky action bar ─── */}
      <div className="sticky top-0 z-40 -mx-2 md:-mx-4 rounded-2xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
        <div className="flex flex-col gap-3 px-4 py-3 md:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="min-w-0 shrink">
            <h1 className={`text-xl md:text-2xl font-black leading-tight ${t.text}`}>Page d’accueil</h1>
            <p className={`mt-0.5 text-xs ${t.textMuted} leading-snug truncate`}>
              Homepage builder bilingue — sections, source mode, ordre merchandising & preview live.
            </p>
            {statusLine && <p className={`mt-0.5 text-[11px] font-semibold text-slate-500 truncate`}>{statusLine}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
            {/* Save — secondary outline slate */}
            <button
              type="button"
              onClick={saveDraft}
              disabled={savingDraft}
              title="Save"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save size={14} />
              <span className="hidden md:inline">{savingDraft ? 'Sauvegarde...' : 'Save'}</span>
            </button>

            {/* Preview desktop — neutral */}
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              title="Preview desktop"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                previewDevice === 'desktop'
                  ? 'border-sky-300 bg-sky-50 text-sky-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Monitor size={14} />
              <span className="hidden md:inline">Desktop</span>
            </button>

            {/* Preview mobile — neutral */}
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              title="Preview mobile"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                previewDevice === 'mobile'
                  ? 'border-sky-300 bg-sky-50 text-sky-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Smartphone size={14} />
              <span className="hidden md:inline">Mobile</span>
            </button>

            {/* Publish — primary coral (most visible) */}
            <button
              type="button"
              onClick={publish}
              disabled={publishing}
              title="Publish"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black text-white shadow-lg shadow-orange-500/30 transition hover:brightness-110 hover:shadow-orange-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)' }}
            >
              <Send size={14} />
              {publishing ? 'Publication...' : 'Publish'}
            </button>

            {/* Reset section — warning outline orange */}
            <button
              type="button"
              onClick={resetExpandedSection}
              disabled={!expandedKey}
              title="Reset section"
              className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 bg-orange-50/60 px-3 py-2 text-xs font-bold text-orange-700 transition hover:bg-orange-100/80 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RotateCcw size={14} />
              <span className="hidden md:inline">Reset</span>
            </button>

            {/* Clear cache — ghost discret */}
            <button
              type="button"
              onClick={clearSyncState}
              title="Clear cache"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <RefreshCw size={14} />
              <span className="hidden md:inline">Clear</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          {draftConfig.sections_order.map((sectionKey, index) => {
            const meta = SECTION_META[sectionKey];
            const Icon = meta.icon;
            const section = draftConfig[sectionKey];
            const expanded = expandedKey === sectionKey;

            const isDragging = dragIndex === index;
            const isDropTarget = dragOverIndex === index && dragIndex !== null && dragIndex !== index;

            return (
              <div
                key={sectionKey}
                draggable
                onDragStart={(event) => {
                  setDragIndex(index);
                  event.dataTransfer.effectAllowed = 'move';
                  try {
                    event.dataTransfer.setData('text/plain', sectionKey);
                  } catch {
                    /* ignore — some browsers restrict setData */
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) {
                    setDragOverIndex(index);
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) {
                    moveSectionTo(dragIndex, index);
                  }
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={`${t.card} ${t.cardBorder} overflow-hidden rounded-2xl border shadow-sm transition-all ${
                  isDragging ? 'scale-[0.99] opacity-50' : ''
                } ${isDropTarget ? 'border-t-4 border-t-blue-500 ring-2 ring-blue-200' : ''}`}
              >
                <div
                  className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${t.rowHover}`}
                  onClick={() => setExpandedKey(expanded ? null : sectionKey)}
                >
                  <div
                    className="flex h-8 w-5 cursor-grab items-center justify-center text-gray-400 hover:text-gray-600 active:cursor-grabbing"
                    onClick={(event) => event.stopPropagation()}
                    title="Glisser pour réordonner"
                  >
                    <GripVertical size={14} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateOrder(sectionKey, 'up');
                      }}
                      className="rounded p-0.5 text-gray-500 hover:bg-gray-100"
                      disabled={index === 0}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateOrder(sectionKey, 'down');
                      }}
                      className="rounded p-0.5 text-gray-500 hover:bg-gray-100"
                      disabled={index === draftConfig.sections_order.length - 1}
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: meta.color }}>
                    <Icon size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-black ${t.text}`}>{meta.labelFr}</p>
                    <p className={`truncate text-xs ${t.textMuted}`} dir="rtl">{meta.labelAr}</p>
                  </div>

                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${t.badge}`}>#{index + 1}</span>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateSection(sectionKey, { enabled: !section.enabled });
                    }}
                    className={`rounded-full px-2 py-1 text-[10px] font-black ${
                      section.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {section.enabled ? 'Active' : 'Inactive'}
                  </button>

                  <div className="text-gray-500">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {expanded && (
                  <div className={`space-y-4 border-t ${t.divider} p-4`}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <LabeledInput
                        label="Titre FR"
                        value={section.title_fr}
                        onChange={(value) => updateSection(sectionKey, { title_fr: normalizeSafeText(value, '') })}
                      />
                      <LabeledInput
                        label="العنوان AR"
                        value={section.title_ar}
                        onChange={(value) => updateSection(sectionKey, { title_ar: normalizeSafeText(value, '') })}
                        dir="rtl"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <LabeledTextarea
                        label="Sous-titre FR"
                        value={section.subtitle_fr}
                        onChange={(value) => updateSection(sectionKey, { subtitle_fr: normalizeSafeText(value, '') })}
                      />
                      <LabeledTextarea
                        label="العنوان الفرعي AR"
                        value={section.subtitle_ar}
                        onChange={(value) => updateSection(sectionKey, { subtitle_ar: normalizeSafeText(value, '') })}
                        dir="rtl"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <LabeledInput
                        label="CTA FR"
                        value={section.cta_fr}
                        onChange={(value) => updateSection(sectionKey, { cta_fr: normalizeSafeText(value, '') })}
                      />
                      <LabeledInput
                        label="CTA AR"
                        value={section.cta_ar}
                        onChange={(value) => updateSection(sectionKey, { cta_ar: normalizeSafeText(value, '') })}
                        dir="rtl"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <LabeledInput
                        label="CTA Link"
                        value={section.cta_link}
                        onChange={(value) => updateSection(sectionKey, { cta_link: value })}
                        placeholder="/shop"
                      />
                      <LabeledInput
                        label="Style variant"
                        value={section.style_variant}
                        onChange={(value) => updateSection(sectionKey, { style_variant: normalizeSafeText(value, 'default') || 'default' })}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-xs font-semibold text-gray-600">
                        <span>Source mode</span>
                        <select
                          value={section.source_mode}
                          onChange={(event) => updateSection(sectionKey, { source_mode: event.target.value as SourceMode })}
                          className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                        >
                          {SOURCE_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      {section.source_mode === 'products' ? (
                        <label className="space-y-1 text-xs font-semibold text-gray-600">
                          <span>Source produits</span>
                          <select
                            value={splitSourceRefValues(section.source_ref)[0] || ''}
                            onChange={(event) => updateSection(sectionKey, { source_ref: normalizeSafeText(event.target.value, '') })}
                            className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                          >
                            <option value="">Sélectionner une source</option>
                            {productSourceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : section.source_mode === 'categories' ? (
                        <label className="space-y-1 text-xs font-semibold text-gray-600">
                          <span>Source catégories</span>
                          <select
                            value={splitSourceRefValues(section.source_ref)[0] || ''}
                            onChange={(event) => updateSection(sectionKey, { source_ref: normalizeSafeText(event.target.value, '') })}
                            className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                          >
                            <option value="">Sélectionner une source</option>
                            {categorySourceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : section.source_mode === 'banners' ? (
                        <label className="space-y-1 text-xs font-semibold text-gray-600">
                          <span>Source bannières</span>
                          <select
                            value={splitSourceRefValues(section.source_ref)[0] || ''}
                            onChange={(event) => updateSection(sectionKey, { source_ref: normalizeSafeText(event.target.value, '') })}
                            className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                          >
                            <option value="">Sélectionner une source</option>
                            {bannerSourceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <LabeledInput
                          label="Source ref"
                          value={section.source_ref}
                          onChange={(value) => updateSection(sectionKey, { source_ref: normalizeSafeText(value, '') })}
                          placeholder="manual"
                        />
                      )}
                    </div>

                    <LabeledInput
                      label="Source ref (avancé: IDs séparés par virgule)"
                      value={section.source_ref}
                      onChange={(value) => updateSection(sectionKey, { source_ref: normalizeSafeText(value, '') })}
                      placeholder="featured,prod-id-1,prod-id-2"
                    />

                    {section.limit !== undefined && (
                      <label className="space-y-1 text-xs font-semibold text-gray-600">
                        <span>Nombre maximum d’éléments</span>
                        <input
                          type="number"
                          value={String(section.limit || 8)}
                          onChange={(event) => updateSection(sectionKey, { limit: normalizeOrder(event.target.value, 8, 48) })}
                          className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                        />
                      </label>
                    )}

                    <div className="space-y-2 rounded-2xl border border-gray-200 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-gray-500">Image section</p>
                      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                        {section.image ? (
                          <img src={section.image} alt={section.title_fr} className="h-32 w-full object-cover" />
                        ) : (
                          <div className="flex h-32 w-full items-center justify-center text-gray-400">
                            <ImageIcon size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setPickerSection(sectionKey)}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
                        >
                          Médiathèque
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSection(sectionKey, { image: '' })}
                          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          Retirer image
                        </button>
                      </div>
                      <LabeledInput
                        label="URL image"
                        value={section.image}
                        onChange={(value) => updateSection(sectionKey, { image: normalizeSafeText(value, '') })}
                        placeholder="https://..."
                      />
                    </div>

                    {sectionKey === 'trust' && (
                      <TrustItemsEditor
                        items={section.trust_items || []}
                        onChange={(nextItems) => updateSection(sectionKey, { trust_items: nextItems })}
                      />
                    )}

                    {sectionKey === 'testimonials' && (
                      <TestimonialItemsEditor
                        items={section.testimonial_items || []}
                        onChange={(nextItems) => updateSection(sectionKey, { testimonial_items: nextItems })}
                      />
                    )}

                    {sectionKey === 'promotions' && (
                      <>
                        <AnimationControlPanel
                          value={section.promo_animation || null}
                          defaults={DEFAULT_PROMO_ANIMATION}
                          onChange={handlePromoAnimationChange}
                          lang={lang}
                          title={lang === 'ar' ? 'إعدادات التحريك (عروض)' : 'Paramètres d\u2019animation (Promos)'}
                          debounceMs={800}
                          hideArrows
                          savedAt={promoAnimSavedAt}
                          savingState={promoAnimSavingState}
                        />
                        <PromoImagesEditor
                          items={section.promo_images || []}
                          onChange={(nextItems) => updateSection(sectionKey, { promo_images: nextItems })}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={`${t.card} ${t.cardBorder} rounded-2xl border p-4 shadow-sm`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-black ${t.text}`}>Preview live</h3>
              <p className={`text-xs ${t.textMuted}`}>Desktop / mobile</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`rounded-lg p-2 ${previewDevice === 'desktop' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <Monitor size={16} />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`rounded-lg p-2 ${previewDevice === 'mobile' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <Smartphone size={16} />
              </button>
            </div>
          </div>

          <div className={`mx-auto overflow-hidden rounded-2xl border border-gray-200 bg-white ${previewDevice === 'mobile' ? 'max-w-[340px]' : ''}`}>
            <div className="space-y-3 p-3">
              {draftConfig.sections_order.map((key) => {
                const section = draftConfig[key];
                if (!section.enabled) return null;
                const meta = SECTION_META[key];
                return (
                  <div key={key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-white" style={{ backgroundColor: meta.color }}>
                        {React.createElement(meta.icon, { size: 12 })}
                      </span>
                      <p className="text-xs font-black text-gray-700">{meta.labelFr}</p>
                    </div>
                    {section.image && (
                      <div className="mb-2 overflow-hidden rounded-lg border border-gray-200">
                        <img src={section.image} alt={section.title_fr} className={`w-full object-cover ${previewDevice === 'mobile' ? 'h-20' : 'h-28'}`} />
                      </div>
                    )}
                    <p className="text-sm font-black text-gray-900">{section.title_fr || 'Titre FR'}</p>
                    <p className="text-xs text-gray-500" dir="rtl">{section.title_ar || 'العنوان'}</p>
                    {(section.subtitle_fr || section.subtitle_ar) && (
                      <>
                        <p className="mt-1 text-xs text-gray-700">{section.subtitle_fr}</p>
                        <p className="text-xs text-gray-500" dir="rtl">{section.subtitle_ar}</p>
                      </>
                    )}
                    {key === 'trust' && section.trust_items && section.trust_items.length > 0 && (
                      <p className="mt-2 text-[11px] font-semibold text-sky-700">
                        {section.trust_items.length} éléments de confiance
                      </p>
                    )}
                    {key === 'testimonials' && section.testimonial_items && section.testimonial_items.length > 0 && (
                      <p className="mt-2 text-[11px] font-semibold text-violet-700">
                        {section.testimonial_items.length} témoignages
                      </p>
                    )}
                    {key === 'promotions' && section.promo_images && section.promo_images.length > 0 && (
                      <p className="mt-2 text-[11px] font-semibold text-amber-700">
                        {section.promo_images.length} image(s) promo
                      </p>
                    )}
                    {(section.cta_fr || section.cta_ar) && (
                      <span className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold text-blue-700">
                        {section.cta_fr || section.cta_ar}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {pickerSection && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className={`${t.card} ${t.cardBorder} w-full max-w-4xl rounded-3xl border p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className={`text-lg font-black ${t.text}`}>Médiathèque images</h3>
              <button
                type="button"
                onClick={() => setPickerSection(null)}
                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    updateSection(pickerSection, { image: item.url });
                    setPickerSection(null);
                  }}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left hover:border-blue-300"
                >
                  <img src={item.url} alt={item.filename || 'media'} className="h-28 w-full object-cover" />
                  <p className="truncate px-2 py-1 text-[11px] font-semibold text-gray-600">
                    {item.filename || 'image'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder = '',
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-300 focus:outline-none"
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        dir={dir}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-300 focus:outline-none"
      />
    </label>
  );
}

function TrustItemsEditor({
  items,
  onChange,
}: {
  items: TrustItem[];
  onChange: (items: TrustItem[]) => void;
}) {
  const updateItem = (index: number, patch: Partial<TrustItem>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  };
  const removeItem = (index: number) => {
    if (items.length <= 3) {
      toast.error('Au moins 3 elements sont requis pour la section confiance.');
      return;
    }
    onChange(items.filter((_, i) => i !== index));
  };
  const addItem = () => {
    if (items.length >= 12) {
      toast.error('Maximum 12 elements.');
      return;
    }
    onChange([
      ...items,
      {
        id: `trust-${Date.now().toString(36)}`,
        icon: 'shield',
        value_fr: '',
        value_ar: '',
        label_fr: '',
        label_ar: '',
        color: '#0EA5E9',
      },
    ]);
  };
  return (
    <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wide text-sky-700">Elements de confiance ({items.length})</p>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
        >
          <Plus size={12} />
          Ajouter
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-gray-500">Aucun element. Cliquez sur Ajouter pour en creer un.</p>
      )}
      {items.map((item, index) => (
        <div key={item.id || index} className="space-y-2 rounded-xl border border-sky-100 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">#{index + 1}</p>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="rounded-lg p-1 text-red-500 hover:bg-red-50"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-gray-600">
              <span>Icone</span>
              <select
                value={item.icon}
                onChange={(event) => updateItem(index, { icon: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                {TRUST_ICON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-gray-600">
              <span>Couleur</span>
              <input
                type="color"
                value={item.color || '#0EA5E9'}
                onChange={(event) => updateItem(index, { color: event.target.value })}
                className="h-9 w-full rounded-xl border border-gray-200 bg-white"
              />
            </label>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput
              label="Valeur FR (ex: 15 000+)"
              value={item.value_fr}
              onChange={(value) => updateItem(index, { value_fr: normalizeSafeText(value, '') })}
              placeholder="15 000+"
            />
            <LabeledInput
              label="القيمة AR"
              value={item.value_ar}
              onChange={(value) => updateItem(index, { value_ar: normalizeSafeText(value, '') })}
              dir="rtl"
              placeholder="+15 000"
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput
              label="Libelle FR"
              value={item.label_fr}
              onChange={(value) => updateItem(index, { label_fr: normalizeSafeText(value, '') })}
              placeholder="Commandes livrees"
            />
            <LabeledInput
              label="العنوان AR"
              value={item.label_ar}
              onChange={(value) => updateItem(index, { label_ar: normalizeSafeText(value, '') })}
              dir="rtl"
              placeholder="طلبات مسلمة"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TestimonialItemsEditor({
  items,
  onChange,
}: {
  items: TestimonialItem[];
  onChange: (items: TestimonialItem[]) => void;
}) {
  const updateItem = (index: number, patch: Partial<TestimonialItem>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  };
  const removeItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('Au moins 1 temoignage est requis.');
      return;
    }
    onChange(items.filter((_, i) => i !== index));
  };
  const addItem = () => {
    if (items.length >= 24) {
      toast.error('Maximum 24 temoignages.');
      return;
    }
    onChange([
      ...items,
      {
        id: `testi-${Date.now().toString(36)}`,
        author_fr: '',
        author_ar: '',
        quote_fr: '',
        quote_ar: '',
        wilaya_fr: 'Alger',
        wilaya_ar: 'الجزائر العاصمة',
        rating: 5,
        avatar_url: '',
      },
    ]);
  };
  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wide text-amber-700">Temoignages ({items.length})</p>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
        >
          <Plus size={12} />
          Ajouter
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-gray-500">Aucun temoignage. Cliquez sur Ajouter pour en creer un.</p>
      )}
      {items.map((item, index) => (
        <div key={item.id || index} className="space-y-2 rounded-xl border border-amber-100 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">#{index + 1}</p>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="rounded-lg p-1 text-red-500 hover:bg-red-50"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput
              label="Nom (FR)"
              value={item.author_fr}
              onChange={(value) => updateItem(index, { author_fr: normalizeSafeText(value, '') })}
              placeholder="Amine Benali"
            />
            <LabeledInput
              label="الاسم (AR)"
              value={item.author_ar}
              onChange={(value) => updateItem(index, { author_ar: normalizeSafeText(value, '') })}
              dir="rtl"
              placeholder="أمين بن علي"
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-gray-600">
              <span>Wilaya FR</span>
              <select
                value={item.wilaya_fr || WILAYA_PRESETS_FR[0]}
                onChange={(event) => {
                  const idx = WILAYA_PRESETS_FR.indexOf(event.target.value);
                  const ar = idx >= 0 ? WILAYA_PRESETS_AR[idx] : item.wilaya_ar;
                  updateItem(index, { wilaya_fr: event.target.value, wilaya_ar: ar });
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                {WILAYA_PRESETS_FR.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <LabeledInput
              label="الولاية AR"
              value={item.wilaya_ar}
              onChange={(value) => updateItem(index, { wilaya_ar: normalizeSafeText(value, '') })}
              dir="rtl"
              placeholder="الجزائر العاصمة"
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput
              label="Citation FR"
              value={item.quote_fr}
              onChange={(value) => updateItem(index, { quote_fr: normalizeSafeText(value, '') })}
              placeholder="Service rapide et qualite remarquable."
            />
            <LabeledInput
              label="الاقتباس AR"
              value={item.quote_ar}
              onChange={(value) => updateItem(index, { quote_ar: normalizeSafeText(value, '') })}
              dir="rtl"
              placeholder="خدمة سريعة وجودة استثنائية."
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput
              label="Avatar URL"
              value={item.avatar_url || ''}
              onChange={(value) => updateItem(index, { avatar_url: normalizeUrlOrPath(value, '') })}
              placeholder="https://..."
            />
            <label className="space-y-1 text-xs font-semibold text-gray-600">
              <span>Note (1-5)</span>
              <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => updateItem(index, { rating: value })}
                    className="rounded p-0.5 text-amber-500 hover:bg-amber-50"
                    title={`${value} etoile${value > 1 ? 's' : ''}`}
                  >
                    <StarIcon size={14} fill={value <= (item.rating || 5) ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Priority 3: Native upload for PromoImagesEditor ───────────────
// Upload constraints (client-side validated before base64 encode)
const PROMO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;   // 5 MB
const PROMO_VIDEO_MAX_BYTES = 20 * 1024 * 1024;  // 20 MB
const PROMO_IMAGE_MIME = /^image\/(jpeg|jpg|png|webp)$/i;
const PROMO_VIDEO_MIME = /^video\/(mp4|webm)$/i;
const PROMO_IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const PROMO_VIDEO_EXT = /\.(mp4|webm)$/i;

function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const u = url.toLowerCase().split('?')[0];
  return /\.(mp4|webm)$/.test(u);
}

function slugifyFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'file';
}

async function uploadPromoMedia(
  file: File,
  token: string,
  onProgress: (pct: number) => void,
): Promise<{ url: string; filename: string }> {
  const isImg = PROMO_IMAGE_MIME.test(file.type) || PROMO_IMAGE_EXT.test(file.name);
  const isVid = PROMO_VIDEO_MIME.test(file.type) || PROMO_VIDEO_EXT.test(file.name);
  if (!isImg && !isVid) {
    throw new Error('unsupported_type');
  }
  if (isImg && file.size > PROMO_IMAGE_MAX_BYTES) throw new Error('image_too_large');
  if (isVid && file.size > PROMO_VIDEO_MAX_BYTES) throw new Error('video_too_large');

  // Read file as data URL with progress reporting
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 70); // reading=0→70%
        onProgress(Math.max(1, pct));
      }
    };
    reader.onload = (evt) => {
      onProgress(70);
      resolve(String(evt.target?.result || ''));
    };
    reader.readAsDataURL(file);
  });

  // Build a stable filename: promo/{timestamp}-{slug}.{ext}
  const ts = Date.now().toString(36);
  const safeName = slugifyFilename(file.name);
  const storageFilename = `promo/${ts}-${safeName}`;
  onProgress(78);

  const res = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers: apiHeaders(token),
    body: JSON.stringify({
      filename: storageFilename,
      content_type: file.type || (isImg ? 'image/jpeg' : 'video/mp4'),
      data: dataUrl,
      size: file.size,
    }),
  });
  onProgress(92);

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`upload_failed:${res.status}:${msg.slice(0, 120)}`);
  }
  const json = await res.json().catch(() => ({} as any));
  const url = json?.media?.url || json?.url;
  if (!url) throw new Error('upload_no_url');
  onProgress(100);
  return { url, filename: json?.media?.filename || storageFilename };
}

function humanizePromoUploadError(code: string, lang: 'fr' | 'ar'): string {
  const isAr = lang === 'ar';
  if (code === 'unsupported_type') {
    return isAr
      ? 'نوع الملف غير مدعوم. الصور: JPG/PNG/WebP — الفيديوهات: MP4/WebM.'
      : 'Type non supporté. Images: JPG/PNG/WebP — Vidéos: MP4/WebM.';
  }
  if (code === 'image_too_large') {
    return isAr ? 'الصورة أكبر من 5 ميغابايت.' : 'Image > 5 Mo.';
  }
  if (code === 'video_too_large') {
    return isAr ? 'الفيديو أكبر من 20 ميغابايت.' : 'Vidéo > 20 Mo.';
  }
  if (code === 'file_read_failed') {
    return isAr ? 'تعذّر قراءة الملف.' : 'Lecture du fichier impossible.';
  }
  if (code.startsWith('upload_failed')) {
    return isAr ? 'فشل الرفع — حاول مرة أخرى.' : 'Échec du téléversement — réessayez.';
  }
  if (code === 'upload_no_url') {
    return isAr ? 'لم يرجع الخادم رابطًا عموميًا.' : "Le serveur n'a pas retourné d'URL publique.";
  }
  return isAr ? 'حدث خطأ غير متوقع.' : 'Erreur inattendue.';
}

type PromoItemRowProps = {
  item: PromoImage;
  index: number;
  total: number;
  lang: 'fr' | 'ar';
  onChange: (patch: Partial<PromoImage>) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
};

function PromoItemRow({ item, index, total, lang, onChange, onRemove, onMove }: PromoItemRowProps) {
  const { token } = useAuth();
  const [uploadPct, setUploadPct] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const isAr = lang === 'ar';
  const isVideo = isVideoUrl(item.image_url);

  const handleUpload = async (file: File | null) => {
    if (!file || !token) {
      if (!token) toast.error(isAr ? 'جلسة غير صالحة — أعد تسجيل الدخول.' : 'Session expirée — reconnectez-vous.');
      return;
    }
    setUploading(true);
    setUploadPct(1);
    setJustUploaded(false);
    const loadingToast = toast.loading(isAr ? 'جاري رفع الملف…' : 'Téléversement en cours…');
    try {
      const { url } = await uploadPromoMedia(file, token, setUploadPct);
      onChange({ image_url: url });
      toast.success(isAr ? 'تم الرفع بنجاح ✓' : 'Téléversement réussi ✓', { id: loadingToast });
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 2400);
    } catch (err: any) {
      const code = (err?.message || '').split(':')[0];
      toast.error(humanizePromoUploadError(code, lang), { id: loadingToast });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadPct(0), 600);
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    handleUpload(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0] || null;
    handleUpload(file);
  };

  return (
    <div className="space-y-2 rounded-xl border border-orange-100 bg-white p-3">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">
          #{index + 1}{isVideo ? ' · Vidéo' : ''}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title={isAr ? 'إلى الأعلى' : 'Monter'}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            title={isAr ? 'إلى الأسفل' : 'Descendre'}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1 text-red-500 hover:bg-red-50"
            title={isAr ? 'حذف' : 'Supprimer'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Drop zone + preview */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
          dragOver
            ? 'border-orange-500 bg-orange-50'
            : item.image_url
              ? 'border-orange-100 bg-white'
              : 'border-orange-200 bg-orange-50/60 hover:bg-orange-50'
        }`}
        style={{ minHeight: item.image_url ? undefined : 140 }}
      >
        {item.image_url ? (
          isVideo ? (
            <video
              src={item.image_url}
              autoPlay
              muted
              loop
              playsInline
              className="h-40 w-full object-cover"
            />
          ) : (
            <img src={item.image_url} alt={item.title_fr || 'promo'} className="h-40 w-full object-cover" />
          )
        ) : (
          <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <UploadCloud size={24} className="text-orange-500" />
            <p className="text-xs font-bold text-gray-700">
              {isAr ? 'اسحب وأسقط ملفًا هنا' : 'Glissez-déposez un fichier ici'}
            </p>
            <p className="text-[10px] text-gray-500">
              {isAr
                ? 'صور JPG/PNG/WebP (≤5 ميغا) · فيديو MP4/WebM (≤20 ميغا)'
                : 'Images JPG/PNG/WebP (≤5 Mo) · Vidéos MP4/WebM (≤20 Mo)'}
            </p>
          </div>
        )}

        {/* Progress overlay */}
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 backdrop-blur-sm">
            <Loader2 size={20} className="animate-spin text-orange-500" />
            <div className="h-1.5 w-3/4 overflow-hidden rounded-full bg-orange-100">
              <div
                className="h-full bg-orange-500 transition-all duration-200"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
            <p className="text-[11px] font-bold text-orange-700">{uploadPct}%</p>
          </div>
        )}

        {/* Success flash */}
        {justUploaded && !uploading && (
          <div className="absolute end-2 top-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-[10px] font-black text-white shadow">
            <CheckCircle2 size={11} /> OK
          </div>
        )}
      </div>

      {/* Upload actions */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm"
          onChange={onFilePicked}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow hover:bg-orange-600 disabled:opacity-50"
        >
          <UploadCloud size={12} />
          {isAr
            ? (item.image_url ? 'استبدال' : 'من جهازي')
            : (item.image_url ? 'Remplacer' : 'Depuis mes appareils')}
        </button>
        {item.image_url && (
          <a
            href={item.image_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-orange-200 px-3 py-1.5 text-[11px] font-bold text-orange-600 hover:bg-orange-50"
          >
            <Eye size={11} />
            {isAr ? 'معاينة' : 'Aperçu'}
          </a>
        )}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="ms-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-100"
        >
          <LinkIcon size={10} />
          {isAr
            ? (showAdvanced ? 'إخفاء الرابط' : 'لصق رابط (متقدم)')
            : (showAdvanced ? 'Masquer URL' : 'Coller URL (avancé)')}
        </button>
      </div>

      {/* Advanced URL input */}
      {showAdvanced && (
        <LabeledInput
          label={isAr ? 'رابط الصورة/الفيديو' : 'URL image/vidéo'}
          value={item.image_url}
          onChange={(value) => onChange({ image_url: normalizeSafeText(value, '') })}
          placeholder="https://..."
        />
      )}

      {/* Title fields (bilingual) */}
      <div className="grid gap-2 md:grid-cols-2">
        <LabeledInput
          label={isAr ? 'العنوان FR' : 'Titre FR'}
          value={item.title_fr}
          onChange={(value) => onChange({ title_fr: normalizeSafeText(value, '') })}
          placeholder="Pack rentrée scolaire"
        />
        <LabeledInput
          label={isAr ? 'العنوان AR' : 'Titre AR'}
          value={item.title_ar}
          onChange={(value) => onChange({ title_ar: normalizeSafeText(value, '') })}
          dir="rtl"
          placeholder="حزمة الدخول المدرسي"
        />
      </div>

      {/* Link */}
      <LabeledInput
        label={isAr ? 'الرابط (اختياري)' : 'Lien (optionnel)'}
        value={item.link}
        onChange={(value) => onChange({ link: normalizeUrlOrPath(value, '') })}
        placeholder="/shop?promo=true"
      />
    </div>
  );
}

// ─── Priority 4: Splash templates gallery ───────────────────────
type SplashGalleryModalProps = {
  open: boolean;
  lang: 'fr' | 'ar';
  onClose: () => void;
  onSelect: (template: SplashTemplate) => void;
};

function SplashGalleryModal({ open, lang, onClose, onSelect }: SplashGalleryModalProps) {
  const [filter, setFilter] = useState<SplashThemeFilter>('all');
  const isAr = lang === 'ar';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const visible = filter === 'all'
    ? SPLASH_TEMPLATES
    : SPLASH_TEMPLATES.filter((t) => t.theme === filter);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? 'معرض القوالب الترويجية' : 'Galerie de modèles promo'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? 'rtl' : 'ltr'}
        className="relative w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {isAr ? 'معرض القوالب الترويجية' : 'Galerie de modèles'}
            </h3>
            <p className="text-xs text-slate-500">
              {isAr
                ? 'اختر قالبًا لإضافته تلقائيًا مع العنوان والصورة.'
                : 'Cliquez pour insérer automatiquement (image + titre bilingue).'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label={isAr ? 'إغلاق' : 'Fermer'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Theme filters */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3 bg-slate-50/60">
          {SPLASH_THEME_FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
                  active
                    ? 'bg-orange-500 text-white shadow'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {isAr ? f.label_ar : f.label_fr}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-5">
          {visible.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-12">
              {isAr ? 'لا توجد قوالب لهذا الفلتر.' : 'Aucun modèle pour ce filtre.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {visible.map((t) => (
                <div
                  key={t.id}
                  className="group flex flex-col rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="aspect-[3/1] overflow-hidden bg-slate-100">
                    <img
                      src={t.file}
                      alt={isAr ? t.title_ar : t.title_fr}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black text-slate-900 leading-tight line-clamp-1">
                        {isAr ? t.title_ar : t.title_fr}
                      </p>
                      {t.badge && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black text-white"
                          style={{ background: t.accent_color }}
                        >
                          {t.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      {isAr ? t.subtitle_ar : t.subtitle_fr}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelect(t)}
                      className="mt-2 inline-flex items-center justify-center gap-1 rounded-lg bg-orange-500 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-white hover:bg-orange-600 transition"
                    >
                      <CheckCircle2 size={12} />
                      {isAr ? 'اختيار' : 'Sélectionner'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/60 text-[11px] text-slate-500">
          {isAr
            ? `${visible.length} قالب${visible.length === 1 ? '' : ' '} · 1200×400 JPG`
            : `${visible.length} modèle${visible.length === 1 ? '' : 's'} disponible${visible.length === 1 ? '' : 's'} · 1200×400 JPG`}
        </div>
      </div>
    </div>
  );
}

function PromoImagesEditor({
  items,
  onChange,
}: {
  items: PromoImage[];
  onChange: (items: PromoImage[]) => void;
}) {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const [galleryOpen, setGalleryOpen] = useState(false);

  const updateItem = (index: number, patch: Partial<PromoImage>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  };
  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };
  const addItem = () => {
    if (items.length >= 12) {
      toast.error(isAr ? 'الحد الأقصى 12 صورة ترويجية.' : 'Maximum 12 images promo.');
      return;
    }
    onChange([
      ...items,
      {
        id: `promo-img-${Date.now().toString(36)}`,
        image_url: '',
        title_fr: '',
        title_ar: '',
        link: '/shop?promo=true',
      },
    ]);
  };
  const handleSelectTemplate = (t: SplashTemplate) => {
    if (items.length >= 12) {
      toast.error(isAr ? 'الحد الأقصى 12 صورة ترويجية.' : 'Maximum 12 images promo.');
      return;
    }
    onChange([
      ...items,
      {
        id: `promo-img-${Date.now().toString(36)}`,
        image_url: t.file,
        title_fr: t.title_fr,
        title_ar: t.title_ar,
        link: t.suggested_link || '/shop?promo=true',
      },
    ]);
    setGalleryOpen(false);
    toast.success(isAr ? `تمت إضافة: ${t.title_ar}` : `Ajouté : ${t.title_fr}`);
  };
  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wide text-orange-700">
          {isAr ? `صور الكاروسيل الترويجي (${items.length})` : `Images carousel promo (${items.length})`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="inline-flex items-center gap-1 rounded-xl border border-orange-300 bg-white px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-50"
          >
            <ImageIcon size={12} />
            {isAr ? 'القوالب' : 'Modèles'}
          </button>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600"
          >
            <Plus size={12} />
            {isAr ? 'إضافة' : 'Ajouter'}
          </button>
        </div>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-gray-500">
          {isAr
            ? 'لا توجد صور بعد. انقر على "إضافة" لإنشاء واحدة.'
            : 'Aucune image. Cliquez sur Ajouter pour en créer une.'}
        </p>
      )}
      {items.map((item, index) => (
        <PromoItemRow
          key={item.id || index}
          item={item}
          index={index}
          total={items.length}
          lang={lang}
          onChange={(patch) => updateItem(index, patch)}
          onRemove={() => removeItem(index)}
          onMove={(delta) => moveItem(index, index + delta)}
        />
      ))}
      <SplashGalleryModal
        open={galleryOpen}
        lang={lang}
        onClose={() => setGalleryOpen(false)}
        onSelect={handleSelectTemplate}
      />
    </div>
  );
}
