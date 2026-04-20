import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ShoppingCart, Heart, Star, Zap } from 'lucide-react';
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
  const fallback = 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=500&q=80';

  return (
    <Link
      to={`/product/${product.id}`}
      className="group block relative bg-white rounded-2xl overflow-hidden flex flex-col border border-gray-100 hover:border-[#E5252A]/30 hover:shadow-[0_8px_30px_-8px_rgba(229,37,42,0.18)] transition-all duration-300 hover:-translate-y-0.5"
    >
      {/* Image zone */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100" style={{ aspectRatio: '1 / 1' }}>
        <img
          src={imgError ? fallback : (product.images?.[0] || fallback)}
          alt={name}
          loading="lazy"
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06] ${isOutOfStock ? 'opacity-40 grayscale-[60%]' : ''}`}
        />

        {/* Top-left badges */}
        <div className="absolute top-2 start-2 flex flex-col gap-1 items-start pointer-events-none">
          {isPromo && discountPct > 0 && (
            <span className="inline-flex items-center gap-0.5 bg-[#E5252A] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-red-500/25">
              <Zap size={9} className="shrink-0" />
              -{discountPct}%
            </span>
          )}
          {product.is_new && !isPromo && (
            <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {lang === 'ar' ? 'جديد' : 'NOUVEAU'}
            </span>
          )}
          {product.is_best_seller && (
            <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow">
              {lang === 'ar' ? '⭐ الأكثر مبيعاً' : '⭐ TOP VENTE'}
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button
          type="button"
          onClick={toggleWishlist}
          aria-label={wishlisted ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className={`absolute top-2 end-2 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-all shadow-sm border ${
            wishlisted
              ? 'bg-[#E5252A] text-white border-[#E5252A] scale-110'
              : 'bg-white/80 text-gray-400 border-white/60 hover:bg-white hover:text-[#E5252A] hover:border-[#E5252A]/20'
          }`}
        >
          <Heart size={13} className={wishlisted ? 'fill-current' : ''} />
        </button>

        {/* Out-of-stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[2px]">
            <span className="bg-black/75 text-white text-[11px] font-black px-4 py-1.5 rounded-full tracking-wide">
              {lang === 'ar' ? 'نفدت الكمية' : 'ÉPUISÉ'}
            </span>
          </div>
        )}

        {/* Add-to-cart hover strip */}
        {!isOutOfStock && (
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <button
              type="button"
              onClick={handleAdd}
              className={`w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-black tracking-wide transition-colors ${
                addedAnim
                  ? 'bg-green-500 text-white'
                  : 'bg-[#E5252A] hover:bg-[#C41E23] text-white'
              }`}
            >
              <ShoppingCart size={13} className={addedAnim ? '' : ''} />
              {addedAnim
                ? (lang === 'ar' ? '✓ تمت الإضافة' : '✓ Ajouté !')
                : (lang === 'ar' ? 'أضف للسلة' : 'Ajouter au panier')}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-2.5 flex flex-col flex-1 gap-1">
        {/* Name */}
        <h3 className="text-gray-800 text-[11px] md:text-xs font-semibold leading-snug line-clamp-2 min-h-[2.2rem] group-hover:text-[#E5252A] transition-colors">
          {name}
        </h3>

        {/* Rating */}
        {reviews > 0 && (
          <div className="flex items-center gap-1">
            <div className="flex text-amber-400">
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={9} className={i <= Math.round(rating) ? 'fill-current' : 'text-gray-200 fill-current'} />
              ))}
            </div>
            <span className="text-[9px] text-gray-500 font-medium">({reviews})</span>
          </div>
        )}

        {/* Pricing */}
        <div className="flex items-baseline gap-1.5 mt-auto">
          <span className="font-black text-[13px] md:text-[15px] leading-none text-[#E5252A]">
            {formatPrice(effectivePrice, lang)}
          </span>
          {isPromo && (
            <span className="text-[10px] text-gray-400 line-through font-medium">
              {formatPrice(product.price, lang)}
            </span>
          )}
        </div>

        {/* Free shipping badge */}
        <span className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5 w-fit border border-green-100">
          <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="1"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>
          {lang === 'ar' ? 'توصيل مجاني' : 'Livraison gratuite'}
        </span>
      </div>
    </Link>
  );
}
