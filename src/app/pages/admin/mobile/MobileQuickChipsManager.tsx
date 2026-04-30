/**
 * MobileQuickChipsManager — admin CRUD for the Temu-style quick chips
 * shown right under the hero on the mobile home (الكل / تخفيض / جملة …).
 *
 * The mobile client reads the chip list via `quick_chips_list_public`
 * (RPC) and stores per-device order in `user_preferences.quick_chips_order`.
 * Admin sets the *available* chips here; user reorders inside the app.
 *
 * UX choices:
 *   ▸ Inline list with drag-style up/down buttons (we don't pull a
 *     drag library on the admin side — sort_order edits are explicit).
 *   ▸ Live preview pill so admins see exactly how the chip will render.
 *   ▸ Hex picker + emoji input + link path.
 *   ▸ Modal-based edit, matching the rest of the mobile manager suite.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Edit3, Eye, EyeOff, Loader2, Plus, Sparkles, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteQuickChip,
  listAllQuickChips,
  upsertQuickChip,
  type MobileQuickChipPatch,
  type MobileQuickChipRow,
} from '../../../lib/adminMobileApi';

const DEFAULT_ACCENTS = [
  '#2D7DD2', '#FF7A1A', '#43D9DB', '#E85D6B',
  '#FFC93C', '#7C5DDB', '#4CAF80', '#12335E',
];

const SUGGESTED_LINKS = [
  '/shop',
  '/shop?filter=promo',
  '/shop?filter=new',
  '/shop?filter=bestsellers',
  '/shop?filter=flash',
  '/shop?filter=rentree',
  '/wholesale',
  '/packs',
  '/loyalty',
];

export function MobileQuickChipsManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [chips, setChips] = useState<MobileQuickChipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MobileQuickChipRow | 'new' | null>(null);

  const sorted = useMemo(
    () => [...chips].sort((a, b) => a.sort_order - b.sort_order),
    [chips],
  );

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listAllQuickChips(token);
      setChips(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const onMove = async (chip: MobileQuickChipRow, dir: -1 | 1) => {
    if (!token) return;
    const idx = sorted.findIndex((c) => c.id === chip.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    // Optimistic — apply locally then persist both rows.
    setChips((prev) => prev.map((c) => {
      if (c.id === chip.id) return { ...c, sort_order: swapWith.sort_order };
      if (c.id === swapWith.id) return { ...c, sort_order: chip.sort_order };
      return c;
    }));
    try {
      await Promise.all([
        upsertQuickChip({ id: chip.id, sort_order: swapWith.sort_order }, token),
        upsertQuickChip({ id: swapWith.id, sort_order: chip.sort_order }, token),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Réordonnancement impossible.');
      void load();
    }
  };

  const onToggleActive = async (chip: MobileQuickChipRow) => {
    if (!token) return;
    const next = !chip.is_active;
    setChips((prev) => prev.map((c) => (c.id === chip.id ? { ...c, is_active: next } : c)));
    try {
      await upsertQuickChip({ id: chip.id, is_active: next }, token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
      setChips((prev) => prev.map((c) => (c.id === chip.id ? { ...c, is_active: chip.is_active } : c)));
    }
  };

  const onDelete = async (chip: MobileQuickChipRow) => {
    if (!token) return;
    if (!window.confirm(`Supprimer le chip "${chip.label_fr}" ?`)) return;
    try {
      await deleteQuickChip(chip.id, token);
      toast.success('Chip supprimé.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="animate-spin text-blue-700" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between rounded-2xl border ${t.cardBorder} ${t.card} p-4`}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-orange-600" />
          <h2 className={`text-sm font-black ${t.text}`}>
            Chips rapides ({sorted.length})
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-bold text-white"
        >
          <Plus size={14} /> Nouveau chip
        </button>
      </div>

      <p className={`text-xs ${t.textMuted}`}>
        Ces chips s&apos;affichent juste sous le hero de la home mobile. L&apos;utilisateur
        peut les réorganiser via long-press → glisser (le réordonnancement est
        sauvegardé par appareil dans <code>user_preferences.quick_chips_order</code>).
        Vous gérez ici l&apos;<em>ensemble</em> disponible.
      </p>

      {sorted.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-10 text-center`}>
          <p className={`text-sm font-semibold ${t.textMuted}`}>
            Aucun chip pour l&apos;instant. Créez-en un pour qu&apos;il apparaisse sur la home.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 rounded-2xl border ${t.cardBorder} ${t.card} p-3`}
            >
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onMove(c, -1)}
                  disabled={i === 0}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(c, 1)}
                  disabled={i === sorted.length - 1}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
              </div>

              <ChipPreview chip={c} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`truncate text-sm font-black ${t.text}`}>{c.label_fr}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                    {c.chip_key}
                  </span>
                  {c.is_active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">active</span>
                  ) : (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">off</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500" dir="auto">
                  <span dir="rtl">{c.label_ar}</span>
                  <span>·</span>
                  <code>{c.link_url}</code>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <Edit3 size={12} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => onToggleActive(c)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${c.is_active ? 'border-orange-200 text-orange-700 hover:bg-orange-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                >
                  {c.is_active ? <EyeOff size={12} /> : <Eye size={12} />}
                  {c.is_active ? 'Off' : 'On'}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <ChipEditor
          initial={editing === 'new' ? null : editing}
          token={token}
          existing={sorted}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function ChipPreview({ chip }: { chip: { emoji: string | null; label_fr: string; accent_color: string } }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold"
      style={{
        borderColor: chip.accent_color + '55',
        backgroundColor: chip.accent_color + '14',
        color: chip.accent_color,
      }}
    >
      {chip.emoji ? <span>{chip.emoji}</span> : null}
      <span>{chip.label_fr}</span>
    </div>
  );
}

function ChipEditor({
  initial, existing, token, onClose, onSaved,
}: {
  initial: MobileQuickChipRow | null;
  existing: MobileQuickChipRow[];
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = initial !== null;
  const [submitting, setSubmitting] = useState(false);
  const nextSortOrder = useMemo(
    () => (existing.length > 0 ? Math.max(...existing.map((c) => c.sort_order)) + 1 : 0),
    [existing],
  );

  const [form, setForm] = useState<MobileQuickChipPatch>(() => ({
    id: initial?.id,
    chip_key: initial?.chip_key ?? '',
    label_fr: initial?.label_fr ?? '',
    label_ar: initial?.label_ar ?? '',
    emoji: initial?.emoji ?? '',
    link_url: initial?.link_url ?? '/shop',
    accent_color: initial?.accent_color ?? '#FF7A1A',
    is_active: initial?.is_active ?? true,
    sort_order: initial?.sort_order ?? nextSortOrder,
  }));

  const setField = <K extends keyof MobileQuickChipPatch>(key: K, value: MobileQuickChipPatch[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async () => {
    if (!token) return;
    if (!form.chip_key?.trim()) { toast.error('chip_key requis.'); return; }
    if (!form.label_fr?.trim() || !form.label_ar?.trim()) {
      toast.error('Labels FR et AR requis.');
      return;
    }
    setSubmitting(true);
    try {
      await upsertQuickChip(form, token);
      toast.success(isEdit ? 'Chip mis à jour.' : 'Chip créé.');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-lg font-black text-gray-900">
            {isEdit ? 'Modifier chip' : 'Nouveau chip'}
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500 mb-2">Aperçu live</p>
            <ChipPreview
              chip={{
                emoji: form.emoji || null,
                label_fr: form.label_fr || 'Label',
                accent_color: form.accent_color || '#FF7A1A',
              }}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="chip_key (slug, unique) *"
              value={form.chip_key ?? ''}
              onChange={(v) => setField('chip_key', v.toLowerCase().replace(/[^a-z0-9_]+/g, '_'))}
              placeholder="ex: rentree, flash, gros…"
              disabled={isEdit}
            />
            <Input
              label="Emoji"
              value={form.emoji ?? ''}
              onChange={(v) => setField('emoji', v)}
              placeholder="🎒"
            />
            <Input
              label="Label FR *"
              value={form.label_fr ?? ''}
              onChange={(v) => setField('label_fr', v)}
              placeholder="Rentrée"
            />
            <Input
              label="Label AR *"
              value={form.label_ar ?? ''}
              onChange={(v) => setField('label_ar', v)}
              dir="rtl"
              placeholder="الدخول المدرسي"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Lien (URL ou /path) *</label>
            <input
              type="text"
              list="quick-chip-link-suggestions"
              value={form.link_url ?? ''}
              onChange={(e) => setField('link_url', e.target.value)}
              placeholder="/shop?filter=…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
            <datalist id="quick-chip-link-suggestions">
              {SUGGESTED_LINKS.map((l) => (<option key={l} value={l} />))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Couleur d&apos;accent</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.accent_color || '#FF7A1A'}
                onChange={(e) => setField('accent_color', e.target.value)}
                className="h-10 w-12 rounded-xl border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={form.accent_color ?? ''}
                onChange={(e) => setField('accent_color', e.target.value)}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
              />
              <div className="flex gap-1">
                {DEFAULT_ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setField('accent_color', c)}
                    className="h-7 w-7 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: c, outline: form.accent_color === c ? '2px solid #1A3C6E' : 'none' }}
                    aria-label={`Use ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Sort order"
              value={String(form.sort_order ?? 0)}
              onChange={(v) => setField('sort_order', Number(v) || 0)}
              type="number"
            />
            <label className="space-y-1 text-xs font-semibold text-gray-600">
              <span>Statut</span>
              <button
                type="button"
                onClick={() => setField('is_active', !(form.is_active ?? true))}
                className={`flex w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-bold ${
                  form.is_active !== false
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-gray-300 bg-gray-100 text-gray-600'
                }`}
              >
                {form.is_active !== false ? 'Active' : 'Inactive'}
              </button>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitting}
            className="rounded-xl bg-[#1A3C6E] px-5 py-2 text-sm font-black text-white disabled:opacity-60"
          >
            {submitting ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, type = 'text', placeholder, dir, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; dir?: 'rtl' | 'ltr'; disabled?: boolean;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        disabled={disabled}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-500"
      />
    </label>
  );
}

export default MobileQuickChipsManager;
