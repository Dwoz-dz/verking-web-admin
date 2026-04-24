/**
 * Shared carousel animation config for Hero + Promo carousels on the homepage.
 * Persisted inside homepage_sections.config JSONB under:
 *   - hero.config.hero_animation
 *   - promotions.config.promo_animation
 * All fields are optional at rest; `normalizeCarouselAnimation` fills missing
 * fields with sensible defaults.
 */

export type CarouselTransitionType =
  | 'fade'
  | 'slide-horizontal'
  | 'slide-vertical'
  | 'zoom-in'
  | 'zoom-out'
  | 'ken-burns'
  | 'flip'
  | 'none';

export type CarouselDirection = 'forward' | 'reverse' | 'alternate';

export type CarouselKenBurnsIntensity = 'none' | 'subtle' | 'medium' | 'strong';

export type CarouselAnimationConfig = {
  slide_duration_ms: number;       // 2000 - 15000
  transition_type: CarouselTransitionType;
  transition_duration_ms: number;  // 300 - 3000
  autoplay: boolean;
  pause_on_hover: boolean;
  loop: boolean;
  direction: CarouselDirection;
  ken_burns_intensity: CarouselKenBurnsIntensity;
  show_dots: boolean;
  show_arrows: boolean;
  respect_reduced_motion: boolean;
};

export const DEFAULT_CAROUSEL_ANIMATION: CarouselAnimationConfig = {
  slide_duration_ms: 5000,
  transition_type: 'ken-burns',
  transition_duration_ms: 1200,
  autoplay: true,
  pause_on_hover: true,
  loop: true,
  direction: 'forward',
  ken_burns_intensity: 'subtle',
  show_dots: true,
  show_arrows: true,
  respect_reduced_motion: true,
};

export const DEFAULT_HERO_ANIMATION: CarouselAnimationConfig = {
  ...DEFAULT_CAROUSEL_ANIMATION,
  show_arrows: true,
};

export const DEFAULT_PROMO_ANIMATION: CarouselAnimationConfig = {
  ...DEFAULT_CAROUSEL_ANIMATION,
  show_arrows: false,
};

const VALID_TRANSITIONS: CarouselTransitionType[] = [
  'fade', 'slide-horizontal', 'slide-vertical',
  'zoom-in', 'zoom-out', 'ken-burns', 'flip', 'none',
];
const VALID_DIRECTIONS: CarouselDirection[] = ['forward', 'reverse', 'alternate'];
const VALID_INTENSITIES: CarouselKenBurnsIntensity[] = ['none', 'subtle', 'medium', 'strong'];

function clamp(n: unknown, min: number, max: number, def: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : def;
  return Math.max(min, Math.min(max, v));
}
function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}
function oneOf<T extends string>(v: unknown, allowed: T[], def: T): T {
  return (typeof v === 'string' && (allowed as string[]).includes(v)) ? (v as T) : def;
}

export function normalizeCarouselAnimation(
  raw: unknown,
  defaults: CarouselAnimationConfig = DEFAULT_CAROUSEL_ANIMATION,
): CarouselAnimationConfig {
  if (!raw || typeof raw !== 'object') return { ...defaults };
  const r = raw as Record<string, unknown>;
  return {
    slide_duration_ms: clamp(r.slide_duration_ms, 2000, 15000, defaults.slide_duration_ms),
    transition_type: oneOf(r.transition_type, VALID_TRANSITIONS, defaults.transition_type),
    transition_duration_ms: clamp(r.transition_duration_ms, 300, 3000, defaults.transition_duration_ms),
    autoplay: bool(r.autoplay, defaults.autoplay),
    pause_on_hover: bool(r.pause_on_hover, defaults.pause_on_hover),
    loop: bool(r.loop, defaults.loop),
    direction: oneOf(r.direction, VALID_DIRECTIONS, defaults.direction),
    ken_burns_intensity: oneOf(r.ken_burns_intensity, VALID_INTENSITIES, defaults.ken_burns_intensity),
    show_dots: bool(r.show_dots, defaults.show_dots),
    show_arrows: bool(r.show_arrows, defaults.show_arrows),
    respect_reduced_motion: bool(r.respect_reduced_motion, defaults.respect_reduced_motion),
  };
}

/** Bilingual label dictionary — kept in one place so both admin + storefront can share. */
export const CAROUSEL_ANIM_LABELS = {
  animation_settings: { fr: "Paramètres d'animation", ar: 'إعدادات الحركة' },
  slide_duration:     { fr: "Durée d'affichage",       ar: 'مدة العرض' },
  transition_type:    { fr: 'Type de transition',       ar: 'نوع الانتقال' },
  transition_speed:   { fr: 'Vitesse de transition',    ar: 'سرعة الانتقال' },
  ken_burns_intensity:{ fr: 'Intensité Ken Burns',      ar: 'شدة كين بيرنز' },
  autoplay:           { fr: 'Lecture auto',             ar: 'تشغيل تلقائي' },
  pause_on_hover:     { fr: 'Pause au survol',          ar: 'إيقاف عند التمرير' },
  loop:               { fr: 'Boucle infinie',           ar: 'تكرار لا نهائي' },
  reduced_motion:     { fr: 'Respecter Reduced Motion', ar: 'احترم وضع الحركة المنخفضة' },
  direction:          { fr: 'Direction',                ar: 'الاتجاه' },
  navigation:         { fr: 'Navigation',               ar: 'التنقل' },
  show_dots:          { fr: 'Points',                   ar: 'النقاط' },
  show_arrows:        { fr: 'Flèches',                  ar: 'الأسهم' },
  reset:              { fr: 'Réinitialiser',            ar: 'إعادة تعيين' },
  saved:              { fr: 'Enregistré ✓',             ar: 'تم الحفظ ✓' },
  saving:             { fr: 'En cours...',              ar: 'جارٍ الحفظ...' },
  preview:            { fr: 'Aperçu en direct',         ar: 'معاينة مباشرة' },
  // transition types
  type_fade:              { fr: 'Fondu',               ar: 'اختفاء' },
  type_slide_horizontal:  { fr: 'Glissement horizontal', ar: 'انزلاق أفقي' },
  type_slide_vertical:    { fr: 'Glissement vertical',   ar: 'انزلاق عمودي' },
  type_zoom_in:           { fr: 'Zoom avant',           ar: 'تقريب' },
  type_zoom_out:          { fr: 'Zoom arrière',         ar: 'تبعيد' },
  type_ken_burns:         { fr: 'Ken Burns',            ar: 'كين بيرنز' },
  type_flip:              { fr: 'Flip 3D',              ar: 'قلب ثلاثي الأبعاد' },
  type_none:              { fr: 'Aucune',               ar: 'بلا' },
  // intensities
  intensity_none:    { fr: 'Aucune', ar: 'بلا' },
  intensity_subtle:  { fr: 'Subtile', ar: 'خفيفة' },
  intensity_medium:  { fr: 'Moyenne', ar: 'متوسطة' },
  intensity_strong:  { fr: 'Forte',   ar: 'قوية' },
  // directions
  dir_forward:   { fr: 'Avant',    ar: 'أمام' },
  dir_reverse:   { fr: 'Arrière',  ar: 'خلف' },
  dir_alternate: { fr: 'Alterné',  ar: 'متناوب' },
} as const;

export type CarouselAnimLabelKey = keyof typeof CAROUSEL_ANIM_LABELS;

export function pickAnimLabel(key: CarouselAnimLabelKey, lang: 'fr' | 'ar'): string {
  const entry = CAROUSEL_ANIM_LABELS[key];
  return lang === 'ar' ? entry.ar : entry.fr;
}
