/**
 * MobileThemedPagesManager — admin CRUD for mobile_themed_pages.
 *
 * Layout:
 *   ▸ Toolbar with stats + "Nouvelle page thématique"
 *   ▸ Filter chips (All / Active / Inactive)
 *   ▸ Cards listing each page: tab pill (emoji + color preview),
 *     slug, FR/AR titles, sections count, validity window, sort_order,
 *     toggle/edit/delete actions.
 *   ▸ Modal form: slug, FR+AR titles, hero (banner/title/subtitle/
 *     countdown/CTA), sections JSON editor, validity window, targeting,
 *     visual (emoji + tab_color), sort_order, is_active.
 *
 * Sections editor is a JSON textarea for v1 — admin can paste a
 * fully-formed array. The mobile renderer ignores unknown section
 * types so iterating is safe. A visual section builder lands in
 * Phase 5.5 (drag-and-drop blocks).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Eye, EyeOff, GripVertical, Layers, Loader2, Plus, Search, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';

import { MediaField } from '../../../components/MediaField';
import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteThemedPage,
  listAllThemedPages,
  upsertThemedPage,
  type MobileThemedPagePatch,
  type MobileThemedPageRow,
} from '../../../lib/adminMobileApi';

type Filter = 'all' | 'active' | 'inactive';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
}

export function MobileThemedPagesManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [pages, setPages] = useState<MobileThemedPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MobileThemedPageRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listAllThemedPages(token);
      setPages(list);
    } catch (err) {
      console.error('[themed-mgr] load failed:', err);
      toast.error('Impossible de charger les pages thématiques.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token]);

  const stats = useMemo(() => {
    const active = pages.filter((p) => p.is_active).length;
    return { total: pages.length, active, inactive: pages.length - active };
  }, [pages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pages.filter((p) => {
      if (filter === 'active' && !p.is_active) return false;
      if (filter === 'inactive' && p.is_active) return false;
      if (!q) return true;
      return (
        p.slug.includes(q) ||
        p.title_fr.toLowerCase().includes(q) ||
        p.title_ar.includes(q)
      );
    });
  }, [pages, filter, search]);

  const onToggleActive = async (page: MobileThemedPageRow) => {
    if (!token) return;
    const next = !page.is_active;
    setPages((prev) => prev.map((x) => (x.id === page.id ? { ...x, is_active: next } : x)));
    try {
      await upsertThemedPage({ id: page.id, is_active: next }, token);
    } catch (err) {
      setPages((prev) => prev.map((x) => (x.id === page.id ? { ...x, is_active: !next } : x)));
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  const onDelete = async (page: MobileThemedPageRow) => {
    if (!token) return;
    if (!window.confirm(`Supprimer la page "${page.slug}" ?`)) return;
    try {
      await deleteThemedPage(page.id, token);
      setPages((prev) => prev.filter((x) => x.id !== page.id));
      toast.success('Page supprimée.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (p: MobileThemedPageRow) => { setEditing(p); setShowForm(true); };
  const onFormSaved = () => { setShowForm(false); setEditing(null); void load(); };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="animate-spin text-blue-700" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-violet-700" />
            <h2 className={`text-sm font-black ${t.text}`}>
              Pages thématiques ({stats.total} · {stats.active} actives)
            </h2>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-bold text-white"
          >
            <Plus size={14} /> Nouvelle page
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {(['all','active','inactive'] as const).map((f) => {
              const counts: Record<typeof f, number> = { all: stats.total, active: stats.active, inactive: stats.inactive } as const;
              const labels: Record<typeof f, string> = { all: 'Toutes', active: 'Actives', inactive: 'Inactives' } as const;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-colors ${
                    filter === f ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {labels[f]} ({counts[f]})
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Slug, titre FR/AR..."
              className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-10 text-center`}>
          <Layers size={28} className="mx-auto text-gray-400" />
          <p className={`mt-3 text-sm font-semibold ${t.textMuted}`}>
            {pages.length === 0 ? 'Aucune page — crée la première.' : 'Aucune page ne correspond.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              onToggle={() => void onToggleActive(page)}
              onEdit={() => openEdit(page)}
              onDelete={() => void onDelete(page)}
              t={t}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ThemedPageForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={onFormSaved}
          token={token}
        />
      )}
    </div>
  );
}

function PageCard({
  page, onToggle, onEdit, onDelete, t,
}: {
  page: MobileThemedPageRow;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useAdminUI>['t'];
}) {
  const tabColor = page.tab_color || '#1A3C6E';
  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} overflow-hidden flex flex-col`}>
      <div
        className="px-3 py-3 flex items-center gap-2 border-b"
        style={{ borderColor: tabColor + '33', background: tabColor + '0F' }}
      >
        <span
          className="rounded-full px-2.5 py-1 text-xs font-black flex items-center gap-1"
          style={{ background: tabColor, color: '#FFF' }}
        >
          {page.tab_emoji ?? '🏷️'} {page.title_fr}
        </span>
        <code className="ml-auto rounded bg-white px-1.5 py-0.5 text-[10px] font-mono font-bold text-gray-600">
          /{page.slug}
        </code>
      </div>
      <div className="p-3 flex-1 space-y-2">
        <p className={`text-[11px] ${t.textMuted} truncate`} dir="rtl">{page.title_ar}</p>
        {page.hero_title_fr ? (
          <p className={`text-xs font-bold ${t.text} line-clamp-2`}>{page.hero_title_fr}</p>
        ) : null}
        <div className={`flex flex-wrap gap-1.5 text-[10px] ${t.textMuted}`}>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 inline-flex items-center gap-1">
            <Layers size={9} /> {page.sections.length} section(s)
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 inline-flex items-center gap-1">
            <GripVertical size={9} /> ordre {page.sort_order}
          </span>
          {page.target_wilayas && page.target_wilayas.length > 0 && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{page.target_wilayas.length} wilaya(s)</span>
          )}
          {!page.is_active && (
            <span className="rounded-full bg-gray-200 px-1.5 py-0.5 font-black uppercase">Inactif</span>
          )}
        </div>
        {(page.starts_at || page.ends_at) && (
          <div className={`flex items-center gap-1 text-[10px] ${t.textMuted}`}>
            <Calendar size={10} />
            {formatDate(page.starts_at)} → {formatDate(page.ends_at)}
          </div>
        )}
      </div>
      <div className={`flex items-center justify-end gap-1 border-t ${t.divider} px-2 py-1.5 bg-gray-50/50`}>
        <button onClick={onToggle} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${page.is_active ? 'border-orange-200 text-orange-700 hover:bg-orange-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
          {page.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
          {page.is_active ? 'Désactiver' : 'Activer'}
        </button>
        <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50">
          Edit
        </button>
        <button onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function ThemedPageForm({
  initial, onClose, onSaved, token,
}: {
  initial: MobileThemedPageRow | null;
  onClose: () => void;
  onSaved: () => void;
  token: string | null;
}) {
  const isEdit = initial !== null;
  const [submitting, setSubmitting] = useState(false);
  const [sectionsJson, setSectionsJson] = useState<string>(() =>
    initial ? JSON.stringify(initial.sections, null, 2) : '[]',
  );
  const [sectionsError, setSectionsError] = useState<string | null>(null);

  const [form, setForm] = useState<MobileThemedPagePatch>(() => ({
    id: initial?.id,
    slug: initial?.slug ?? '',
    title_fr: initial?.title_fr ?? '',
    title_ar: initial?.title_ar ?? '',
    tab_emoji: initial?.tab_emoji ?? '',
    tab_color: initial?.tab_color ?? '#1A3C6E',
    hero_banner_image: initial?.hero_banner_image ?? '',
    hero_video_url: (initial as { hero_video_url?: string | null } | null)?.hero_video_url ?? '',
    hero_title_fr: initial?.hero_title_fr ?? '',
    hero_title_ar: initial?.hero_title_ar ?? '',
    hero_subtitle_fr: initial?.hero_subtitle_fr ?? '',
    hero_subtitle_ar: initial?.hero_subtitle_ar ?? '',
    hero_countdown_ends_at: initial?.hero_countdown_ends_at ?? null,
    hero_cta_label_fr: initial?.hero_cta_label_fr ?? '',
    hero_cta_label_ar: initial?.hero_cta_label_ar ?? '',
    hero_cta_link: initial?.hero_cta_link ?? '',
    is_active: initial?.is_active ?? true,
    sort_order: initial?.sort_order ?? 0,
    starts_at: initial?.starts_at ?? null,
    ends_at: initial?.ends_at ?? null,
    target_wilayas: initial?.target_wilayas ?? null,
  }));

  const setField = <K extends keyof MobileThemedPagePatch>(key: K, value: MobileThemedPagePatch[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async () => {
    if (!token) return;
    if (!form.slug?.trim()) { toast.error('Slug requis.'); return; }
    if (!form.title_fr?.trim()) { toast.error('Titre FR requis.'); return; }
    if (!form.title_ar?.trim()) { toast.error('Titre AR requis.'); return; }

    let sectionsParsed: Record<string, unknown>[] = [];
    try {
      const parsed = JSON.parse(sectionsJson || '[]');
      if (!Array.isArray(parsed)) throw new Error('Doit être un tableau JSON.');
      sectionsParsed = parsed;
      setSectionsError(null);
    } catch (e) {
      setSectionsError(e instanceof Error ? e.message : 'JSON invalide.');
      toast.error('Sections JSON invalide.');
      return;
    }

    setSubmitting(true);
    try {
      const wilayas = Array.isArray(form.target_wilayas)
        ? form.target_wilayas.map((w) => String(w).trim()).filter((w) => /^[0-9]{1,2}$/.test(w)).map((w) => w.padStart(2, '0'))
        : null;
      const patch: MobileThemedPagePatch = {
        ...form,
        sections: sectionsParsed,
        sort_order: Number(form.sort_order ?? 0),
        target_wilayas: wilayas && wilayas.length > 0 ? wilayas : null,
      };
      await upsertThemedPage(patch, token);
      toast.success(isEdit ? 'Page mise à jour.' : 'Page créée.');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-lg font-black text-gray-900">
            {isEdit ? `Modifier page ${initial?.slug ?? ''}` : 'Nouvelle page thématique'}
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Identity */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Slug *">
              <input
                type="text"
                value={form.slug ?? ''}
                onChange={(e) => setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
                placeholder="rentree"
                disabled={isEdit}
              />
            </Field>
            <Field label="Ordre d'affichage">
              <input
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => setField('sort_order', Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Titre FR *">
              <input type="text" value={form.title_fr ?? ''} onChange={(e) => setField('title_fr', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="Rentrée scolaire" />
            </Field>
            <Field label="العنوان AR *">
              <input type="text" value={form.title_ar ?? ''} onChange={(e) => setField('title_ar', e.target.value)} dir="rtl"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="الدخول المدرسي" />
            </Field>
          </div>

          {/* Visual */}
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Emoji onglet">
              <input type="text" value={form.tab_emoji ?? ''} onChange={(e) => setField('tab_emoji', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-center" placeholder="🎒" maxLength={4} />
            </Field>
            <Field label="Couleur onglet">
              <div className="flex items-center gap-2">
                <input type="color" value={form.tab_color ?? '#1A3C6E'} onChange={(e) => setField('tab_color', e.target.value)}
                  className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer" />
                <input type="text" value={form.tab_color ?? ''} onChange={(e) => setField('tab_color', e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono" placeholder="#1A3C6E" />
              </div>
            </Field>
            <FlagField label="Active" value={form.is_active ?? true} onChange={(v) => setField('is_active', v)} />
          </div>

          {/* Hero */}
          <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50">
            <p className="text-xs font-black uppercase tracking-wide text-gray-600 mb-3">Hero (top of page)</p>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <MediaField
                  label="Image bannière hero"
                  kind="image"
                  module="themed-pages"
                  value={form.hero_banner_image ?? ''}
                  onChange={(url) => setField('hero_banner_image', url ?? '')}
                  helper="Affichée pleine largeur en haut de la page thématique."
                />
                <MediaField
                  label="Vidéo hero (optionnelle)"
                  kind="video"
                  module="themed-pages"
                  value={(form as { hero_video_url?: string | null }).hero_video_url ?? ''}
                  onChange={(url) => setField('hero_video_url' as keyof MobileThemedPagePatch, (url ?? '') as never)}
                  helper="Lue uniquement en Wi-Fi côté mobile. Sinon : image bannière."
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Titre hero FR">
                  <input type="text" value={form.hero_title_fr ?? ''} onChange={(e) => setField('hero_title_fr', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Field>
                <Field label="عنوان hero AR">
                  <input type="text" value={form.hero_title_ar ?? ''} onChange={(e) => setField('hero_title_ar', e.target.value)} dir="rtl"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Sous-titre FR">
                  <input type="text" value={form.hero_subtitle_fr ?? ''} onChange={(e) => setField('hero_subtitle_fr', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Field>
                <Field label="العنوان الفرعي AR">
                  <input type="text" value={form.hero_subtitle_ar ?? ''} onChange={(e) => setField('hero_subtitle_ar', e.target.value)} dir="rtl"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="CTA Label FR">
                  <input type="text" value={form.hero_cta_label_fr ?? ''} onChange={(e) => setField('hero_cta_label_fr', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="Voir tout" />
                </Field>
                <Field label="CTA Label AR">
                  <input type="text" value={form.hero_cta_label_ar ?? ''} onChange={(e) => setField('hero_cta_label_ar', e.target.value)} dir="rtl"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Field>
                <Field label="CTA Lien">
                  <input type="text" value={form.hero_cta_link ?? ''} onChange={(e) => setField('hero_cta_link', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono" placeholder="/(tabs)/explore" />
                </Field>
              </div>
              <Field label="Hero countdown jusqu'à">
                <input type="datetime-local"
                  value={form.hero_countdown_ends_at ? form.hero_countdown_ends_at.slice(0, 16) : ''}
                  onChange={(e) => setField('hero_countdown_ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Field>
            </div>
          </div>

          {/* Sections JSON */}
          <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50">
            <p className="text-xs font-black uppercase tracking-wide text-gray-600 mb-2">Sections (JSON)</p>
            <p className="text-[11px] text-gray-500 mb-2">
              Types supportés: <code>banner</code>, <code>products</code>, <code>coupons</code>, <code>flash_sales</code>, <code>rail</code>.
              Chaque section: <code>{`{ "type": "...", ... }`}</code>
            </p>
            <textarea
              value={sectionsJson}
              onChange={(e) => { setSectionsJson(e.target.value); setSectionsError(null); }}
              rows={10}
              className={`w-full rounded-xl border px-3 py-2 text-xs font-mono ${sectionsError ? 'border-red-300' : 'border-gray-200'}`}
              spellCheck={false}
            />
            {sectionsError ? (
              <p className="text-xs text-red-600 mt-1">⚠ {sectionsError}</p>
            ) : null}
          </div>

          {/* Validity + targeting */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Début">
              <input type="datetime-local"
                value={form.starts_at ? form.starts_at.slice(0, 16) : ''}
                onChange={(e) => setField('starts_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
            <Field label="Fin">
              <input type="datetime-local"
                value={form.ends_at ? form.ends_at.slice(0, 16) : ''}
                onChange={(e) => setField('ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Field>
          </div>

          <Field label="Wilayas ciblées (codes séparés par virgule, vide = toutes)">
            <input type="text"
              value={Array.isArray(form.target_wilayas) ? form.target_wilayas.join(',') : ''}
              onChange={(e) => {
                const list = e.target.value.split(/[,\s]+/).filter(Boolean);
                setField('target_wilayas', list.length > 0 ? list : null);
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono" placeholder="16, 31, 25" />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
            Annuler
          </button>
          <button onClick={() => void onSubmit()} disabled={submitting}
            className="rounded-xl bg-[#1A3C6E] px-5 py-2 text-sm font-black text-white disabled:opacity-60">
            {submitting ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FlagField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-3 bg-white">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={() => onChange(true)}
          className={`flex-1 rounded-xl border px-2 py-1.5 text-xs font-bold ${value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          Oui
        </button>
        <button type="button" onClick={() => onChange(false)}
          className={`flex-1 rounded-xl border px-2 py-1.5 text-xs font-bold ${!value ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          Non
        </button>
      </div>
    </div>
  );
}

export default MobileThemedPagesManager;
