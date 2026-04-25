import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  listHeroSlidesPublic,
  HeroSlide,
  HeroTransition,
  HeroZone,
  HERO_ZONES,
} from '../../lib/heroSlidesApi';
import { subscribeRealtimeResources } from '../../lib/realtimeLiveSync';

type Lang = 'fr' | 'ar';

export type HeroAnimationConfig = {
  slide_duration_ms: number;
  transition_type:
    | 'fade'
    | 'slide-horizontal'
    | 'slide-vertical'
    | 'zoom-in'
    | 'zoom-out'
    | 'ken-burns'
    | 'flip'
    | 'none';
  transition_duration_ms: number;
  autoplay: boolean;
  pause_on_hover: boolean;
  loop: boolean;
  direction: 'forward' | 'reverse' | 'alternate';
  ken_burns_intensity: 'none' | 'subtle' | 'medium' | 'strong';
  show_dots: boolean;
  show_arrows: boolean;
  respect_reduced_motion: boolean;
};

export const DEFAULT_HERO_ANIMATION: HeroAnimationConfig = {
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

type Props = {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  fallback?: React.ReactNode;
  className?: string;
  animation?: Partial<HeroAnimationConfig> | null;
  /** Master override — when explicitly false, hides ALL text overlay cards regardless of per-slide settings. */
  showOverlayGlobal?: boolean;
};

const LOCAL_HERO_PRIMARY = '/hero-marcelo.png';

function pick(fr: string | null, ar: string | null, lang: Lang, fallback = ''): string {
  if (lang === 'ar') return (ar || fr || fallback).toString();
  return (fr || ar || fallback).toString();
}

function buildPanelBackground(p: HeroSlide['text_panel']): React.CSSProperties {
  switch (p.bg_mode) {
    case 'solid':
      return { background: p.bg_color || '#ffffff' };
    case 'image': {
      if (!p.bg_image_url) return { background: p.bg_gradient_from || '#ffffff' };
      return {
        backgroundImage: `url("${p.bg_image_url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    case 'gradient':
    default:
      return {
        background: `linear-gradient(${p.bg_gradient_angle || 135}deg, ${p.bg_gradient_from} 0%, ${p.bg_gradient_to} 100%)`,
      };
  }
}

function buildOverlayStyle(p: HeroSlide['text_panel']): React.CSSProperties | null {
  if (p.overlay_mode === 'none' || !p.overlay_opacity) return null;
  const base = p.overlay_mode === 'dark' ? '0,0,0' : '255,255,255';
  return {
    background: `rgba(${base},${Math.max(0, Math.min(1, p.overlay_opacity))})`,
    backdropFilter: p.blur_px > 0 ? `blur(${p.blur_px}px)` : undefined,
    WebkitBackdropFilter: p.blur_px > 0 ? `blur(${p.blur_px}px)` : undefined,
  };
}

const KEN_BURNS_SCALE: Record<HeroAnimationConfig['ken_burns_intensity'], number> = {
  none: 1.0,
  subtle: 1.04,
  medium: 1.08,
  strong: 1.15,
};

function buildTransition(
  cfg: HeroAnimationConfig,
  legacy: HeroTransition,
  reduce: boolean,
  dir: 'ltr' | 'rtl',
): { initial: any; animate: any; exit: any; transition: any } {
  if (reduce && cfg.respect_reduced_motion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.3, ease: 'easeInOut' },
    };
  }
  const dur = Math.max(0.1, cfg.transition_duration_ms / 1000);
  const ease = [0.22, 1, 0.36, 1];
  const horizSign = dir === 'rtl' ? -1 : 1;
  const type = cfg.transition_type;
  switch (type) {
    case 'fade':
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: dur, ease: 'easeInOut' },
      };
    case 'slide-horizontal':
      return {
        initial: { opacity: 0, x: `${6 * horizSign}%` },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: `${-6 * horizSign}%` },
        transition: { duration: dur, ease },
      };
    case 'slide-vertical':
      return {
        initial: { opacity: 0, y: '6%' },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: '-6%' },
        transition: { duration: dur, ease },
      };
    case 'zoom-in':
      return {
        initial: { opacity: 0, scale: 0.88 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.92 },
        transition: { duration: dur, ease },
      };
    case 'zoom-out':
      return {
        initial: { opacity: 0, scale: 1.12 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.96 },
        transition: { duration: dur, ease },
      };
    case 'flip':
      return {
        initial: { opacity: 0, rotateY: 90 },
        animate: { opacity: 1, rotateY: 0 },
        exit: { opacity: 0, rotateY: -90 },
        transition: { duration: dur, ease },
      };
    case 'none':
      return {
        initial: {},
        animate: {},
        exit: {},
        transition: { duration: 0 },
      };
    case 'ken-burns':
    default: {
      if (legacy === 'slide') {
        return {
          initial: { opacity: 0, x: `${6 * horizSign}%` },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: `${-6 * horizSign}%` },
          transition: { duration: dur, ease },
        };
      }
      if (legacy === 'zoom') {
        return {
          initial: { opacity: 0, scale: 1.08 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.96 },
          transition: { duration: dur, ease },
        };
      }
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: dur, ease: 'easeInOut' },
      };
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────
   HeroZoneSlot
   ─────────────────────────────────────────────────────────────────────
   Renders ONE bento slot (main or one of the 3 side panels). Cycles
   through its slides if more than one is present, otherwise displays
   the single slide statically.

   The `kind` prop controls the chrome density: the main slot keeps
   the full overlay card + arrows + dots like the original hero; the
   side slots use a stripped-down render (no arrows, smaller text card,
   tiny pip dots) so the secondary banners don't fight the main one
   for attention.
   ───────────────────────────────────────────────────────────────────── */

type SlotKind = 'main' | 'side';

type SlotProps = {
  slides: HeroSlide[];
  kind: SlotKind;
  lang: Lang;
  dir: 'ltr' | 'rtl';
  cfg: HeroAnimationConfig;
  showOverlayGlobal?: boolean;
  fallback?: React.ReactNode;
  className?: string;
};

function HeroZoneSlot({ slides, kind, lang, dir, cfg, showOverlayGlobal, fallback, className }: SlotProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const dirSign = useRef<1 | -1>(1);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mql.matches;
    const onChange = () => { reducedMotion.current = mql.matches; };
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  const activeSlides = useMemo(
    () => slides.filter((s) => s.is_active && s.media_url),
    [slides],
  );

  useEffect(() => {
    if (activeSlides.length > 0 && index >= activeSlides.length) setIndex(0);
  }, [activeSlides.length, index]);

  useEffect(() => {
    if (!cfg.autoplay) return;
    if (activeSlides.length < 2) return;
    if (cfg.pause_on_hover && paused) return;
    const cur = activeSlides[index];
    const dur = Math.max(1500, cfg.slide_duration_ms || cur?.duration_ms || 4000);
    const t = window.setTimeout(() => {
      setIndex((i) => {
        const n = activeSlides.length;
        if (cfg.direction === 'reverse') return (i - 1 + n) % n;
        if (cfg.direction === 'alternate') {
          const next = i + dirSign.current;
          if (next >= n) { dirSign.current = -1; return n - 2 >= 0 ? n - 2 : 0; }
          if (next < 0) { dirSign.current = 1; return 1 % n; }
          return next;
        }
        if (!cfg.loop && i + 1 >= n) return i;
        return (i + 1) % n;
      });
    }, dur);
    return () => window.clearTimeout(t);
  }, [activeSlides, index, paused, cfg.autoplay, cfg.pause_on_hover, cfg.slide_duration_ms, cfg.direction, cfg.loop]);

  if (activeSlides.length === 0) return <>{fallback || null}</>;

  const current = activeSlides[Math.min(index, activeSlides.length - 1)];
  const panel = current.text_panel;
  const title = pick(current.title_fr, current.title_ar, lang);
  const subtitle = pick(current.subtitle_fr, current.subtitle_ar, lang);
  const ctaLabel = pick(current.cta_label_fr, current.cta_label_ar, lang);
  const ctaHref = current.cta_url || '/shop';

  const reduceActive = reducedMotion.current && cfg.respect_reduced_motion;
  const trans = buildTransition(cfg, current.transition, reducedMotion.current, dir);
  const kenBurnsActive =
    cfg.transition_type === 'ken-burns' &&
    cfg.ken_burns_intensity !== 'none' &&
    !reduceActive;
  const kenBurnsScale = KEN_BURNS_SCALE[cfg.ken_burns_intensity];
  const kenBurnsDurSec = Math.max(2, cfg.slide_duration_ms / 1000);

  const alignClass =
    panel.align === 'center' ? 'items-center justify-center text-center'
    : panel.align === 'end' ? 'items-end justify-end text-end'
    : 'items-start justify-start text-start';

  const panelBg = buildPanelBackground(panel);
  const overlay = buildOverlayStyle(panel);

  const showOverlay =
    showOverlayGlobal !== false &&
    panel.show_text_overlay !== false &&
    (title || subtitle || ctaLabel);
  // Side slots get reduced chrome — no arrows, no dots row, smaller text.
  // Main slot keeps the full carousel chrome.
  const isMain = kind === 'main';
  const showArrows = isMain && cfg.show_arrows && activeSlides.length > 1;
  const showDots = cfg.show_dots && activeSlides.length > 1;

  const go = (delta: number) => {
    setIndex((i) => (i + delta + activeSlides.length) % activeSlides.length);
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden rounded-[1.5rem] ${className || ''}`}
      dir={dir}
      onMouseEnter={() => cfg.pause_on_hover && setPaused(true)}
      onMouseLeave={() => cfg.pause_on_hover && setPaused(false)}
      aria-roledescription="carousel"
      style={{ perspective: cfg.transition_type === 'flip' ? '1200px' : undefined }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.id + ':media'}
          initial={trans.initial}
          animate={trans.animate}
          exit={trans.exit}
          transition={trans.transition}
          className="absolute inset-0 h-full w-full"
          style={{ transformStyle: cfg.transition_type === 'flip' ? 'preserve-3d' : undefined }}
        >
          {current.media_type === 'video' && current.media_url ? (
            <video
              key={current.media_url}
              src={current.media_url}
              poster={current.poster_url || undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: 'center',
                transformOrigin: 'center',
                animation: kenBurnsActive
                  ? `verking-ken-burns ${kenBurnsDurSec}s ease-in-out both`
                  : undefined,
              }}
            />
          ) : (
            <img
              src={current.media_url || LOCAL_HERO_PRIMARY}
              alt={title || 'hero slide'}
              onError={(e) => { e.currentTarget.src = LOCAL_HERO_PRIMARY; }}
              className="absolute inset-0 h-full w-full object-cover"
              loading={isMain ? 'eager' : 'lazy'}
              style={{
                objectPosition: 'center',
                transformOrigin: 'center',
                animation: kenBurnsActive
                  ? `verking-ken-burns ${kenBurnsDurSec}s ease-in-out both`
                  : undefined,
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {showOverlay && (
        <div
          className={`absolute inset-0 z-10 flex pointer-events-none ${alignClass} ${
            isMain ? 'p-4 md:p-8' : 'p-3 md:p-4'
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id + ':panel'}
              initial={trans.initial}
              animate={trans.animate}
              exit={trans.exit}
              transition={trans.transition}
              className={`pointer-events-auto relative overflow-hidden rounded-[1.25rem] ${
                isMain ? 'p-5 md:p-8 max-w-xl' : 'p-3 md:p-4 max-w-[85%]'
              } w-full`}
              style={{
                ...panelBg,
                color: panel.text_color || '#10223c',
                boxShadow: '0 18px 48px -22px rgba(16,34,60,0.30), inset 0 1px 0 rgba(255,255,255,0.55)',
              }}
            >
              {overlay && (
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={overlay}
                />
              )}
              <div className="relative z-10 w-full">
                {title && (
                  <h1
                    className={`font-black tracking-tight mb-2 ${
                      isMain ? 'text-[2rem] md:text-5xl leading-[1.08] md:mb-4' : 'text-base md:text-lg leading-tight'
                    }`}
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {title}
                  </h1>
                )}
                {subtitle && isMain && (
                  <p className="text-sm md:text-xl font-medium mb-5 md:mb-7 opacity-90">
                    {subtitle}
                  </p>
                )}
                {subtitle && !isMain && (
                  <p className="text-[11px] md:text-xs font-medium opacity-85 line-clamp-2">
                    {subtitle}
                  </p>
                )}
                {ctaLabel && (
                  <Link
                    to={ctaHref}
                    className={`group inline-flex items-center justify-center gap-2 rounded-full font-black uppercase tracking-[0.10em] transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] shadow-lg text-white ${
                      isMain ? 'mt-2 px-6 py-3 text-sm gap-2.5' : 'mt-1.5 px-3 py-1.5 text-[10px]'
                    }`}
                    style={{
                      background: 'linear-gradient(135deg,#9b3f00,#ff7a2e)',
                      boxShadow: '0 8px 22px rgba(155,63,0,0.34)',
                    }}
                  >
                    {ctaLabel}
                    <ChevronRight size={isMain ? 16 : 11} className="rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                  </Link>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {showArrows && (
        <>
          <button
            type="button"
            aria-label={lang === 'ar' ? 'الشريحة السابقة' : 'Slide précédente'}
            onClick={() => go(-1)}
            className="absolute top-1/2 -translate-y-1/2 start-4 z-20 h-12 w-12 rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(0,0,0,0.40)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
            onMouseEnter={(e) => { (e.currentTarget.style.background = 'rgba(0,0,0,0.60)'); }}
            onMouseLeave={(e) => { (e.currentTarget.style.background = 'rgba(0,0,0,0.40)'); }}
          >
            <ChevronLeft size={22} className="rtl:rotate-180" />
          </button>
          <button
            type="button"
            aria-label={lang === 'ar' ? 'الشريحة التالية' : 'Slide suivante'}
            onClick={() => go(1)}
            className="absolute top-1/2 -translate-y-1/2 end-4 z-20 h-12 w-12 rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(0,0,0,0.40)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
            onMouseEnter={(e) => { (e.currentTarget.style.background = 'rgba(0,0,0,0.60)'); }}
            onMouseLeave={(e) => { (e.currentTarget.style.background = 'rgba(0,0,0,0.40)'); }}
          >
            <ChevronRight size={22} className="rtl:rotate-180" />
          </button>
        </>
      )}

      {showDots && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-20 flex items-center ${
            isMain ? 'bottom-4 gap-1.5' : 'bottom-2 gap-1'
          }`}
        >
          {activeSlides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${lang === 'ar' ? 'الشريحة' : 'Slide'} ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className="transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/60 rounded-full"
              style={{
                width: i === index ? (isMain ? 8 : 6) : (isMain ? 6 : 4),
                height: i === index ? (isMain ? 8 : 6) : (isMain ? 6 : 4),
                background: i === index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
                boxShadow: i === index ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   HeroCarousel — bento wrapper
   ─────────────────────────────────────────────────────────────────────
   Fetches all hero slides once + subscribes to the `hero_slides` table
   via Supabase realtime so the storefront updates instantly when admin
   publishes. Slides are then grouped by `zone` and rendered into the
   bento layout:

     desktop (lg+)  ─ 2 cols, 1fr | 320px
       ┌─────────────────┬──────────┐
       │                 │ side_1   │
       │                 ├──────────┤
       │     main        │ side_2   │
       │                 ├──────────┤
       │                 │ side_3   │
       └─────────────────┴──────────┘

     mobile         ─ stacked
       main → side_1 → side_2 → side_3

   Empty zones (no active slide) collapse silently — admin can leave
   any side slot empty without breaking the layout.
   ───────────────────────────────────────────────────────────────────── */

export function HeroCarousel({ lang, dir, fallback, className, animation, showOverlayGlobal }: Props) {
  const [slides, setSlides] = useState<HeroSlide[] | null>(null);

  const cfg: HeroAnimationConfig = useMemo(() => ({
    ...DEFAULT_HERO_ANIMATION,
    ...(animation || {}),
  }), [animation]);

  const load = useCallback(() => {
    listHeroSlidesPublic()
      .then((rows) => setSlides(rows))
      .catch(() => setSlides([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return subscribeRealtimeResources(['hero_slides'], () => { load(); });
  }, [load]);

  const slidesByZone = useMemo(() => {
    const map: Record<HeroZone, HeroSlide[]> = {
      main: [],
      side_1: [],
      side_2: [],
      side_3: [],
    };
    for (const s of slides || []) {
      if (HERO_ZONES.includes(s.zone)) map[s.zone].push(s);
    }
    return map;
  }, [slides]);

  if (slides === null) return null;

  const hasMain = slidesByZone.main.some((s) => s.is_active && s.media_url);
  const hasAnySide = (['side_1', 'side_2', 'side_3'] as HeroZone[]).some((z) =>
    slidesByZone[z].some((s) => s.is_active && s.media_url),
  );

  if (!hasMain && !hasAnySide) {
    return <>{fallback || null}</>;
  }

  return (
    <section className={`relative ${className || ''}`} dir={dir}>
      <style>{`
        @keyframes verking-ken-burns {
          from { transform: scale(1); }
          to { transform: scale(var(--vk-kb-scale, 1.04)); }
        }
        /* Hero stage height — main slot drives the height; side column
           grid stretches to match. 56vh on mobile, 58vh on tablet+,
           clamped so the page below still peeks above the fold. */
        .hero-bento { min-height: 360px; max-height: 56vh; }
        @media (min-width: 768px) { .hero-bento { min-height: 460px; max-height: 58vh; } }
      `}</style>
      <div
        className={[
          'hero-bento relative w-full',
          // Single column stacked on mobile; 2-col bento on lg+.
          // The right column is fixed-ish width so the main slot
          // gets the lion's share even on wider displays.
          'grid grid-cols-1 gap-3 md:gap-4',
          'lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]',
        ].join(' ')}
      >
        {/* Main slot — collapses to display:none if admin hasn't put any
            slide in it, so the bento doesn't leave a tall empty box.
            (`hasAnySide` ensures we still render *something* — only the
            side column will show.) */}
        {hasMain && (
          <HeroZoneSlot
            slides={slidesByZone.main}
            kind="main"
            lang={lang}
            dir={dir}
            cfg={cfg}
            showOverlayGlobal={showOverlayGlobal}
          />
        )}

        {hasAnySide && (
          <div className="grid grid-rows-3 gap-3 md:gap-4 min-h-[300px] lg:min-h-0">
            {(['side_1', 'side_2', 'side_3'] as HeroZone[]).map((z) => {
              const zoneSlides = slidesByZone[z];
              const zoneActive = zoneSlides.some((s) => s.is_active && s.media_url);
              if (!zoneActive) {
                // Reserve the row so the other side slots keep their
                // 1/3 height — but render a soft placeholder so empty
                // slots read as "ready for an ad" rather than broken.
                return (
                  <div
                    key={z}
                    className="rounded-[1.5rem] border border-dashed border-white/40 bg-white/5"
                    aria-hidden
                  />
                );
              }
              return (
                <HeroZoneSlot
                  key={z}
                  slides={zoneSlides}
                  kind="side"
                  lang={lang}
                  dir={dir}
                  cfg={cfg}
                  showOverlayGlobal={showOverlayGlobal}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default HeroCarousel;
