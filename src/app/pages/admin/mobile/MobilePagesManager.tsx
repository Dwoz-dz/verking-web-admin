/**
 * MobilePagesManager — admin CRUD for `mobile_pages`.
 *
 * The mobile app's static info pages (`/info/help`, `/info/faq`,
 * `/info/privacy`, `/info/terms`) all read from this table. The
 * marketing team can rewrite the body any time without a code release —
 * the change appears on every device through the realtime channel
 * subscribed in `app/info/[slug].tsx`.
 *
 * Layout:
 *   ▸ Toolbar with + Nouvelle page
 *   ▸ Card list per page (slug, title preview, published badge)
 *   ▸ Modal form for create/edit with bilingual title + body
 */
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Eye, EyeOff, Loader2, Plus, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteMobilePage,
  listAllMobilePages,
  upsertMobilePage,
  type MobilePagePatch,
  type MobilePageRow,
} from '../../../lib/adminMobileApi';

const SLUG_PRESETS = [
  { slug: 'help',    label: 'Centre d\'aide',  emoji: '🆘' },
  { slug: 'faq',     label: 'FAQ',             emoji: '❓' },
  { slug: 'privacy', label: 'Confidentialité', emoji: '🛡️' },
  { slug: 'terms',   label: 'Conditions',      emoji: '📜' },
] as const;

export function MobilePagesManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [rows, setRows] = useState<MobilePageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MobilePageRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listAllMobilePages(token);
      setRows(list);
    } catch (err) {
      console.error('[mobile-pages] load failed:', err);
      toast.error('Impossible de charger les pages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token]);

  const onCreate = () => { setEditing(null); setShowForm(true); };
  const onEdit = (row: MobilePageRow) => { setEditing(row); setShowForm(true); };
  const onDelete = async (slug: string) => {
    if (!token) return;
    if (!confirm(`Supprimer la page « ${slug} » ?`)) return;
    try {
      await deleteMobilePage(slug, token);
      toast.success('Page supprimée.');
      void load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Échec de la suppression.');
    }
  };

  const stats = useMemo(() => ({
    total: rows.length,
    published: rows.filter((r) => r.is_published).length,
  }), [rows]);

  if (!token) {
    return <p className={t.textMuted}>Token admin requis.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className={`text-xl font-black ${t.text}`}>📄 Pages d'info</h2>
          <p className={`text-sm ${t.textMuted}`}>
            Gérez le contenu de Centre d'aide, FAQ, Confidentialité et Conditions affiché dans l'app mobile.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-black text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
          type="button"
        >
          <Plus size={14} className="inline-block mr-1" />
          Nouvelle page
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} accent="blue" />
        <StatCard label="Publiées" value={stats.published} accent="green" />
        <StatCard label="Brouillons" value={stats.total - stats.published} accent="amber" />
        <StatCard label="Standard" value={SLUG_PRESETS.length} accent="purple" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={28} />
        </div>
      ) : rows.length === 0 ? (
        <div className={`rounded-2xl border ${t.cardBorder} p-10 text-center`}>
          <BookOpen size={36} className="mx-auto text-slate-400" />
          <p className={`mt-3 ${t.text} font-bold`}>Aucune page configurée</p>
          <p className={`mt-1 text-sm ${t.textMuted}`}>
            Cliquez sur « Nouvelle page » pour rédiger la première.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.slug}
              className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 hover:shadow-md transition`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">
                  {SLUG_PRESETS.find((p) => p.slug === row.slug)?.emoji ?? '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className={`text-xs font-bold rounded px-2 py-0.5 ${t.cardSubtle ?? 'bg-slate-100'} text-slate-600`}>
                      /info/{row.slug}
                    </code>
                    {row.is_published ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        <Eye size={10} className="inline-block mr-1" />
                        Publié
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600">
                        <EyeOff size={10} className="inline-block mr-1" />
                        Brouillon
                      </span>
                    )}
                  </div>
                  <h3 className={`mt-1 font-black ${t.text}`}>{row.title_fr}</h3>
                  {row.title_ar ? (
                    <p className={`text-xs ${t.textMuted}`} dir="rtl">{row.title_ar}</p>
                  ) : null}
                  <p className={`mt-2 text-xs ${t.textMuted} line-clamp-2`}>
                    {row.body_fr.slice(0, 200)}{row.body_fr.length > 200 ? '…' : ''}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => onDelete(row.slug)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                  type="button"
                >
                  <Trash2 size={12} className="inline-block mr-1" />
                  Supprimer
                </button>
                <button
                  onClick={() => onEdit(row)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                  type="button"
                >
                  Modifier
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <PageEditModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { void load(); setShowForm(false); setEditing(null); }}
        />
      ) : null}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: 'blue' | 'green' | 'amber' | 'purple' }) {
  const palette = {
    blue:   'from-blue-500 to-indigo-600',
    green:  'from-emerald-500 to-green-600',
    amber:  'from-amber-500 to-orange-600',
    purple: 'from-violet-500 to-purple-600',
  }[accent];
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${palette} p-4 text-white shadow`}>
      <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}

interface PageEditModalProps {
  initial: MobilePageRow | null;
  onClose: () => void;
  onSaved: () => void;
}
function PageEditModal({ initial, onClose, onSaved }: PageEditModalProps) {
  const { token } = useAuth();
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [titleFr, setTitleFr] = useState(initial?.title_fr ?? '');
  const [titleAr, setTitleAr] = useState(initial?.title_ar ?? '');
  const [bodyFr, setBodyFr] = useState(initial?.body_fr ?? '');
  const [bodyAr, setBodyAr] = useState(initial?.body_ar ?? '');
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? true);
  const [submitting, setSubmitting] = useState(false);

  const slugLocked = !!initial; // can't change slug on existing rows

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!slug.trim() || !titleFr.trim() || !bodyFr.trim()) {
      toast.error('Slug, titre FR et corps FR sont obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      const patch: MobilePagePatch = {
        slug: slug.trim().toLowerCase(),
        title_fr: titleFr.trim(),
        title_ar: titleAr.trim() || null,
        body_fr: bodyFr.trim(),
        body_ar: bodyAr.trim() || null,
        is_published: isPublished,
      };
      await upsertMobilePage(patch, token);
      toast.success('Page enregistrée.');
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Échec de l\'enregistrement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4 py-8"
      style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-black text-slate-900">
          {initial ? 'Modifier la page' : 'Nouvelle page'}
        </h2>

        <div className="mt-4 space-y-4">
          <Field label="Slug (URL)">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="help, faq, privacy, terms…"
              disabled={slugLocked}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
            {slugLocked ? (
              <p className="mt-1 text-[11px] text-slate-500">Le slug ne peut pas être modifié après création.</p>
            ) : null}
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Titre (FR)">
              <input
                value={titleFr}
                onChange={(e) => setTitleFr(e.target.value)}
                placeholder="Centre d'aide"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </Field>
            <Field label="Titre (AR)">
              <input
                value={titleAr ?? ''}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder="مركز المساعدة"
                dir="rtl"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </Field>
          </div>

          <Field label="Corps (FR)">
            <textarea
              value={bodyFr}
              onChange={(e) => setBodyFr(e.target.value)}
              rows={8}
              placeholder="Texte complet en français…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-[11px] text-slate-500">{bodyFr.length} caractères</p>
          </Field>

          <Field label="Corps (AR)">
            <textarea
              value={bodyAr ?? ''}
              onChange={(e) => setBodyAr(e.target.value)}
              rows={8}
              placeholder="النص الكامل بالعربية…"
              dir="rtl"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </Field>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-bold text-slate-900">Publiée (visible dans l'app)</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-black text-white shadow-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export default MobilePagesManager;
