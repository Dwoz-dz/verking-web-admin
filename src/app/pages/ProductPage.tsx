import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  ShoppingCart, MessageCircle, ChevronLeft, ChevronRight, Shield,
  Truck, RotateCcw, Share2, Minus, Plus, Star, CheckCircle2,
  Package, Heart, ArrowLeft, ZoomIn, Tag, Sparkles, TrendingUp,
} from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { tr, formatPrice } from '../lib/translations';
import { api } from '../lib/api';
import { ProductCard } from '../components/ProductCard';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { lang, dir } = useLang();
  const { addItem } = useCart();
  const { theme } = useTheme();
  const [product, setProduct] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [addedAnim, setAddedAnim] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setQty(1);
    setImgIdx(0);
    api.get(`/products/${id}`).then(async d => {
      setProduct(d.product);
      const all = await api.get('/products?active=true');
      setRelated(
        (all.products || [])
          .filter((p: any) => p.category_id === d.product?.category_id && p.id !== id)
          .slice(0, 4)
      );
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-2xl border-4 border-t-[#1A3C6E] border-blue-100 animate-spin" />
        <p className="text-gray-400 text-sm font-bold animate-pulse">
          {lang === 'ar' ? 'جاري التحميل...' : 'Chargement...'}
        </p>
      </div>
    </div>
  );

  if (!product) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <Package size={64} className="mx-auto mb-4 text-gray-200" />
        <p className="font-bold text-gray-500">{lang === 'ar' ? 'المنتج غير موجود' : 'Produit non trouvé'}</p>
        <Link to="/shop" className="inline-block mt-4 text-sm text-[#1A3C6E] font-bold hover:underline">
          ← {lang === 'ar' ? 'العودة للمتجر' : 'Retour à la boutique'}
        </Link>
      </div>
    </div>
  );

  const name = lang === 'ar' ? product.name_ar : product.name_fr;
  const description = lang === 'ar' ? product.description_ar : product.description_fr;
  const effectivePrice = product.sale_price || product.price;
  const discount = product.sale_price
    ? Math.round((1 - product.sale_price / product.price) * 100) : 0;
  const images: string[] = product.images?.length
    ? product.images
    : ['https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=800&q=85'];
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  const handleAdd = () => {
    if (isOutOfStock) return;
    addItem({
      product_id: product.id,
      name_fr: product.name_fr, name_ar: product.name_ar,
      price: product.price, sale_price: product.sale_price,
      image: images[0], qty, stock: product.stock,
    });
    setAddedAnim(true);
    setTimeout(() => setAddedAnim(false), 1500);
    toast.success(lang === 'ar' ? `✓ أضيف ${qty} إلى السلة` : `✓ ${qty} article(s) ajouté(s) au panier`);
  };

  const handleWhatsApp = () => {
    const msg = lang === 'ar'
      ? `مرحباً، أريد طلب: ${product.name_ar} - السعر: ${formatPrice(effectivePrice, lang)} - الكمية: ${qty}`
      : `Bonjour, je souhaite commander: ${product.name_fr} - Prix: ${formatPrice(effectivePrice, lang)} - Quantité: ${qty}`;
    window.open(`https://wa.me/213555123456?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: name, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(lang === 'ar' ? 'تم نسخ الرابط' : 'Lien copié !');
    }
  };

  const badges = [
    product.is_new && { label: lang === 'ar' ? 'جديد' : 'Nouveau', bg: '#1A3C6E', icon: Sparkles },
    product.is_best_seller && { label: lang === 'ar' ? 'الأكثر مبيعاً' : 'Best seller', bg: '#d97706', icon: TrendingUp },
    product.is_featured && { label: lang === 'ar' ? 'مختار' : 'Sélection', bg: '#7c3aed', icon: Star },
  ].filter(Boolean) as { label: string; bg: string; icon: any }[];

  return (
    <div dir={dir} style={{ backgroundColor: theme.bg_color }} className="min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 pt-20 py-4 px-4">
        <div className="container mx-auto max-w-6xl">
          <nav className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
            <Link to="/" className="hover:text-gray-700 transition-colors">{tr('home', lang)}</Link>
            <ChevronRight size={12} className="text-gray-300" />
            <Link to="/shop" className="hover:text-gray-700 transition-colors">{tr('shop', lang)}</Link>
            <ChevronRight size={12} className="text-gray-300" />
            <span className="text-gray-700 truncate max-w-[180px]">{name}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* ── IMAGE GALLERY ── */}
          <div className="space-y-4">
            {/* Main Image */}
            <div
              className="relative aspect-square bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm cursor-zoom-in group"
              onClick={() => setLightboxOpen(true)}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={imgIdx}
                  src={images[imgIdx]}
                  alt={name}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </AnimatePresence>

              {/* Zoom hint */}
              <div className="absolute bottom-4 right-4 bg-black/60 text-white rounded-xl px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                <ZoomIn size={11} /> {lang === 'ar' ? 'تكبير' : 'Agrandir'}
              </div>

              {/* Badges on image */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {discount > 0 && (
                  <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-lg">
                    <Tag size={11} /> -{discount}%
                  </span>
                )}
                {badges.slice(0, 1).map(b => (
                  <span key={b.label} className="inline-flex items-center gap-1 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-lg"
                    style={{ backgroundColor: b.bg }}>
                    <b.icon size={11} /> {b.label}
                  </span>
                ))}
              </div>

              {/* Nav arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); setImgIdx(p => (p - 1 + images.length) % images.length); }}
                    title={lang === 'ar' ? 'الصورة السابقة' : 'Image précédente'}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-110"
                    aria-label={lang === 'ar' ? 'الصورة السابقة' : 'Image précédente'}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setImgIdx(p => (p + 1) % images.length); }}
                    title={lang === 'ar' ? 'الصورة التالية' : 'Image suivante'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-110"
                    aria-label={lang === 'ar' ? 'الصورة التالية' : 'Image suivante'}
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              {/* Image counter */}
              {images.length > 1 && (
                <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full border border-white/10">
                  {imgIdx + 1} / {images.length}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className={`shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all ${
                      i === imgIdx
                        ? 'shadow-md scale-105 border-transparent'
                        : 'border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100'
                    }`}
                    style={i === imgIdx ? { borderColor: theme.primary_color } : {}}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── PRODUCT INFO ── */}
          <div className="flex flex-col gap-5">
            {/* Badges */}
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {badges.map(b => (
                  <span key={b.label}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-black shadow-sm"
                    style={{ backgroundColor: b.bg }}>
                    <b.icon size={11} /> {b.label}
                  </span>
                ))}
              </div>
            )}

            {/* Name */}
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              {name}
            </h1>

            {/* Price block */}
            <div className="flex items-baseline gap-4 flex-wrap">
              <span className="text-4xl font-black leading-none" style={{ color: theme.primary_color }}>
                {formatPrice(effectivePrice, lang)}
              </span>
              {product.sale_price && (
                <>
                  <span className="text-xl text-gray-300 line-through font-semibold">
                    {formatPrice(product.price, lang)}
                  </span>
                  <span className="px-3 py-1 bg-red-100 text-red-600 text-sm font-black rounded-xl">
                    {lang === 'ar' ? `وفر ${discount}%` : `Économisez ${discount}%`}
                  </span>
                </>
              )}
            </div>

            {/* Stock status */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold w-fit ${
              isOutOfStock ? 'bg-red-50 text-red-600 border border-red-200' :
              isLowStock ? 'bg-orange-50 text-orange-600 border border-orange-200' :
              'bg-green-50 text-green-700 border border-green-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-orange-500 animate-pulse' : 'bg-green-500 animate-pulse'
              }`} />
              {isOutOfStock
                ? tr('out_of_stock', lang)
                : isLowStock
                ? (lang === 'ar' ? `آخر ${product.stock} في المخزون` : `Seulement ${product.stock} restant(s)`)
                : tr('in_stock', lang)
              }
            </div>

            {/* Description */}
            {description && (
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-2">
                  {tr('description', lang)}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
              </div>
            )}

            {/* Quantity picker */}
            {!isOutOfStock && (
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-gray-600">{tr('qty', lang)}</span>
                <div className="flex items-center bg-gray-100 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors font-bold text-lg">
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center font-black text-base text-gray-800">{qty}</span>
                  <button
                    onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                    className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors font-bold text-lg">
                    <Plus size={16} />
                  </button>
                </div>
                <span className="text-sm font-bold text-gray-400">
                  / {product.stock} {lang === 'ar' ? 'متوفر' : 'disponibles'}
                </span>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAdd}
                disabled={isOutOfStock}
                title={addedAnim ? (lang === 'ar' ? 'تمت الإضافة' : 'Ajouté') : tr('add_to_cart', lang)}
                className={`w-full py-4 text-white font-black rounded-2xl flex items-center justify-center gap-3 text-base shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  addedAnim
                    ? 'bg-green-600 scale-[0.98]'
                    : 'hover:opacity-90 hover:shadow-xl active:scale-[0.98]'
                }`}
                style={addedAnim ? {} : { backgroundColor: theme.primary_color }}
                aria-label={addedAnim ? (lang === 'ar' ? 'تمت الإضافة' : 'Ajouté') : tr('add_to_cart', lang)}
              >
                {addedAnim ? <CheckCircle2 size={20} /> : <ShoppingCart size={20} />}
                {addedAnim
                  ? (lang === 'ar' ? 'تمت الإضافة ✓' : 'Ajouté au panier ✓')
                  : tr('add_to_cart', lang)
                }
              </button>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/checkout"
                  onClick={handleAdd}
                  className="py-3.5 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm hover:opacity-90 transition-opacity shadow-md"
                  style={{ backgroundColor: theme.accent_color }}>
                  {lang === 'ar' ? 'شراء فوراً' : 'Acheter maintenant'}
                </Link>
                <button
                  onClick={handleWhatsApp}
                  className="py-3.5 bg-[#25D366] hover:bg-[#1ea952] text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm transition-colors shadow-md">
                  <MessageCircle size={15} /> WhatsApp
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setWishlisted(p => !p); toast(wishlisted ? (lang === 'ar' ? 'أُزيل من المفضلة' : 'Retiré des favoris') : '❤ ' + (lang === 'ar' ? 'أضيف للمفضلة' : 'Ajouté aux favoris')); }}
                  className={`flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold border transition-all ${
                    wishlisted ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  <Heart size={14} className={wishlisted ? 'fill-current' : ''} />
                  {lang === 'ar' ? 'المفضلة' : 'Favoris'}
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold border border-gray-200 text-gray-600 hover:border-gray-300 transition-all">
                  <Share2 size={14} />
                  {lang === 'ar' ? 'مشاركة' : 'Partager'}
                </button>
              </div>
            </div>

            {/* Trust Strip */}
            <div className="grid grid-cols-3 gap-3 pt-8 border-t border-gray-100 mt-4">
              {[
                { icon: Shield, labelFr: 'Produit Garanti', labelAr: 'منتج مضمون', color: '#1A3C6E' },
                { icon: Truck, labelFr: 'Livraison Rapide', labelAr: 'توصيل سريع', color: '#16a34a' },
                { icon: RotateCcw, labelFr: 'Échange Facile', labelAr: 'سهولة التبديل', color: '#F57C00' },
              ].map(({ icon: Icon, labelFr, labelAr, color }) => (
                <div key={labelFr} className="flex flex-col items-center text-center gap-3 p-4 rounded-3xl bg-gray-50/50 border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all group">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110" style={{ backgroundColor: color + '15' }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <span className="text-[10px] font-black text-gray-700 leading-tight uppercase tracking-wider">
                    {lang === 'ar' ? labelAr : labelFr}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RELATED PRODUCTS ── */}
        {related.length > 0 && (
          <div className="mt-20">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">
                  {lang === 'ar' ? 'من نفس الفئة' : 'De la même catégorie'}
                </p>
                <h2 className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  {tr('related', lang)}
                </h2>
              </div>
              <Link to="/shop" className="flex items-center gap-2 text-sm font-bold text-[#1A3C6E] hover:gap-3 transition-all">
                {lang === 'ar' ? 'عرض الكل' : 'Voir tout'}
                <ArrowLeft size={14} className="rotate-180" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              {related.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}>
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-5 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center text-xl font-bold transition-colors">
              ✕
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={images[imgIdx]}
              alt={name}
              className="max-w-full max-h-[90vh] object-contain rounded-2xl"
              onClick={e => e.stopPropagation()}
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setImgIdx(p => (p - 1 + images.length) % images.length); }}
                  title={lang === 'ar' ? 'الصورة السابقة' : 'Image précédente'}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center transition-colors"
                  aria-label={lang === 'ar' ? 'الصورة السابقة' : 'Image précédente'}
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setImgIdx(p => (p + 1) % images.length); }}
                  title={lang === 'ar' ? 'الصورة التالية' : 'Image suivante'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center transition-colors"
                  aria-label={lang === 'ar' ? 'الصورة التالية' : 'Image suivante'}
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky mobile CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/80 border-t border-gray-100 p-4 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.1)] backdrop-blur-3xl flex items-center gap-4">
        <div className="flex-1 text-start">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 line-clamp-1">{name}</div>
          <div className="text-lg font-black text-blue-900">{formatPrice(effectivePrice, lang)}</div>
        </div>
        <button
          onClick={handleAdd}
          disabled={isOutOfStock}
          title={addedAnim ? (lang === 'ar' ? 'تمت الإضافة' : 'Ajouté') : tr('add_to_cart', lang)}
          className={`flex-[1.5] py-4 rounded-2xl text-white text-sm font-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${addedAnim ? 'bg-green-600 shadow-green-500/20' : 'shadow-blue-500/20'}`}
          style={addedAnim ? {} : { backgroundColor: theme.primary_color }}
          aria-label={addedAnim ? (lang === 'ar' ? 'تمت الإضافة' : 'Ajouté') : tr('add_to_cart', lang)}
        >
          {addedAnim ? <CheckCircle2 size={18} /> : <ShoppingCart size={18} />}
          {addedAnim ? (lang === 'ar' ? 'تم ✓' : 'Ajouté ✓') : tr('add_to_cart', lang)}
        </button>
      </div>
    </div>
  );
}