import React from 'react';
import { Link } from 'react-router';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export function NotFoundPage() {
  const { lang, dir } = useLang();
  const { theme } = useTheme();
  return (
    <div dir={dir} className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-black mb-4" style={{ color: theme.primary_color + '30' }}>404</div>
        <h1 className="text-2xl font-black text-gray-800 mb-3">
          {lang === 'ar' ? 'الصفحة غير موجودة' : 'Page introuvable'}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {lang === 'ar' ? 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.' : 'La page que vous recherchez n\'existe pas ou a été déplacée.'}
        </p>
        <Link to="/" className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-bold rounded-2xl hover:opacity-90 transition-opacity shadow-lg" style={{ backgroundColor: theme.primary_color }}>
          {lang === 'ar' ? '← العودة للرئيسية' : '← Retour à l\'accueil'}
        </Link>
      </div>
    </div>
  );
}
