/**
 * MobileTagsPoolManager — admin CRUD for `mobile_user_tags_pool`.
 *
 * Each row is a tag suggestion the marketing team wants surfaced when
 * adding tags to a mobile user (vip / parent / school_buyer / …).
 * Free-form tags still work — the pool only seeds the suggestion UI
 * inside `TagPickerModal`.
 *
 * Layout:
 *   ▸ Toolbar with + Nouveau tag
 *   ▸ Sortable card list (by sort_order)
 *   ▸ Modal form for create/edit
 */
import { useEffect, useState } from 'react';
import { Loader2, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteTagPool,
  listAllTagPool,
  upsertTagPool,
  type TagPoolPatch,
  type TagPoolRow,
} from '../../../lib/adminMobileApi';

const TAG_RE = /^[a-z][a-z0-9_]{0,31}$/;

export function MobileTagsPoolManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [rows, setRows] = useState<TagPoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TagPoolRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listAllTagPool(token);
      setRows(list);
    } catch (err) {
      console.error('[tags-pool] load failed:', err);
      toast.error('Impossible de charger les tags.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token]);

  const onCreate = () => { setEditing(null); setShowForm(true); };
  const onEdit = (row: TagPoolRow) => { setEditing(row); setShowForm(true); };
  const onDelete = async (tag: string) => {
    if (!token) return;
    if (!confirm(`Supprimer le tag « ${tag} » ?`)) return;
    try {
      await deleteTagPool(tag, token);
      toast.success('Tag supprimé.');
      void load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  if (!token) return <p className={t.textMuted}>Token admin requis.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className={`text-xl font-black ${t.text}`}>🏷️ Pool de tags utilisateurs</h2>
          <p className={`text-sm ${t.textMuted}`}>
            Tags suggérés dans le picker de la fiche utilisateur. Les tags free-form fonctionnent toujours.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-black text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
          type="button"
        >
          <Plus size={14} className="inline-block mr-1" />
          Nouveau tag
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={28} />
        </div>
      ) : rows.length === 0 ? (
        <div className={`rounded-2xl border ${t.cardBorder} p-10 text-center`}>
          <TagIcon size={36} className="mx-auto text-slate-400" />
          <p className={`mt-3 ${t.text} font-bold`}>Aucun tag dans le pool</p>
          <p className={`mt-1 text-sm ${t.textMuted}`}>
            Cliquez sur « Nouveau tag » pour commencer.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.tag}
              className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 hover:shadow-md transition`}
              style={row.accent_color ? { borderLeftWidth: 4, borderLeftColor: row.accent_color } : undefined}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{row.emoji ?? '🏷️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code
                      className="text-[10px] font-bold rounded px-2 py-0.5 text-white"
                      style={{ backgroundColor: row.accent_color ?? '#64748B' }}
                    >
                      {row.tag}
                    </code>
                    {!row.is_active ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">
                        Désactivé
                      </span>
                    ) : null}
                  </div>
                  <h3 className={`mt-1 font-black ${t.text}`}>{row.label_fr}</h3>
                  {row.label_ar ? (
                    <p className={`text-xs ${t.textMuted}`} dir="rtl">{row.label_ar}</p>
                  ) : null}
                  {row.description_fr ? (
                    <p className={`mt-1 text-xs ${t.textMuted}`}>{row.description_fr}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => onDelete(row.tag)}
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
        <TagEditModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { void load(); setShowForm(false); setEditing(null); }}
        />
      ) : null}
    </div>
  );
}

interface TagEditModalProps {
  initial: TagPoolRow | null;
  onClose: () => void;
  onSaved: () => void;
}
function TagEditModal({ initial, onClose, onSaved }: TagEditModalProps) {
  const { token } = useAuth();
  const [tag, setTag] = useState(initial?.tag ?? '');
  const [labelFr, setLabelFr] = useState(initial?.label_fr ?? '');
  const [labelAr, setLabelAr] = useState(initial?.label_ar ?? '');
  const [descFr, setDescFr] = useState(initial?.description_fr ?? '');
  const [descAr, setDescAr] = useState(initial?.description_ar ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🏷️');
  const [color, setColor] = useState(initial?.accent_color ?? '#64748B');
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 100);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);

  const tagLocked = !!initial;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!TAG_RE.test(tag.trim().toLowerCase())) {
      toast.error('Format requis : lettres minuscules, chiffres, underscore. Max 32 caractères.');
      return;
    }
    if (!labelFr.trim()) {
      toast.error('Label FR requis.');
      return;
    }
    setSubmitting(true);
    try {
      const patch: TagPoolPatch = {
        tag: tag.trim().toLowerCase(),
        label_fr: labelFr.trim(),
        label_ar: labelAr.trim() || null,
        description_fr: descFr.trim() || null,
        description_ar: descAr.trim() || null,
        emoji: emoji.trim() || null,
        accent_color: color || null,
        sort_order: Number(sortOrder),
        is_active: isActive,
      };
      await upsertTagPool(patch, token);
      toast.success('Tag enregistré.');
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Échec.');
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
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-black text-slate-900">
          {initial ? 'Modifier le tag' : 'Nouveau tag'}
        </h2>

        <div className="mt-4 space-y-4">
          <Field label="Slug du tag">
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="vip, parent, school_buyer…"
              disabled={tagLocked}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Label FR">
              <input
                value={labelFr}
                onChange={(e) => setLabelFr(e.target.value)}
                placeholder="VIP"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </Field>
            <Field label="Label AR">
              <input
                value={labelAr ?? ''}
                onChange={(e) => setLabelAr(e.target.value)}
                placeholder="كبار العملاء"
                dir="rtl"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Description FR">
              <textarea
                value={descFr ?? ''}
                onChange={(e) => setDescFr(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </Field>
            <Field label="Description AR">
              <textarea
                value={descAr ?? ''}
                onChange={(e) => setDescAr(e.target.value)}
                rows={2}
                dir="rtl"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Emoji">
              <input
                value={emoji ?? ''}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-2xl outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </Field>
            <Field label="Couleur">
              <input
                type="color"
                value={color ?? '#64748B'}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50"
              />
            </Field>
            <Field label="Ordre">
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-bold text-slate-900">Actif (suggéré dans le picker)</span>
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

export default MobileTagsPoolManager;
