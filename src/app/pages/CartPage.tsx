import React from 'react';
import { Link } from 'react-router';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { tr, formatPrice } from '../lib/translations';

export function CartPage() {
  const { lang, dir } = useLang();
  const { items, removeItem, updateQty, total, count, isFreeShipping, progressToFree, freeShippingThreshold, shippingFee } = useCart();
  const { theme } = useTheme();

  const shipping = isFreeShipping ? 0 : shippingFee;
  const finalTotal = total + shipping;

  if (items.length === 0) {
    return (
      <div dir={dir} className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <ShoppingBag size={64} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-600 mb-2">{tr('cart_empty', lang)}</h2>
          <p className="text-gray-400 text-sm mb-6">{lang === 'ar' ? 'لم تضف أي منتج بعد' : 'Vous n\'avez pas encore ajouté de produit'}</p>
          <Link to="/shop"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-bold rounded-2xl hover:opacity-90 transition-opacity"
            style={{ backgroundColor: theme.primary_color }}>
            {tr('continue_shopping', lang)}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} style={{ backgroundColor: theme.bg_color }} className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Checkout Progress Indicator */}
        <div className="flex items-center justify-between mb-10 max-w-sm mx-auto overflow-hidden">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#1A3C6E] text-white flex items-center justify-center font-black text-sm ring-4 ring-blue-50">1</div>
            <span className="text-[10px] font-black uppercase text-gray-900">{tr('cart', lang)}</span>
          </div>
          <div className="flex-1 h-1 bg-gray-100 mx-4 rounded-full" />
          <div className="flex flex-col items-center gap-2 opacity-30">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 text-gray-300 flex items-center justify-center font-black text-sm">2</div>
            <span className="text-[10px] font-black uppercase text-gray-400">{tr('checkout', lang)}</span>
          </div>
          <div className="flex-1 h-1 bg-gray-100 mx-4 rounded-full" />
          <div className="flex flex-col items-center gap-2 opacity-30">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 text-gray-300 flex items-center justify-center font-black text-sm">3</div>
            <span className="text-[10px] font-black uppercase text-gray-400">{lang === 'ar' ? 'تتبع' : 'Suivi'}</span>
          </div>
        </div>

        <h1 className="text-3xl font-black text-gray-900 mb-8 tracking-tighter">
          {tr('cart', lang)} <span className="text-gray-300 ml-2 font-medium">({count})</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map(item => {
              const name = lang === 'ar' ? item.name_ar : item.name_fr;
              const price = item.sale_price || item.price;
              return (
                <div key={item.product_id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-4">
                  <Link to={`/product/${item.product_id}`} className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-50">
                    <img src={item.image || 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=200&q=80'} alt={name} className="w-full h-full object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product_id}`} className="font-black text-gray-900 text-sm leading-snug hover:text-blue-700 transition-colors line-clamp-2 block mb-1">
                      {name}
                    </Link>
                    <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
                      <div className="flex items-center bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden p-0.5">
                        <button 
                          onClick={() => updateQty(item.product_id, item.qty - 1)} 
                          title={lang === 'ar' ? 'نقص الكمية' : 'Diminuer'}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm transition-all rounded-xl"
                          aria-label={lang === 'ar' ? 'نقص الكمية' : 'Diminuer'}
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-10 text-center text-sm font-black">{item.qty}</span>
                        <button 
                          onClick={() => updateQty(item.product_id, item.qty + 1)} 
                          title={lang === 'ar' ? 'زيادة الكمية' : 'Augmenter'}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm transition-all rounded-xl"
                          aria-label={lang === 'ar' ? 'زيادة الكمية' : 'Augmenter'}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-end">
                           <div className="font-black text-base" style={{ color: theme.primary_color }}>
                             {formatPrice(price * item.qty, lang)}
                           </div>
                           {item.sale_price && (
                             <div className="text-[10px] text-gray-400 line-through font-bold">{formatPrice(item.price * item.qty, lang)}</div>
                           )}
                        </div>
                        <button 
                          onClick={() => removeItem(item.product_id)} 
                          title={lang === 'ar' ? 'حذف من السلة' : 'Supprimer'}
                          className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500 rounded-xl transition-all shadow-sm shadow-red-500/10"
                          aria-label={lang === 'ar' ? 'حذف من السلة' : 'Supprimer'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="text-center pt-2">
              <Link to="/shop" className="text-sm font-medium hover:underline" style={{ color: theme.primary_color }}>
                ← {tr('continue_shopping', lang)}
              </Link>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 sticky top-24">
              <h2 className="font-bold text-gray-800 mb-4">{tr('order_summary', lang)}</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>{tr('cart_subtotal', lang)}</span>
                  <span>{formatPrice(total, lang)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{tr('shipping', lang)}</span>
                  <span className={shipping === 0 ? 'text-green-600 font-medium' : ''}>
                    {shipping === 0 ? tr('free_shipping', lang) : formatPrice(shipping, lang)}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-tighter">
                     <span className={isFreeShipping ? 'text-emerald-500' : 'text-gray-400'}>
                        {isFreeShipping ? tr('you_have_free_shipping', lang) : tr('free_shipping_progress', lang).replace('{amount}', (freeShippingThreshold - total).toString())}
                     </span>
                     {!isFreeShipping && <span className="text-blue-600">{Math.round(progressToFree)}%</span>}
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                     <motion.div 
                       initial={{ width: 0 }} 
                       animate={{ width: `${progressToFree}%` }} 
                       className="h-full rounded-full transition-all"
                       style={{ backgroundColor: isFreeShipping ? '#10b981' : theme.primary_color }}
                     />
                  </div>
                  {isFreeShipping && (
                    <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-bold">
                       <CheckCircle2 size={12} /> {lang === 'ar' ? 'لقد وفرت تكاليف الشحن!' : 'Frais de livraison offerts !'}
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex justify-between font-bold text-base">
                    <span>{tr('cart_total', lang)}</span>
                    <span style={{ color: theme.primary_color }}>{formatPrice(finalTotal, lang)}</span>
                  </div>
                </div>
              </div>
              <Link to="/checkout"
                className="mt-5 w-full py-4 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm hover:opacity-90 transition-opacity shadow-lg block text-center"
                style={{ backgroundColor: theme.primary_color }}>
                {tr('checkout', lang)}
                <ArrowRight size={16} />
              </Link>
              {/* Payment Methods */}
              <div className="mt-8 pt-6 border-t border-gray-50 flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 grayscale opacity-40">
                   <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" className="h-4" alt="PayPal" />
                   <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-3" alt="Visa" />
                   <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-5" alt="Mastercard" />
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                   <ShieldCheck size={12} className="text-emerald-500" />
                   {lang === 'ar' ? 'دفع آمن 100%' : 'Paiement 100% sécurisé'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
