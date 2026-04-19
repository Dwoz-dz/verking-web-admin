import React from 'react';
import { Link } from 'react-router';
import { ArrowRight, Sparkles } from 'lucide-react';
import {
  CategoriesStripConfig,
  withAlpha,
} from '../../lib/categoriesStrip';

type CategoriesMarketingStripProps = {
  config: CategoriesStripConfig;
  lang: 'fr' | 'ar';
  dir: 'ltr' | 'rtl';
  chips?: string[];
  preview?: boolean;
  ctaHref?: string;
  className?: string;
};

export function CategoriesMarketingStrip({
  config,
  lang,
  dir,
  chips = [],
  preview = false,
  ctaHref,
  className = '',
}: CategoriesMarketingStripProps) {
  const title = lang === 'ar' ? config.title_ar : config.title_fr;
  const subtitle = lang === 'ar' ? config.subtitle_ar : config.subtitle_fr;
  const ctaLabel = lang === 'ar' ? config.cta_ar : config.cta_fr;
  const hasCta = ctaLabel.trim().length > 0;
  const ctaTarget = (ctaHref || config.cta_link || '/shop').trim();
  const accentSoft = withAlpha(config.text_color, '16');
  const accentBorder = withAlpha(config.text_color, '2E');
  const glowColor = withAlpha(config.text_color, '18');

  return (
    <div
      dir={dir}
      className={`relative overflow-hidden rounded-[28px] border shadow-[0_24px_70px_-35px_rgba(15,23,42,0.55)] ${className}`}
      style={{
        backgroundColor: config.background_color,
        color: config.text_color,
        borderColor: withAlpha(config.text_color, '1A'),
      }}
    >
      <div
        className="absolute -top-16 -right-12 h-40 w-40 rounded-full blur-3xl"
        style={{ backgroundColor: glowColor }}
      />
      <div
        className="absolute -bottom-20 left-8 h-44 w-44 rounded-full blur-3xl"
        style={{ backgroundColor: withAlpha(config.text_color, '10') }}
      />
      <div
        className="absolute inset-y-0 right-0 w-40 opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${withAlpha(config.text_color, '12')} 100%)`,
        }}
      />

      <div className="relative z-10 px-6 py-6 md:px-8 md:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] backdrop-blur-sm">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm"
                style={{ backgroundColor: accentSoft }}
              >
                {config.icon || <Sparkles size={15} />}
              </span>
              <span
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: accentSoft }}
              >
                {lang === 'ar' ? 'شريط الفئات' : 'Categories Focus'}
              </span>
            </div>

            <div className="max-w-3xl space-y-2">
              <h3 className="text-2xl font-black tracking-tight md:text-3xl">
                {title}
              </h3>
              <p
                className="max-w-2xl text-sm font-medium md:text-base"
                style={{ color: withAlpha(config.text_color, 'D9') }}
              >
                {subtitle}
              </p>
            </div>

            {chips.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {chips.slice(0, 6).map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold"
                    style={{
                      borderColor: accentBorder,
                      backgroundColor: accentSoft,
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {hasCta ? (
            preview ? (
              <div
                className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black"
                style={{
                  borderColor: accentBorder,
                  backgroundColor: accentSoft,
                }}
              >
                {ctaLabel}
                <ArrowRight size={15} className={dir === 'rtl' ? 'rotate-180' : ''} />
              </div>
            ) : (
              <Link
                to={ctaTarget}
                className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black transition-transform hover:-translate-y-0.5"
                style={{
                  borderColor: accentBorder,
                  backgroundColor: accentSoft,
                }}
              >
                {ctaLabel}
                <ArrowRight size={15} className={dir === 'rtl' ? 'rotate-180' : ''} />
              </Link>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
