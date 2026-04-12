import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Lang } from '../lib/translations';

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; dir: 'ltr' | 'rtl'; }
const LanguageContext = createContext<LangCtx>({ lang: 'fr', setLang: () => {}, dir: 'ltr' });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('vk_lang') as Lang) || 'fr');

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('vk_lang', l);
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir]);

  return <LanguageContext.Provider value={{ lang, setLang, dir }}>{children}</LanguageContext.Provider>;
}

export function useLang() { return useContext(LanguageContext); }
