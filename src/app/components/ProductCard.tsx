import React, { useState } from 'react';
import { Link } from 'react-router';
import { ShoppingCart } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { formatPrice } from '../lib/translations';
import { toast } from 'sonner';

interface Product {
  id: string; name_fr: string; name_ar: string; price: number; sale_price?: number;
  images: string[]; category_id: string; stock: number; is_featured?: boolean;
  is_new?: boolean; is_best_seller?: boolean; is_active?: boolean;
  show_in_promotions?: boolean; rating?: number; review_count?: number;
}

export function ProductCard({ product }: { product: Product }) {
  const { lang } = useLang();
  const { addItem } = useCart();
  const { theme } = useTheme();
  const [addedAnim, setAddedAnim] = useState(false);

  const name = lang === 'ar' ? product.name_ar : product.name_fr;
  const effectivePrice = product.sale_price || product.price;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    setTimeout(() => setAddedAnim(false), 1200);
    toast.success(lang === 'ar' ? 'تمت الإضافة للسلة' : 'Ajouté au panier');
  };

  const isOutOfStock = product.stock === 0;

  // AliExpress-style welcome deal / promo tags
  const isPromo = product.sale_price && product.sale_price < product.price;

  // Fake robust stats to complete the AliExpress look if no real data exists
  const rating = product.rating || 4.8;
  const soldCount = product.review_count ? product.review_count * 15 + '+' : '1000+';

  return (
    <Link
      to={`/product/${product.id}`}
      className="group block relative rounded-xl transition-all overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 border"
      style={{ backgroundColor: theme.card_color, borderColor: theme.border_color }}
    >
      {/* Upper image area */}
      <div className="relative aspect-square bg-[#F5F5F5] overflow-hidden">
        <img
          src={product.images?.[0] || 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=500&q=80'}
          alt={name}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isOutOfStock ? 'opacity-50 grayscale' : ''}`}
        />

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-black/70 text-white font-bold text-xs px-3 py-1 rounded-full">
              {lang === 'ar' ? 'نفدت الكمية' : 'Épuisé'}
            </span>
          </div>
        )}

        {/* Small Cart Button Overlaid (AliExpress style) */}
        {!isOutOfStock && (
          <button
            onClick={handleAdd}
            className={`absolute bottom-2 right-2 rtl:right-auto rtl:left-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all text-white ${addedAnim ? 'bg-green-500 scale-110' : 'hover:opacity-90 hover:scale-110'}`}
            style={addedAnim ? undefined : { backgroundColor: theme.accent_color }}
          >
            <ShoppingCart size={12} className={addedAnim ? 'animate-bounce' : ''} />
          </button>
        )}
      </div>

      {/* Info area - DENSE layout */}
      <div className="p-2 flex flex-col flex-1">

        {/* Title: 2 lines max, very compact */}
        <h3 className="text-gray-800 text-[11px] md:text-xs leading-tight line-clamp-2 min-h-[2.2rem] mb-1">
          {name}
        </h3>

        {/* Tags row: Free shipping or Welcome Deal */}
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {isPromo && (
            <span className="text-white text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: theme.accent_color }}>
              {lang === 'ar' ? 'عرض ترحيبي' : 'Offre de bienvenue'}
            </span>
          )}
          <span className="text-[#008920] border border-[#008920] text-[8px] md:text-[9px] font-bold px-1 py-0.5 rounded-sm">
            {lang === 'ar' ? 'توصيل مجاني' : 'Livraison gratuite'}
          </span>
        </div>

        {/* Price block */}
        <div className="flex items-end gap-1 mb-1">
          <span className="font-extrabold text-[13px] md:text-base leading-none" style={{ color: theme.accent_color }}>
            {formatPrice(effectivePrice, lang)}
          </span>
          {isPromo && (
            <span className="text-[9px] text-gray-400 line-through leading-tight mb-0.5">
              {formatPrice(product.price, lang)}
            </span>
          )}
        </div>

        {/* Social Proof (Stars & Sold) */}
        <div className="mt-auto flex items-center text-[10px] text-gray-500 gap-1.5 font-medium">
          <span className="flex items-center text-amber-500 font-bold">
            <svg className="w-2.5 h-2.5 mr-0.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            {rating}
          </span>
          <span>•</span>
          <span>{soldCount} {lang === 'ar' ? 'مبيع' : 'vendus'}</span>
        </div>
      </div>
    </Link>
  );
}
