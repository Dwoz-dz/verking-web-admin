import React, { useState } from 'react';
import { useParams } from 'react-router';
import { Search, Package, Clock, CheckCircle2, Truck, XCircle, AlertTriangle, Phone, Hash, ChevronRight, User, ArrowLeft, Loader2, Info } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { tr, formatPrice } from '../lib/translations';
import { api, ORDER_STATUSES } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export function TrackOrderPage() {
  const { lang, dir } = useLang();
  const { theme } = useTheme();
  const { id } = useParams(); // Pre-filled order number if any
  
  const [orderNumber, setOrderNumber] = useState(id || '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!orderNumber || !phone) {
      setError(lang === 'ar' ? 'يرجى إدخال رقم الطلب ورقم الهاتف' : 'Veuillez saisir le numéro et le téléphone');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/orders/track?number=${orderNumber.trim()}&phone=${phone.trim()}`);
      if (res.order) {
        setOrder(res.order);
      } else {
        setError(tr('order_not_found', lang));
      }
    } catch (e) {
      setError(tr('order_not_found', lang));
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    return ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];
  };

  const StatusIcon = ({ status, size = 20 }: { status: string, size?: number }) => {
    switch (status) {
      case 'new': return <Clock size={size} />;
      case 'confirmed': return <User size={size} />;
      case 'processing': return <Package size={size} />;
      case 'shipped': return <Truck size={size} />;
      case 'delivered': return <CheckCircle2 size={size} />;
      case 'cancelled': return <XCircle size={size} />;
      default: return <Clock size={size} />;
    }
  };

  return (
    <div dir={dir} style={{ backgroundColor: theme.bg_color }} className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        
        <header className="text-center mb-12">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-20 h-20 rounded-[2.5rem] bg-white shadow-xl flex items-center justify-center mx-auto mb-6 text-blue-600">
            <Search size={32} />
          </motion.div>
          <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tighter">{tr('track_order', lang)}</h1>
          <p className="text-gray-400 font-medium">{tr('track_desc', lang)}</p>
        </header>

        {!order ? (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-[3rem] p-8 sm:p-12 shadow-2xl border border-gray-50 max-w-lg mx-auto">
            <form onSubmit={handleTrack} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase text-gray-400 tracking-widest px-1">{tr('order_number', lang)}</label>
                <div className="relative">
                  <Hash className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
                    placeholder="ORD-XXXXX" 
                    className="w-full pl-12 pr-5 py-5 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-black transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase text-gray-400 tracking-widest px-1">{tr('phone', lang)}</label>
                <div className="relative">
                  <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="05 / 06 / 07..." 
                    className="w-full pl-12 pr-5 py-5 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-black transition-all outline-none"
                  />
                </div>
              </div>

              {error && <p className="text-sm font-bold text-red-500 text-center animate-bounce">{error}</p>}

              <button 
                type="submit" disabled={loading}
                className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                style={{ backgroundColor: theme.primary_color }}
              >
                {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                {lang === 'ar' ? 'بحث' : 'Rechercher'}
              </button>
            </form>
          </motion.div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Simple Back Link */}
            <button onClick={() => setOrder(null)} className="flex items-center gap-2 text-sm font-black text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={16} /> {lang === 'ar' ? 'بحث جديد' : 'Nouvelle recherche'}
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Order Info Sidebar */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none rotate-12"><Package size={100} /></div>
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">{tr('order_number', lang)}</p>
                  <h2 className="text-3xl font-black text-[#1A3C6E] mb-6">{order.order_number}</h2>
                  
                  <div className="space-y-4 pt-6 border-t border-gray-50">
                    <div>
                      <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{lang === 'ar' ? 'التفاصيل' : 'Détails Client'}</p>
                      <p className="font-black text-sm text-gray-800">{order.customer_name}</p>
                      <p className="text-xs font-bold text-gray-400 mt-1">{order.customer_phone}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{lang === 'ar' ? 'المجموع' : 'Total Commande'}</p>
                      <p className="text-2xl font-black" style={{ color: theme.primary_color }}>{formatPrice(order.total, lang)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1A3C6E] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                   <h3 className="text-sm font-black mb-4 relative z-10 flex items-center gap-2">
                     <Info size={16} /> {lang === 'ar' ? 'تحتاج مساعدة؟' : 'Besoin d\'aide ?'}
                   </h3>
                   <p className="text-xs font-bold text-blue-100/70 mb-6 relative z-10 leading-relaxed">
                     {lang === 'ar' ? 'إذا كان لديك أي استفسار حول طلبك، تواصل معنا مباشرة.' : 'Pour toute question sur votre commande, contactez notre support.'}
                   </p>
                   <a href="tel:0555555555" className="px-6 py-3 bg-white text-[#1A3C6E] rounded-xl text-xs font-black inline-flex items-center gap-2 transition-transform group-hover:scale-105 relative z-10">
                      <Phone size={14} /> {lang === 'ar' ? 'اتصل بنا' : 'Appeler support'}
                   </a>
                </div>
              </div>

              {/* Lifecycle & Status Timeline */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Visual Status Highlight */}
                <div className={`p-8 rounded-[3rem] border flex items-center gap-6 shadow-sm overflow-hidden relative group transition-all hover:scale-[1.01] ${getStatusInfo(order.status).color === 'green' ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform"><CheckCircle2 size={120} /></div>
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 shadow-lg ${getStatusInfo(order.status).color === 'green' ? 'bg-emerald-500 text-white' : 'bg-[#1A3C6E] text-white'}`}>
                       <StatusIcon status={order.status} size={32} />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{lang === 'ar' ? 'الحالة الحالية' : 'Statut Actuel'}</p>
                       <h3 className="text-2xl font-black text-gray-900 leading-none">{lang === 'ar' ? getStatusInfo(order.status).label_ar : getStatusInfo(order.status).label_fr}</h3>
                    </div>
                    
                    <div className="ms-auto pt-1">
                       <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-tighter shadow-sm border ${
                          getStatusInfo(order.status).color === 'green' ? 'bg-emerald-100/50 border-emerald-200 text-emerald-700' : 'bg-blue-100/50 border-blue-200 text-blue-700'
                       }`}>
                          {lang === 'ar' ? 'تحديث مباشر' : 'Live Update'}
                       </span>
                    </div>
                 </div>

                {/* Timeline */}
                <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-gray-50 flex flex-col gap-10">
                  {ORDER_STATUSES.slice(0, 5).map((s, idx) => {
                    const statusOrder = ['new', 'confirmed', 'processing', 'shipped', 'delivered'];
                    const currentIdx = statusOrder.indexOf(order.status);
                    const stepIdx = statusOrder.indexOf(s.value);
                    const isPast = stepIdx <= currentIdx;
                    const isCurrent = s.value === order.status;
                    
                    if (order.status === 'cancelled' && s.value === 'delivered') return null;

                    return (
                      <div key={s.value} className="flex gap-6 group">
                        <div className="flex flex-col items-center">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-4 transition-all duration-500 ${isPast ? 'bg-blue-600 border-blue-100 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-200'}`} style={isPast ? { backgroundColor: theme.primary_color, borderColor: theme.primary_color + '20' } : {}}>
                            <StatusIcon status={s.value} size={20} />
                          </div>
                          {idx < 4 && <div className={`w-1 flex-1 my-2 rounded-full transition-colors duration-1000 ${isPast && idx < currentIdx ? 'bg-blue-600' : 'bg-gray-100'}`} style={isPast && idx < currentIdx ? { backgroundColor: theme.primary_color } : {}} />}
                        </div>
                        <div className="pt-2">
                           <h4 className={`text-base font-black transition-colors ${isPast ? 'text-gray-900' : 'text-gray-300'}`}>
                             {lang === 'ar' ? s.label_ar : s.label_fr}
                           </h4>
                           <p className={`text-xs font-bold transition-colors ${isPast ? 'text-gray-400' : 'text-gray-200'}`}>
                             {isCurrent ? (lang === 'ar' ? 'جارٍ العمل على هذا حالياً' : 'C\'est l\'état actuel de votre commande') : isPast ? (lang === 'ar' ? 'مكتمل' : 'Étape complétée') : (lang === 'ar' ? 'خطوة قادمة' : 'Prochaine étape')}
                           </p>
                        </div>
                      </div>
                    );
                  })}

                  {order.status === 'cancelled' && (
                    <div className="flex gap-6 animate-pulse">
                      <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center text-white shadow-lg border-4 border-red-100">
                        <XCircle size={24} />
                      </div>
                      <div className="pt-2">
                        <h4 className="text-base font-black text-red-600">{lang === 'ar' ? 'تم إلغاء الطلب' : 'Commande Annulée'}</h4>
                        <p className="text-xs font-bold text-red-400">{lang === 'ar' ? 'نعتذر، لقد تم إلغاء هذا الطلب.' : 'Désolé, cette commande a été annulée.'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Reviews & Delivery Info */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-gray-50">
                       <h4 className="text-sm font-black text-gray-900 mb-6 flex items-center gap-2">
                          <Package size={16} className="text-blue-600" /> {lang === 'ar' ? 'محتويات الطلب' : 'Contenu du colis'}
                       </h4>
                       <div className="space-y-4 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                          {(order.items || []).map((item: any, i: number) => (
                             <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                                <div className="w-12 h-12 rounded-xl bg-gray-50 overflow-hidden shrink-0 border border-gray-100">
                                   <img src={item.image} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0">
                                   <p className="text-xs font-black text-gray-800 truncate">{lang === 'ar' ? item.name_ar : item.name_fr}</p>
                                   <p className="text-[10px] font-bold text-gray-400 mt-0.5">{item.qty} × {formatPrice(item.price, lang)}</p>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-white rounded-[3rem] p-8 shadow-xl border border-blue-100/50 flex flex-col justify-between">
                       <div>
                          <h4 className="text-sm font-black text-blue-900 mb-2 flex items-center gap-2">
                             <Truck size={16} /> {lang === 'ar' ? 'موعد التسليم' : 'Livraison Estimée'}
                          </h4>
                          <p className="text-xs font-bold text-blue-800/60 mb-8">{lang === 'ar' ? 'نعمل جاهدين لتوصيل طلبك في أسرع وقت ممكن.' : 'Nous faisons tout notre possible pour livrer à temps.'}</p>
                       </div>
                       
                       <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm">
                          <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">{lang === 'ar' ? 'التسليم المتوقع' : 'Date de livraison prévue'}</p>
                          <p className="text-lg font-black text-[#1A3C6E]">{lang === 'ar' ? 'خلال 2 - 5 أيام عمل' : 'Sous 2 à 5 jours ouvrables'}</p>
                       </div>
                    </div>
                 </div>

              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
