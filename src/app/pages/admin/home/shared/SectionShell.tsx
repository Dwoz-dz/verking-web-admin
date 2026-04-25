// Common shell for every /admin/home/<slug> sub-page. Renders:
//   • the breadcrumb (← back to Hub)
//   • the colored section badge + localized title/subtitle
//   • the action toolbar (Brouillon / Réinitialiser / Publier)
//   • a two-column body: editor on the left, live preview sticky on the right
//     (stacked on mobile so the admin can still see both)
// All writes go through the passed-in useHomepageConfig instance so every
// section page has identical toolbar behavior. Children = editor body.
import React from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Save, Send, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLang } from '../../../../context/LanguageContext';
import type { SectionKey } from './types';
import { SECTION_META } from './meta';
import type { UseHomepageConfig } from './useHomepageConfig';
import { SectionPreview } from './preview/SectionPreview';
import { SectionErrorBoundary } from './SectionErrorBoundary';

type Props = {
  sectionKey: SectionKey;
  hub: UseHomepageConfig;
  /** Optional banner rendered above the enabled toggle */
  topBanner?: React.ReactNode;
  /** Editor body */
  children: React.ReactNode;
  /** Hide the live preview column (e.g. for Hero which has its own preview) */
  hidePreview?: boolean;
};

export function SectionShell({ sectionKey, hub, topBanner, children, hidePreview = false }: Props) {
  const { lang } = useLang();
  const meta = SECTION_META[sectionKey];
  const Icon = meta.icon;

  if (hub.loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    );
  }

  const handleReset = () => {
    if (!window.confirm(lang === 'ar'
      ? `إعادة تعيين قسم "${meta.labelAr}"؟ ستفقد التغييرات غير المنشورة.`
      : `Réinitialiser la section "${meta.labelFr}" ? Les modifications non publiées seront perdues.`)) return;
    hub.resetSection(sectionKey);
    toast.success(lang === 'ar' ? `تمت إعادة تعيين ${meta.labelAr}` : `${meta.labelFr} réinitialisé`);
  };

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Breadcrumb + header */}
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
            <Icon size={20} />
          </span>
          <div className="min-w-0">
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

      {hub.statusLine && (
        <p className="text-[11px] font-semibold text-gray-500">{hub.statusLine}</p>
      )}

      {topBanner}

      {/* 2-column body: editor + sticky preview. Each column is wrapped
          in its own error boundary so a crash inside the editor does NOT
          take out the preview (and vice versa). The reset button hooks
          into hub.resetSection so admins can roll back a corrupted draft
          without leaving the page. */}
      <div className={hidePreview
        ? 'space-y-6'
        : 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'}>
        <div className="min-w-0 space-y-6">
          <EnabledCard sectionKey={sectionKey} hub={hub} />
          <SectionErrorBoundary
            sectionLabel={lang === 'ar' ? meta.labelAr : meta.labelFr}
            lang={lang as 'fr' | 'ar'}
            onResetSection={() => hub.resetSection(sectionKey)}
          >
            {children}
          </SectionErrorBoundary>
        </div>

        {!hidePreview && (
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <SectionErrorBoundary
              sectionLabel={lang === 'ar' ? meta.labelAr : meta.labelFr}
              lang={lang as 'fr' | 'ar'}
              onResetSection={() => hub.resetSection(sectionKey)}
            >
              <SectionPreview sectionKey={sectionKey} hub={hub} lang={lang as 'fr' | 'ar'} />
            </SectionErrorBoundary>
            <p className="text-[11px] text-gray-500">
              {lang === 'ar'
                ? 'المعاينة تُحدَّث تلقائياً مع كل تغيير. اضغط "نشر" لتطبيقها على الموقع.'
                : 'L’aperçu se met à jour à chaque modification. Cliquez sur Publier pour l’envoyer sur le site.'}
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

function EnabledCard({ sectionKey, hub }: { sectionKey: SectionKey; hub: UseHomepageConfig }) {
  const { lang } = useLang();
  const section = hub.draftConfig[sectionKey];
  const meta = SECTION_META[sectionKey];

  const handleToggle = async () => {
    const next = !section.enabled;
    hub.updateSection(sectionKey, { enabled: next });
    try {
      await hub.persistSectionPartial(sectionKey, { enabled: next });
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحفظ' : 'Sauvegarde échouée');
    }
  };

  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'تفعيل القسم' : 'Section activée'}
        </h3>
        <p className="text-xs text-gray-600">
          {lang === 'ar'
            ? `عند الإيقاف، لن يظهر "${meta.labelAr}" على الصفحة الرئيسية.`
            : `Désactivez pour masquer "${meta.labelFr}" de la homepage.`}
        </p>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        className={[
          'relative h-7 w-12 rounded-full transition-colors',
          section.enabled ? 'bg-blue-600' : 'bg-gray-300',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
            section.enabled
              ? (lang === 'ar' ? 'right-0.5' : 'left-[22px]')
              : (lang === 'ar' ? 'right-[22px]' : 'left-0.5'),
          ].join(' ')}
        />
      </button>
    </div>
  );
}
