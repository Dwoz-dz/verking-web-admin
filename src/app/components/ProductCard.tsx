import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ShoppingCart, Heart, Star, Sparkles } from 'lucide-react';
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
const ETHEREAL_PRIMARY = '#9b3f00';
const ETHEREAL_PRIMARY_LIGHT = '#ff7a2e';

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
    writeWishlist(exists ? current.filter(id => id !== product.id) : [...current, product.id]);
    setWishlisted(!exists);
    toast.success(exists
      ? (lang === 'ar' ? 'تمت الإزالة من المفضلة' : 'Retiré des favoris')
      : (lang === 'ar' ? 'تمت الإضافة للمفضلة' : 'Ajouté aux favoris'));
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
  const rating = product.rating || 4.8;
  const reviews = product.review_count || 0;
  const salesCount = product.order_count || 0;
  const fallback = LOCAL_PRODUCT_FALLBACK;

  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(172deg, rgba(255,255,255,0.92) 0%, rgba(247,251,255,0.82) 55%, rgba(238,247,255,0.78) 100%)',
    backdropFilter: 'blur(22px) saturate(160%)',
    WebkitBackdropFilter: 'blur(22px) saturate(160%)',
    border: '1px solid rgba(255,255,255,0.75)',
    boxShadow: '0 16px 38px -24px rgba(23,97,139,0.32), 0 4px 14px -10px rgba(23,97,139,0.14), inset 0 1px 0 rgba(255,255,255,0.78)',
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className="group relative flex h-full flex-col rounded-[1.6rem] transition-all duration-500 ease-out will-change-transform hover:-translate-y-[6px] hover:shadow-[0_30px_60px_-28px_rgba(23,97,139,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#ff7a2e]/60"
      style={cardStyle}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[1.6rem] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(120% 60% at 50% 0%, rgba(255,122,46,0.10) 0%, rgba(255,122,46,0) 60%)' }}
      />

      <div
        className="relative overflow-hidden rounded-t-[1.6rem]"
        style={{ aspectRatio: '1 / 0.96', background: 'linear-gradient(150deg,#f4f9ff 0%,#e6f1ff 55%,#dae9fb 100%)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(70% 60% at 50% 45%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)' }}
        />

        <img
          src={imgError ? fallback : (product.images?.[0] || fallback)}
          alt={name}
          loading="lazy"
          onError={() => setImgError(true)}
          className={`relative h-full w-full object-contain p-4 md:p-5 transition-transform duration-[700ms] ease-out group-hover:scale-[1.07] ${isOutOfStock ? 'opacity-40 grayscale-[60%]' : ''}`}
          style={{ filter: isOutOfStock ? undefined : 'drop-shadow(0 18px 22px rgba(23,97,139,0.18))' }}
        />

        <div className="pointer-events-none absolute top-3 start-3 flex flex-col items-start gap-1.5">
          {isPromo && discountPct > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-[5px] text-[10px] font-black tracking-wide text-white"
              style={{
                background: `linear-gradient(135deg,${ETHEREAL_PRIMARY} 0%,${ETHEREAL_PRIMARY_LIGHT} 100%)`,
                boxShadow: '0 8px 22px -8px rgba(155,63,0,0.70), inset 0 1px 0 rgba(255,255,255,0.4)',
                letterSpacing: '0.03em',
              }}
            >
              <Sparkles size={9} className="shrink-0" strokeWidth={2.5} />
              -{discountPct}%
            </span>
          )}
          {product.is_new && !isPromo && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-[5px] text-[10px] font-black tracking-wide text-white"
              style={{
                background: 'linear-gradient(135deg,#0f172a 0%,#334155 100%)',
                boxShadow: '0 6px 16px -6px rgba(15,23,42,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
                letterSpacing: '0.04em',
              }}
            >
              {lang === 'ar' ? 'جديد' : 'NOUVEAU'}
            </span>
          )}
          {product.is_best_seller && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-[5px] text-[10px] font-black tracking-wide"
              style={{
                background: 'linear-gradient(135deg,#fde68a 0%,#fbbf24 100%)',
                color: '#5a3a00',
                boxShadow: '0 6px 16px -6px rgba(251,191,36,0.55), inset 0 1px 0 rgba(255,255,255,0.55)',
                letterSpacing: '0.04em',
              }}
            >
              ⭐ {lang === 'ar' ? 'الأكثر مبيعاً' : 'TOP VENTE'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={toggleWishlist}
          aria-label={wishlisted ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className={`absolute top-3 end-3 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 ${
            wishlisted ? 'scale-110 text-white' : 'text-gray-500 hover:scale-105 hover:text-[#9b3f00]'
          }`}
          style={
            wishlisted
              ? {
                  background: `linear-gradient(135deg,${ETHEREAL_PRIMARY},${ETHEREAL_PRIMARY_LIGHT})`,
                  boxShadow: '0 8px 18px -6px rgba(155,63,0,0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
                  border: '1px solid rgba(255,255,255,0.4)',
                }
              : {
                  background: 'rgba(255,255,255,0.82)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.85)',
                  boxShadow: '0 6px 14px -6px rgba(23,97,139,0.25), inset 0 1px 0 rgba(255,255,255,0.7)',
                }
          }
        >
          <Heart size={14} strokeWidth={2.2} className={wishlisted ? 'fill-current' : ''} />
        </button>

        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/35 backdrop-blur-[3px]">
            <span
              className="rounded-full px-4 py-[7px] text-[11px] font-black tracking-[0.08em] text-white"
              style={{ background: 'linear-gradient(135deg,#1f2937 0%,#0f172a 100%)', boxShadow: '0 10px 20px -8px rgba(15,23,42,0.5)' }}
            >
              {lang === 'ar' ? 'نفدت الكمية' : 'EPUISE'}
            </span>
          </div>
        )}

        {!isOutOfStock && (
          <div className="absolute inset-x-3 bottom-3 translate-y-[120%] opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={handleAdd}
              className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[12px] font-black tracking-wide text-white transition-colors duration-300"
              style={{
                background: addedAnim
                  ? 'linear-gradient(135deg,#16a34a 0%,#22c55e 100%)'
                  : `linear-gradient(135deg,${ETHEREAL_PRIMARY} 0%,${ETHEREAL_PRIMARY_LIGHT} 100%)`,
                boxShadow: addedAnim
                  ? '0 10px 24px -10px rgba(22,163,74,0.6), inset 0 1px 0 rgba(255,255,255,0.3)'
                  : '0 12px 24px -10px rgba(155,63,0,0.6), inset 0 1px 0 rgba(255,255,255,0.3)',
                letterSpacing: '0.03em',
              }}
            >
              <ShoppingCart size={13} strokeWidth={2.4} />
              {addedAnim
                ? (lang === 'ar' ? '✓ تمت الإضافة' : '✓ Ajouté !')
                : (lang === 'ar' ? 'أضف للسلة' : 'Ajouter au panier')}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4 md:p-[1.05rem]">
        <h3
          className="line-clamp-2 min-h-[2.6rem] text-[14px] font-bold leading-snug transition-colors duration-300 group-hover:text-[#9b3f00] md:text-[15px]"
          style={{ color: '#1f2937', letterSpacing: '-0.005em' }}
        >
          {name}
        </h3>

        {(reviews > 0 || salesCount > 0) && (
          <div className="flex min-h-[1rem] items-center gap-1.5">
            <div className="flex items-center">
              {[1,2,3,4,5].map(i => (
                <Star
                  key={i}
                  size={11}
                  className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}
                  strokeWidth={1.5}
                />
              ))}
            </div>
            <span className="text-[11px] font-semibold text-gray-600">{rating.toFixed(1)}</span>
            <span className="text-[10px] font-medium text-gray-400">
              {reviews > 0 ? `(${reviews})` : `(${salesCount}+)`}
            </span>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              className="font-black leading-none tracking-tight"
              style={{ color: ETHEREAL_PRIMARY, fontSize: 'clamp(17px, 2vw, 21px)', letterSpacing: '-0.02em' }}
            >
              {formatPrice(effectivePrice, lang)}
            </span>
            {isPromo && (
              <span className="text-[12px] font-semibold leading-none text-gray-400 line-through">
                {formatPrice(product.price, lang)}
              </span>
            )}
          </div>

          {!isOutOfStock && (
            <button
              type="button"
              onClick={handleAdd}
              aria-label={lang === 'ar' ? 'أضف للسلة' : 'Ajouter au panier'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-all duration-300 group-hover:translate-x-2 group-hover:opacity-0"
              style={{
                background: `linear-gradient(135deg,${ETHEREAL_PRIMARY} 0%,${ETHEREAL_PRIMARY_LIGHT} 100%)`,
                boxShadow: '0 10px 20px -8px rgba(155,63,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
            >
              <ShoppingCart size={14} strokeWidth={2.4} />
            </button>
          )}
        </div>

        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[10.5px] font-bold"
          style={{
            color: '#065f46',
            background: 'linear-gradient(135deg,rgba(209,250,229,0.9) 0%,rgba(220,252,231,0.85) 100%)',
            border: '1px solid rgba(167,243,208,0.7)',
            letterSpacing: '0.01em',
          }}
        >
          <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
            <rect x="9" y="11" width="14" height="10" rx="1"/>
            <circle cx="12" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
          </svg>
          {lang === 'ar' ? 'توصيل مجاني' : 'Livraison gratuite'}
        </span>
      </div>
    </Link>
  );
}
