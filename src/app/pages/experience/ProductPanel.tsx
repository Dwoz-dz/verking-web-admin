import React from 'react';
import { Link } from 'react-router';
import { ChevronRight, ShoppingBag, X } from 'lucide-react';
import { formatPrice } from '../../lib/translations';

export interface HotspotData {
  id: string;
  label_fr: string;
  label_ar: string;
  description_fr?: string;
  description_ar?: string;
  type: 'category' | 'product';
  link: string;
  color: string;
  emoji: string;
  products?: any[];
}

interface Props {
  hotspot: HotspotData | null;
  lang: 'fr' | 'ar';
  onClose: () => void;
}

export function ProductPanel({ hotspot, lang, onClose }: Props) {
  if (!hotspot) return null;

  const label = lang === 'ar' ? hotspot.label_ar : hotspot.label_fr;
  const description = lang === 'ar'
    ? (hotspot.description_ar || '')
    : (hotspot.description_fr || '');
  const previewProducts = (hotspot.products || []).slice(0, 6);

  const cheapest = previewProducts.length > 0
    ? Math.min(...previewProducts.map((product) => Number(product.sale_price || product.price || 0)))
    : null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col"
        style={{
          background: 'linear-gradient(160deg,#0d1327 0%,#090d1b 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-24px 0 60px rgba(0,0,0,0.6)',
        }}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div
          className="flex items-center justify-between p-5 shrink-0"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: `linear-gradient(135deg, ${hotspot.color}22, transparent)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{
                background: `linear-gradient(135deg, ${hotspot.color}, ${hotspot.color}99)`,
                boxShadow: `0 8px 24px ${hotspot.color}40`,
              }}
            >
              {hotspot.emoji}
            </div>
            <div>
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
                {lang === 'ar' ? 'الفئة' : hotspot.type === 'category' ? 'Categorie' : 'Produit'}
              </p>
              <h2 className="text-white font-black text-xl leading-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {label}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
            aria-label={lang === 'ar' ? 'اغلاق' : 'Fermer'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {description && (
            <p className="text-white/70 text-sm leading-relaxed font-medium">
              {description}
            </p>
          )}

          <div
            className="rounded-2xl p-4 grid grid-cols-2 gap-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-white/45 text-[10px] uppercase tracking-widest font-bold">
                {lang === 'ar' ? 'المنتجات' : 'Produits'}
              </span>
              <span className="text-white font-black text-2xl">
                {hotspot.products?.length ?? 0}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-white/45 text-[10px] uppercase tracking-widest font-bold">
                {lang === 'ar' ? 'يبدا من' : 'Des'}
              </span>
              <span className="font-black text-xl" style={{ color: hotspot.color }}>
                {cheapest !== null ? formatPrice(cheapest, lang) : '—'}
              </span>
            </div>
          </div>

          {previewProducts.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/45 text-[10px] font-bold uppercase tracking-widest">
                {lang === 'ar' ? 'بطاقات منتجات' : 'Cartes produits'}
              </p>

              {previewProducts.map((product) => {
                const name = lang === 'ar'
                  ? (product.name_ar || product.name_fr || 'منتج')
                  : (product.name_fr || product.name_ar || 'Produit');
                const basePrice = Number(product.price || 0);
                const salePrice = Number(product.sale_price || basePrice);
                const isPromo = salePrice > 0 && salePrice < basePrice;
                const finalPrice = salePrice || basePrice;
                const fallback = 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=220&q=80';

                return (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="flex items-center gap-3 rounded-xl p-3 transition-all hover:translate-x-[2px]"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <img
                      src={product.images?.[0] || fallback}
                      alt={name}
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                      onError={(event) => {
                        event.currentTarget.src = fallback;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-black text-sm" style={{ color: hotspot.color }}>
                          {formatPrice(finalPrice, lang)}
                        </span>
                        {isPromo && (
                          <span className="text-white/40 line-through text-xs">
                            {formatPrice(basePrice, lang)}
                          </span>
                        )}
                      </div>
                    </div>
                    {isPromo && (
                      <span className="shrink-0 text-[9px] font-black text-white bg-red-500/80 px-1.5 py-0.5 rounded-full">
                        PROMO
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <Link
            to={hotspot.link}
            className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.12em] transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: `linear-gradient(135deg, ${hotspot.color}, ${hotspot.color}cc)`,
              boxShadow: `0 8px 24px ${hotspot.color}40`,
              color: hotspot.color === '#FFD700' || hotspot.color === '#FFC107' ? '#111' : '#fff',
            }}
          >
            <ShoppingBag size={16} />
            {lang === 'ar' ? `تسوق ${label}` : `Explorer ${label}`}
            <ChevronRight size={15} className={lang === 'ar' ? 'rotate-180' : ''} />
          </Link>

          <button
            type="button"
            className="w-full mt-2 py-2.5 rounded-2xl font-bold text-xs text-white/45 hover:text-white/75 transition-colors"
            onClick={onClose}
          >
            {lang === 'ar' ? 'العودة الى الشوروم' : 'Retour au showroom'}
          </button>
        </div>
      </div>
    </>
  );
}
