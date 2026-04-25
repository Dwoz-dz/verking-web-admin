// Default content seeded for every new homepage_config row.
// Used both as the "reset to default" fallback and as the normalizer's
// reference scaffold when fields are missing server-side.
import {
  DEFAULT_HERO_ANIMATION,
  DEFAULT_PROMO_ANIMATION,
} from '../../../../lib/carouselAnimation';
import type {
  HomepageConfig,
  HomepageSection,
  PromoImage,
  TestimonialItem,
  TrustItem,
} from './types';

export const DRAFT_KEY = 'vk_homepage_draft_v2';
export const SYNC_KEY = 'vk_homepage_sync_state_v2';

// Wire-format version for the localStorage payload itself (NOT the
// schema of HomepageConfig — bump this when the on-disk shape changes,
// e.g. switching from `{ ... }` to `{ __v, value: { ... } }`). A legacy
// un-wrapped payload (any v2 draft saved before the versioning helper
// landed) is migrated transparently on first read.
export const DRAFT_VERSION = 1;
export const SYNC_VERSION = 1;

export const DEFAULT_SECTION: HomepageSection = {
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

export const DEFAULT_TRUST_ITEMS: TrustItem[] = [
  { id: 'trust-delivery', icon: 'truck', value_fr: '48h', value_ar: '48 ساعة', label_fr: 'Livraison 58 wilayas', label_ar: 'توصيل لـ 58 ولاية', color: '#145f8e' },
  { id: 'trust-orders', icon: 'package', value_fr: '15 000+', value_ar: '+15 000', label_fr: 'Commandes livrées', label_ar: 'طلبات مُسلَّمة', color: '#8b3f14' },
  { id: 'trust-products', icon: 'award', value_fr: '300+', value_ar: '+300', label_fr: 'Produits éducatifs', label_ar: 'منتجات تعليمية', color: '#0EA5E9' },
  { id: 'trust-clients', icon: 'users', value_fr: '50 000+', value_ar: '+50 000', label_fr: 'Clients satisfaits', label_ar: 'عملاء راضون', color: '#15803d' },
  { id: 'trust-payment', icon: 'credit-card', value_fr: 'Dahabia / CIB / COD', value_ar: 'ذهبية / CIB / الدفع عند التسليم', label_fr: 'Paiement sécurisé', label_ar: 'دفع آمن', color: '#7C3AED' },
  { id: 'trust-support', icon: 'headphones', value_fr: '7j/7', value_ar: '7 أيام / 7', label_fr: 'Support dédié', label_ar: 'دعم مخصص', color: '#DC2626' },
];

export const DEFAULT_TESTIMONIAL_ITEMS: TestimonialItem[] = [
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

export const DEFAULT_PROMO_IMAGES: PromoImage[] = [
  { id: 'promo-img-1', image_url: '', title_fr: 'Pack rentrée scolaire', title_ar: 'حزمة الدخول المدرسي', link: '/shop?promo=true' },
  { id: 'promo-img-2', image_url: '', title_fr: 'Fournitures premium', title_ar: 'أدوات مكتبية فاخرة', link: '/shop?promo=true' },
  { id: 'promo-img-3', image_url: '', title_fr: 'Offres limitées', title_ar: 'عروض محدودة', link: '/shop?promo=true' },
];

export const DEFAULT_CONFIG: HomepageConfig = {
  sections_order: [
    'hero',
    'categories',
    'promotions',
    'best_sellers',
    'new_arrivals',
    'featured',
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
    show_text_overlay_global: true,
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
