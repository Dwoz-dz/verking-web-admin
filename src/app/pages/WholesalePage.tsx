import React, { useState } from 'react';
import { CheckCircle, TrendingUp, Package, Headphones, Star, Building2, ChevronRight, ShieldCheck, ArrowRight, CheckCircle2, Factory } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { tr } from '../lib/translations';
import { api, WILAYAS } from '../lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

export function WholesalePage() {
  const { lang, dir } = useLang();
  const { theme } = useTheme();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ company_name: '', contact_name: '', phone: '', email: '', wilaya: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.company_name.trim()) e.company_name = tr('required', lang);
    if (!form.contact_name.trim()) e.contact_name = tr('required', lang);
    if (!form.phone.trim()) e.phone = tr('required', lang);
    if (!form.wilaya) e.wilaya = tr('required', lang);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/wholesale', form);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { toast.error(lang === 'ar' ? 'حدث خطأ، يرجى المحاولة' : 'Erreur, réessayez'); }
    finally { setLoading(false); }
  };

  const advantages = [
    { icon: Star, label_fr: 'Remises exclusives\njusqu\'à 30%', label_ar: 'تخفيضات حصرية\nحتى 30%', color: '#1A3C6E' },
    { icon: Package, label_fr: 'Commande min.\n50 pièces', label_ar: 'طلب أدنى\n50 قطعة', color: '#F57C00' },
    { icon: TrendingUp, label_fr: 'Tarifs dégressifs\nselon volume', label_ar: 'أسعار تنازلية\nحسب الحجم', color: '#16a34a' },
    { icon: Headphones, label_fr: 'Responsable\ncommercial dédié', label_ar: 'مسؤول تجاري\nmخصص', color: '#9333ea' },
  ];

  const steps = [
    { title_fr: 'Candidature', title_ar: 'تقديم الطلب', desc_fr: 'Remplissez le formulaire ci-dessous avec vos informations.', desc_ar: 'املأ النموذج أدناه بمعلوماتك.' },
    { title_fr: 'Étude', title_ar: 'الدراسة', desc_fr: 'Notre équipe analyse votre demande sous 24h.', desc_ar: 'فريقنا يحلل طلبك في غضون 24 ساعة.' },
    { title_fr: 'Validation', title_ar: 'التفعيل', desc_fr: 'Accès à votre espace grossiste et tarifs pro.', desc_ar: 'الوصول إلى مساحة الجملة والأسعار المخصصة.' },
    { title_fr: 'Première Commande', title_ar: 'أول طلب', desc_fr: 'Lancez votre business avec VERKING SCOLAIRE.', desc_ar: 'ابدأ عملك مع VERKING SCOLAIRE.' },
  ];

  return (
    <div dir={dir} style={{ backgroundColor: theme.bg_color }} className="min-h-screen">
      {/* ── B2B HERO ── */}
      <div className="relative overflow-hidden py-24 px-4 bg-[#1A3C6E]">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
             <defs>
               <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                 <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
               </pattern>
             </defs>
             <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>
        <div className="container mx-auto relative text-center text-white">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 text-xs font-black uppercase tracking-widest mb-6 border border-white/20 backdrop-blur-sm">
              <Factory size={16} />
              {lang === 'ar' ? 'بوابة كبار الموزعين' : 'Portail Partenaires & Grossistes'}
            </div>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl font-black mb-6 tracking-tight"
          >
            {tr('wholesale_title', lang)}
          </motion.h1>
          <motion.p 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
             className="text-white/80 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed font-medium"
          >
            {tr('wholesale_desc', lang)}
          </motion.p>
        </div>
      </div>

      {/* ── ADVANTAGES GRID ── */}
      <div className="container mx-auto px-4 -mt-12 mb-20 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {advantages.map((adv, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
              className="bg-white rounded-[2.5rem] p-8 text-center shadow-2xl shadow-blue-900/10 border border-gray-50 flex flex-col items-center group hover:bg-gray-50 transition-all"
            >
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5 shadow-inner" style={{ backgroundColor: adv.color + '10' }}>
                <adv.icon size={28} style={{ color: adv.color }} />
              </div>
              <p className="font-black text-xs sm:text-sm text-gray-800 whitespace-pre-line leading-relaxed uppercase tracking-wider">{lang === 'ar' ? adv.label_ar : adv.label_fr}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── PARTNERSHIP STEPS ── */}
      <div className="container mx-auto px-4 mb-24">
         <FadeIn>
           <div className="text-center mb-16">
              <h2 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">
                {lang === 'ar' ? 'كيف تصبح شريكاً؟' : 'Devenir partenaire en 4 étapes'}
              </h2>
              <div className="w-20 h-1.5 bg-[#1A3C6E] mx-auto rounded-full" />
           </div>
         </FadeIn>
         
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 relative">
            <div className="hidden lg:block absolute top-10 left-0 right-0 h-0.5 bg-gray-100 -z-0" />
            {steps.map((step, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="relative text-center group">
                   <div className="w-20 h-20 rounded-[2rem] bg-white border-2 border-[#1A3C6E] flex items-center justify-center mx-auto mb-6 relative z-10 group-hover:bg-[#1A3C6E] group-hover:text-white transition-all shadow-xl">
                      <span className="text-3xl font-black italic">{i + 1}</span>
                   </div>
                   <h3 className="font-black text-gray-800 mb-2 uppercase tracking-tight text-sm">{lang === 'ar' ? step.title_ar : step.title_fr}</h3>
                   <p className="text-xs text-gray-500 font-medium px-4">{lang === 'ar' ? step.desc_ar : step.desc_fr}</p>
                </div>
              </FadeIn>
            ))}
         </div>
      </div>

      {/* ── CONTENT SECTION ── */}
      <div className="container mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Info Side */}
          <div className="lg:col-span-5 space-y-8">
            <FadeIn>
              <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-gray-100">
                <h2 className="font-black text-2xl text-gray-800 mb-8 leading-tight">
                  {lang === 'ar' ? 'لماذا تختار VERKING SCOLAIRE للجملة؟' : 'Pourquoi choisir VERKING SCOLAIRE en gros ?'}
                </h2>
                <div className="space-y-6">
                  {[
                    { icon: '📦', title_fr: '+60 modèles disponibles', title_ar: '+60 موديل متوفر', desc_fr: 'Large gamme de cartables et trousses en stock permanent.', desc_ar: 'تشكيلة واسعة من الكرطابلات والمقالم دائمة التوفر.' },
                    { icon: '🛡️', title_fr: 'Garantie Fabrication', title_ar: 'ضمان المصنع', desc_fr: 'Support SAV réactif pour tous nos distributeurs.', desc_ar: 'دعم ما بعد البيع سريع لجميع موزعينا.' },
                    { icon: '🚚', title_fr: 'Expédition Express', title_ar: 'شحن سريع', desc_fr: 'Livraison prioritaire dans toute l\'Algérie.', desc_ar: 'شحن بأولوية عالية في كامل أنحاء الجزائر.' },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 group">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">{item.icon}</div>
                      <div>
                        <p className="font-black text-sm text-gray-800 uppercase tracking-tight">{lang === 'ar' ? item.title_ar : item.title_fr}</p>
                        <p className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">{lang === 'ar' ? item.desc_ar : item.desc_fr}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-12 p-8 rounded-3xl bg-[#1A3C6E]/5 border border-[#1A3C6E]/10">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#1A3C6E] text-white flex items-center justify-center">
                         <ShieldCheck size={20} />
                      </div>
                      <span className="font-black text-xs uppercase tracking-widest text-[#1A3C6E]">Accès Prioritaire</span>
                   </div>
                   <p className="text-xs text-gray-600 font-medium leading-relaxed mb-6">
                      Vous avez déjà un compte grossiste validé ? Contactez votre responsable dédié pour vos commandes rapides.
                   </p>
                   <a
                    href="https://wa.me/213555123456"
                    target="_blank" rel="noreferrer"
                    className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 text-xs transition-all shadow-lg shadow-green-500/20"
                  >
                    💬 WhatsApp {lang === 'ar' ? 'مباشرة' : 'Ligne Grossistes'}
                  </a>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Form Side */}
          <div className="lg:col-span-7">
            <FadeIn delay={0.2}>
              <div className={`bg-white rounded-[3rem] p-10 shadow-2xl border ${submitted ? 'border-green-100' : 'border-gray-50'}`}>
                {submitted ? (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 bg-green-50 border border-green-100 text-green-600">
                      <CheckCircle2 size={56} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-800 mb-4">{tr('request_sent', lang)}</h2>
                    <p className="text-gray-500 font-medium max-w-sm mx-auto">{tr('request_sent_msg', lang)}</p>
                    <button onClick={() => setSubmitted(false)} className="mt-10 text-sm font-black text-[#1A3C6E] uppercase tracking-widest hover:underline flex items-center gap-2 mx-auto">
                        <ArrowRight size={14} /> Envoyer une autre demande
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <div className="mb-10">
                       <h2 className="font-black text-2xl text-gray-800 mb-2 truncate">{tr('submit', lang)}</h2>
                       <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Devenez distributeur agréé</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {[
                          { label: tr('company_name', lang), name: 'company_name', required: true, placeholder: lang === 'ar' ? 'اسم شركتك / محلك' : 'Nom fiscal' },
                          { label: tr('contact_name', lang), name: 'contact_name', required: true, placeholder: lang === 'ar' ? 'اسمك الكامل' : 'Responsable' },
                          { label: 'Mobile', name: 'phone', required: true, placeholder: '+213 xxx xxx xxx' },
                          { label: 'E-mail', name: 'email', placeholder: 'Optionnel' },
                        ].map(field => (
                          <div key={field.name}>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{field.label}{field.required && <span className="text-red-500 ms-1">*</span>}</label>
                            <input
                              type="text"
                              value={(form as any)[field.name]}
                              onChange={e => { setForm(p => ({ ...p, [field.name]: e.target.value })); setErrors(p => ({ ...p, [field.name]: '' })); }}
                              placeholder={field.placeholder}
                              className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1A3C6E]/10 transition-all ${errors[field.name] ? 'border-red-300 bg-red-50/30' : 'border-gray-100 focus:border-[#1A3C6E]'}`}
                            />
                            {errors[field.name] && <p className="text-[10px] text-red-500 mt-1.5 font-bold uppercase tracking-tight px-1">{errors[field.name]}</p>}
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{tr('wilaya', lang)} *</label>
                        <select value={form.wilaya} onChange={e => { setForm(p => ({ ...p, wilaya: e.target.value })); setErrors(p => ({ ...p, wilaya: '' })); }}
                          className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl text-sm font-bold focus:outline-none transition-all ${errors.wilaya ? 'border-red-300' : 'border-gray-100 focus:border-[#1A3C6E]'}`}>
                          <option value="">{lang === 'ar' ? 'اختر الولاية' : 'Sélectionner la wilaya'}</option>
                          {WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                        {errors.wilaya && <p className="text-[10px] text-red-500 mt-1.5 font-bold uppercase tracking-tight px-1">{errors.wilaya}</p>}
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{tr('message', lang)}</label>
                        <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                          placeholder={tr('message_placeholder', lang)} rows={5}
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-[#1A3C6E] resize-none transition-all" />
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full py-5 text-white font-black rounded-3xl text-sm hover:opacity-90 transition-all shadow-2xl shadow-blue-900/10 disabled:opacity-60 overflow-hidden relative"
                        style={{ backgroundColor: theme.primary_color }}>
                        <AnimatePresence mode="wait">
                           {loading ? (
                             <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {lang === 'ar' ? 'جاري الإرسال...' : 'Traitement BI...'}
                             </motion.div>
                           ) : (
                             <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2">
                                {tr('submit', lang)} <ChevronRight size={18} />
                             </motion.div>
                           )}
                        </AnimatePresence>
                      </button>
                    </form>
                  </>
                )}
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}
