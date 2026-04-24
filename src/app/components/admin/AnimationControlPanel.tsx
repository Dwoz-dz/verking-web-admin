import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Settings2, RotateCcw } from 'lucide-react';
import {
  CarouselAnimationConfig,
  CarouselTransitionType,
  CarouselDirection,
  CarouselKenBurnsIntensity,
  DEFAULT_CAROUSEL_ANIMATION,
  normalizeCarouselAnimation,
  pickAnimLabel,
} from '../../lib/carouselAnimation';

type Lang = 'fr' | 'ar';

export type AnimationControlPanelProps = {
  value?: Partial<CarouselAnimationConfig> | null;
  defaults?: CarouselAnimationConfig;
  onChange: (next: CarouselAnimationConfig) => void;
  lang?: Lang;
  title?: string;
  /** Debounce in ms before notifying parent. Default 0 (immediate); admins typically add their own debounced save. */
  debounceMs?: number;
  /** Hide the show_arrows toggle (e.g. for inline Promo where arrows aren't rendered) */
  hideArrows?: boolean;
  savedAt?: number | null;
  savingState?: 'idle' | 'saving' | 'saved';
};

const TRANSITION_OPTIONS: Array<{ value: CarouselTransitionType; labelKey: any }> = [
  { value: 'fade', labelKey: 'type_fade' },
  { value: 'slide-horizontal', labelKey: 'type_slide_horizontal' },
  { value: 'slide-vertical', labelKey: 'type_slide_vertical' },
  { value: 'zoom-in', labelKey: 'type_zoom_in' },
  { value: 'zoom-out', labelKey: 'type_zoom_out' },
  { value: 'ken-burns', labelKey: 'type_ken_burns' },
  { value: 'flip', labelKey: 'type_flip' },
  { value: 'none', labelKey: 'type_none' },
];

const INTENSITY_OPTIONS: CarouselKenBurnsIntensity[] = ['none', 'subtle', 'medium', 'strong'];
const DIRECTION_OPTIONS: CarouselDirection[] = ['forward', 'reverse', 'alternate'];

function labelForIntensity(i: CarouselKenBurnsIntensity) {
  return (('intensity_' + i) as any);
}
function labelForDirection(d: CarouselDirection) {
  return (('dir_' + d) as any);
}

/**
 * AnimationControlPanel — reusable admin UI for configuring carousel animation.
 * Stateless: receives `value` + `onChange` as props. Supports debounce.
 * Collapsible, bilingual FR/AR, accessible (labels, aria).
 */
export function AnimationControlPanel({
  value,
  defaults = DEFAULT_CAROUSEL_ANIMATION,
  onChange,
  lang = 'fr',
  title,
  debounceMs = 0,
  hideArrows = false,
  savedAt = null,
  savingState = 'idle',
}: AnimationControlPanelProps) {
  const [open, setOpen] = useState(true);
  const [local, setLocal] = useState<CarouselAnimationConfig>(() =>
    normalizeCarouselAnimation(value || {}, defaults),
  );
  const debounceTimer = useRef<number | null>(null);
  const lastExternal = useRef<string>(JSON.stringify(local));

  // Sync from external props when they change (e.g. load from DB)
  useEffect(() => {
    const next = normalizeCarouselAnimation(value || {}, defaults);
    const serialized = JSON.stringify(next);
    if (serialized !== lastExternal.current) {
      lastExternal.current = serialized;
      setLocal(next);
    }
  }, [value, defaults]);

  const patch = (delta: Partial<CarouselAnimationConfig>) => {
    setLocal((prev) => {
      const next = { ...prev, ...delta };
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
      if (debounceMs > 0) {
        debounceTimer.current = window.setTimeout(() => {
          lastExternal.current = JSON.stringify(next);
          onChange(next);
        }, debounceMs) as unknown as number;
      } else {
        lastExternal.current = JSON.stringify(next);
        onChange(next);
      }
      return next;
    });
  };

  const reset = () => {
    setLocal(defaults);
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    lastExternal.current = JSON.stringify(defaults);
    onChange(defaults);
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const headerTitle = title || pickAnimLabel('animation_settings', lang);
  const statusLabel = savingState === 'saving'
    ? pickAnimLabel('saving', lang)
    : savingState === 'saved'
      ? pickAnimLabel('saved', lang)
      : (savedAt ? pickAnimLabel('saved', lang) : '');

  return (
    <div
      dir={dir}
      className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-md shadow-sm"
      style={{ background: 'linear-gradient(172deg, rgba(255,255,255,0.95) 0%, rgba(247,251,255,0.85) 100%)' }}
    >
      {/* Header — collapsible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg,#9b3f00,#ff7a2e)' }}
          >
            <Settings2 size={16} />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-black text-slate-800">{headerTitle}</span>
            {statusLabel && (
              <span className="text-[11px] font-medium text-emerald-600">{statusLabel}</span>
            )}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="grid gap-4 px-4 pb-4 md:grid-cols-2">
          {/* SLIDE DURATION */}
          <div className="flex flex-col gap-1.5 rounded-xl bg-white/70 p-3 border border-white md:col-span-2">
            <div className="flex items-baseline justify-between">
              <label className="text-xs font-black text-slate-700">
                ⏱️ {pickAnimLabel('slide_duration', lang)}
              </label>
              <span className="text-[11px] font-bold text-[#9b3f00]">
                {(local.slide_duration_ms / 1000).toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={2000}
              max={15000}
              step={500}
              value={local.slide_duration_ms}
              onChange={(e) => patch({ slide_duration_ms: Number(e.target.value) })}
              className="w-full accent-[#9b3f00]"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>2s</span><span>5s</span><span>10s</span><span>15s</span>
            </div>
          </div>

          {/* TRANSITION TYPE */}
          <div className="flex flex-col gap-1.5 rounded-xl bg-white/70 p-3 border border-white">
            <label className="text-xs font-black text-slate-700">
              🎬 {pickAnimLabel('transition_type', lang)}
            </label>
            <select
              value={local.transition_type}
              onChange={(e) => patch({ transition_type: e.target.value as CarouselTransitionType })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff7a2e]/40"
            >
              {TRANSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {pickAnimLabel(opt.labelKey, lang)}
                </option>
              ))}
            </select>
          </div>

          {/* TRANSITION SPEED */}
          <div className="flex flex-col gap-1.5 rounded-xl bg-white/70 p-3 border border-white">
            <div className="flex items-baseline justify-between">
              <label className="text-xs font-black text-slate-700">
                ⚡ {pickAnimLabel('transition_speed', lang)}
              </label>
              <span className="text-[11px] font-bold text-[#9b3f00]">
                {(local.transition_duration_ms / 1000).toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={300}
              max={3000}
              step={100}
              value={local.transition_duration_ms}
              onChange={(e) => patch({ transition_duration_ms: Number(e.target.value) })}
              className="w-full accent-[#9b3f00]"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0.3s</span><span>1s</span><span>2s</span><span>3s</span>
            </div>
          </div>

          {/* KEN BURNS INTENSITY — only relevant when type = ken-burns */}
          {local.transition_type === 'ken-burns' && (
            <div className="flex flex-col gap-2 rounded-xl bg-white/70 p-3 border border-white md:col-span-2">
              <label className="text-xs font-black text-slate-700">
                🎨 {pickAnimLabel('ken_burns_intensity', lang)}
              </label>
              <div className="flex flex-wrap gap-2">
                {INTENSITY_OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                      local.ken_burns_intensity === opt
                        ? 'border-[#ff7a2e] bg-[#ff7a2e]/10 text-[#9b3f00]'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="kb-intensity"
                      value={opt}
                      checked={local.ken_burns_intensity === opt}
                      onChange={() => patch({ ken_burns_intensity: opt })}
                      className="sr-only"
                    />
                    {pickAnimLabel(labelForIntensity(opt), lang)}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* BOOLEAN TOGGLES */}
          <div className="flex flex-col gap-2 rounded-xl bg-white/70 p-3 border border-white md:col-span-2">
            {[
              { key: 'autoplay' as const, icon: '▶️', labelKey: 'autoplay' as const },
              { key: 'pause_on_hover' as const, icon: '⏸️', labelKey: 'pause_on_hover' as const },
              { key: 'loop' as const, icon: '🔁', labelKey: 'loop' as const },
              { key: 'respect_reduced_motion' as const, icon: '♿', labelKey: 'reduced_motion' as const },
            ].map((row) => (
              <label
                key={row.key}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white transition-colors"
              >
                <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span>{row.icon}</span>
                  {pickAnimLabel(row.labelKey, lang)}
                </span>
                <span className="relative inline-flex h-5 w-9 shrink-0">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={!!local[row.key]}
                    onChange={(e) => patch({ [row.key]: e.target.checked } as any)}
                  />
                  <span className="absolute inset-0 rounded-full bg-slate-300 peer-checked:bg-[#9b3f00] transition-colors" />
                  <span className="absolute top-0.5 start-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4" />
                </span>
              </label>
            ))}
          </div>

          {/* DIRECTION */}
          <div className="flex flex-col gap-2 rounded-xl bg-white/70 p-3 border border-white">
            <label className="text-xs font-black text-slate-700">
              🧭 {pickAnimLabel('direction', lang)}
            </label>
            <div className="flex flex-wrap gap-2">
              {DIRECTION_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                    local.direction === opt
                      ? 'border-[#ff7a2e] bg-[#ff7a2e]/10 text-[#9b3f00]'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="direction"
                    value={opt}
                    checked={local.direction === opt}
                    onChange={() => patch({ direction: opt })}
                    className="sr-only"
                  />
                  {pickAnimLabel(labelForDirection(opt), lang)}
                </label>
              ))}
            </div>
          </div>

          {/* NAVIGATION TOGGLES */}
          <div className="flex flex-col gap-2 rounded-xl bg-white/70 p-3 border border-white">
            <label className="text-xs font-black text-slate-700">
              👀 {pickAnimLabel('navigation', lang)}
            </label>
            <div className="flex flex-col gap-1">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={local.show_dots}
                  onChange={(e) => patch({ show_dots: e.target.checked })}
                  className="h-4 w-4 accent-[#9b3f00]"
                />
                {pickAnimLabel('show_dots', lang)}
              </label>
              {!hideArrows && (
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={local.show_arrows}
                    onChange={(e) => patch({ show_arrows: e.target.checked })}
                    className="h-4 w-4 accent-[#9b3f00]"
                  />
                  {pickAnimLabel('show_arrows', lang)}
                </label>
              )}
            </div>
          </div>

          {/* RESET */}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw size={12} />
              {pickAnimLabel('reset', lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnimationControlPanel;
