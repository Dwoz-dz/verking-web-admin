import React, { useEffect, useMemo, useState } from 'react';
import { X, Mail, Send } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const STORAGE_KEY = 'vk_newsletter_popup_closed_at';
const RESHOW_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_POPUP = {
  enabled: true,
  title_fr: 'Bienvenue chez VERKING SCOLAIRE',
  title_ar: 'مرحبا بك في VERKING SCOLAIRE',
  description_fr: 'Recevez nos nouveautes et offres exclusives par email.',
  description_ar: 'توصل بآخر المنتجات والعروض الحصرية عبر البريد الإلكتروني.',
  email_placeholder_fr: 'Votre email',
  email_placeholder_ar: 'بريدك الإلكتروني',
  button_text_fr: "S'abonner",
  button_text_ar: 'اشتراك',
  success_message_fr: 'Merci, votre inscription est confirmee.',
  success_message_ar: 'شكرا، تم تسجيل اشتراكك بنجاح.',
};

function shouldDisplayPopup() {
  const lastClosedAtRaw = localStorage.getItem(STORAGE_KEY);
  if (!lastClosedAtRaw) {
    return true;
  }

  const lastClosedAt = Number.parseInt(lastClosedAtRaw, 10);
  if (!Number.isFinite(lastClosedAt)) {
    return true;
  }

  return Date.now() - lastClosedAt >= RESHOW_AFTER_MS;
}

function rememberDismiss() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function NewsletterWelcomeModal() {
  const { lang, dir } = useLang();
  const { theme } = useTheme();
  const [popup, setPopup] = useState(DEFAULT_POPUP);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    api.get('/content')
      .then((d) => {
        if (!mounted) return;
        const config = d?.content?.newsletter_popup || {};
        const merged = { ...DEFAULT_POPUP, ...config };
        setPopup(merged);

        if (!merged.enabled) {
          return;
        }

        if (shouldDisplayPopup()) {
          timer = window.setTimeout(() => {
            setOpen(true);
          }, 1000);
        }
      })
      .catch(() => {
        if (!mounted) return;
        if (DEFAULT_POPUP.enabled && shouldDisplayPopup()) {
          timer = window.setTimeout(() => {
            setOpen(true);
          }, 1000);
        }
      });

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const ui = useMemo(() => ({
    title: lang === 'ar' ? popup.title_ar : popup.title_fr,
    description: lang === 'ar' ? popup.description_ar : popup.description_fr,
    placeholder: lang === 'ar' ? popup.email_placeholder_ar : popup.email_placeholder_fr,
    button: lang === 'ar' ? popup.button_text_ar : popup.button_text_fr,
    success: lang === 'ar' ? popup.success_message_ar : popup.success_message_fr,
  }), [lang, popup]);

  const handleClose = () => {
    rememberDismiss();
    setOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      toast.error(lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Veuillez saisir un email valide');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/newsletter/subscribe', {
        email: normalizedEmail,
        locale: lang,
        source: 'welcome_modal',
      });
      setSubscribed(true);
      toast.success(ui.success);
      rememberDismiss();
      window.setTimeout(() => {
        setOpen(false);
      }, 1200);
    } catch {
      toast.error(lang === 'ar' ? 'تعذر الاشتراك حاليا، حاول لاحقا' : "Impossible de s'abonner pour le moment");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" dir={dir}>
      <button
        aria-label="Close newsletter modal"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-lg rounded-[2rem] bg-white p-6 sm:p-8 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${theme.primary_color}15` }}>
          <Mail size={22} style={{ color: theme.primary_color }} />
        </div>

        <h3 className="text-2xl font-black text-gray-900 mb-2">{ui.title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">{ui.description}</p>

        {subscribed ? (
          <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {ui.success}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={ui.placeholder}
                className="w-full rounded-2xl border border-gray-200 py-3 pl-11 pr-4 text-sm font-medium text-gray-800 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-200"
                autoComplete="email"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white transition-all disabled:opacity-60"
              style={{ backgroundColor: theme.primary_color }}
            >
              <Send size={14} />
              {submitting ? (lang === 'ar' ? 'جاري الإرسال...' : 'Envoi...') : ui.button}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
