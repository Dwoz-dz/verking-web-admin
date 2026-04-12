import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { tr } from '../lib/translations';
import { api } from '../lib/api';

export function FaqPage() {
  const { lang, dir } = useLang();
  const { theme } = useTheme();
  const [content, setContent] = useState<any>({});
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => { api.get('/content').then(d => setContent(d.content || {})); }, []);

  const faqs = content.faq || [];

  return (
    <div dir={dir} style={{ backgroundColor: theme.bg_color }} className="min-h-screen">
      <div className="py-12 px-4" style={{ background: `linear-gradient(135deg, ${theme.primary_color}, ${theme.primary_color}cc)` }}>
        <div className="container mx-auto text-center text-white">
          <h1 className="text-3xl sm:text-4xl font-black mb-3">{tr('faq', lang)}</h1>
          <p className="text-white/75 text-sm max-w-md mx-auto">
            {lang === 'ar' ? 'إجابات على أكثر الأسئلة شيوعاً' : 'Réponses aux questions les plus fréquentes'}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {faqs.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <div className="text-4xl mb-4">❓</div>
            <p>{lang === 'ar' ? 'جاري التحميل...' : 'Chargement...'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq: any, i: number) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between gap-4 text-start"
                >
                  <span className="font-semibold text-gray-800 text-sm leading-snug">
                    {lang === 'ar' ? faq.q_ar : faq.q_fr}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-gray-400 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}
                    style={openIndex === i ? { color: theme.primary_color } : {}}
                  />
                </button>
                {openIndex === i && (
                  <div className="px-6 pb-5 border-t border-gray-50">
                    <p className="text-sm text-gray-600 leading-relaxed pt-4">
                      {lang === 'ar' ? faq.a_ar : faq.a_fr}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Contact CTA */}
        <div className="mt-10 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
          <p className="font-semibold text-gray-800 mb-2">
            {lang === 'ar' ? 'لم تجد إجابتك؟' : 'Vous n\'avez pas trouvé votre réponse ?'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {lang === 'ar' ? 'تواصل معنا مباشرة عبر واتساب أو هاتف.' : 'Contactez-nous directement via WhatsApp ou téléphone.'}
          </p>
          <a
            href="https://wa.me/213555123456"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm transition-colors"
          >
            💬 WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
