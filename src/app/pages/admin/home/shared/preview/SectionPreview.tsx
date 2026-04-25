// Live preview engine for every section sub-page. Reads directly from the
// draftConfig (via the passed-in hub) so the admin sees the new layout as
// they type — no publish required. Each internal component is a tiny,
// storefront-faithful reproduction. Goal: pixel-coherent enough to catch
// layout mistakes, light enough to render instantly.
import React, { useEffect, useState } from 'react';
import {
  Mail, Package, ShieldCheck, Truck, Award, Users, Clock, Star, Heart,
  CreditCard, Headphones, Megaphone, Layers, Film, Play, Images as ImagesIcon,
} from 'lucide-react';
import type { UseHomepageConfig } from '../useHomepageConfig';
import type { HomepageSection, SectionKey, TrustItem, TestimonialItem, PromoImage } from '../types';
import { isVideoUrl } from '../media/useMediaUpload';

/** Pick a non-empty list of URLs: prefer section.images[], else [section.image]. */
function pickBackdropList(section: HomepageSection): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: unknown) => {
    if (typeof v !== 'string') return;
    const trimmed = v.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };
  if (Array.isArray(section.images)) section.images.forEach(push);
  if (out.length === 0) push(section.image);
  return out;
}

/** A small auto-cycling backdrop used inside previews. */
function PreviewBackdrop({ section, rounded = 'rounded-xl', overlay = 0.45, intervalMs = 3500 }: {
  section: HomepageSection;
  rounded?: string;
  overlay?: number;
  intervalMs?: number;
}) {
  const list = pickBackdropList(section);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (list.length < 2) return undefined;
    const timer = window.setInterval(() => setIdx((p) => (p + 1) % list.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [list.length, intervalMs]);
  if (list.length === 0) return null;
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${rounded}`} aria-hidden="true">
      {list.map((u, i) => {
        const active = i === idx;
        const style: React.CSSProperties = {
          opacity: active ? 1 : 0,
          transition: 'opacity 700ms cubic-bezier(0.4,0,0.2,1)',
        };
        return isVideoUrl(u) ? (
          <video key={`${i}-${u}`} src={u} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" style={style} />
        ) : (
          <img key={`${i}-${u}`} src={u} alt="" className="absolute inset-0 h-full w-full object-cover" style={style} />
        );
      })}
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(8,23,48,${overlay * 0.75}) 0%, rgba(8,23,48,${overlay}) 100%)` }} />
      {list.length > 1 && (
        <div className="absolute bottom-1 left-1 z-10 inline-flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white">
          <ImagesIcon size={9} />
          {idx + 1}/{list.length}
        </div>
      )}
    </div>
  );
}

type Lang = 'fr' | 'ar';

const TRUST_ICON_MAP: Record<string, React.ElementType> = {
  shield: ShieldCheck, truck: Truck, award: Award, users: Users,
  package: Package, clock: Clock, star: Star, heart: Heart,
  'credit-card': CreditCard, headphones: Headphones,
};

function t(section: HomepageSection, field: 'title' | 'subtitle' | 'cta', lang: Lang): string {
  const key = `${field}_${lang}` as keyof HomepageSection;
  return String(section[key] || '') || '';
}

function Shell({ children, lang }: { children: React.ReactNode; lang: Lang }) {
  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
          {lang === 'ar' ? 'معاينة مباشرة' : 'Aperçu live'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          {lang === 'ar' ? 'مسودة' : 'Brouillon'}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MediaFill({ url, className }: { url: string; className?: string }) {
  if (!url) return null;
  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        autoPlay
        muted
        loop
        playsInline
        className={className || 'absolute inset-0 h-full w-full object-cover'}
      />
    );
  }
  return <img src={url} alt="preview" className={className || 'absolute inset-0 h-full w-full object-cover'} />;
}

// ——— Hero ——————————————————————————————————————————————————————————————————
function HeroPreview({ section, lang }: { section: HomepageSection; lang: Lang }) {
  const title = t(section, 'title', lang);
  const subtitle = t(section, 'subtitle', lang);
  const cta = t(section, 'cta', lang);
  const overlay = section.show_text_overlay_global !== false;

  return (
    <div className="relative aspect-[16/7] w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#1A3C6E] to-[#0d2447]">
      <PreviewBackdrop section={section} overlay={0} />
      {overlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      )}
      <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
        {title && <h4 className="text-lg font-black leading-tight drop-shadow">{title}</h4>}
        {subtitle && <p className="mt-1 line-clamp-2 text-xs opacity-90">{subtitle}</p>}
        {cta && (
          <span className="mt-2 w-fit rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#1A3C6E]">
            {cta}
          </span>
        )}
      </div>
      <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
        <Play size={10} />
        {lang === 'ar' ? 'كاروسيل' : 'Carousel'}
      </div>
    </div>
  );
}

// ——— Categories ————————————————————————————————————————————————————————————
function CategoriesPreview({ section, hub, lang }: { section: HomepageSection; hub: UseHomepageConfig; lang: Lang }) {
  const cats = hub.categories.slice(0, 6);
  const count = Math.max(cats.length, 6);
  const variant = section.style_variant || 'grid';
  const hasBackdrop = pickBackdropList(section).length > 0;
  return (
    <div className={`relative space-y-3 ${hasBackdrop ? 'overflow-hidden rounded-xl p-3' : ''}`}>
      {hasBackdrop && <PreviewBackdrop section={section} overlay={0.5} />}
      <div className="relative space-y-3">
        {t(section, 'title', lang) && (
          <h4 className={`text-sm font-black ${hasBackdrop ? 'text-white' : 'text-gray-900'}`}>{t(section, 'title', lang)}</h4>
        )}
        <div className={variant === 'chips'
          ? 'flex flex-wrap gap-2'
          : variant === 'list'
          ? 'flex flex-col gap-2'
          : 'grid grid-cols-3 gap-2'}>
          {Array.from({ length: count }).map((_, i) => {
            const cat = cats[i];
            const name = cat ? (lang === 'ar' ? cat.name_ar || cat.name_fr : cat.name_fr || cat.name_ar) : `Cat ${i + 1}`;
            if (variant === 'chips') {
              return (
                <span key={i} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-bold text-gray-700">
                  {name}
                </span>
              );
            }
            if (variant === 'list') {
              return (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2">
                  <Layers size={14} className="text-[#7C3AED]" />
                  <span className="text-xs font-bold text-gray-800">{name}</span>
                </div>
              );
            }
            return (
              <div key={i} className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED]/10 text-[#7C3AED]">
                  <Layers size={16} />
                </div>
                <span className="line-clamp-1 text-[10px] font-bold text-gray-700">{name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ——— Promotions ———————————————————————————————————————————————————————————
function PromotionsPreview({ section, hub, lang }: { section: HomepageSection; hub: UseHomepageConfig; lang: Lang }) {
  const images: PromoImage[] = section.promo_images || [];
  const title = t(section, 'title', lang);
  const subtitle = t(section, 'subtitle', lang);
  const cta = t(section, 'cta', lang);

  // Mirror the storefront — show real selected promo products.
  const selectedProducts = (Array.isArray(section.selected_product_ids) ? section.selected_product_ids : [])
    .map((id) => hub.products.find((p) => p.id === id))
    .filter(Boolean)
    .slice(0, 6) as Array<{ id: string; name_fr: string; name_ar: string }>;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-3 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h4 className="text-sm font-black">{title}</h4>}
            {subtitle && <p className="mt-0.5 line-clamp-2 text-[11px] opacity-90">{subtitle}</p>}
          </div>
          <Megaphone size={18} className="shrink-0" />
        </div>
        {cta && <span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-[10px] font-black text-emerald-700">{cta}</span>}
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.slice(0, 6).map((img, i) => (
            <div key={img.id || i} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
              <MediaFill url={img.image_url || ''} />
              {(img.title_fr || img.title_ar) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                  <p className="truncate text-[9px] font-bold text-white">
                    {lang === 'ar' ? img.title_ar || img.title_fr : img.title_fr || img.title_ar}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {selectedProducts.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-2">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {lang === 'ar' ? 'منتجات العرض' : 'Produits en promo'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {selectedProducts.map((product) => {
              const name = lang === 'ar' ? product.name_ar || product.name_fr : product.name_fr || product.name_ar;
              return (
                <div key={product.id} className="rounded-lg border border-gray-100 bg-white p-1.5">
                  <div className="aspect-square w-full rounded bg-gradient-to-br from-emerald-50 to-teal-50" />
                  <p className="mt-1 line-clamp-2 text-[10px] font-bold text-gray-700">{name || product.id}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ——— Products row (shared by best_sellers / new_arrivals / featured) ————————
// Mirrors the storefront resolver \u2014 preview shows the EXACT products
// the admin picked (selected_product_ids, in order). When nothing is
// selected, an explicit warning replaces the generic placeholder grid
// so the admin sees the section will be hidden on the storefront.
function ProductsPreview({ section, hub, lang, accent }: { section: HomepageSection; hub: UseHomepageConfig; lang: Lang; accent: string }) {
  const limit = Math.min(section.limit || 8, 6);
  const variant = section.style_variant || 'carousel';
  const hasBackdrop = pickBackdropList(section).length > 0;

  const products = (() => {
    const seen = new Set<string>();
    const pool: any[] = [];
    const push = (p: any) => {
      if (!p?.id || seen.has(p.id)) return;
      seen.add(p.id);
      pool.push(p);
    };
    if (Array.isArray(section.selected_product_ids)) {
      for (const id of section.selected_product_ids) {
        const product = hub.products.find((item) => item.id === id);
        if (product) push(product);
      }
    }
    const refs = (section.source_ref || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (pool.length === 0 && refs.length > 0) {
      for (const product of hub.products) {
        push(product);
        if (pool.length >= limit * 2) break;
      }
    }
    return pool.slice(0, limit);
  })();

  const empty = products.length === 0;

  return (
    <div className={`relative space-y-3 ${hasBackdrop ? 'overflow-hidden rounded-xl p-3' : ''}`}>
      {hasBackdrop && <PreviewBackdrop section={section} overlay={0.55} />}
      <div className="relative space-y-3">
        <div className="flex items-center justify-between">
          {t(section, 'title', lang) && (
            <h4 className="text-sm font-black" style={hasBackdrop ? { color: '#fff' } : { color: accent }}>{t(section, 'title', lang)}</h4>
          )}
          {t(section, 'cta', lang) && (
            <span className="text-[10px] font-bold" style={hasBackdrop ? { color: '#fff' } : { color: accent }}>{t(section, 'cta', lang)} \u2192</span>
          )}
        </div>
        {empty ? (
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-3 text-center">
            <p className="text-[11px] font-bold text-amber-800">
              {lang === 'ar' ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0646\u062a\u062c\u0627\u062a \u0645\u062e\u062a\u0627\u0631\u0629' : 'Aucun produit s\u00e9lectionn\u00e9'}
            </p>
            <p className="mt-0.5 text-[10px] text-amber-700">
              {lang === 'ar'
                ? '\u0633\u064a\u062a\u0645 \u0625\u062e\u0641\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u0639\u0644\u0649 \u0627\u0644\u0635\u0641\u062d\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629 \u062d\u062a\u0649 \u062a\u062e\u062a\u0627\u0631 \u0645\u0646\u062a\u062c\u0627\u062a.'
                : 'Cette section restera masqu\u00e9e sur la homepage tant que rien n\u2019est s\u00e9lectionn\u00e9.'}
            </p>
          </div>
        ) : (
          <div className={variant === 'grid' ? 'grid grid-cols-3 gap-2' : 'flex gap-2 overflow-x-auto pb-1'}>
            {products.map((product) => {
              const name = lang === 'ar' ? product.name_ar || product.name_fr : product.name_fr || product.name_ar;
              const image = (product as any).image as string | undefined;
              return (
                <div
                  key={product.id}
                  className={variant === 'grid'
                    ? 'rounded-lg border border-gray-200 bg-white p-2'
                    : 'w-28 shrink-0 rounded-lg border border-gray-200 bg-white p-2'}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded bg-gradient-to-br from-gray-100 to-gray-200">
                    {image && (
                      <img src={image} alt={name || product.id} className="absolute inset-0 h-full w-full object-cover" />
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] font-bold text-gray-700">{name || product.id}</p>
                  <div className="mt-1 flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={8} fill="currentColor" className="text-amber-400" />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ——— Trust ————————————————————————————————————————————————————————————————
function TrustPreview({ section, lang }: { section: HomepageSection; lang: Lang }) {
  const items: TrustItem[] = section.trust_items || [];
  const hasBackdrop = pickBackdropList(section).length > 0;
  return (
    <div className={`relative space-y-3 ${hasBackdrop ? 'overflow-hidden rounded-xl p-3' : ''}`}>
      {hasBackdrop && <PreviewBackdrop section={section} overlay={0.55} />}
      <div className="relative space-y-3">
        {t(section, 'title', lang) && (
          <h4 className={`text-center text-sm font-black ${hasBackdrop ? 'text-white' : 'text-gray-900'}`}>{t(section, 'title', lang)}</h4>
        )}
        <div className="grid grid-cols-3 gap-2">
          {items.slice(0, 6).map((item) => {
            const Icon = TRUST_ICON_MAP[item.icon] || ShieldCheck;
            return (
              <div key={item.id} className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-white p-2 text-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${item.color}1a`, color: item.color }}>
                  <Icon size={14} />
                </div>
                <p className="text-[10px] font-black text-gray-900">{lang === 'ar' ? item.value_ar || item.value_fr : item.value_fr || item.value_ar}</p>
                <p className="line-clamp-1 text-[9px] text-gray-500">{lang === 'ar' ? item.label_ar || item.label_fr : item.label_fr || item.label_ar}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ——— Testimonials ————————————————————————————————————————————————————————
function TestimonialsPreview({ section, lang }: { section: HomepageSection; lang: Lang }) {
  const items: TestimonialItem[] = section.testimonial_items || [];
  const hasBackdrop = pickBackdropList(section).length > 0;
  return (
    <div className={`relative space-y-3 ${hasBackdrop ? 'overflow-hidden rounded-xl p-3' : ''}`}>
      {hasBackdrop && <PreviewBackdrop section={section} overlay={0.5} />}
      <div className="relative space-y-3">
        {t(section, 'title', lang) && (
          <h4 className={`text-center text-sm font-black ${hasBackdrop ? 'text-white' : 'text-gray-900'}`}>{t(section, 'title', lang)}</h4>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.slice(0, 2).map((item) => (
            <div key={item.id} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-200">
                  {item.avatar ? <img src={item.avatar} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-gray-900">{lang === 'ar' ? item.author_ar || item.author_fr : item.author_fr || item.author_ar}</p>
                  <p className="truncate text-[10px] text-gray-500">{lang === 'ar' ? item.wilaya_ar || item.wilaya_fr : item.wilaya_fr || item.wilaya_ar}</p>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={9} fill={n <= (item.rating || 5) ? 'currentColor' : 'none'} className="text-amber-500" />
                ))}
              </div>
              <p className="mt-1 line-clamp-3 text-[10px] italic text-gray-700">
                \u201c{lang === 'ar' ? item.quote_ar || item.quote_fr : item.quote_fr || item.quote_ar}\u201d
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ——— Newsletter ——————————————————————————————————————————————————————————
function NewsletterPreview({ section, lang }: { section: HomepageSection; lang: Lang }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
      <PreviewBackdrop section={section} overlay={0.25} />
      <div className="relative flex items-center gap-3">
        <Mail size={20} className="shrink-0" />
        <div className="min-w-0">
          <h4 className="text-sm font-black">{t(section, 'title', lang) || (lang === 'ar' ? 'النشرة البريدية' : 'Newsletter')}</h4>
          <p className="mt-0.5 line-clamp-2 text-[11px] opacity-90">{t(section, 'subtitle', lang)}</p>
        </div>
      </div>
      <div className="relative mt-3 flex gap-1 rounded-lg bg-white/10 p-1 backdrop-blur">
        <span className="flex-1 rounded bg-white/90 px-2 py-1 text-[11px] text-gray-400">
          email@example.com
        </span>
        <span className="rounded bg-white px-3 py-1 text-[11px] font-black text-blue-700">
          {t(section, 'cta', lang) || (lang === 'ar' ? 'اشترك' : 'Je m\u2019abonne')}
        </span>
      </div>
    </div>
  );
}

// ——— Wholesale ——————————————————————————————————————————————————————————
function WholesalePreview({ section, lang }: { section: HomepageSection; lang: Lang }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-900 to-emerald-700 p-4 text-white">
      <PreviewBackdrop section={section} overlay={0.2} />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-black">{t(section, 'title', lang) || (lang === 'ar' ? 'فضاء الجملة' : 'Espace grossiste')}</h4>
          <p className="mt-0.5 line-clamp-2 text-[11px] opacity-90">{t(section, 'subtitle', lang)}</p>
          {t(section, 'cta', lang) && (
            <span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-[10px] font-black text-emerald-900">
              {t(section, 'cta', lang)}
            </span>
          )}
        </div>
        <Package size={32} className="shrink-0 opacity-80" />
      </div>
    </div>
  );
}

// ——— Switch ————————————————————————————————————————————————————————————————
export function SectionPreview({
  sectionKey,
  hub,
  lang = 'fr',
}: {
  sectionKey: SectionKey;
  hub: UseHomepageConfig;
  lang?: Lang;
}) {
  if (hub.loading) {
    return (
      <Shell lang={lang}>
        <div className="flex aspect-video w-full items-center justify-center text-gray-400">
          <Film size={20} className="animate-pulse" />
        </div>
      </Shell>
    );
  }
  const section = hub.draftConfig[sectionKey];
  const content = (() => {
    switch (sectionKey) {
      case 'hero': return <HeroPreview section={section} lang={lang} />;
      case 'categories': return <CategoriesPreview section={section} hub={hub} lang={lang} />;
      case 'promotions': return <PromotionsPreview section={section} hub={hub} lang={lang} />;
      case 'best_sellers': return <ProductsPreview section={section} hub={hub} lang={lang} accent="#DC2626" />;
      case 'new_arrivals': return <ProductsPreview section={section} hub={hub} lang={lang} accent="#0891B2" />;
      case 'featured': return <ProductsPreview section={section} hub={hub} lang={lang} accent="#F57C00" />;
      case 'trust': return <TrustPreview section={section} lang={lang} />;
      case 'testimonials': return <TestimonialsPreview section={section} lang={lang} />;
      case 'newsletter': return <NewsletterPreview section={section} lang={lang} />;
      case 'wholesale': return <WholesalePreview section={section} lang={lang} />;
      default: return null;
    }
  })();
  // When a section is toggled off, dim the preview and label it
  // explicitly so admins immediately see the section will be hidden
  // on the public storefront after publish.
  const disabled = section?.enabled === false;
  // Surface a small "fond actif" indicator when the admin has set a
  // section background — confirms the persistence is working without
  // making admins squint at the tiny preview.
  const hasBackdrop =
    !!(typeof section?.image === 'string' && section.image) ||
    (Array.isArray(section?.images) && section.images.some((u) => typeof u === 'string' && u));
  return (
    <Shell lang={lang}>
      <div className="relative">
        <div className={disabled ? 'pointer-events-none opacity-40 grayscale' : ''}>
          {content}
        </div>
        {disabled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-gray-900/85 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-lg">
              {lang === 'ar' ? 'القسم معطّل' : 'Section désactivée'}
            </span>
          </div>
        )}
        {hasBackdrop && !disabled && (
          <span className="pointer-events-none absolute right-1 top-1 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white">
            <ImagesIcon size={9} />
            {lang === 'ar' ? 'خلفية' : 'Fond'}
          </span>
        )}
      </div>
    </Shell>
  );
}
