// ─────────────────────────────────────────────────────────────
//  VIKING Scolaire — Splash templates gallery (Priority 4)
//  10 bilingual FR/AR splash images pre-rendered at 1200×400
//  JPG q=85 and shipped under /public/splashes/. The admin
//  PromoImagesEditor opens a modal gallery and lets users pick
//  one with a single click: image_url + title_fr + title_ar
//  are auto-filled from the selected template.
// ─────────────────────────────────────────────────────────────

export type SplashTheme =
  | 'back-to-school'
  | 'promo'
  | 'new'
  | 'best-seller'
  | 'pack'
  | 'delivery'
  | 'wholesale'
  | 'premium';

export type SplashTemplate = {
  id: string;
  file: string;          // absolute URL path served by Vite
  theme: SplashTheme;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string;
  subtitle_ar: string;
  badge?: string;
  suggested_link: string;
  accent_color: string;
};

export const SPLASH_TEMPLATES: SplashTemplate[] = [
  {
    id: '01-rentree-2026',
    file: '/splashes/01-rentree-2026.jpg',
    theme: 'back-to-school',
    title_fr: 'Rentrée 2026',
    title_ar: 'العودة المدرسية 2026',
    subtitle_fr: 'Tout pour bien commencer',
    subtitle_ar: 'كل ما تحتاجه لبداية ناجحة',
    badge: '-15%',
    suggested_link: '/shop?category=rentree-2026',
    accent_color: '#1e3a8a',
  },
  {
    id: '02-promo-flash',
    file: '/splashes/02-promo-flash.jpg',
    theme: 'promo',
    title_fr: 'Promo Flash -30%',
    title_ar: 'عرض خاطف -30%',
    subtitle_fr: '48 heures seulement !',
    subtitle_ar: '48 ساعة فقط!',
    badge: '-30%',
    suggested_link: '/shop?promo=true',
    accent_color: '#dc2626',
  },
  {
    id: '03-nouveaute-marcelo',
    file: '/splashes/03-nouveaute-marcelo.jpg',
    theme: 'new',
    title_fr: 'Nouveauté Marcelo',
    title_ar: 'جديد مارسيلو',
    subtitle_fr: 'Collection Exclusive 2026',
    subtitle_ar: 'مجموعة حصرية 2026',
    badge: 'NEW',
    suggested_link: '/shop?brand=marcelo',
    accent_color: '#7c3aed',
  },
  {
    id: '04-best-seller',
    file: '/splashes/04-best-seller.jpg',
    theme: 'best-seller',
    title_fr: 'Best Seller',
    title_ar: 'الأكثر مبيعا',
    subtitle_fr: 'Les plus vendus',
    subtitle_ar: 'الأكثر طلبا',
    badge: '★★★',
    suggested_link: '/shop?best=true',
    accent_color: '#ca8a04',
  },
  {
    id: '05-pack-eleve',
    file: '/splashes/05-pack-eleve.jpg',
    theme: 'pack',
    title_fr: 'Pack Élève',
    title_ar: 'حزمة التلميذ',
    subtitle_fr: 'Économisez jusqu\u2019à 25%',
    subtitle_ar: 'وفر حتى 25%',
    badge: 'PACK',
    suggested_link: '/shop?category=packs',
    accent_color: '#0891b2',
  },
  {
    id: '06-offre-limitee',
    file: '/splashes/06-offre-limitee.jpg',
    theme: 'promo',
    title_fr: 'Offre Limitée',
    title_ar: 'عرض محدود',
    subtitle_fr: 'Jusqu\u2019à épuisement des stocks',
    subtitle_ar: 'حتى نفاد الكمية',
    badge: 'LIMITED',
    suggested_link: '/shop?limited=true',
    accent_color: '#b91c1c',
  },
  {
    id: '07-livraison-58',
    file: '/splashes/07-livraison-58.jpg',
    theme: 'delivery',
    title_fr: 'Livraison 58 Wilayas',
    title_ar: 'توصيل 58 ولاية',
    subtitle_fr: 'Partout en Algérie',
    subtitle_ar: 'في كل الجزائر',
    badge: 'FREE',
    suggested_link: '/shipping',
    accent_color: '#059669',
  },
  {
    id: '08-grossistes-40',
    file: '/splashes/08-grossistes-40.jpg',
    theme: 'wholesale',
    title_fr: 'Grossistes -40%',
    title_ar: 'تجار الجملة -40%',
    subtitle_fr: 'Tarifs pros — Écoles & revendeurs',
    subtitle_ar: 'أسعار المحترفين — المدارس والموزعون',
    badge: 'PRO',
    suggested_link: '/wholesale',
    accent_color: '#1e293b',
  },
  {
    id: '09-collection-premium',
    file: '/splashes/09-collection-premium.jpg',
    theme: 'premium',
    title_fr: 'Collection Premium',
    title_ar: 'المجموعة المميزة',
    subtitle_fr: 'L\u2019élégance au quotidien',
    subtitle_ar: 'الأناقة في كل يوم',
    badge: 'PREMIUM',
    suggested_link: '/shop?premium=true',
    accent_color: '#0f172a',
  },
  {
    id: '10-retour-ecole',
    file: '/splashes/10-retour-ecole.jpg',
    theme: 'back-to-school',
    title_fr: 'Retour à l\u2019école',
    title_ar: 'العودة إلى المدرسة',
    subtitle_fr: 'Tout pour réussir l\u2019année',
    subtitle_ar: 'كل ما تحتاج للنجاح',
    badge: 'NEW YEAR',
    suggested_link: '/shop?category=rentree-2026',
    accent_color: '#15803d',
  },
];

export type SplashThemeFilter = 'all' | SplashTheme;

export const SPLASH_THEME_FILTERS: { key: SplashThemeFilter; label_fr: string; label_ar: string }[] = [
  { key: 'all',             label_fr: 'Tous',          label_ar: 'الكل' },
  { key: 'back-to-school',  label_fr: 'Rentrée',       label_ar: 'العودة المدرسية' },
  { key: 'promo',           label_fr: 'Promo',         label_ar: 'عروض' },
  { key: 'new',             label_fr: 'Nouveautés',    label_ar: 'الجديد' },
  { key: 'best-seller',     label_fr: 'Best Sellers',  label_ar: 'الأكثر مبيعا' },
  { key: 'pack',            label_fr: 'Packs',         label_ar: 'الحزم' },
  { key: 'delivery',        label_fr: 'Livraison',     label_ar: 'التوصيل' },
  { key: 'wholesale',       label_fr: 'Grossistes',    label_ar: 'الجملة' },
  { key: 'premium',         label_fr: 'Premium',       label_ar: 'بريميوم' },
];
