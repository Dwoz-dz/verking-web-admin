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

type Props = {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  fallback?: React.ReactNode;
  className?: string;
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

const TRANSITIONS: Record<HeroTransition, {
  initial: any; animate: any; exit: any; transition: any;
}> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.7, ease: 'easeInOut' },
  },
  slide: {
    initial: { opacity: 0, x: '6%' },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: '-6%' },
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
  },
  zoom: {
    initial: { opacity: 0, scale: 1.08 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
    transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
  },
};

export function HeroCarousel({ lang, dir, fallback, className }: Props) {
  const [slides, setSlides] = useState<HeroSlide[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);

  // Respect prefers-reduced-motion
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

  useEffect(() => {
    load();
  }, [load]);

  // Realtime refresh when admin updates slides
  useEffect(() => {
    return subscribeRealtimeResources(['hero_slides'], () => {
      load();
    });
  }, [load]);

  const activeSlides = useMemo(() => (slides || []).filter((s) => s.is_active && s.media_url), [slides]);

  // Reset index if slides shrink
  useEffect(() => {
    if (activeSlides.length > 0 && index >= activeSlides.length) {
      setIndex(0);
    }
  }, [activeSlides.length, index]);

  // Auto-rotate
  useEffect(() => {
    if (activeSlides.length < 2 || paused) return;
    const cur = activeSlides[index];
    const dur = Math.max(1500, cur?.duration_ms || 4000);
    const t = window.setTimeout(() => {
      setIndex((i) => (i + 1) % activeSlides.length);
    }, dur);
    return () => window.clearTimeout(t);
  }, [activeSlides, index, paused]);

  // Loading / empty → fallback
  if (slides === null) return null;
  if (activeSlides.length === 0) return <>{fallback || null}</>;

  const current = activeSlides[Math.min(index, activeSlides.length - 1)];
  const panel = current.text_panel;
  const title = pick(current.title_fr, current.title_ar, lang);
  const subtitle = pick(current.subtitle_fr, current.subtitle_ar, lang);
  const ctaLabel = pick(current.cta_label_fr, current.cta_label_ar, lang);
  const ctaHref = current.cta_url || '/shop';
  const trans = reducedMotion.current ? TRANSITIONS.fade : TRANSITIONS[current.transition];

  const alignClass =
    panel.align === 'center' ? 'items-center text-center'
    : panel.align === 'end' ? 'items-end text-end'
    : 'items-start text-start';

  const panelBg = buildPanelBackground(panel);
  const overlay = buildOverlayStyle(panel);

  const go = (delta: number) => {
    setIndex((i) => (i + delta + activeSlides.length) % activeSlides.length);
  };

  return (
    <section
      className={`relative ${className || ''}`}
      dir={dir}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="relative overflow-hidden rounded-[2rem] min-h-[320px] md:min-h-[480px]">
        {/* Media layer */}
        <div className="absolute inset-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id + ':media'}
              initial={trans.initial}
              animate={trans.animate}
              exit={trans.exit}
              transition={trans.transition}
              className="absolute inset-0"
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
                />
              ) : (
                <img
                  src={current.media_url || LOCAL_HERO_PRIMARY}
                  alt={title || 'hero slide'}
                  onError={(e) => { e.currentTarget.src = LOCAL_HERO_PRIMARY; }}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Text panel layer */}
        <div className="relative z-10 grid gap-4 md:gap-6 lg:grid-cols-[1.05fr_0.95fr] p-3 md:p-5 min-h-[320px] md:min-h-[480px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id + ':panel'}
              initial={trans.initial}
              animate={trans.animate}
              exit={trans.exit}
              transition={trans.transition}
              className={`relative overflow-hidden rounded-[1.75rem] p-5 md:p-9 flex flex-col justify-center ${alignClass}`}
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
              <div className="relative z-10 max-w-xl w-full">
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

          {/* Right media preview placeholder – keeps hero layout balanced */}
          <div className="hidden lg:block" aria-hidden />
        </div>

        {/* Prev / Next (only if >1 slide) */}
        {activeSlides.length > 1 && (
          <>
            <button
              type="button"
              aria-label={lang === 'ar' ? 'الشريحة السابقة' : 'Slide précédente'}
              onClick={() => go(-1)}
              className="absolute top-1/2 -translate-y-1/2 start-3 md:start-5 z-20 h-10 w-10 md:h-11 md:w-11 rounded-full flex items-center justify-center backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 8px 20px -8px rgba(16,34,60,0.4)',
              }}
            >
              <ChevronLeft size={20} className="text-[#10223c] rtl:rotate-180" />
            </button>
            <button
              type="button"
              aria-label={lang === 'ar' ? 'الشريحة التالية' : 'Slide suivante'}
              onClick={() => go(1)}
              className="absolute top-1/2 -translate-y-1/2 end-3 md:end-5 z-20 h-10 w-10 md:h-11 md:w-11 rounded-full flex items-center justify-center backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 8px 20px -8px rgba(16,34,60,0.4)',
              }}
            >
              <ChevronRight size={20} className="text-[#10223c] rtl:rotate-180" />
            </button>

            {/* Dot pager */}
            <div className="absolute bottom-3 md:bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.7)',
              }}
            >
              {activeSlides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                  className="transition-all duration-300"
                  style={{
                    width: i === index ? 22 : 8,
                    height: 8,
                    borderRadius: 9999,
                    background: i === index ? '#9b3f00' : 'rgba(16,34,60,0.35)',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default HeroCarousel;
