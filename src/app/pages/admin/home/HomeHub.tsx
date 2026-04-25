// /admin/home — Homepage Hub.
// Single source of truth for the whole Page d'accueil experience:
//   • 10 section cards (one per SectionKey), order reflects draftConfig.sections_order
//   • drag-and-drop + up/down buttons to reorder (mirrors live storefront render order)
//   • per-card enable toggle → auto-persists via persistSectionPartial
//   • global toolbar: save draft, publish, discard local state, status line
//   • health banner: unpublished draft warning, error + warning surfaces
// Each "Gérer →" CTA routes to /admin/home/<slug> if the section has a
// dedicated page, otherwise falls back to /admin/homepage#section-<key>
// so the legacy editor remains a safety net while we port sections one by one.
import React, { useState } from 'react';
import { Save, Send, RotateCcw, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { useLang } from '../../../context/LanguageContext';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SectionCard } from './shared/SectionCard';
import type { SectionKey } from './shared/types';

export default function HomeHub() {
  const { lang } = useLang();
  const hub = useHomepageConfig();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (hub.loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    );
  }

  const order = hub.draftConfig.sections_order;
  const enabledCount = order.filter((key) => hub.draftConfig[key].enabled).length;

  const handleToggleEnabled = async (sectionKey: SectionKey, next: boolean) => {
    hub.updateSection(sectionKey, { enabled: next });
    await hub.persistSectionPartial(sectionKey, { enabled: next });
  };

  const handleClearSync = () => {
    if (!window.confirm(lang === 'ar'
      ? 'حذف المسودة المحلية واستعادة الإصدار المنشور؟ هذا الإجراء لا رجعة فيه.'
      : 'Supprimer le brouillon local et restaurer la version publiée ? Cette action est irréversible.')) return;
    hub.clearSyncState();
  };

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">
            {lang === 'ar' ? 'الصفحة الرئيسية' : 'Page d’accueil'}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {lang === 'ar'
              ? `إدارة أقسام الصفحة الرئيسية — ${enabledCount} من ${order.length} مفعّلة`
              : `Pilotez chaque section de la home — ${enabledCount}/${order.length} actives`}
          </p>
          {hub.statusLine && (
            <p className="mt-1 text-[11px] font-semibold text-gray-500">{hub.statusLine}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={handleClearSync}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-sm hover:bg-gray-50"
            title={lang === 'ar' ? 'مسح الحالة المحلية' : 'Nettoyer l’état local'}
          >
            <RotateCcw size={14} />
            {lang === 'ar' ? 'تنظيف' : 'Nettoyer'}
          </button>
          <button
            type="button"
            onClick={hub.reload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-sm hover:bg-gray-50"
          >
            <RefreshCw size={14} />
            {lang === 'ar' ? 'تحديث' : 'Recharger'}
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

      {/* Draft-ahead warning */}
      {hub.hasDraftAhead && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="shrink-0 text-lg">⚠️</span>
          <span className="font-semibold">
            {lang === 'ar'
              ? 'مسودة محلية غير منشورة — التغييرات ليست مرئية على الموقع بعد.'
              : 'Brouillon local non publié — les modifications ne sont pas encore visibles sur le site.'}
          </span>
          <button
            type="button"
            onClick={hub.publish}
            disabled={hub.publishing}
            className="ms-auto shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {lang === 'ar' ? 'نشر الآن' : 'Publier maintenant'}
          </button>
        </div>
      )}

      {/* Errors / warnings from validator */}
      {(hub.liveErrors.length > 0 || hub.liveWarnings.length > 0) && (
        <div className="space-y-2">
          {hub.liveErrors.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="mb-2 flex items-center gap-2 font-black">
                <AlertTriangle size={16} />
                <span>
                  {lang === 'ar'
                    ? `أخطاء (${hub.liveErrors.length}) — النشر محجوب`
                    : `Erreurs (${hub.liveErrors.length}) — la publication est bloquée`}
                </span>
              </div>
              <ul className="list-inside list-disc space-y-1 text-xs">
                {hub.liveErrors.slice(0, 6).map((err, idx) => (
                  <li key={`err-${idx}`}>{err.messageFr}</li>
                ))}
                {hub.liveErrors.length > 6 && (
                  <li className="opacity-70">… +{hub.liveErrors.length - 6}</li>
                )}
              </ul>
            </div>
          )}
          {hub.liveWarnings.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="mb-2 flex items-center gap-2 font-black">
                <AlertTriangle size={16} />
                <span>
                  {lang === 'ar'
                    ? `تنبيهات (${hub.liveWarnings.length})`
                    : `Avertissements (${hub.liveWarnings.length})`}
                </span>
              </div>
              <ul className="list-inside list-disc space-y-1 text-xs">
                {hub.liveWarnings.slice(0, 6).map((warn, idx) => (
                  <li key={`warn-${idx}`}>{warn.messageFr}</li>
                ))}
                {hub.liveWarnings.length > 6 && (
                  <li className="opacity-70">… +{hub.liveWarnings.length - 6}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {order.map((sectionKey, idx) => (
          <SectionCard
            key={sectionKey}
            sectionKey={sectionKey}
            section={hub.draftConfig[sectionKey]}
            index={idx}
            total={order.length}
            dragging={dragIndex === idx}
            dragOver={dragOverIndex === idx && dragIndex !== null && dragIndex !== idx}
            onMoveUp={() => hub.updateOrder(sectionKey, 'up')}
            onMoveDown={() => hub.updateOrder(sectionKey, 'down')}
            onDragStart={() => setDragIndex(idx)}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== idx) {
                hub.moveSectionTo(dragIndex, idx);
              }
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onToggleEnabled={(next) => handleToggleEnabled(sectionKey, next)}
          />
        ))}
      </div>
    </div>
  );
}
