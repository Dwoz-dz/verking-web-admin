/**
 * TagPickerModal — admin-facing UI for adding tags to a mobile user.
 *
 * Replaces the legacy `window.prompt('Tag à ajouter…')` with a curated
 * picker:
 *   ▸ Top: search box + free-form input ("Add custom tag")
 *   ▸ Middle: list of pool tags from `mobile_user_tags_pool`, click
 *     to add (skips tags already on the user).
 *   ▸ Bottom: Cancel / Apply.
 *
 * The pool is admin-managed (Phase Final migration). Free-form tags
 * still work — the marketing team isn't restricted to the pool.
 */
import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient as supabase } from "../../lib/supabaseClient";

interface TagPoolRow {
  tag: string;
  label_fr: string;
  label_ar: string | null;
  description_fr: string | null;
  emoji: string | null;
  accent_color: string | null;
  sort_order: number;
}

interface TagPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Tags the user already has — filtered out of the suggestion list. */
  alreadyAdded: string[];
  /** Called once per tag the admin picks. */
  onAddTag: (tag: string) => void;
}

const SLUG_RE = /^[a-z][a-z0-9_]{0,31}$/;

export function TagPickerModal({
  open, onClose, alreadyAdded, onAddTag,
}: TagPickerModalProps) {
  const [pool, setPool] = useState<TagPoolRow[]>([]);
  const [query, setQuery] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void supabase
      .from("mobile_user_tags_pool")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setPool((data ?? []) as TagPoolRow[]);
        setLoading(false);
      });
  }, [open]);

  const filtered = useMemo(() => {
    const added = new Set(alreadyAdded);
    const q = query.trim().toLowerCase();
    return pool
      .filter((p) => !added.has(p.tag))
      .filter((p) => !q || p.tag.includes(q) || p.label_fr.toLowerCase().includes(q));
  }, [pool, query, alreadyAdded]);

  if (!open) return null;

  const onPickPool = (tag: string) => {
    onAddTag(tag);
    // Don't close — admin might add multiple in one go.
  };

  const onAddCustom = () => {
    const t = customTag.trim().toLowerCase();
    if (!SLUG_RE.test(t)) {
      // Invalid slug — surface inline rather than alerting.
      return;
    }
    onAddTag(t);
    setCustomTag("");
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Fermer"
          type="button"
        >
          <X size={18} />
        </button>

        <h2 className="mb-1 text-lg font-black text-slate-900">Ajouter un tag</h2>
        <p className="mb-4 text-sm text-slate-500">
          Choisissez parmi la liste recommandée ou ajoutez un tag personnalisé.
        </p>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un tag…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pl-9 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Pool list */}
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50">
          {loading ? (
            <p className="p-4 text-center text-xs text-slate-500">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-500">
              {query ? `Aucun tag suggéré pour « ${query} »` : "Tous les tags suggérés sont déjà appliqués."}
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.tag}
                onClick={() => onPickPool(p.tag)}
                type="button"
                className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-white"
              >
                <span className="text-lg">{p.emoji ?? "🏷️"}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900">{p.label_fr}</span>
                  {p.description_fr ? (
                    <span className="block truncate text-[11px] text-slate-500">{p.description_fr}</span>
                  ) : null}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: p.accent_color ?? "#64748B" }}
                >
                  {p.tag}
                </span>
                <Plus size={14} className="text-slate-400" />
              </button>
            ))
          )}
        </div>

        {/* Custom tag */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Tag personnalisé
          </label>
          <div className="flex gap-2">
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="ex: ramadan_2026"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddCustom();
              }}
            />
            <button
              onClick={onAddCustom}
              disabled={!SLUG_RE.test(customTag.trim().toLowerCase())}
              type="button"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-black text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add
            </button>
          </div>
          {customTag && !SLUG_RE.test(customTag.trim().toLowerCase()) ? (
            <p className="mt-1 text-[11px] text-red-600">
              Format requis : minuscules, chiffres, underscore. Max 32 caractères.
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
}

export default TagPickerModal;
