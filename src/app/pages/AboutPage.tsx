import React, { useEffect, useState } from 'react';
import { Shield, Award, Globe, Users, Target, Rocket, Heart, CheckCircle2 } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { tr } from '../lib/translations';
import { api } from '../lib/api';
import { motion } from 'motion/react';

const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.8, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

export function AboutPage() {
  const { lang, dir } = useLang();
  const { theme } = useTheme();
  const [content, setContent] = useState<any>({});

  useEffect(() => { api.get('/content').then(d => setContent(d.content || {})); }, []);

  const aboutText = lang === 'ar' ? content.about_ar : content.about_fr;

  const values = [
    { icon: Award, label_fr: 'Qualité Premium', label_ar: 'جودة عالية', desc_fr: 'Nos produits sont fabriqués avec des matériaux sélectionnés, testés et certifiés.', desc_ar: 'منتجاتنا مصنوعة من مواد مختارة ومختبرة ومعتمدة.', color: theme.primary_color },
    { icon: Shield, label_fr: 'Fiabilité', label_ar: 'الموثوقية', desc_fr: 'Chaque article est garanti 6 mois contre tout défaut de fabrication.', desc_ar: 'كل منتج مضمون 6 أشهر ضد عيوب التصنيع.', color: theme.accent_color },
    { icon: Globe, label_fr: 'Accessibilité', label_ar: 'الشمولية', desc_fr: 'Nous livrons partout en Algérie avec des prix adaptés à tous les budgets.', desc_ar: 'نوصل في كل أنحاء الجزائر بأسعار تناسب جميع الميزانيات.', color: '#16a34a' },
    { icon: Users, label_fr: 'Communauté', label_ar: 'المجتمع', desc_fr: 'Plus de 10 000 familles algériennes font confiance à VERKING SCOLAIRE.', desc_ar: 'أكثر من 10,000 عائلة جزائرية تثق في VERKING SCOLAIRE.', color: '#9333ea' },
  ];

  const stats = [
    { value: '+60', label_fr: 'Modèles', label_ar: 'موديل' },
    { value: '+10K', label_fr: 'Clients', label_ar: 'عميل' },
    { value: '58', label_fr: 'Wilayas', label_ar: 'ولاية' },
    { value: '6', label_fr: 'Mois de garantie', label_ar: 'ضمان' },
  ];

  return (
    <div dir={dir} style={{ backgroundColor: theme.bg_color }} className="min-h-screen">
      {/* ── HERO ── */}
      <div className="relative overflow-hidden py-24 sm:py-32 bg-gradient-to-br from-black via-neutral-900 to-[#1a0808]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
           <svg className="absolute w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M0 100 C 20 0 50 0 100 100" fill="#E5252A" fillOpacity="0.35" />
           </svg>
        </div>
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-[#E5252A]/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="container mx-auto px-4 relative z-10 text-center text-white">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
             <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E5252A] text-white text-xs font-black uppercase tracking-[0.2em] mb-6 shadow-lg shadow-[#E5252A]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                {lang === 'ar' ? 'من نحن' : 'À propos de nous'}
             </span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-4xl sm:text-6xl font-black mb-6 tracking-tight"
          >
            {tr('about_title', lang)}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-white/80 text-lg sm:text-xl max-w-2xl mx-auto font-medium"
          >
            {lang === 'ar' ? 'علامة جزائرية متخصصة في الأدوات المدرسية عالية الجودة' : 'La marque algérienne de référence pour les fournitures scolaires premium.'}
          </motion.p>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {/* ── STATS BAR ── */}
        <div className="relative -mt-12 mb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {stats.map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}
                className="bg-white rounded-[2rem] p-8 text-center shadow-2xl shadow-blue-900/5 border border-gray-50 group hover:translate-y-[-5px] transition-all"
              >
                <p className="text-4xl font-black mb-2 tracking-tighter text-[#E5252A]">{stat.value}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">{lang === 'ar' ? stat.label_ar : stat.label_fr}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── STORY SECTION ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24 items-center">
          <FadeIn>
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider bg-[#E5252A]/10 text-[#E5252A]">
                <Rocket size={14} /> {lang === 'ar' ? 'قصتنا' : 'Notre Histoire'}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-800 leading-tight">
                {lang === 'ar' ? 'رحلتنا نحو التميز المدرسي' : 'Accompagner l’excellence scolaire en Algérie.'}
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed text-base sm:text-lg">
                <p>
                  {aboutText || (lang === 'ar'
                    ? 'VERKING SCOLAIRE علامة جزائرية متخصصة في الأدوات المدرسية عالية الجودة. تحت العلامة الفرعية STP Stationery، نقدم أكثر من 60 موديلاً من الكرطابلات والمقالم، مصممة لتجمع بين الأناقة والجودة والمتانة.'
                    : 'Fondée avec la mission d’apporter un standard de qualité supérieure sur le marché national, VERKING SCOLAIRE s’est imposée comme le choix privilégié des parents exigeants.'
                  )}
                </p>
                <p className="font-medium text-gray-800 italic">
                  {lang === 'ar' 
                    ? '"كل منتج نصممه هو استثمار في مستقبل أطفالنا."'
                    : '"Chaque produit que nous créons est un investissement dans le futur de nos enfants."'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 {[
                   { label_fr: 'Qualité Certifiée', label_ar: 'جودة معتمدة', icon: CheckCircle2 },
                   { label_fr: 'Design Local', label_ar: 'تصميم محلي', icon: Heart }
                 ].map(item => (
                   <div key={item.label_fr} className="flex items-center gap-2 bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-[#E5252A]/30 transition-colors">
                      <item.icon size={18} className="text-[#E5252A]" />
                      <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                        {lang === 'ar' ? item.label_ar : item.label_fr}
                      </span>
                   </div>
                 ))}
              </div>
            </div>
          </FadeIn>
          
          <FadeIn delay={0.2}>
            <div className="relative">
              <div className="absolute -inset-4 bg-[#E5252A]/10 rounded-[3rem] -rotate-3 z-0" />
              <img
                src="/hero-marcelo.jpg"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=800&q=80'; }}
                alt="VERKING SCOLAIRE"
                className="relative w-full rounded-[2.5rem] shadow-2xl object-cover aspect-[4/3] z-10"
              />
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                className="absolute -bottom-6 -right-6 lg:-right-10 rtl:-right-auto rtl:-left-6 rtl:lg:-left-10 bg-white rounded-3xl p-8 shadow-2xl border border-gray-100 z-20 text-center"
              >
                <p className="text-5xl font-black mb-1 tracking-tighter text-[#E5252A]">2019</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{lang === 'ar' ? 'تأسست في' : 'Fondée en'}</p>
              </motion.div>
            </div>
          </FadeIn>
        </div>

        {/* ── VALUES SECTION ── */}
        <div className="mb-24">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">{tr('our_values', lang)}</h2>
              <div className="w-20 h-1.5 bg-[#E5252A] mx-auto rounded-full" />
            </div>
          </FadeIn>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((val, i) => (
              <FadeIn key={i} delay={0.1 * i}>
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/40 border border-gray-50 text-center h-full group hover:shadow-2xl transition-all h-full flex flex-col items-center">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-xl rotate-[-5deg] group-hover:rotate-0 transition-transform" 
                    style={{ background: `linear-gradient(135deg, ${val.color}, ${val.color}cc)` }}>
                    <val.icon size={26} className="text-white" />
                  </div>
                  <h3 className="font-black text-gray-800 mb-3 uppercase tracking-wider text-sm">{lang === 'ar' ? val.label_ar : val.label_fr}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed font-medium">{lang === 'ar' ? val.desc_ar : val.desc_fr}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>

        {/* ── VISION ── */}
        <FadeIn>
          <div className="bg-gradient-to-br from-black via-neutral-900 to-[#1a0808] rounded-[3rem] p-12 sm:p-20 text-white text-center mb-20 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#E5252A]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
             <div className="absolute bottom-0 left-0 w-56 h-56 bg-amber-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
             <div className="relative z-10 max-w-3xl mx-auto">
               <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E5252A] mb-6 shadow-lg shadow-[#E5252A]/40">
                 <Target size={28} className="text-white" />
               </div>
               <h2 className="text-3xl sm:text-4xl font-black mb-2">
                 {lang === 'ar' ? 'رؤيتنا 2026' : 'Notre Vision 2026'}
               </h2>
               <div className="w-12 h-0.5 bg-amber-400 mx-auto rounded-full mb-6" />
               <p className="text-gray-200 text-lg sm:text-xl font-medium leading-relaxed">
                 {lang === 'ar'
                   ? 'نطمح أن نكون الشريك المفضل للتعليم في الجزائر، من خلال تقديم أدوات مدرسية تكنولوجية ومريحة ومستدامة تدعم تطلعات قادة الغد.'
                   : 'Devenir le partenaire privilégié de l’éducation en Algérie en proposant des solutions scolaires innovantes, ergonomiques et durables.'}
               </p>
             </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
