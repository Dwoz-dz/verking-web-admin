// /admin/home/hero — Dedicated Hero sub-page.
// Collects the three hero controls into one focused screen:
//   1. Gestionnaire du Hero Carousel  (slides + animation)
//   2. Hero text-card overlay master toggle
//   3. Short headline inputs (title / subtitle / CTA) — wired to draftConfig
// All writes route through useHomepageConfig so the Hub, storefront, and
// legacy /admin/homepage stay in sync.
import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Send,
  RotateCcw,
  CheckCircle2,
  ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { HeroCarouselManager } from '../../../components/admin/HeroCarouselManager';
import {
  DEFAULT_HERO_ANIMATION,
  CarouselAnimationConfig,
} from '../../../lib/carouselAnimation';
import { useLang } from '../../../context/LanguageContext';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SECTION_META } from './shared/meta';
import { BackgroundField } from './shared/media/BackgroundField';

type SavingState = 'idle' | 'saving' | 'saved' | 'error';

export default function HeroSection() {
  const { lang } = useLang();
  const hub = useHomepageConfig();

  const [heroAnimSavingState, setHeroAnimSavingState] = useState<SavingState>('idle');
  const [heroAnimSavedAt, setHeroAnimSavedAt] = useState<number | null>(null);
  const [overlaySavingState, setOverlaySavingState] = useState<SavingState>('idle');
  const [overlaySavedAt, setOverlaySavedAt] = useState<number | null>(null);

  if (hub.loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    );
  }

  const meta = SECTION_META.hero;
  const hero = hub.draftConfig.hero;
  const heroOverlayGlobal = hero?.show_text_overlay_global !== false;

  const handleHeroAnimationChange = async (cfg: CarouselAnimationConfig) => {
    hub.updateSection('hero', { hero_animation: cfg });
    setHeroAnimSavingState('saving');
    try {
      await hub.persistSectionPartial('hero', { hero_animation: cfg });
      setHeroAnimSavingState('saved');
      setHeroAnimSavedAt(Date.now());
    } catch {
      setHeroAnimSavingState('error');
    }
  };

  const handleOverlayToggle = async (next: boolean) => {
    hub.updateSection('hero', { show_text_overlay_global: next });
    setOverlaySavingState('saving');
    try {
      await hub.persistSectionPartial('hero', { show_text_overlay_global: next });
      setOverlaySavingState('saved');
      setOverlaySavedAt(Date.now());
    } catch {
      setOverlaySavingState('error');
      toast.error(lang === 'ar' ? 'فشل حفظ الإعداد' : 'Sauvegarde échouée');
    }
  };

  const handleEnabledToggle = async (next: boolean) => {
    hub.updateSection('hero', { enabled: next });
    try {
      await hub.persistSectionPartial('hero', { enabled: next });
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحفظ' : 'Sauvegarde échouée');
    }
  };

  const handleReset = () => {
    if (!window.confirm(lang === 'ar'
      ? 'إعادة تعيين قسم Hero؟ ستفقد التغييرات غير المنشورة.'
      : 'Réinitialiser la section Hero ? Les modifications non publiées seront perdues.')) return;
    hub.resetSection('hero');
    toast.success(lang === 'ar' ? 'تمت إعادة تعيين Hero' : 'Hero réinitialisé');
  };

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* ─── Breadcrumb + header ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/home"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            aria-label={lang === 'ar' ? 'رجوع' : 'Retour'}
          >
            <ArrowLeft size={16} className={lang === 'ar' ? 'rotate-180' : ''} />
          </Link>
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: meta.color }}
          >
            <ImageIcon size={20} />
          </span>
          <div>
            <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">
              {lang === 'ar' ? meta.labelAr : meta.labelFr}
            </h1>
            <p className="text-xs text-gray-600">
              {lang === 'ar' ? meta.hintAr : meta.hintFr}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-sm hover:bg-gray-50"
          >
            <RotateCcw size={14} />
            {lang === 'ar' ? 'إعادة تعيين' : 'Réinitialiser'}
          </button>
          <button
            type="button"
            onClick={hub.saveDraft}
            disabled={hub.savingDraft}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {hub.savingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {lang === 'ar' ? 'حفظ مسودة' : 'Brouillon'}
          </button>
          <button
            type="button"
            onClick={hub.publish}
            disabled={hub.publishing || !hub.canPublish}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {hub.publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {lang === 'ar' ? 'نشر' : 'Publier'}
          </button>
        </div>
      </div>

      {/* Status line */}
      {hub.statusLine && (
        <p className="text-[11px] font-semibold text-gray-500">{hub.statusLine}</p>
      )}

      {/* ─── Enabled toggle ──────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-sm font-black text-gray-900">
            {lang === 'ar' ? 'تفعيل القسم' : 'Section activée'}
          </h3>
          <p className="text-xs text-gray-600">
            {lang === 'ar'
              ? 'عند الإيقاف، لن يظهر الـ Hero على الصفحة الرئيسية.'
              : 'Désactivez pour masquer le Hero de la homepage.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleEnabledToggle(!hero.enabled)}
          className={[
            'relative h-7 w-12 rounded-full transition-colors',
            hero.enabled ? 'bg-blue-600' : 'bg-gray-300',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
              hero.enabled ? (lang === 'ar' ? 'right-0.5' : 'left-[22px]') : (lang === 'ar' ? 'right-[22px]' : 'left-0.5'),
            ].join(' ')}
          />
        </button>
      </div>

      {/* ─── Overlay master toggle ───────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-sky-200/60 bg-gradient-to-br from-white via-sky-50/70 to-indigo-50/50 p-5 shadow-[0_10px_30px_-20px_rgba(30,64,175,0.35)]"
      >
        <div className="pointer-events-none absolute -top-16 -end-16 h-40 w-40 rounded-full bg-gradient-to-br from-sky-200/70 to-transparent blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={[
                'inline-flex h-11 w-11 items-center justify-center rounded-xl',
                heroOverlayGlobal
                  ? 'bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-md'
                  : 'bg-gray-200 text-gray-500',
              ].join(' ')}
            >
              {heroOverlayGlobal ? <Eye size={20} /> : <EyeOff size={20} />}
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-black leading-tight text-gray-900">
                {lang === 'ar' ? 'بطاقة العنوان فوق الفيديو' : 'Carte de titre sur la vidéo'}
              </h3>
              <p className="mt-0.5 max-w-xl text-xs leading-snug text-gray-600">
                {lang === 'ar'
                  ? 'شغّل أو أطفئ نافذة "Nouvelle Collection" البيضاء التي تظهر فوق الفيديو/الصورة. عند الإطفاء، يُعرض الوسيط بكامل شاشة البطل دون أي نص.'
                  : 'Activez ou désactivez la carte blanche "Nouvelle Collection" qui s’affiche au-dessus de la vidéo/image. Quand elle est désactivée, le média occupe tout le hero sans aucun texte superposé.'}
              </p>
              {overlaySavingState !== 'idle' && (
                <p className="mt-1 text-[11px] font-semibold text-sky-700">
                  {overlaySavingState === 'saving' && (lang === 'ar' ? 'جارٍ الحفظ…' : 'Sauvegarde…')}
                  {overlaySavingState === 'saved' && (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      {lang === 'ar' ? 'تم الحفظ' : 'Enregistré'}
                    </span>
                  )}
                  {overlaySavingState === 'error' && (lang === 'ar' ? 'خطأ في الحفظ' : 'Erreur de sauvegarde')}
                  {overlaySavedAt && overlaySavingState === 'saved' && (
                    <span className="ms-2 opacity-60">
                      {new Date(overlaySavedAt).toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleOverlayToggle(!heroOverlayGlobal)}
            className={[
              'relative h-8 w-14 rounded-full transition-colors',
              heroOverlayGlobal ? 'bg-gradient-to-br from-sky-500 to-indigo-500' : 'bg-gray-300',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 h-7 w-7 rounded-full bg-white shadow transition-all',
                heroOverlayGlobal ? (lang === 'ar' ? 'right-0.5' : 'left-[26px]') : (lang === 'ar' ? 'right-[26px]' : 'left-0.5'),
              ].join(' ')}
            />
          </button>
        </div>
      </div>

      {/* ─── Headline fields ─────────────────────────────────── */}
      {heroOverlayGlobal && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-black text-gray-900">
            {lang === 'ar' ? 'نص البطاقة البيضاء' : 'Contenu de la carte blanche'}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <LangInput
              label={lang === 'ar' ? 'العنوان (عربي)' : 'Titre (AR)'}
              value={hero.title_ar}
              dir="rtl"
              onChange={(v) => hub.updateSection('hero', { title_ar: v })}
            />
            <LangInput
              label={lang === 'ar' ? 'العنوان (فرنسي)' : 'Titre (FR)'}
              value={hero.title_fr}
              onChange={(v) => hub.updateSection('hero', { title_fr: v })}
            />
            <LangInput
              label={lang === 'ar' ? 'العنوان الفرعي (عربي)' : 'Sous-titre (AR)'}
              value={hero.subtitle_ar}
              dir="rtl"
              onChange={(v) => hub.updateSection('hero', { subtitle_ar: v })}
            />
            <LangInput
              label={lang === 'ar' ? 'العنوان الفرعي (فرنسي)' : 'Sous-titre (FR)'}
              value={hero.subtitle_fr}
              onChange={(v) => hub.updateSection('hero', { subtitle_fr: v })}
            />
            <LangInput
              label={lang === 'ar' ? 'زر النداء (عربي)' : 'CTA (AR)'}
              value={hero.cta_ar}
              dir="rtl"
              onChange={(v) => hub.updateSection('hero', { cta_ar: v })}
            />
            <LangInput
              label={lang === 'ar' ? 'زر النداء (فرنسي)' : 'CTA (FR)'}
              value={hero.cta_fr}
              onChange={(v) => hub.updateSection('hero', { cta_fr: v })}
            />
            <div className="md:col-span-2">
              <LangInput
                label={lang === 'ar' ? 'رابط زر النداء' : 'Lien du CTA'}
                value={hero.cta_link}
                placeholder="/shop"
                onChange={(v) => hub.updateSection('hero', { cta_link: v })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Hero Carousel Manager ───────────────────────────── */}
      <HeroCarouselManager
        heroAnimation={hero?.hero_animation || DEFAULT_HERO_ANIMATION}
        onHeroAnimationChange={handleHeroAnimationChange}
        animationSavedAt={heroAnimSavedAt}
        animationSavingState={heroAnimSavingState}
      />

      {/* ─── Section background (Fond de section) ─────────────
          The Hero already has its own slide carousel. The "Fond de
          section" block here is the OUTER section background — i.e.
          what the storefront SectionMediaBackdrop renders BEHIND the
          Hero panel. Most admins leave this on "Aucun fond" and rely
          on the Hero slides themselves; the option is exposed for
          parity with every other homepage section. */}
      <BackgroundField
        image={hero?.image || ''}
        images={hero?.images || []}
        onChange={(next) => {
          hub.updateSection('hero', { image: next.image, images: next.images });
          hub.persistSectionPartial('hero', { image: next.image, images: next.images })
            .catch(() => {
              /* error toast already surfaced inside persistSectionPartial */
            });
        }}
        media={hub.media}
        lang={lang as 'fr' | 'ar'}
        aspectClass="aspect-[16/7]"
      />
    </div>
  );
}

// ── Tiny text input helper — keeps the file compact & DRY ────────────
function LangInput({
  label,
  value,
  onChange,
  dir,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: 'ltr' | 'rtl';
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-gray-700">{label}</span>
      <input
        type="text"
        dir={dir}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}
