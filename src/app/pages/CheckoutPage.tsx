import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { CheckCircle, Package, Truck, Store, ChevronRight, ChevronLeft, ShieldCheck, CreditCard, Info, MapPin, User, ArrowRight, Phone, Mail } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { tr, formatPrice } from '../lib/translations';
import { api, WILAYAS, PAYMENT_METHODS } from '../lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export function CheckoutPage() {
  const { lang, dir } = useLang();
  const { items, total, clearCart, isFreeShipping, shippingFee } = useCart();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [orderDone, setOrderDone] = useState<any>(null);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '',
    customer_wilaya: '', customer_address: '',
    delivery_type: 'delivery', payment_method: 'cash_on_delivery', notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const shipping = form.delivery_type === 'store_pickup' ? 0 : isFreeShipping ? 0 : shippingFee;
  const finalTotal = total + shipping;

  const validatePhone = (phone: string) => {
    // Basic Algerian phone regex (05, 06, 07 followed by 8 digits)
    const regex = /^(0)(5|6|7)[0-9]{8}$/;
    return regex.test(phone.replace(/\s/g, ''));
  };

  const validateStep = (s: number) => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!form.customer_name.trim()) errs.customer_name = tr('required', lang);
      if (!form.customer_phone.trim()) {
        errs.customer_phone = tr('required', lang);
      } else if (!validatePhone(form.customer_phone)) {
        errs.customer_phone = lang === 'ar' ? 'رقم هاتف غير صحيح (05/06/07)' : 'Numéro invalide (05/06/07)';
      }
    }
    if (s === 2) {
      if (form.delivery_type === 'delivery') {
        if (!form.customer_wilaya) errs.customer_wilaya = tr('required', lang);
        if (!form.customer_address.trim()) errs.customer_address = tr('required', lang);
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(p => p + 1);
  };

  const prevStep = () => setStep(p => p - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;
    setLoading(true);
    try {
      const data = await api.post('/orders', {
        ...form,
        status: 'new', // Ensure explicit 'new' status
        items: items.map(i => ({ product_id: i.product_id, name_fr: i.name_fr, name_ar: i.name_ar, price: i.sale_price || i.price, qty: i.qty, image: i.image })),
        subtotal: total, shipping, total: finalTotal,
      });
      setOrderDone(data.order);
      clearCart();
    } catch (e) {
      toast.error(lang === 'ar' ? 'حدث خطأ، يرجى المحاولة مرة أخرى' : 'Une erreur est survenue, réessayez');
    } finally { setLoading(false); }
  };

  if (items.length === 0 && !orderDone) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-6">
            <Package size={40} className="text-gray-300" />
          </motion.div>
          <p className="text-gray-500 font-bold mb-6">{lang === 'ar' ? 'سلتك فارغة حالياً' : 'Votre panier est vide actuellement'}</p>
          <Link to="/shop" className="inline-flex items-center gap-2 px-8 py-4 text-white font-black rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95" style={{ backgroundColor: theme.primary_color }}>
            {tr('shop', lang)} <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  if (orderDone) {
    return (
      <div dir={dir} className="min-h-[80vh] flex items-center justify-center px-4 py-12" style={{ backgroundColor: theme.bg_color }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[3rem] p-10 sm:p-16 max-w-xl w-full text-center shadow-2xl border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
          
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 bg-emerald-50">
            <CheckCircle size={54} className="text-emerald-500" />
          </div>

          <h2 className="text-3xl font-black text-gray-900 mb-3">{tr('order_success', lang)}</h2>
          <p className="text-gray-500 font-medium mb-8 leading-relaxed">{tr('order_success_msg', lang)}</p>
          
          <div className="bg-gray-50 rounded-[2.5rem] p-8 mb-8 border border-gray-100">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">{tr('order_number', lang)}</p>
            <p className="text-4xl font-black tracking-tighter mb-4" style={{ color: theme.primary_color }}>{orderDone.order_number}</p>
            <div className="h-px bg-gray-100 w-full mb-4" />
            <p className="text-sm font-bold text-gray-600">
               {lang === 'ar' ? `سنتصل بك على ${form.customer_phone} للتأكيد.` : `Confirmation par appel au ${form.customer_phone}.`}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Link to={`/track/${orderDone.order_number}`} className="py-5 text-white font-black rounded-[2rem] hover:opacity-90 transition-all shadow-xl shadow-blue-900/10 active:scale-95 block text-center" style={{ backgroundColor: theme.primary_color }}>
              {tr('track_order', lang)}
            </Link>
            <Link to="/shop" className="py-5 border-2 border-gray-100 text-gray-500 font-bold rounded-[2rem] hover:bg-gray-50 transition-all text-center text-sm">
              {tr('continue_shopping', lang)}
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const F = ({ label, name, type = 'text', placeholder = '', required = false, children, icon: Icon }: any) => (
    <div className="space-y-2">
      <label className="block text-[11px] font-black uppercase text-gray-400 tracking-widest px-1">{label}{required && <span className="text-red-500 ms-1">*</span>}</label>
      <div className="relative group">
        {Icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"><Icon size={18} /></div>}
        {children || (
          <input
            type={type}
            value={(form as any)[name]}
            onChange={e => { setForm(p => ({ ...p, [name]: e.target.value })); if (errors[name]) setErrors(p => ({ ...p, [name]: '' })); }}
            placeholder={placeholder}
            className={`w-full ${Icon ? 'pl-11' : 'px-5'} py-4 border-2 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 transition-all bg-white ${errors[name] ? 'border-red-200 bg-red-50 focus:ring-red-100' : 'border-gray-100 focus:border-blue-100 focus:ring-blue-50'}`}
          />
        )}
      </div>
      {errors[name] && <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-[10px] text-red-500 font-bold px-1">{errors[name]}</motion.p>}
    </div>
  );

  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-10 px-2 max-w-sm mx-auto">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-4 transition-all ${step === s ? 'bg-blue-600 border-blue-100 text-white scale-125 shadow-lg' : step > s ? 'bg-emerald-500 border-emerald-50 text-white' : 'bg-white border-gray-100 text-gray-300'}`}
                 style={step === s ? { backgroundColor: theme.primary_color, borderColor: theme.primary_color + '20' } : {}}>
              {step > s ? <CheckCircle size={20} /> : s}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-tighter ${step === s ? 'text-gray-900' : 'text-gray-400'}`}>
              {s === 1 ? tr('step_info', lang) : s === 2 ? tr('step_shipping', lang) : tr('step_payment', lang)}
            </span>
          </div>
          {s < 3 && <div className={`flex-1 h-1 mx-2 rounded-full mb-6 ${step > s ? 'bg-emerald-200' : 'bg-gray-100'}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div dir={dir} style={{ backgroundColor: theme.bg_color }} className="min-h-screen py-10 px-4">
      <div className="container mx-auto max-w-6xl">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Form Content */}
          <div className="lg:col-span-7 xl:col-span-8">
            <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-4xl font-black text-gray-900 mb-2 tracking-tighter">{tr('checkout', lang)}</motion.h1>
            <p className="text-gray-400 font-medium mb-12">{lang === 'ar' ? 'أكمل خطوات طلبك للحصول على أفضل المنتجات' : 'Finalisez vos étapes pour recevoir vos produits.'}</p>

            <StepIndicator />

            <form onSubmit={handleSubmit} className="relative min-h-[400px]">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-gray-50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><User size={20} /></div>
                      <h2 className="text-xl font-black text-gray-800">{tr('personal_info', lang)}</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      <F label={tr('full_name', lang)} name="customer_name" required placeholder={lang === 'ar' ? 'الاسم الكامل' : 'Votre nom complet'} icon={User} />
                      <F label={tr('phone', lang)} name="customer_phone" required placeholder="05 / 06 / 07 xxx..." icon={Phone} />
                      <F label={tr('email', lang)} name="customer_email" type="email" placeholder={lang === 'ar' ? 'البريد الإلكتروني (اختياري)' : 'Email (optionnel)'} icon={Mail} />
                    </div>
                    
                    <button type="button" onClick={nextStep} className="w-full py-5 text-white font-black rounded-[2rem] shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 group" style={{ backgroundColor: theme.primary_color }}>
                      {tr('next', lang)} <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-gray-50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><Truck size={20} /></div>
                      <h2 className="text-xl font-black text-gray-800">{tr('delivery_method', lang)}</h2>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { value: 'delivery', label: tr('home_delivery', lang), icon: <Truck size={20} /> },
                        { value: 'store_pickup', label: tr('store_pickup', lang), icon: <Store size={20} /> },
                      ].map(opt => (
                        <button
                          key={opt.value} type="button"
                          onClick={() => setForm(p => ({ ...p, delivery_type: opt.value }))}
                          className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 text-sm font-black transition-all ${form.delivery_type === opt.value ? 'border-blue-600 text-blue-700 bg-blue-50 shadow-inner' : 'border-gray-100 text-gray-400 hover:border-gray-200 hover:bg-gray-50'}`}
                          style={form.delivery_type === opt.value ? { borderColor: theme.primary_color, color: theme.primary_color, backgroundColor: theme.primary_color + '08' } : {}}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      ))}
                    </div>

                    {form.delivery_type === 'delivery' && (
                      <div className="grid grid-cols-1 gap-6 pt-4 animate-in fade-in duration-500">
                        <F label={tr('wilaya', lang)} name="customer_wilaya" required icon={MapPin}>
                          <select
                            value={form.customer_wilaya}
                            onChange={e => { setForm(p => ({ ...p, customer_wilaya: e.target.value })); if (errors.customer_wilaya) setErrors(p => ({ ...p, customer_wilaya: '' })); }}
                            className={`w-full pl-11 pr-5 py-4 border-2 rounded-2xl text-sm font-black focus:outline-none bg-white appearance-none ${errors.customer_wilaya ? 'border-red-200' : 'border-gray-100 focus:border-blue-100'}`}
                          >
                            <option value="">{lang === 'ar' ? 'اختر الولاية' : 'Choisir la wilaya'}</option>
                            {WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
                          </select>
                        </F>
                        <F label={tr('address', lang)} name="customer_address" required placeholder={lang === 'ar' ? 'النهج، رقم الدار، المجمع السكني...' : 'Rue, N° maison, quartier...'} icon={MapPin} />
                      </div>
                    )}

                    {form.delivery_type === 'store_pickup' && (
                      <div className="bg-blue-50 rounded-[2rem] p-6 text-sm text-blue-700 font-bold border border-blue-100 flex items-start gap-4">
                        <Info size={24} className="shrink-0" />
                        <p>{lang === 'ar' ? 'رجاء التنقل إلى مقرنا: شارع إخوة بلول، برج البحري، الجزائر العاصمة' : 'Veuillez vous présenter à notre siège: Rue des Frères Belloul, Bordj El Bahri, Alger'}</p>
                      </div>
                    )}

                    <div className="flex gap-4">
                      <button type="button" onClick={prevStep} className="flex-1 py-5 text-gray-400 font-bold border-2 border-gray-100 rounded-[2rem] hover:bg-gray-50 transition-all">{tr('back', lang)}</button>
                      <button type="button" onClick={nextStep} className="flex-[2] py-5 text-white font-black rounded-[2rem] shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-2" style={{ backgroundColor: theme.primary_color }}>{tr('next', lang)} <ChevronRight size={20} /></button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-gray-50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><CreditCard size={20} /></div>
                      <h2 className="text-xl font-black text-gray-800">{tr('payment_method', lang)}</h2>
                    </div>

                    <div className="space-y-3">
                      {PAYMENT_METHODS.map(pm => (
                        <button
                          key={pm.value} type="button"
                          onClick={() => setForm(p => ({ ...p, payment_method: pm.value }))}
                          className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 text-sm font-black transition-all text-start relative group ${form.payment_method === pm.value ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-50 text-gray-500 hover:border-gray-100 hover:bg-gray-50'}`}
                          style={form.payment_method === pm.value ? { borderColor: theme.primary_color, color: theme.primary_color, backgroundColor: theme.primary_color + '05' } : {}}
                        >
                          <span className="text-2xl group-hover:scale-110 transition-transform">{pm.icon}</span>
                          <span className="flex-1">{lang === 'ar' ? pm.label_ar : pm.label_fr}</span>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${form.payment_method === pm.value ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200'}`}
                               style={form.payment_method === pm.value ? { backgroundColor: theme.primary_color, borderColor: theme.primary_color } : {}}>
                            {form.payment_method === pm.value && <CheckCircle size={14} />}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="pt-4 space-y-6">
                       <F label={tr('notes', lang)} name="notes" icon={Info}>
                          <textarea 
                            value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))}
                            className="w-full px-5 py-4 border-2 border-gray-100 rounded-[2rem] text-sm focus:outline-none focus:border-blue-100 bg-white resize-none h-24 font-bold"
                            placeholder={tr('notes_placeholder', lang)}
                          />
                       </F>
                       
                       <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 flex flex-col gap-4">
                          <h3 className="text-xs font-black uppercase tracking-widest text-amber-700 flex items-center gap-2">
                             <ShieldCheck size={14} /> {lang === 'ar' ? 'مراجعة نهائية' : 'Révision finale'}
                          </h3>
                          <div className="grid grid-cols-2 gap-4 text-[11px] font-bold text-amber-900/60">
                             <div>
                                <p className="uppercase text-[9px] opacity-50 mb-1">{tr('full_name', lang)}</p>
                                <p className="truncate">{form.customer_name}</p>
                             </div>
                             <div>
                                <p className="uppercase text-[9px] opacity-50 mb-1">{tr('phone', lang)}</p>
                                <p>{form.customer_phone}</p>
                             </div>
                             <div className="col-span-2">
                                <p className="uppercase text-[9px] opacity-50 mb-1">{tr('address', lang)}</p>
                                <p className="truncate">{form.delivery_type === 'store_pickup' ? (lang === 'ar' ? 'استلام من المحل' : 'Retrait en magasin') : `${form.customer_wilaya}, ${form.customer_address}`}</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex gap-4">
                      <button type="button" onClick={prevStep} className="flex-1 py-5 text-gray-400 font-bold border-2 border-gray-100 rounded-[2rem] hover:bg-gray-50 transition-all">{tr('back', lang)}</button>
                      <button type="submit" disabled={loading} className="flex-[2] py-5 text-white font-black rounded-[2rem] shadow-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 group disabled:opacity-50" style={{ backgroundColor: theme.primary_color }}>
                        {loading ? (lang === 'ar' ? 'جاري التأكيد...' : 'Confirmation...') : tr('place_order', lang)} 
                        {!loading && <ShieldCheck size={20} className="group-hover:scale-125 transition-transform" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          {/* Sidebar Area: Summary + Trust */}
          <div className="lg:col-span-5 xl:col-span-4">
             <div className="sticky top-28 space-y-8">
                
                {/* Order Summary Card */}
                <div className="bg-white rounded-[3rem] p-8 shadow-2xl shadow-blue-900/10 border border-gray-50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Package size={120} /></div>
                  <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3">
                    <Package size={20} style={{ color: theme.primary_color }} /> {tr('order_summary', lang)}
                  </h2>
                  
                  <div className="space-y-5 max-h-[30vh] overflow-y-auto mb-8 pr-2 custom-scrollbar">
                    {items.map(item => (
                      <div key={item.product_id} className="flex items-center gap-4 group">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 shrink-0 border border-gray-100 group-hover:scale-105 transition-transform">
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-gray-800 truncate line-clamp-1">{lang === 'ar' ? item.name_ar : item.name_fr}</p>
                          <p className="text-xs font-bold text-gray-400 mt-0.5">{item.qty} × {formatPrice((item.sale_price || item.price), lang)}</p>
                        </div>
                        <p className="text-sm font-black text-gray-900">{formatPrice((item.sale_price || item.price) * item.qty, lang)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 pt-6 border-t-2 border-dashed border-gray-100">
                    <div className="flex justify-between text-sm font-bold text-gray-500">
                      <span>{tr('cart_subtotal', lang)}</span>
                      <span>{formatPrice(total, lang)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-gray-500">
                      <span>{tr('shipping', lang)}</span>
                      <span className={shipping === 0 ? 'text-emerald-500' : ''}>
                        {shipping === 0 ? tr('free_shipping', lang) : formatPrice(shipping, lang)}
                      </span>
                    </div>
                    
                    <div className="h-px bg-gray-100 w-full" />
                    
                    <div className="flex justify-between items-end">
                       <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{tr('cart_total', lang)}</p>
                          <p className="text-3xl font-black tracking-tighter" style={{ color: theme.primary_color }}>{formatPrice(finalTotal, lang)}</p>
                       </div>
                       <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300">
                          <CreditCard size={24} />
                       </div>
                    </div>

                    <div className="mt-6 p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50 flex items-center gap-3">
                       <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                          <Truck size={16} />
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase text-blue-900/40 tracking-widest">{lang === 'ar' ? 'موعد التسليم المتوقع' : 'Livraison estimée'}</p>
                          <p className="text-xs font-bold text-blue-900">{lang === 'ar' ? 'خلال 2 - 5 أيام عمل' : 'Sous 2 à 5 jours ouvrables'}</p>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Trust Signals */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-5 bg-white rounded-3xl border border-gray-50 shadow-sm flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShieldCheck size={20} /></div>
                      <p className="text-[10px] font-black uppercase text-gray-900">{lang === 'ar' ? 'أمان تام' : 'Sécurité'}</p>
                   </div>
                   <div className="p-5 bg-white rounded-3xl border border-gray-50 shadow-sm flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Truck size={20} /></div>
                      <p className="text-[10px] font-black uppercase text-gray-900">{lang === 'ar' ? 'شحن موثوق' : 'Livraison'}</p>
                   </div>
                </div>

             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
