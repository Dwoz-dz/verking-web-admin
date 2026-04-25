// Shared types for the Page d'accueil hub + all section sub-pages.
// Extracted from the legacy AdminHomepage.tsx so that every dedicated
// section page can import the same definitions without creating cycles.
import type { CarouselAnimationConfig } from '../../../../lib/carouselAnimation';

export type PreviewDevice = 'desktop' | 'mobile';
export type SourceMode = 'manual' | 'products' | 'categories' | 'banners';

export type SectionKey =
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

export type MediaItem = {
  id: string;
  url: string;
  filename?: string;
  content_type?: string;
};

export type TrustItem = {
  id: string;
  icon: string;
  value_fr: string;
  value_ar: string;
  label_fr: string;
  label_ar: string;
  color: string;
};

export type TestimonialItem = {
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

export type PromoImage = {
  id: string;
  image_url: string;
  title_fr: string;
  title_ar: string;
  link: string;
};

export type HomepageSection = {
  enabled: boolean;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string;
  subtitle_ar: string;
  cta_fr: string;
  cta_ar: string;
  cta_link: string;
  image: string;
  /** Optional multi-image/video gallery — when set, overrides the single
   *  `image` on the storefront. Admin can upload up to 8 media files to
   *  auto-cycle as a section backdrop (image + video auto-detected). */
  images?: string[];
  source_mode: SourceMode;
  source_ref: string;
  /** Hand-picked product IDs for product-driven sections. Source of truth
   *  for "which exact products should appear in this section". Mirrored
   *  into `source_ref` (CSV) for backward-compat with the legacy resolver,
   *  but `selected_product_ids` is what new admin UI writes/reads. Empty
   *  array → admin picked nothing → storefront hides the section. */
  selected_product_ids?: string[];
  style_variant: string;
  limit?: number;
  trust_items?: TrustItem[];
  testimonial_items?: TestimonialItem[];
  promo_images?: PromoImage[];
  hero_animation?: CarouselAnimationConfig;
  promo_animation?: CarouselAnimationConfig;
  show_text_overlay_global?: boolean;
};

export type HomepageConfig = {
  sections_order: SectionKey[];
} & Record<SectionKey, HomepageSection>;

export type ProductLookup = {
  id: string;
  name_fr: string;
  name_ar: string;
};

export type CategoryLookup = {
  id: string;
  name_fr: string;
  name_ar: string;
};

export type BannerLookup = {
  id: string;
  title_fr: string;
  title_ar: string;
  placement: string;
  is_active: boolean;
};

export type SavingState = 'idle' | 'saving' | 'saved' | 'error';
