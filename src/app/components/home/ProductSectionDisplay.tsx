// Single source of truth for how a homepage product section RENDERS.
// The admin picks a "Style d'affichage" per section in Page d'accueil and
// that choice must actually change the storefront layout. This component
// takes the resolved real products + the style keyword and returns the
// right layout. The THREE modes are intentionally visually distinct so
// the admin can preview the difference at a glance:
//
//   • 'grid'   (Grille) — responsive CSS grid that WRAPS into multiple
//                         rows. 2 cols mobile / 3 tablet / 4 desktop / 5
//                         on wide. No horizontal scroll. No arrows.
//   • 'carousel'(Carrousel) — paged horizontal scroller WITH arrow
//                         buttons + snap-x stops. Cards ~½/⅓/¼ width
//                         so the carousel "pages" through groups.
//   • 'row'    (Rangée horizontale) — continuous shelf-style horizontal
//                         scroll, NO arrow buttons, smaller cards
//                         (~⅖ mobile, ¼ tablet, ⅕ desktop) so more cards
//                         peek into view than the carousel. Designed
//                         for "browse the shelf" feel rather than a
//                         deliberate carousel.
//   • anything else      — falls back to grid so unknown values never
//                         break the page.
//
// Uses the existing ProductCard for real ecommerce-grade cards — never
// renders fake placeholders. If the product list is empty, returns null
// so the caller can hide the whole section cleanly.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard, DiscoverMoreCard } from '../ProductCard';

export type ProductDisplayStyle = 'grid' | 'carousel' | 'row' | string;
type ResolvedLayout = 'grid' | 'carousel' | 'row';

type Props = {
  products: any[];
  style: ProductDisplayStyle;
  /** Optional "see more" link shown as a trailing card when only a single
   *  real product is present. Matches the existing DiscoverMoreCard
   *  pattern used on the homepage. */
  discoverMoreHref?: string;
  /** RTL / LTR — inverts the carousel arrow direction so Arabic readers
   *  get the expected scroll polarity. */
  dir?: 'ltr' | 'rtl';
  /** Grid class override. When omitted, uses the canonical home grid. */
  gridClassName?: string;
  /** Card width class for the horizontal layouts. Defaults to a size
   *  that shows ~2 cards on mobile and ~4 on desktop. */
  horizontalCardWidthClass?: string;
  /** Section key for debug logging (e.g. 'featured', 'new_arrivals'). */
  sectionKey?: string;
};

// Real responsive CSS grid (mobile 2 → tablet 3 → desktop 4 → wide 5).
// We keep the Tailwind classes for the standard responsive breakpoints
// AND apply an inline `style` with `display: grid` + an explicit
// grid-template-columns. The inline style is the bulletproof guarantee:
// if Tailwind purge ever fails to ship `lg:grid-cols-4` (or any cousin),
// the inline style still produces a real CSS grid that wraps to rows.
//
// `data-display-style="grid"` on the container makes it trivial to
// inspect the DOM and confirm grid mode is active. `data-grid-mode="real-css-grid"`
// is a bigger, friendlier marker for the same reason — admins debugging
// "why is my grid not gridding" can grep this in the page source.
// Default grid for product sections when the page does not pass a
// custom `gridClassName`. The 5-col rung at 2xl was creating
// thumbnail-thin cards on wide displays; a 2 / 3 / 3 / 4 ladder
// keeps each card wide enough to read its name + price + CTA at
// a glance — the "premium ecommerce grid" feel rather than the old
// "horizontal strip" look.
// 2 / 3 / 4 / 4 ladder. With the section limit of 8 products this gives
// a clean 2-row block at lg+ (4 × 2 = 8) — no half-empty trailing row.
// 2xl stays at 4 because the cards are now compact image-tiles; 5 cols
// would shrink them past the readable threshold.
const DEFAULT_GRID =
  'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4 gap-3 md:gap-4 lg:gap-5';

// Inline-style fallback for the grid container. We force `display: grid`
// inline so the layout cannot regress to a row/flex lane regardless of
// what Tailwind ships. The column COUNT is left to the Tailwind classes
// in DEFAULT_GRID (so we keep the desired 2/3/4/5 breakpoint cadence)
// rather than inlining grid-template-columns — which would override
// the Tailwind responsive cadence and lock in a single column rule.
//
// We DO inline `overflowX: visible` to defeat any ancestor that tries
// to clip / scroll horizontally, since the contract is "never a
// horizontal scroller in grid mode".
const GRID_INLINE_STYLE: React.CSSProperties = {
  display: 'grid',
  overflowX: 'visible',
};

// Card-width strategy per layout. Carousel pages through wider cards
// (the "deliberate paging" feel), Row shows more cards at once like a
// shelf you scroll continuously.
const CAROUSEL_CARD_WIDTH =
  'w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.5rem)] lg:w-[calc(25%-0.75rem)] 2xl:w-[calc(20%-0.8rem)]';

const ROW_CARD_WIDTH =
  'w-[calc(40%-0.3rem)] sm:w-[calc(28%-0.4rem)] lg:w-[calc(20%-0.6rem)] 2xl:w-[calc(16.666%-0.7rem)]';

const DEFAULT_HORIZONTAL_CARD_WIDTH = CAROUSEL_CARD_WIDTH;

/**
 * Strict, explicit, allow-list-only mapping from any incoming
 * `style_variant` value to the single layout we render.
 *
 * The chain (admin pill → useHomepageConfig.updateSection →
 *   persistSectionPartial → edge function PUT → JSONB column → edge
 *   function GET → storefront useMemo → this function) has many places
 *   where a value could become "almost grid" but not exactly the string
 *   we expect. So we lowercase, trim, and pattern-match against every
 *   reasonable spelling/synonym (FR/AR transliterations, legacy values
 *   from the Promotions banner picker, even hard-coded strings from
 *   defaults.ts) before falling back to grid as the safe default.
 *
 * Anything not understood collapses to 'grid' so admins never see a
 * carousel when they explicitly picked Grille.
 */
function normalizeStyle(style: ProductDisplayStyle): ResolvedLayout {
  const raw = typeof style === 'string' ? style.trim().toLowerCase() : '';

  // Explicit carousel synonyms (FR + legacy values from older configs).
  // Carousel = paged scroller with arrows + snap.
  const CAROUSEL = new Set([
    'carousel',
    'carrousel',
    'slider',
    'paged',
  ]);
  if (CAROUSEL.has(raw)) return 'carousel';

  // Row / shelf synonyms — continuous horizontal scroll, no arrows.
  const ROW = new Set([
    'row',
    'rangee',
    'rangée',
    'rang',
    'horizontal',
    'shelf',
    'lane',
    'scroll',
  ]);
  if (ROW.has(raw)) return 'row';

  // Everything else (including '', 'default', 'grid', 'grille', 'banner',
  // 'strip', 'hero', 'cta', 'trust', 'testimonials', unknown values) →
  // grid. This is intentional: when admin picks Grille we get 'grid',
  // and when they leave it on a non-product variant we render a wrapping
  // grid rather than accidentally producing a horizontal scroller.
  return 'grid';
}

export function ProductSectionDisplay({
  products,
  style,
  discoverMoreHref,
  dir = 'ltr',
  gridClassName,
  horizontalCardWidthClass,
  sectionKey,
}: Props) {
  if (!Array.isArray(products) || products.length === 0) return null;
  const layout = normalizeStyle(style);

  // Opt-in diagnostic: append ?debug=style to the URL to surface the
  // exact style value flowing into each section. Helps debug "I picked
  // Grille but it shows as carousel" without polluting normal pages.
  const debugEnabled =
    typeof window !== 'undefined' &&
    typeof window.location !== 'undefined' &&
    /\bdebug=style\b/.test(window.location.search);

  if (debugEnabled) {
    // eslint-disable-next-line no-console
    console.log('[ProductSectionDisplay]', { sectionKey, rawStyle: style, normalized: layout, count: products.length });
  }

  const debugBadge = debugEnabled ? (
    <span
      className="pointer-events-none absolute left-1 top-1 z-30 rounded-md bg-black/85 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
    >
      {sectionKey || 'sec'}={String(style ?? 'undef')}→{layout}
    </span>
  ) : null;

  if (layout === 'grid') {
    // relative + z-10 so the grid stacks above any SectionMediaBackdrop
    // sibling. data-display-style is for debugging — admins can inspect
    // the DOM and verify the resolved style matches what they picked.
    //
    // We render NO horizontal scroll container, NO carousel wrapper, NO
    // overflow-x. The inline `style` redundantly enforces `display: grid`
    // on top of the Tailwind classes so the layout cannot collapse to a
    // single-row flex lane even if the utility classes ever fail to ship.
    return (
      <div
        className={`relative z-10 ${gridClassName || DEFAULT_GRID}`}
        style={GRID_INLINE_STYLE}
        data-display-style="grid"
        data-grid-mode="real-css-grid"
        data-section-key={sectionKey || ''}
        data-raw-style={String(style ?? '')}
        data-product-count={products.length}
      >
        {debugBadge}
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {products.length === 1 && discoverMoreHref && (
          <DiscoverMoreCard href={discoverMoreHref} />
        )}
      </div>
    );
  }

  if (layout === 'carousel') {
    return (
      <HorizontalScroll
        products={products}
        dir={dir}
        cardWidthClass={horizontalCardWidthClass || CAROUSEL_CARD_WIDTH}
        discoverMoreHref={discoverMoreHref}
        debugBadge={debugBadge}
        sectionKey={sectionKey}
        rawStyle={style}
        showArrows
        snap
        domStyleTag="carousel"
      />
    );
  }

  // Row / shelf — continuous horizontal scroll, NO arrows, smaller cards
  // so more peek into view. This is the "shelf" feel.
  return (
    <HorizontalScroll
      products={products}
      dir={dir}
      cardWidthClass={horizontalCardWidthClass || ROW_CARD_WIDTH}
      discoverMoreHref={discoverMoreHref}
      debugBadge={debugBadge}
      sectionKey={sectionKey}
      rawStyle={style}
      showArrows={false}
      snap={false}
      domStyleTag="row"
    />
  );
}

/**
 * Horizontal product scroller shared by "Carrousel" and "Rangée
 * horizontale".
 *   • showArrows — Carousel mode shows arrow buttons + snap-x stops.
 *                  Row mode hides arrows (continuous shelf scroll).
 *   • snap        — Toggle CSS scroll-snap so carousel pages cleanly,
 *                  but row scrolls smoothly without snapping.
 *   • domStyleTag — Sets data-display-style on the root so you can
 *                  inspect the DOM and confirm which mode is active.
 */
function HorizontalScroll({
  products,
  dir,
  cardWidthClass,
  discoverMoreHref,
  debugBadge,
  sectionKey,
  rawStyle,
  showArrows = true,
  snap = true,
  domStyleTag = 'horizontal',
}: {
  products: any[];
  dir: 'ltr' | 'rtl';
  cardWidthClass: string;
  discoverMoreHref?: string;
  debugBadge?: React.ReactNode;
  sectionKey?: string;
  rawStyle?: any;
  showArrows?: boolean;
  snap?: boolean;
  domStyleTag?: 'carousel' | 'row' | 'horizontal';
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const refreshOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setCanLeft(pos > 4);
    setCanRight(pos < maxScroll - 4);
  }, []);

  useEffect(() => {
    refreshOverflow();
    const el = scrollerRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', refreshOverflow, { passive: true });
    window.addEventListener('resize', refreshOverflow);
    return () => {
      el.removeEventListener('scroll', refreshOverflow);
      window.removeEventListener('resize', refreshOverflow);
    };
  }, [refreshOverflow, products.length]);

  const scrollBy = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = el.clientWidth * 0.8;
    el.scrollBy({ left: direction * delta, behavior: 'smooth' });
  };

  const LeftIcon = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const RightIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div
      className="relative z-10"
      data-display-style={domStyleTag}
      data-section-key={sectionKey || ''}
      data-raw-style={String(rawStyle ?? '')}
      data-product-count={products.length}
      data-show-arrows={showArrows ? 'true' : 'false'}
      data-snap={snap ? 'true' : 'false'}
    >
      {debugBadge}
      {showArrows && canLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Previous"
          className="absolute start-1 top-1/2 z-20 hidden sm:flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-lg ring-1 ring-black/5 backdrop-blur transition hover:scale-105 hover:bg-white"
        >
          <LeftIcon size={18} />
        </button>
      )}
      {showArrows && canRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Next"
          className="absolute end-1 top-1/2 z-20 hidden sm:flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-lg ring-1 ring-black/5 backdrop-blur transition hover:scale-105 hover:bg-white"
        >
          <RightIcon size={18} />
        </button>
      )}
      <div
        ref={scrollerRef}
        className={`scrollbar-hidden flex gap-3 overflow-x-auto overflow-y-visible py-1 scroll-smooth md:gap-4 ${snap ? 'snap-x snap-mandatory' : ''}`}
        style={{ scrollbarWidth: 'none' }}
      >
        {products.map((product) => (
          <div
            key={product.id}
            className={`${cardWidthClass} shrink-0 ${snap ? 'snap-start' : ''}`}
          >
            <ProductCard product={product} />
          </div>
        ))}
        {products.length === 1 && discoverMoreHref && (
          <div className={`${cardWidthClass} shrink-0 ${snap ? 'snap-start' : ''}`}>
            <DiscoverMoreCard href={discoverMoreHref} />
          </div>
        )}
      </div>
    </div>
  );
}
