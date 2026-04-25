// Drop-in backdrop for admin-configurable section media on the storefront.
// Accepts either a single URL (`url`) or a list (`urls`). Videos and
// images are auto-detected by extension. When multiple slides are given,
// a gentle 5s cross-fade loops through them. An optional overlay keeps
// foreground text readable. Used by every homepage section that exposes
// a bilingual "image ou vidéo" control in the admin.
import React, { useEffect, useState } from 'react';

const VIDEO_RX = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return VIDEO_RX.test(url);
}

/** Coerce admin payload into a deduped, non-empty string[] of URLs. */
export function pickBackdropUrls(
  single?: string | null,
  multi?: string[] | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: unknown) => {
    if (typeof v !== 'string') return;
    const trimmed = v.trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };
  if (Array.isArray(multi)) multi.forEach(push);
  if (out.length === 0) push(single);
  return out;
}

type Props = {
  /** Legacy single URL. Ignored when `urls` has entries. */
  url?: string | null;
  /** Multi-slide list. Cycles every `intervalMs` (default 5000). */
  urls?: string[] | null;
  /** Strength of the dark overlay (0-1). Default 0.35. */
  overlay?: number;
  /** Extra class names applied to the wrapper. */
  className?: string;
  /** Rounded-corner class. Default 'rounded-3xl'. */
  roundedClass?: string;
  /** If true, disable the overlay entirely. */
  noOverlay?: boolean;
  /** Cycle interval in ms for multi-slide. Default 5000. */
  intervalMs?: number;
};

export function SectionMediaBackdrop({
  url,
  urls,
  overlay = 0.35,
  className = '',
  roundedClass = 'rounded-3xl',
  noOverlay = false,
  intervalMs = 5000,
}: Props) {
  const list = pickBackdropUrls(url, urls);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (list.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % list.length);
    }, Math.max(1500, intervalMs));
    return () => window.clearInterval(timer);
  }, [list.length, intervalMs]);

  // Clamp index if list shrinks.
  useEffect(() => {
    if (index >= list.length && list.length > 0) setIndex(0);
  }, [list.length, index]);

  if (list.length === 0) return null;

  return (
    // The backdrop must paint BEHIND every panel sibling — including
    // static (non-positioned) panel headers, paragraph text, and
    // panel-internal CTAs. Per CSS painting order, an `absolute`
    // descendant with `z-index: 0` paints AFTER static descendants,
    // i.e. ON TOP of headlines — which is exactly the visibility bug
    // we observed: setting an admin background made the panel header
    // disappear behind the image.
    //
    // Negative z-index pushes the backdrop into the "negative-stacking
    // contexts" painting tier, which sits ABOVE the stacking context's
    // own background but BELOW every other descendant. This works
    // because every panel that hosts a backdrop already establishes
    // a stacking context (via backdrop-filter on the glass panel
    // wrapper or via an explicit z-index), so the negative value is
    // safely confined to the panel rather than leaking behind the
    // whole page.
    //
    // Using inline style to write z-index: -1 (Tailwind's `-z-10`
    // would also work; we choose the inline form to make the intent
    // and value visible at the call site).
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${roundedClass} ${className}`}
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      {list.map((slideUrl, i) => {
        const active = i === index;
        const isVideo = isVideoUrl(slideUrl);
        const style: React.CSSProperties = {
          opacity: active ? 1 : 0,
          transition: 'opacity 900ms cubic-bezier(0.4, 0, 0.2, 1)',
        };
        return (
          <React.Fragment key={`${i}-${slideUrl}`}>
            {isVideo ? (
              <video
                src={slideUrl}
                autoPlay
                muted
                loop
                playsInline
                preload={active ? 'auto' : 'metadata'}
                className="absolute inset-0 h-full w-full object-cover"
                style={style}
              />
            ) : (
              <img
                src={slideUrl}
                alt=""
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                style={style}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </React.Fragment>
        );
      })}
      {!noOverlay && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, rgba(8,23,48,${overlay * 0.85}) 0%, rgba(8,23,48,${overlay}) 100%)`,
          }}
        />
      )}
      {list.length > 1 && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1">
          {list.map((_, i) => (
            <span
              key={i}
              className="h-1 rounded-full transition-all"
              style={{
                width: i === index ? 16 : 6,
                background: i === index ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
