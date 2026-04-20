import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/translations';

export const CART_DRAWER_EVENT = 'vk:cart-drawer';

export function openCartDrawer() {
  window.dispatchEvent(new CustomEvent(CART_DRAWER_EVENT, { detail: { open: true } }));
}

export function CartDrawer() {
  const { lang, dir } = useLang();
  const navigate = useNavigate();
  const {
    items, removeItem, updateQty, total, count,
    isFreeShipping, progressToFree, freeShippingThreshold, shippingFee,
  } = useCart();
  const [open, setOpen] = React.useState(false);

  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setOpen(detail?.open ?? true);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener(CART_DRAWER_EVENT, onToggle);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener(CART_DRAWER_EVENT, onToggle);
      window.removeEventListener('keydown', onEsc);
    };
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const close = () => setOpen(false);
  const goCheckout = () => { close(); navigate('/checkout'); };
  const goCart = () => { close(); navigate('/cart'); };

  const remaining = Math.max(0, freeShippingThreshold - total);
  const side = dir === 'rtl' ? 'left-0' : 'right-0';
  const xFrom = dir === 'rtl' ? '-100%' : '100%';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200]" dir={dir}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: xFrom }}
            animate={{ x: 0 }}
            exit={{ x: xFrom }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className={`absolute top-0 ${side} h-full w-[92%] sm:w-[420px] bg-white shadow-2xl flex flex-col`}
            role="dialog"
            aria-modal="true"
            aria-label={lang === 'ar' ? 'السلة' : 'Panier'}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E5252A] text-white flex items-center justify-center shadow-lg shadow-[#E5252A]/20">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 text-lg leading-tight">
                    {lang === 'ar' ? 'سلتك' : 'Votre panier'}
                  </h2>
                  <p className="text-[11px] text-gray-500 font-medium">
                    {count} {lang === 'ar' ? 'منتج' : count > 1 ? 'articles' : 'article'}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                aria-label={lang === 'ar' ? 'إغلاق' : 'Fermer'}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Free shipping progress */}
            {items.length > 0 && (
              <div className="px-5 py-3 bg-amber-50/60 border-b border-amber-100">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold">
                  <Truck size={14} className="text-[#E5252A]" />
                  {isFreeShipping ? (
                    <span className="text-green-700">
                      {lang === 'ar' ? '✓ توصيل مجاني مفعل!' : '✓ Livraison gratuite débloquée !'}
                    </span>
                  ) : (
                    <span className="text-gray-700">
                      {lang === 'ar'
                        ? <>أضف {formatPrice(remaining, lang)} للحصول على توصيل مجاني</>
                        : <>Plus que {formatPrice(remaining, lang)} pour la livraison gratuite</>}
                    </span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ width: `${progressToFree}%` }}
                    transition={{ type: 'spring', damping: 20, stiffness: 120 }}
                    className="h-full bg-gradient-to-r from-amber-400 to-[#E5252A]"
                  />
                </div>
              </div>
            )}

            {/* Items list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                    <ShoppingBag size={36} className="text-gray-300" />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 mb-1">
                    {lang === 'ar' ? 'السلة فارغة' : 'Votre panier est vide'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                    {lang === 'ar' ? 'اكتشف منتجاتنا المميزة' : 'Découvrez nos produits'}
                  </p>
                  <button
                    onClick={() => { close(); navigate('/shop'); }}
                    className="px-6 py-3 bg-[#E5252A] text-white font-bold rounded-2xl hover:bg-[#C41E23] shadow-lg shadow-[#E5252A]/20 transition-all"
                  >
                    {lang === 'ar' ? 'تسوق الآن' : 'Commencer mes achats'}
                  </button>
                </div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {items.map((item) => {
                      const name = lang === 'ar' ? item.name_ar : item.name_fr;
                      const price = item.sale_price || item.price;
                      return (
                        <motion.li
                          key={item.product_id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 40 }}
                          className="flex gap-3 bg-white rounded-2xl border border-gray-100 p-3 hover:border-gray-200 transition-colors"
                        >
                          <Link
                            to={`/product/${item.product_id}`}
                            onClick={close}
                            className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-50 block"
                          >
                            <img
                              src={item.image || 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=200&q=80'}
                              alt={name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/product/${item.product_id}`}
                              onClick={close}
                              className="block font-bold text-sm text-gray-900 line-clamp-2 hover:text-[#E5252A] transition-colors"
                            >
                              {name}
                            </Link>
                            <div className="flex items-baseline gap-1.5 mt-1">
                              <span className="font-black text-sm text-[#E5252A]">
                                {formatPrice(price, lang)}
                              </span>
                              {item.sale_price && (
                                <span className="text-[10px] text-gray-400 line-through">
                                  {formatPrice(item.price, lang)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="inline-flex items-center bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                                <button
                                  onClick={() => updateQty(item.product_id, item.qty - 1)}
                                  disabled={item.qty <= 1}
                                  aria-label="-"
                                  className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-7 text-center text-xs font-black text-gray-900">
                                  {item.qty}
                                </span>
                                <button
                                  onClick={() => updateQty(item.product_id, item.qty + 1)}
                                  disabled={item.qty >= item.stock}
                                  aria-label="+"
                                  className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                              <button
                                onClick={() => removeItem(item.product_id)}
                                aria-label={lang === 'ar' ? 'حذف' : 'Retirer'}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer summary */}
            {items.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4 bg-white space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-medium">
                    {lang === 'ar' ? 'المجموع الفرعي' : 'Sous-total'}
                  </span>
                  <span className="font-black text-gray-900">{formatPrice(total, lang)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-medium">
                    {lang === 'ar' ? 'التوصيل' : 'Livraison'}
                  </span>
                  <span className="font-bold text-gray-800">
                    {isFreeShipping
                      ? <span className="text-green-600">{lang === 'ar' ? 'مجاني' : 'Gratuit'}</span>
                      : formatPrice(shippingFee, lang)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-base pt-2 border-t border-dashed border-gray-200">
                  <span className="font-black text-gray-900">
                    {lang === 'ar' ? 'الإجمالي' : 'Total'}
                  </span>
                  <span className="font-black text-lg text-[#E5252A]">
                    {formatPrice(total + (isFreeShipping ? 0 : shippingFee), lang)}
                  </span>
                </div>
                <button
                  onClick={goCheckout}
                  className="w-full py-3.5 rounded-2xl bg-[#E5252A] text-white font-black text-sm uppercase tracking-wide hover:bg-[#C41E23] shadow-lg shadow-[#E5252A]/25 transition-all flex items-center justify-center gap-2"
                >
                  {lang === 'ar' ? 'إتمام الطلب' : 'Passer commande'}
                  <ArrowRight size={16} className="rtl:rotate-180" />
                </button>
                <button
                  onClick={goCart}
                  className="w-full py-2.5 rounded-2xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200 transition-colors"
                >
                  {lang === 'ar' ? 'عرض السلة الكاملة' : 'Voir le panier complet'}
                </button>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
