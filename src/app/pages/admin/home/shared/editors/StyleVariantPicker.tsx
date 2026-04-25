// Visual style picker — turns the abstract `style_variant` string into
// three illustrated cards (mini wireframe + label + one-liner hint) so
// the admin sees AT A GLANCE what Carrousel vs Grille vs Rangée
// horizontale actually does on the storefront. Each section can pass
// its own allowed variants so we don't render meaningless options
// (e.g. a Trust section doesn't need "carousel").
import React from 'react';

export type StyleVariantOption = {
  value: string;
  label: string;
  labelAr?: string;
  hint?: string;
  hintAr?: string;
};

/**
 * Each known product-section variant gets a tiny inline SVG
 * "wireframe" icon so the picker is visually self-explanatory.
 * If a variant is not in this map (e.g. "hero", "trust"), the picker
 * falls back to the text-only pill style — those sections don't need
 * a layout illustration anyway.
 */
function VariantIcon({ value, active }: { value: string; active: boolean }) {
  const stroke = active ? '#fff' : '#475569';
  const fill = active ? 'rgba(255,255,255,0.18)' : 'rgba(148,163,184,0.18)';
  const common = { stroke, strokeWidth: 1.5 } as const;

  if (value === 'grid') {
    return (
      <svg viewBox="0 0 56 36" className="h-9 w-14" aria-hidden>
        {[0, 1].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={2 + col * 13}
              y={2 + row * 16}
              width={11}
              height={14}
              rx={2}
              fill={fill}
              {...common}
            />
          )),
        )}
      </svg>
    );
  }
  if (value === 'carousel') {
    return (
      <svg viewBox="0 0 56 36" className="h-9 w-14" aria-hidden>
        <rect x={4} y={6} width={20} height={24} rx={2} fill={fill} {...common} />
        <rect x={26} y={6} width={20} height={24} rx={2} fill={fill} {...common} />
        <path d="M50 18 L54 14 M50 18 L54 22" {...common} fill="none" />
        <path d="M6 18 L2 14 M6 18 L2 22" {...common} fill="none" />
      </svg>
    );
  }
  if (value === 'row') {
    return (
      <svg viewBox="0 0 56 36" className="h-9 w-14" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={2 + i * 11}
            y={6}
            width={9}
            height={24}
            rx={2}
            fill={fill}
            {...common}
          />
        ))}
      </svg>
    );
  }
  return null;
}

export function StyleVariantPicker({
  value,
  options,
  onChange,
  lang,
}: {
  value: string;
  options: StyleVariantOption[];
  onChange: (next: string) => void;
  lang: 'fr' | 'ar';
}) {
  // Detect whether at least one option has a wireframe icon — if so we
  // render the rich card grid; otherwise (e.g. Hero / Trust sections
  // with non-product variants) we fall back to the compact pill layout.
  const hasIcons = options.some((opt) => opt.value === 'grid' || opt.value === 'carousel' || opt.value === 'row');

  if (!hasIcons) {
    return (
      <div>
        <p className="mb-2 text-xs font-bold text-gray-600">
          {lang === 'ar' ? 'نمط العرض' : 'Style d’affichage'}
        </p>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={[
                  'rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors',
                  active
                    ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                ].join(' ')}
                title={opt.hint}
              >
                {lang === 'ar' ? (opt.labelAr || opt.label) : opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'نمط العرض' : 'Style d’affichage'}
        </h3>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {lang === 'ar' ? 'مباشر' : 'En direct'}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((opt) => {
          const active = opt.value === value;
          const label = lang === 'ar' ? (opt.labelAr || opt.label) : opt.label;
          const hint = lang === 'ar' ? (opt.hintAr || opt.hint || '') : (opt.hint || '');
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              data-active={active ? 'true' : 'false'}
              data-style-variant={opt.value}
              onClick={() => onChange(opt.value)}
              className={[
                'group relative flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-all',
                active
                  ? 'border-blue-500 bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/40',
              ].join(' ')}
            >
              <div
                className={[
                  'flex h-12 w-full items-center justify-center rounded-xl border',
                  active ? 'border-white/30 bg-white/10' : 'border-gray-200 bg-gray-50',
                ].join(' ')}
              >
                <VariantIcon value={opt.value} active={active} />
              </div>
              <span className="text-sm font-black leading-tight">{label}</span>
              {hint && (
                <span className={['text-[11px] leading-snug', active ? 'text-white/80' : 'text-gray-500'].join(' ')}>
                  {hint}
                </span>
              )}
              {active && (
                <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-blue-600 shadow-sm">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
