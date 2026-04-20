import React, { useEffect, useState } from 'react';
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, MessageCircle, ExternalLink, ChevronRight, Send, Headphones } from 'lucide-react';
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

export function ContactPage() {
  const { lang, dir } = useLang();
  const { theme } = useTheme();
  const [content, setContent] = useState<any>({});

  useEffect(() => {
    api.get('/content').then(d => setContent(d.content || {}));
  }, []);

  const c = {
    address: content.address || 'Rue des Frères Belloul, Bordj El Bahri, Alger 16111',
    phone: content.phone || '+213 555 123 456',
    email: content.email || 'contact@verking-scolaire.dz',
    working_hours: content.working_hours || 'Dim–Jeu: 08h–18h | Ven–Sam: 09h–14h',
    facebook: content.facebook || 'https://facebook.com/verking.scolaire',
    instagram: content.instagram || 'https://instagram.com/verking.scolaire',
    whatsapp: content.whatsapp || '213555123456',
  };

  return (
    <div dir={dir} style={{ backgroundColor: theme.bg_color }} className="min-h-screen">
      {/* ── HEADER ── */}
      <div className="relative overflow-hidden py-20 px-4 bg-gradient-to-br from-black via-neutral-900 to-[#1a0808]">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
           <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M0 0 L 100 100 M 100 0 L 0 100" stroke="#E5252A" strokeWidth="0.5" />
           </svg>
        </div>
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#E5252A]/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="container mx-auto text-center text-white relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
             <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E5252A] text-[10px] font-black uppercase tracking-[0.2em] mb-6 shadow-lg shadow-[#E5252A]/30">
                <Headphones size={14} /> {lang === 'ar' ? 'الدعم والمساعدة' : 'Support & Assistance'}
             </div>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl font-black mb-4 tracking-tight"
          >
            {tr('contact_title', lang)}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-white/80 text-lg sm:text-xl max-w-xl mx-auto font-medium"
          >
            {lang === 'ar' ? 'نحن هنا لإجابة على جميع استفساراتك وطلباتك' : 'Nous sommes à votre entière disposition pour tout renseignement.'}
          </motion.p>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-10 pb-20 relative z-20">
        {/* ── INFO CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {[
            { icon: MapPin, label: tr('our_address', lang), value: c.address, color: '#E5252A', href: `https://maps.google.com/?q=${encodeURIComponent(c.address)}` },
            { icon: Phone, label: lang === 'ar' ? 'الهاتف' : 'Téléphone', value: c.phone, color: '#F59E0B', href: `tel:${c.phone}`, dir: 'ltr' },
            { icon: Mail, label: lang === 'ar' ? 'البريد الإلكتروني' : 'Email Support', value: c.email, color: '#111', href: `mailto:${c.email}` },
            { icon: Clock, label: tr('working_hours', lang), value: c.working_hours, color: '#E5252A' },
          ].map((item, i) => (
            <motion.div 
               key={i}
               initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
               className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-blue-900/5 border border-gray-50 group hover:translate-y-[-5px] transition-all"
            >
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center mb-6 shadow-inner transition-transform group-hover:rotate-12" style={{ backgroundColor: item.color + '10' }}>
                <item.icon size={24} style={{ color: item.color }} />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{item.label}</p>
              {item.href ? (
                <a href={item.href} target={i === 0 ? '_blank' : '_self'} rel="noreferrer"
                  className="text-sm text-gray-800 font-black hover:text-[#E5252A] transition-colors flex items-start gap-1" dir={item.dir}>
                  {item.value}
                  {i === 0 && <ExternalLink size={12} className="mt-1 shrink-0 opacity-40" />}
                </a>
              ) : (
                <p className="text-sm text-gray-800 font-black">{item.value}</p>
              )}
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* ── MAP CONTAINER ── */}
          <div className="lg:col-span-8">
            <FadeIn>
              <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-gray-100 flex flex-col h-full">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#E5252A]/10 flex items-center justify-center">
                         <MapPin size={18} className="text-[#E5252A]" />
                      </div>
                      <h2 className="text-xl font-black text-gray-800 tracking-tight">
                        {lang === 'ar' ? 'صالة العرض والمكتب' : 'Showroom & Bureau'}
                      </h2>
                   </div>
                   <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`}
                    target="_blank" rel="noreferrer"
                    className="text-[10px] font-black uppercase tracking-widest text-[#E5252A] hover:underline flex items-center gap-2"
                  >
                    Google Maps <ChevronRight size={14} />
                  </a>
                </div>
                <div className="flex-1 min-h-[400px]">
                  <iframe
                    src="https://maps.google.com/maps?q=Bordj+El+Bahri+Alger+Algeria&output=embed&z=15"
                    width="100%"
                    height="100%"
                    style={{ border: 0, filter: 'grayscale(0.2) contrast(1.1)' }}
                    allowFullScreen
                    loading="lazy"
                    title="VERKING SCOLAIRE Location"
                  />
                </div>
              </div>
            </FadeIn>
          </div>

          {/* ── SIDE CHANNELS ── */}
          <div className="lg:col-span-4 space-y-8">
            {/* Social Matrix */}
            <FadeIn delay={0.2}>
              <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-gray-100">
                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-gray-400 mb-8">{tr('follow_us', lang)}</h3>
                <div className="space-y-4">
                  {[
                    { icon: Facebook, name: 'Facebook', handle: '@verking.scolaire', href: c.facebook, color: '#1877f2' },
                    { icon: Instagram, name: 'Instagram', handle: '@verking.scolaire', href: c.instagram, color: '#e1306c' },
                    { icon: MessageCircle, name: 'WhatsApp', handle: 'Support Direct', href: `https://wa.me/${c.whatsapp}`, color: '#25d366' },
                  ].map(social => (
                    <a key={social.name} href={social.href} target="_blank" rel="noreferrer"
                      className="group flex items-center gap-4 p-4 rounded-3xl bg-gray-50 hover:bg-[#E5252A] transition-all">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg" style={{ backgroundColor: social.color }}>
                        <social.icon size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-xs text-gray-800 group-hover:text-white transition-colors uppercase tracking-tight">{social.name}</p>
                        <p className="text-[10px] text-gray-500 group-hover:text-white/60 transition-colors font-bold uppercase">{social.handle}</p>
                      </div>
                      <ExternalLink size={14} className="text-gray-300 group-hover:text-white/40" />
                    </a>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* Direct Connect */}
            <FadeIn delay={0.3}>
              <div className="bg-gradient-to-br from-black via-neutral-900 to-[#1a0808] rounded-[3rem] p-10 text-white shadow-2xl shadow-black/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-[#E5252A]/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-400/15 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                <h3 className="font-black text-xs uppercase tracking-[0.2em] opacity-60 mb-6">{lang === 'ar' ? 'تواصل فوري' : 'Contact Direct'}</h3>
                <p className="text-lg font-black leading-tight mb-8">
                  {lang === 'ar' ? 'هل لديك طلب خاص أو استفسار عاجل؟' : 'Une demande urgente ou un devis spécial ?'}
                </p>
                <div className="space-y-4">
                   <a
                    href={`https://wa.me/${c.whatsapp}?text=${encodeURIComponent('Bonjour, je souhaite un devis...')}`}
                    className="flex items-center justify-center gap-2 w-full py-4 bg-green-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-600 transition-all shadow-xl shadow-green-900/20"
                   >
                     <Send size={16} /> WhatsApp Business
                   </a>
                   <a
                    href={`tel:${c.phone}`}
                    className="flex items-center justify-center gap-2 w-full py-4 bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all border border-white/10"
                   >
                     <Phone size={16} /> {c.phone}
                   </a>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}
