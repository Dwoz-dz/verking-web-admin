import React from 'react';
import { Link } from 'react-router';
import { X, ShoppingBag, Tag, ChevronRight, Star } from 'lucide-react';
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
  const visible = !!hotspot;

  if (!hotspot) return null;

  const label = lang === 'ar' ? hotspot.label_ar : hotspot.label_fr;
  const description = lang === 'ar' ? (hotspot.description_ar || '') : (hotspot.description_fr || '');
  const previewProducts = (hotspot.products || []).slice(0, 3);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col"
        style={{
          background: 'linear-gradient(160deg,#0e1225 0%,#0a0c1a 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
        }}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 shrink-0"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: `linear-gradient(135deg, ${hotspot.color}18, transparent)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${hotspot.color}, ${hotspot.color}99)`,
                boxShadow: `0 8px 24px ${hotspot.color}40`,
              }}
            >
              {hotspot.emoji}
            </div>
            <div>
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
                {lang === 'ar' ? 'الفئة' : hotspot.type === 'category' ? 'Catégorie' : 'Produit'}
              </p>
              <h2 className="text-white font-black text-xl leading-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {label}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {description && (
            <p className="text-white/60 text-sm leading-relaxed font-medium">
              {description}
            </p>
          )}

          {/* Stats bar */}
          <div
            className="rounded-2xl p-4 grid grid-cols-2 gap-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
                {lang === 'ar' ? 'المنتجات' : 'Produits'}
              </span>
              <span className="text-white font-black text-2xl">
                {hotspot.products?.length ?? 0}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
                {lang === 'ar' ? 'من' : 'Dès'}
              </span>
              <span className="font-black text-xl" style={{ color: hotspot.color }}>
                {previewProducts.length > 0
                  ? formatPrice(
                      Math.min(...previewProducts.map((p) => p.sale_price || p.price || 0)),
                      lang,
                    )
                  : '—'}
              </span>
            </div>
          </div>

          {/* Preview products */}
          {previewProducts.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
                {lang === 'ar' ? 'منتجات من هذه الفئة' : 'Aperçu produits'}
              </p>
              {previewProducts.map((product) => {
                const name = lang === 'ar' ? product.name_ar : product.name_fr;
                const price = product.sale_price || product.price;
                const isPromo = !!(product.sale_price && product.sale_price < product.price);
                const fallback = 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=120&q=80';
                return (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="flex items-center gap-3 rounded-xl p-3 group transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <img
                      src={product.images?.[0] || fallback}
                      alt={name}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                      onError={(e) => { e.currentTarget.src = fallback; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate group-hover:text-amber-300 transition-colors">
                        {name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-black text-sm" style={{ color: hotspot.color }}>
                          {formatPrice(price, lang)}
                        </span>
                        {isPromo && (
                          <span className="text-white/40 line-through text-xs">
                            {formatPrice(product.price, lang)}
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

        {/* CTA Footer */}
        <div className="p-5 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <Link
            to={hotspot.link}
            className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.14em] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
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

          <Link
            to="/experience"
            className="flex items-center justify-center gap-2 w-full mt-2 py-3 rounded-2xl font-bold text-xs text-white/40 hover:text-white/70 transition-colors"
            onClick={onClose}
          >
            ← {lang === 'ar' ? 'العودة للمعرض' : 'Retour au showroom'}
          </Link>
        </div>
      </div>
    </>
  );
}
