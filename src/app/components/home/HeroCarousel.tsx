import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  listHeroSlidesPublic,
  HeroSlide,
  HeroTransition,
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

export function HeroCarousel({ lang, dir, fallback, className, animation, showOverlayGlobal }: Props) {
  const [slides, setSlides] = useState<HeroSlide[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const dirSign = useRef<1 | -1>(1);

  const cfg: HeroAnimationConfig = useMemo(() => ({
    ...DEFAULT_HERO_ANIMATION,
    ...(animation || {}),
  }), [animation]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mql.matches;
    const onChange = () => { reducedMotion.current = mql.matches; };
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  const load = useCallback(() => {
    listHeroSlidesPublic()
      .then((rows) => setSlides(rows))
      .catch(() => setSlides([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return subscribeRealtimeResources(['hero_slides'], () => { load(); });
  }, [load]);

  const activeSlides = useMemo(
    () => (slides || []).filter((s) => s.is_active && s.media_url),
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

  if (slides === null) return null;
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

  const go = (delta: number) => {
    setIndex((i) => (i + delta + activeSlides.length) % activeSlides.length);
  };

  const showOverlay = showOverlayGlobal !== false;
  const showArrows = cfg.show_arrows && activeSlides.length > 1;
  const showDots = cfg.show_dots && activeSlides.length > 1;

  return (
    <section
      className={`relative ${className || ''}`}
      dir={dir}
      onMouseEnter={() => cfg.pause_on_hover && setPaused(true)}
      onMouseLeave={() => cfg.pause_on_hover && setPaused(false)}
      aria-roledescription="carousel"
    >
      <style>{`
        @keyframes verking-ken-burns {
          from { transform: scale(1); }
          to { transform: scale(${kenBurnsScale}); }
        }
        .hero-stage { min-height: 400px; max-height: 60vh; }
        @media (min-width: 768px) {
          .hero-stage { min-height: 500px; max-height: 70vh; }
        }
      `}</style>
      <div
        className="hero-stage relative w-full overflow-hidden rounded-[2rem]"
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
                loading="eager"
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
          <div className={`absolute inset-0 z-10 flex p-4 md:p-8 pointer-events-none ${alignClass}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.id + ':panel'}
                initial={trans.initial}
                animate={trans.animate}
                exit={trans.exit}
                transition={trans.transition}
                className="pointer-events-auto relative overflow-hidden rounded-[1.75rem] p-5 md:p-8 w-full max-w-xl"
                style={{
                  ...panelBg,
                  color: panel.text_color || '#10223c',
                  boxShadow: '0 24px 60px -22px rgba(16,34,60,0.30), inset 0 1px 0 rgba(255,255,255,0.55)',
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
                      className="font-black text-[2rem] md:text-5xl leading-[1.08] tracking-tight mb-3 md:mb-4"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-sm md:text-xl font-medium mb-5 md:mb-7 opacity-90">
                      {subtitle}
                    </p>
                  )}
                  {ctaLabel && (
                    <Link
                      to={ctaHref}
                      className="group inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full font-black text-sm uppercase tracking-[0.12em] transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] shadow-xl text-white"
                      style={{
                        background: 'linear-gradient(135deg,#9b3f00,#ff7a2e)',
                        boxShadow: '0 10px 28px rgba(155,63,0,0.34)',
                      }}
                    >
                      {ctaLabel}
                      <ChevronRight size={16} className="rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {activeSlides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`${lang === 'ar' ? 'الشريحة' : 'Slide'} ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className="transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/60 rounded-full"
                style={{
                  width: i === index ? 8 : 6,
                  height: i === index ? 8 : 6,
                  background: i === index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
                  boxShadow: i === index ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default HeroCarousel;
