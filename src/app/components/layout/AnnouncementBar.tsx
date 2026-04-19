import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../lib/api';

type AnnouncementItem = {
  id: string;
  text_fr: string;
  text_ar: string;
  color: string;
  text_color: string;
  icon: string;
  priority: number;
  is_active: boolean;
  duration_ms: number;
  start_at: string | null;
  end_at: string | null;
  sort_order: number;
};

type AnnouncementAnimationDirection = 'ltr' | 'rtl';
type AnnouncementAnimationMode = 'auto' | 'manual';

const DEFAULT_ANNOUNCEMENT_BAR_COLOR = '#1A3C6E';
const DEFAULT_ANNOUNCEMENT_DURATION_MS = 6000;
const MIN_ANNOUNCEMENT_DURATION_MS = 5000;
const ANNOUNCEMENT_BAR_HEIGHT = '40px';
const CONTENT_UPDATED_KEY = 'vk_content_updated_at';
const POLL_INTERVAL_MS = 60000;
const TRANSITION_MS = 320;
const DEFAULT_ANNOUNCEMENT_ENGINE_ENABLED = true;
const DEFAULT_ANNOUNCEMENT_RADIUS_PX = 12;
const MIN_ANNOUNCEMENT_RADIUS_PX = 0;
const MAX_ANNOUNCEMENT_RADIUS_PX = 24;
const DEFAULT_ANNOUNCEMENT_SPEED_SECONDS = 50;
const MIN_ANNOUNCEMENT_SPEED_SECONDS = 5;
const MAX_ANNOUNCEMENT_SPEED_SECONDS = 120;
const DEFAULT_ANNOUNCEMENT_LOOP_INFINITE = true;
const DEFAULT_ANNOUNCEMENT_PAUSE_ON_HOVER = true;
const DEFAULT_ANNOUNCEMENT_RESUME_AUTO = true;
const DEFAULT_ANNOUNCEMENT_MULTI_MESSAGES = true;

function scoreCorruption(value: string) {
  const mojibakeMatches = value.match(/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178]/g) || [];
  const replacementMatches = value.match(/\uFFFD/g) || [];
  return (mojibakeMatches.length * 2) + (replacementMatches.length * 4);
}

function decodeLatin1AsUtf8(value: string) {
  const codePoints = Array.from(value).map((char) => char.codePointAt(0) ?? 0);
  if (codePoints.some((code) => code > 255)) return value;
  return new TextDecoder().decode(Uint8Array.from(codePoints));
}

function repairLikelyMojibake(value: string) {
  if (!/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178\uFFFD]/.test(value)) return value;

  try {
    const repaired = decodeLatin1AsUtf8(value);
    if (!repaired || repaired === value) return value;
    return scoreCorruption(repaired) < scoreCorruption(value) ? repaired : value;
  } catch {
    return value;
  }
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return '';

  let normalized = repairLikelyMojibake(value)
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n');

  try {
    normalized = normalized.normalize('NFC');
  } catch {
    // Ignore missing Unicode normalization support.
  }

  return normalized.trim();
}

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return fallback;
}

function normalizeOptionalHexColor(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return '';
}

function normalizeAnnouncementDate(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeAnimationDirection(
  value: unknown,
  fallback: AnnouncementAnimationDirection,
): AnnouncementAnimationDirection {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'ltr' || normalized === 'rtl') return normalized;
  return fallback;
}

function normalizeAnimationMode(
  value: unknown,
  fallback: AnnouncementAnimationMode = 'auto',
): AnnouncementAnimationMode {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'auto' || normalized === 'manual') return normalized;
  return fallback;
}

function normalizeBoundedInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(Math.min(max, Math.max(min, parsed)));
}

function normalizeAnnouncements(items: unknown): AnnouncementItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const source = (typeof item === 'object' && item !== null) ? item as Record<string, any> : {};
      const sortOrderRaw = source.sort_order ?? source.order ?? index;
      const priorityValue = Number(source.priority);
      const durationValue = Number(source.duration_ms);

      return {
        id: typeof source.id === 'string' && source.id.trim().length > 0
          ? source.id
          : `ann-${index}`,
        text_fr: normalizeText(source.text_fr),
        text_ar: normalizeText(source.text_ar),
        color: normalizeOptionalHexColor(source.color),
        text_color: normalizeOptionalHexColor(source.text_color),
        icon: normalizeText(source.icon),
        priority: Number.isFinite(priorityValue) ? Math.trunc(priorityValue) : 0,
        is_active: source.is_active !== false,
        duration_ms: Number.isFinite(durationValue) && durationValue > 0
          ? Math.max(MIN_ANNOUNCEMENT_DURATION_MS, Math.trunc(durationValue))
          : DEFAULT_ANNOUNCEMENT_DURATION_MS,
        start_at: normalizeAnnouncementDate(source.start_at ?? source.startAt),
        end_at: normalizeAnnouncementDate(source.end_at ?? source.endAt),
        sort_order: Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : index,
      };
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.sort_order - b.sort_order;
    });
}

function pickMessageText(item: AnnouncementItem, lang: 'fr' | 'ar') {
  const primary = lang === 'ar' ? item.text_ar : item.text_fr;
  const fallback = lang === 'ar' ? item.text_fr : item.text_ar;
  return normalizeText(primary) || normalizeText(fallback);
}

function isScheduledNow(item: AnnouncementItem, now: number) {
  const start = item.start_at ? Date.parse(item.start_at) : null;
  const end = item.end_at ? Date.parse(item.end_at) : null;

  if (Number.isFinite(start) && now < (start as number)) return false;
  if (Number.isFinite(end) && now > (end as number)) return false;
  return true;
}

function buildVisualTone(backgroundColor: string, textColor?: string) {
  if (textColor) {
    return {
      textColor,
      borderColor: 'rgba(255,255,255,0.18)',
      chipBackground: 'rgba(255,255,255,0.12)',
      chipBorder: 'rgba(255,255,255,0.18)',
      separatorColor: 'rgba(255,255,255,0.28)',
      textShadow: 'none',
    };
  }

  const raw = backgroundColor.replace('#', '');
  const hex = raw.length === 3
    ? raw.split('').map((char) => `${char}${char}`).join('')
    : raw;

  const parsed = Number.parseInt(hex, 16);
  if (!Number.isFinite(parsed)) {
    return {
      textColor: '#FFFFFF',
      borderColor: 'rgba(255,255,255,0.18)',
      chipBackground: 'rgba(255,255,255,0.12)',
      chipBorder: 'rgba(255,255,255,0.18)',
      separatorColor: 'rgba(255,255,255,0.28)',
      textShadow: '0 1px 1px rgba(0,0,0,0.18)',
    };
  }

  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const useDarkText = luminance >= 0.72;

  return {
    textColor: useDarkText ? '#0F172A' : '#FFFFFF',
    borderColor: useDarkText ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.18)',
    chipBackground: useDarkText ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.10)',
    chipBorder: useDarkText ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.20)',
    separatorColor: useDarkText ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.28)',
    textShadow: useDarkText ? 'none' : '0 1px 1px rgba(0,0,0,0.18)',
  };
}

export function AnnouncementBar() {
  const { lang } = useLang();
  const { theme } = useTheme();
  const [content, setContent] = useState<any>({});
  const [isHovering, setIsHovering] = useState(false);
  const [hoverLocked, setHoverLocked] = useState(false);
  const [timeMarker, setTimeMarker] = useState(() => Date.now());
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const fetchContent = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const data = await api.get('/content');
      if (!mountedRef.current) return;
      setContent(data?.content || {});
      setTimeMarker(Date.now());
    } catch {
      if (!mountedRef.current) return;
      setContent({});
      setTimeMarker(Date.now());
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchContent();

    const onFocus = () => {
      void fetchContent();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchContent();
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONTENT_UPDATED_KEY) {
        void fetchContent();
      }
    };
    const intervalId = window.setInterval(() => {
      void fetchContent();
    }, POLL_INTERVAL_MS);

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [fetchContent]);

  const fallbackBarColor = useMemo(
    () => normalizeHexColor(
      content?.announcement_bar_color,
      theme.primary_color || DEFAULT_ANNOUNCEMENT_BAR_COLOR,
    ),
    [content?.announcement_bar_color, theme.primary_color],
  );

  const normalizedMessages = useMemo(() => {
    const now = timeMarker;
    return normalizeAnnouncements(content?.announcement_messages)
      .filter((item) => item.is_active && isScheduledNow(item, now))
      .filter((item) => pickMessageText(item, lang).length > 0);
  }, [content?.announcement_messages, lang, timeMarker]);

  const engineEnabled = useMemo(() => {
    if (typeof content?.announcement_engine_enabled === 'boolean') {
      return content.announcement_engine_enabled;
    }
    return DEFAULT_ANNOUNCEMENT_ENGINE_ENABLED;
  }, [content?.announcement_engine_enabled]);
  const speedSeconds = useMemo(
    () => normalizeBoundedInteger(
      content?.announcement_speed_seconds,
      DEFAULT_ANNOUNCEMENT_SPEED_SECONDS,
      MIN_ANNOUNCEMENT_SPEED_SECONDS,
      MAX_ANNOUNCEMENT_SPEED_SECONDS,
    ),
    [content?.announcement_speed_seconds],
  );
  const loopInfinite = useMemo(() => {
    if (typeof content?.announcement_loop_infinite === 'boolean') {
      return content.announcement_loop_infinite;
    }
    return DEFAULT_ANNOUNCEMENT_LOOP_INFINITE;
  }, [content?.announcement_loop_infinite]);
  const pauseOnHover = useMemo(() => {
    if (typeof content?.announcement_pause_on_hover === 'boolean') {
      return content.announcement_pause_on_hover;
    }
    return DEFAULT_ANNOUNCEMENT_PAUSE_ON_HOVER;
  }, [content?.announcement_pause_on_hover]);
  const resumeAuto = useMemo(() => {
    if (typeof content?.announcement_resume_auto === 'boolean') {
      return content.announcement_resume_auto;
    }
    return DEFAULT_ANNOUNCEMENT_RESUME_AUTO;
  }, [content?.announcement_resume_auto]);
  const multiMessages = useMemo(() => {
    if (typeof content?.announcement_multi_messages === 'boolean') {
      return content.announcement_multi_messages;
    }
    return DEFAULT_ANNOUNCEMENT_MULTI_MESSAGES;
  }, [content?.announcement_multi_messages]);
  const globalIcon = useMemo(
    () => normalizeText(content?.announcement_global_icon),
    [content?.announcement_global_icon],
  );
  const radiusPx = useMemo(
    () => normalizeBoundedInteger(
      content?.announcement_radius_px,
      DEFAULT_ANNOUNCEMENT_RADIUS_PX,
      MIN_ANNOUNCEMENT_RADIUS_PX,
      MAX_ANNOUNCEMENT_RADIUS_PX,
    ),
    [content?.announcement_radius_px],
  );

  const activeMessages = useMemo(() => {
    if (!multiMessages && normalizedMessages.length > 0) return [normalizedMessages[0]];
    return normalizedMessages;
  }, [normalizedMessages, multiMessages]);

  const animationEnabled = useMemo(
    () => content?.animation_enabled !== false,
    [content?.animation_enabled],
  );
  const animationMode = useMemo<AnnouncementAnimationMode>(
    () => normalizeAnimationMode(content?.animation_mode, 'auto'),
    [content?.animation_mode],
  );
  const animationDirection = useMemo<AnnouncementAnimationDirection>(
    () => normalizeAnimationDirection(
      content?.animation_direction,
      lang === 'ar' ? 'rtl' : 'ltr',
    ),
    [content?.animation_direction, lang],
  );
  const isPaused = pauseOnHover && (isHovering || hoverLocked);
  const shouldAnimateVisual = (
    engineEnabled
    && animationEnabled
    && animationMode === 'auto'
    && activeMessages.length > 0
  );

  useEffect(() => {
    if (!pauseOnHover) {
      setIsHovering(false);
      setHoverLocked(false);
    }
  }, [pauseOnHover]);

  useEffect(() => {
    if (resumeAuto && !isHovering) {
      setHoverLocked(false);
    }
  }, [isHovering, resumeAuto]);

  const currentMessage = engineEnabled ? (activeMessages[0] || null) : null;

  useEffect(() => {
    const root = document.documentElement;
    const height = currentMessage ? ANNOUNCEMENT_BAR_HEIGHT : '0px';
    root.style.setProperty('--vk-announcement-height', height);
    return () => {
      root.style.setProperty('--vk-announcement-height', '0px');
    };
  }, [currentMessage]);

  if (!currentMessage) {
    return null;
  }

  const tickerDurationSeconds = Math.max(
    MIN_ANNOUNCEMENT_DURATION_MS / 1000,
    speedSeconds,
  );
  const tickerAnimationName = animationDirection === 'rtl'
    ? 'vk-announcement-marquee-rtl'
    : 'vk-announcement-marquee-ltr';
  const renderTickerItem = (item: AnnouncementItem, key: string) => {
    const frText = normalizeText(item.text_fr);
    const arText = normalizeText(item.text_ar);
    const hasFrench = frText.length > 0;
    const hasArabic = arText.length > 0;
    const messageText = [frText, arText].filter(Boolean).join(' • ');
    const messageIcon = normalizeText(item.icon) || globalIcon;
    const chipColor = normalizeHexColor(item.color, fallbackBarColor);
    const tone = buildVisualTone(chipColor, normalizeOptionalHexColor(item.text_color) || undefined);

    return (
      <div
        key={key}
        className="flex shrink-0 items-center gap-3 px-3 py-1.5"
        style={{
          backgroundColor: 'rgba(255,255,255,0.14)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#FFFFFF',
          borderRadius: `${radiusPx}px`,
          boxShadow: '0 12px 34px rgba(15,23,42,0.14)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {messageIcon ? (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] leading-none"
            style={{
              backgroundColor: chipColor,
              color: tone.textColor,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
            }}
            aria-hidden
          >
            {messageIcon}
          </span>
        ) : null}

        {messageIcon ? (
          <span
            className="h-4 w-px shrink-0 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
            aria-hidden
          />
        ) : null}

        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          {hasFrench ? (
            <span className="inline-flex items-center gap-2">
              <span className="rounded-full border border-white/16 bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/72">
                FR
              </span>
              <span
                className="text-[13px] font-semibold leading-none tracking-[0.01em] text-white md:text-sm"
                lang="fr"
                title={frText}
              >
                {frText}
              </span>
            </span>
          ) : null}

          {hasFrench && hasArabic ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white/36" aria-hidden />
          ) : null}

          {hasArabic ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="text-[13px] font-semibold leading-none tracking-[0.01em] text-white md:text-sm"
                dir="rtl"
                lang="ar"
                style={{ unicodeBidi: 'plaintext', textShadow: tone.textShadow }}
                title={arText}
              >
                {arText}
              </span>
              <span className="rounded-full border border-white/16 bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/72">
                AR
              </span>
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[60] h-10 overflow-hidden border-b shadow-sm"
      style={{
        backgroundColor: fallbackBarColor,
        color: '#FFFFFF',
        borderBottomColor: 'rgba(255,255,255,0.16)',
      }}
      onMouseEnter={() => {
        if (!pauseOnHover) return;
        setIsHovering(true);
        if (!resumeAuto) {
          setHoverLocked(true);
        }
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        if (resumeAuto) {
          setHoverLocked(false);
        }
      }}
      aria-live="polite"
    >
      <style>
        {`
          @keyframes vk-announcement-marquee-rtl {
            from { transform: translate3d(0, 0, 0); }
            to { transform: translate3d(-50%, 0, 0); }
          }

          @keyframes vk-announcement-marquee-ltr {
            from { transform: translate3d(-50%, 0, 0); }
            to { transform: translate3d(0, 0, 0); }
          }
        `}
      </style>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 14% 50%, rgba(255,255,255,0.12) 0%, transparent 18%),
            radial-gradient(circle at 82% 50%, rgba(255,255,255,0.08) 0%, transparent 20%),
            linear-gradient(90deg, rgba(255,255,255,0.08) 0%, transparent 22%, transparent 78%, rgba(255,255,255,0.05) 100%)
          `,
        }}
        aria-hidden
      />

      <div className="absolute inset-y-0 left-0 z-20 flex items-center pl-2 sm:pl-3" aria-hidden>
        <div
          className="relative flex items-center gap-2 overflow-hidden rounded-2xl border border-white/16 px-2.5 py-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.18)]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.22)_48%,transparent_100%)] opacity-60" />
          <span className="relative flex h-2.5 w-2.5 items-center justify-center">
            <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-[#FACC15]/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FACC15]" />
          </span>
          <span className="relative text-[9px] font-black uppercase tracking-[0.24em] text-white/72">VERKING</span>
          <span className="relative rounded-full bg-white/14 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white">
            Live
          </span>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 left-[92px] z-20 w-10 sm:left-[104px] sm:w-14"
        style={{ background: `linear-gradient(to right, ${fallbackBarColor} 0%, transparent 100%)` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 sm:w-14"
        style={{ background: `linear-gradient(to left, ${fallbackBarColor} 0%, transparent 100%)` }}
        aria-hidden
      />

      <div
        className="relative z-10 flex h-full w-full items-center overflow-hidden pl-28 pr-5 sm:pl-32 sm:pr-6"
        style={{
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)',
          maskImage: 'linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)',
        }}
      >
        {shouldAnimateVisual ? (
          <div
            className="flex w-max min-w-full shrink-0 items-center gap-8"
            style={{
              animationName: tickerAnimationName,
              animationDuration: `${tickerDurationSeconds}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: loopInfinite ? 'infinite' : 1,
              animationFillMode: 'forwards',
              animationPlayState: isPaused ? 'paused' : 'running',
              willChange: 'transform',
            }}
          >
            {[0, 1].map((copyIndex) => (
              <div key={`copy-${copyIndex}`} className="flex shrink-0 items-center gap-8 pr-8">
                {activeMessages.map((item, itemIndex) => renderTickerItem(item, `${copyIndex}-${item.id}-${itemIndex}`))}
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-auto flex h-full max-w-full items-center justify-center">
            {renderTickerItem(currentMessage, `static-${currentMessage.id}`)}
          </div>
        )}
      </div>
    </div>
  );
}
