import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ShoppingCart, Heart, Star, Package, Truck, ChevronRight } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/translations';
import { toast } from 'sonner';
import { openCartDrawer } from './CartDrawer';

interface Product {
  id: string; name_fr: string; name_ar: string; price: number; sale_price?: number;
  images: string[]; category_id: string; stock: number; is_featured?: boolean;
  is_new?: boolean; is_best_seller?: boolean; is_active?: boolean;
  show_in_promotions?: boolean; rating?: number; review_count?: number;
  order_count?: number;
}

const WISHLIST_KEY = 'vk_wishlist_v1';
const WISHLIST_EVENT = 'vk:wishlist-updated';
const LOCAL_PRODUCT_FALLBACK = '/verking-hero.png';
const CORAL_PRIMARY = '#9b3f00';
const CORAL_LIGHT = '#ff7a2e';

function readWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch { return []; }
}

function writeWishlist(ids: string[]) {
  try {
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(WISHLIST_EVENT));
  } catch { /* ignore */ }
}

/**
 * ProductCard — premium compact card (2026 refresh)
 *
 * Structure:
 *   ┌─────────────────────┐
 *   │  [Badge] [♥]        │
 *   │   [IMAGE 1:1]       │  ← dominant ~58% of card height
 *   │ ─────────────────── │
 *   │ Name (2 lines)      │
 *   │ ★★★★★ (24)         │
 *   │ 2500 DA  3000 DA    │
 *   │ ✓ Livraison  [🛒]   │
 *   └─────────────────────┘
 *
 * Dimensions: 20px card radius · 16px image radius · 12px padding.
 * States: default / hover (scale 1.02 + shadow) / out-of-stock (60% opacity).
 * Bilingual FR/AR + RTL via logical props (start/end).
 */
export function ProductCard({ product }: { product: Product }) {
  const { lang } = useLang();
  const { addItem } = useCart();
  const [addedAnim, setAddedAnim] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setWishlisted(readWishlist().includes(product.id));
    const onChange = () => setWishlisted(readWishlist().includes(product.id));
    window.addEventListener(WISHLIST_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [product.id]);

  const toggleWishlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const current = readWishlist();
    const exists = current.includes(product.id);
    writeWishlist(exists ? current.filter((id) => id !== product.id) : [...current, product.id]);
    setWishlisted(!exists);
    toast.success(
      exists
        ? (lang === 'ar' ? 'تمت الإزالة من المفضلة' : 'Retiré des favoris')
        : (lang === 'ar' ? 'تمت الإضافة للمفضلة' : 'Ajouté aux favoris'),
    );
  }, [product.id, lang]);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (product.stock === 0) return;
    addItem({
      product_id: product.id,
      name_fr: product.name_fr,
      name_ar: product.name_ar,
      price: product.price,
      sale_price: product.sale_price,
      image: product.images?.[0] || '',
      qty: 1,
      stock: product.stock,
    });
    setAddedAnim(true);
    setTimeout(() => setAddedAnim(false), 1400);
    toast.success(lang === 'ar' ? 'تمت الإضافة للسلة' : 'Ajouté au panier');
    setTimeout(() => openCartDrawer(), 280);
  };

  const name = lang === 'ar' ? product.name_ar : product.name_fr;
  const effectivePrice = product.sale_price || product.price;
  const isOutOfStock = product.stock === 0;
  const isPromo = !!(product.sale_price && product.sale_price < product.price);
  const discountPct = isPromo
    ? Math.round(((product.price - (product.sale_price as number)) / product.price) * 100)
    : 0;
  const rating = typeof product.rating === 'number' && product.rating > 0 ? product.rating : 4.8;
  const reviews = product.review_count || 0;
  const salesCount = product.order_count || 0;
  const reviewOrSales = reviews > 0 ? reviews : salesCount;
  const hasImage = !imgError && !!product.images?.[0];

  // Single badge with explicit priority: NEW > BEST > PROMO
  type BadgeKind = 'new' | 'best' | 'promo';
  const primaryBadge: { kind: BadgeKind; label: string } | null = product.is_new
    ? { kind: 'new', label: lang === 'ar' ? 'جديد' : 'NOUVEAU' }
    : product.is_best_seller
      ? { kind: 'best', label: lang === 'ar' ? 'الأكثر مبيعاً' : 'TOP VENTE' }
      : (isPromo && discountPct > 0)
        ? { kind: 'promo', label: `-${discountPct}%` }
        : null;

  const badgeStyle: Record<BadgeKind, React.CSSProperties> = {
    new: {
      background: 'linear-gradient(135deg,#0f172a 0%,#334155 100%)',
      color: '#ffffff',
      boxShadow: '0 6px 14px -6px rgba(15,23,42,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
    },
    best: {
      background: 'linear-gradient(135deg,#fde68a 0%,#fbbf24 100%)',
      color: '#5a3a00',
      boxShadow: '0 6px 14px -6px rgba(251,191,36,0.55), inset 0 1px 0 rgba(255,255,255,0.55)',
    },
    promo: {
      background: `linear-gradient(135deg,${CORAL_PRIMARY} 0%,${CORAL_LIGHT} 100%)`,
      color: '#ffffff',
      boxShadow: '0 6px 14px -6px rgba(155,63,0,0.6), inset 0 1px 0 rgba(255,255,255,0.35)',
    },
  };

  return (
    <Link
      to={`/product/${product.id}`}
      aria-label={name}
      aria-disabled={isOutOfStock || undefined}
      className={`group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-white/75
                  transition-all duration-200 ease-out focus-visible:outline-none
                  focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[${CORAL_LIGHT}]/60
                  ${isOutOfStock
                    ? 'opacity-60 cursor-not-allowed shadow-sm'
                    : 'hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-lg shadow-sm'
                  }`}
      style={{
        background: 'linear-gradient(172deg, rgba(255,255,255,0.94) 0%, rgba(247,251,255,0.88) 55%, rgba(238,247,255,0.82) 100%)',
        backdropFilter: 'blur(14px) saturate(150%)',
        WebkitBackdropFilter: 'blur(14px) saturate(150%)',
        boxShadow: isOutOfStock
          ? '0 3px 10px -6px rgba(23,97,139,0.18)'
          : '0 4px 14px -8px rgba(23,97,139,0.22), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      {/* IMAGE ZONE — 1:1 aspect, dominant */}
      <div
        className="relative m-3 mb-0 overflow-hidden rounded-[16px]"
        style={{
          aspectRatio: '1 / 1',
          background: hasImage
            ? 'linear-gradient(150deg,#f4f9ff 0%,#e6f1ff 55%,#dae9fb 100%)'
            : 'linear-gradient(150deg,#f1f5f9 0%,#e2e8f0 100%)',
        }}
      >
        {/* Subtle radial highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(70% 60% at 50% 40%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)' }}
        />

        {hasImage ? (
          <img
            src={product.images?.[0] || LOCAL_PRODUCT_FALLBACK}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className={`relative h-full w-full object-contain p-3 transition-transform duration-500 ease-out will-change-transform ${
              isOutOfStock ? 'grayscale-[55%]' : 'group-hover:scale-[1.06]'
            }`}
            style={{ filter: isOutOfStock ? undefined : 'drop-shadow(0 12px 16px rgba(23,97,139,0.16))' }}
          />
        ) : (
          // Elegant placeholder when no image available
          <div className="relative flex h-full w-full items-center justify-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(135deg, rgba(100,116,139,0.15), rgba(148,163,184,0.22))' }}
            >
              <Package size={28} className="text-slate-400" strokeWidth={1.6} />
            </div>
          </div>
        )}

        {/* Priority badge — top-start */}
        {primaryBadge && !isOutOfStock && (
          <span
            className="absolute top-2 start-2 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide"
            style={{ ...badgeStyle[primaryBadge.kind], letterSpacing: '0.04em' }}
          >
            {primaryBadge.label}
          </span>
        )}

        {/* Wishlist — top-end */}
        <button
          type="button"
          onClick={toggleWishlist}
          aria-label={wishlisted
            ? (lang === 'ar' ? 'إزالة من المفضلة' : 'Retirer des favoris')
            : (lang === 'ar' ? 'إضافة للمفضلة' : 'Ajouter aux favoris')}
          className={`absolute top-2 end-2 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
            wishlisted ? 'scale-105 text-white' : 'text-slate-500 hover:text-[' + CORAL_PRIMARY + '] hover:scale-105'
          }`}
          style={
            wishlisted
              ? {
                  background: `linear-gradient(135deg,${CORAL_PRIMARY},${CORAL_LIGHT})`,
                  boxShadow: '0 6px 14px -6px rgba(155,63,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                  border: '1px solid rgba(255,255,255,0.45)',
                }
              : {
                  background: 'rgba(255,255,255,0.88)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 4px 10px -6px rgba(23,97,139,0.22), inset 0 1px 0 rgba(255,255,255,0.7)',
                }
          }
        >
          <Heart size={13} strokeWidth={2.2} className={wishlisted ? 'fill-current' : ''} />
        </button>

        {/* Out-of-stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
            <span
              className="rounded-full px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.08em] text-white"
              style={{
                background: 'linear-gradient(135deg,#475569 0%,#334155 100%)',
                boxShadow: '0 8px 16px -6px rgba(51,65,85,0.55)',
              }}
            >
              {lang === 'ar' ? 'نفدت الكمية' : 'Rupture de stock'}
            </span>
          </div>
        )}
      </div>

      {/* CONTENT ZONE — compact */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {/* Name — 2 lines max, reserve 2 lines of height to stabilise layout */}
        <h3
          className="line-clamp-2 text-[15px] font-semibold leading-snug transition-colors duration-200 group-hover:text-[#9b3f00]"
          style={{ color: '#1e293b', minHeight: '2.45rem' }}
        >
          {name}
        </h3>

        {/* Rating — small, discreet */}
        <div className="flex items-center gap-1">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={12}
                strokeWidth={1.5}
                className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}
              />
            ))}
          </div>
          <span className="text-[11px] font-semibold text-slate-600">{rating.toFixed(1)}</span>
          {reviewOrSales > 0 && (
            <span className="text-[10px] font-medium text-slate-400">({reviewOrSales})</span>
          )}
        </div>

        {/* Price — current + old if promo */}
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className="font-black leading-none tracking-tight"
            style={{ color: CORAL_PRIMARY, fontSize: '18px', letterSpacing: '-0.02em' }}
          >
            {formatPrice(effectivePrice, lang)}
          </span>
          {isPromo && (
            <span className="text-[13px] font-medium leading-none text-slate-400 line-through">
              {formatPrice(product.price, lang)}
            </span>
          )}
        </div>

        {/* Bottom row — delivery badge + CTA */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-bold"
            style={{
              color: '#15803d',
              background: 'rgba(220,252,231,0.85)',
              border: '1px solid rgba(167,243,208,0.7)',
            }}
          >
            <Truck size={11} strokeWidth={2.2} className="shrink-0" />
            {lang === 'ar' ? 'توصيل مجاني' : 'Livraison gratuite'}
          </span>

          {!isOutOfStock ? (
            <button
              type="button"
              onClick={handleAdd}
              aria-label={lang === 'ar' ? 'أضف للسلة' : 'Ajouter au panier'}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-all duration-200 hover:scale-110 active:scale-95 ${
                addedAnim ? 'scale-105' : ''
              }`}
              style={{
                background: addedAnim
                  ? 'linear-gradient(135deg,#16a34a 0%,#22c55e 100%)'
                  : `linear-gradient(135deg,${CORAL_PRIMARY} 0%,${CORAL_LIGHT} 100%)`,
                boxShadow: addedAnim
                  ? '0 8px 18px -8px rgba(22,163,74,0.6), inset 0 1px 0 rgba(255,255,255,0.3)'
                  : '0 8px 18px -8px rgba(155,63,0,0.6), inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
            >
              <ShoppingCart size={14} strokeWidth={2.4} />
            </button>
          ) : (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400"
              style={{ background: 'rgba(226,232,240,0.7)', border: '1px solid rgba(203,213,225,0.7)' }}
              aria-hidden
            >
              <ShoppingCart size={14} strokeWidth={2.2} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * ProductCardSkeleton — shimmer placeholder matching ProductCard layout.
 */
export function ProductCardSkeleton() {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[20px] border border-white/70 bg-white/80"
      style={{ boxShadow: '0 4px 14px -8px rgba(23,97,139,0.15)' }}
    >
      <div className="m-3 mb-0 aspect-square animate-pulse rounded-[16px] bg-gradient-to-br from-slate-100 to-slate-200" />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-7/12 animate-pulse rounded bg-slate-200" />
        <div className="mt-1 h-3 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-5 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="h-5 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

/**
 * DiscoverMoreCard — replaces a dangling single-product card with
 * a clickable "Discover more" placeholder so grids never look lonely.
 */
export function DiscoverMoreCard({ href = '/shop' }: { href?: string }) {
  const { lang } = useLang();
  return (
    <Link
      to={href}
      className="group relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-slate-300/80 p-6 text-center transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-[#ff7a2e]/50 hover:shadow-lg"
      style={{
        background: 'linear-gradient(172deg, rgba(255,255,255,0.88) 0%, rgba(247,251,255,0.78) 55%, rgba(255,237,224,0.65) 100%)',
        backdropFilter: 'blur(12px) saturate(150%)',
        WebkitBackdropFilter: 'blur(12px) saturate(150%)',
      }}
    >
      <div
        className="mb-3 flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
        style={{
          background: `linear-gradient(135deg,${CORAL_PRIMARY},${CORAL_LIGHT})`,
          boxShadow: '0 10px 22px -10px rgba(155,63,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)',
        }}
      >
        <ChevronRight size={22} className="text-white rtl:rotate-180" strokeWidth={2.4} />
      </div>
      <p className="text-[15px] font-black tracking-tight text-slate-800" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        {lang === 'ar' ? 'اكتشف المزيد' : 'Découvrir plus'}
      </p>
      <p className="mt-1 text-[12px] font-medium text-slate-500">
        {lang === 'ar' ? 'تصفح كامل المجموعة' : 'Parcourir toute la collection'}
      </p>
    </Link>
  );
}
