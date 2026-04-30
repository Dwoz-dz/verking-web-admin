/**
 * MobileSearchManager — Phase 10 admin pour les recherches tendance.
 *
 * Section unique pour l'instant : Trending (les 6 chips affichés sous la
 * barre de recherche de l'app). Search history reste device-scoped (pas
 * d'admin), wishlist idem.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Loader2, Pencil, Plus, Save, Search, Sparkles,
  ToggleLeft, ToggleRight, Trash2, X, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteSearchTrending, listAllSearchTrending, upsertSearchTrending,
  type SearchTrendingPatch, type SearchTrendingRow,
} from '../../../lib/adminMobileApi';

export function MobileSearchManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [list, setList] = useState<SearchTrendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SearchTrendingRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try { setList(await listAllSearchTrending(token)); }
    catch (e) { console.error(e); toast.error('Chargement des recherches échoué.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.query.includes(q) || r.label_fr.toLowerCase().includes(q) || r.label_ar.toLowerCase().includes(q));
  }, [list, search]);

  const onToggle = async (r: SearchTrendingRow) => {
    if (!token) return;
    try { await upsertSearchTrending({ id: r.id, is_active: !r.is_active }, token); void load(); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };
  const onDelete = async (r: SearchTrendingRow) => {
    if (!token) return;
    if (!confirm(`Supprimer la recherche "${r.label_fr}" ?`)) return;
    try { await deleteSearchTrending(r.id, token); void load(); toast.success('Supprimé.'); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };

  return (
    <div className="space-y-6">
      {/* Header band */}
      <div
        className="rounded-3xl border border-blue-100 p-5 flex items-center gap-4 shadow-sm"
        style={{ background: 'linear-gradient(135deg, rgba(45,125,210,0.14) 0%, rgba(67,217,219,0.14) 100%)' }}
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
             style={{ background: 'linear-gradient(135deg, #2D7DD2, #43D9DB)' }}>
          <Search size={26} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className={`text-2xl font-black ${t.text}`}>Recherches & Favoris</h1>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>
            Recherches tendance affichées sous la barre de recherche dans l&apos;application.
            L&apos;historique de recherche et la liste de favoris sont device-scoped — gérés par chaque utilisateur dans l&apos;app.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-wrap items-center gap-3`}>
        <TrendingUp size={20} className="text-[#2D7DD2]" />
        <div className="flex-1 min-w-0">
          <h2 className={`text-sm font-black ${t.text}`}>{list.filter((l) => l.is_active).length} / {list.length} recherches actives</h2>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>Affichage en chips sous la barre de recherche, ordre par <code>sort_order</code>.</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#2D7DD2]/40 focus:border-[#2D7DD2]"
          />
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A3C6E] text-white text-xs font-black"
        >
          <Plus size={14} /> Nouvelle recherche
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-10 flex justify-center`}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-8 text-center`}>
          <TrendingUp size={28} className={t.textMuted} />
          <p className={`mt-2 text-sm font-semibold ${t.textMuted}`}>
            {list.length === 0 ? "Aucune recherche tendance." : "Rien ne correspond à votre filtre."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <TrendingCard key={r.id} row={r} onEdit={() => { setEditing(r); setShowForm(true); }} onToggle={() => onToggle(r)} onDelete={() => onDelete(r)} />
          ))}
        </div>
      )}

      {showForm && (
        <TrendingForm
          row={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}
    </div>
  );
}

function TrendingCard({ row, onEdit, onToggle, onDelete }: { row: SearchTrendingRow; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const { t } = useAdminUI();
  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-col gap-2`}>
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0"
          style={{ background: row.accent_color + '22', color: row.accent_color }}
        >
          {row.emoji || '🔎'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-sm font-black ${t.text} truncate`}>{row.label_fr}</h3>
            {row.is_active
              ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black">Actif</span>
              : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-black">Inactif</span>}
          </div>
          <p className={`text-[11px] ${t.textMuted} truncate`} dir="rtl">{row.label_ar}</p>
          <p className={`text-[11px] ${t.textMuted} mt-1`}>
            Requête : <code className="bg-slate-50 px-1 rounded font-black">{row.query}</code>
          </p>
        </div>
      </div>
      {(row.starts_at || row.ends_at) ? (
        <p className={`text-[11px] ${t.textMuted} flex items-center gap-1`}>
          <Calendar size={11} /> {fmtDate(row.starts_at)} → {fmtDate(row.ends_at)}
        </p>
      ) : null}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
        <button onClick={onToggle} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-slate-50 hover:bg-slate-100">
          {row.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
          {row.is_active ? 'Actif' : 'Inactif'}
        </button>
        <button onClick={onEdit} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-blue-50 text-[#1A3C6E] hover:bg-blue-100">
          <Pencil size={11} /> Éditer
        </button>
        <button onClick={onDelete} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function TrendingForm({ row, onClose, onSaved }: { row: SearchTrendingRow | null; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState<SearchTrendingPatch>({
    query: row?.query ?? '',
    label_fr: row?.label_fr ?? '',
    label_ar: row?.label_ar ?? '',
    icon: row?.icon ?? '',
    emoji: row?.emoji ?? '🔎',
    accent_color: row?.accent_color ?? '#2D7DD2',
    sort_order: row?.sort_order ?? 100,
    is_active: row?.is_active ?? true,
    starts_at: row?.starts_at ?? null,
    ends_at: row?.ends_at ?? null,
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!token) return;
    if (!form.query) { toast.error('La requête est requise.'); return; }
    if (!form.label_fr || !form.label_ar) { toast.error('Les libellés FR et AR sont requis.'); return; }
    setSaving(true);
    try {
      await upsertSearchTrending(row ? { ...form, id: row.id } : form, token);
      toast.success('Recherche enregistrée.');
      onSaved();
    } catch (e: unknown) { toast.error((e as Error).message || 'Échec.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={row ? `Modifier "${row.label_fr}"` : 'Nouvelle recherche tendance'} onClose={onClose}>
      <div className="space-y-3">
        <TextField
          label="Requête (lowercased)"
          placeholder="cartable"
          value={form.query ?? ''}
          onChange={(v) => setForm({ ...form, query: v.toLowerCase().trim() })}
        />
        <p className="text-[11px] text-slate-500 -mt-2">
          Cette requête sera passée telle quelle à la RPC <code>search_products</code> quand l&apos;utilisateur tape la chip.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Libellé (FR)" value={form.label_fr ?? ''} onChange={(v) => setForm({ ...form, label_fr: v })} />
          <TextField label="Libellé (AR)" rtl value={form.label_ar ?? ''} onChange={(v) => setForm({ ...form, label_ar: v })} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="Emoji" placeholder="🎒" value={form.emoji ?? ''} onChange={(v) => setForm({ ...form, emoji: v })} />
          <ColorField label="Couleur d'accent" value={form.accent_color ?? '#2D7DD2'} onChange={(v) => setForm({ ...form, accent_color: v })} />
          <NumField label="Ordre" value={form.sort_order ?? 0} onChange={(n) => setForm({ ...form, sort_order: n })} />
        </div>
        <TextField label="Icône Ionicons (optionnelle)" placeholder="search-outline" value={form.icon ?? ''} onChange={(v) => setForm({ ...form, icon: v })} />
        <div className="grid gap-3 md:grid-cols-2">
          <DateField label="Début (optionnel)" value={form.starts_at ?? ''} onChange={(v) => setForm({ ...form, starts_at: v || null })} />
          <DateField label="Fin (optionnelle)" value={form.ends_at ?? ''} onChange={(v) => setForm({ ...form, ends_at: v || null })} />
        </div>
        <ToggleField label="Active (visible dans l'app)" value={!!form.is_active} onChange={(b) => setForm({ ...form, is_active: b })} />
      </div>
      <ModalFooter onSave={onSave} saving={saving} onClose={onClose} />
    </Modal>
  );
}

// ─── Shared widgets ─────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#1A3C6E]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 inline-flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ onSave, saving, onClose }: { onSave: () => void; saving: boolean; onClose: () => void }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-2">
      <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-black bg-slate-50 hover:bg-slate-100">Annuler</button>
      <button
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2D7DD2] to-[#43D9DB] text-white font-black shadow-md disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Enregistrer
      </button>
    </div>
  );
}

function TextField({ label, value, onChange, rtl, placeholder }: { label: string; value: string; onChange: (v: string) => void; rtl?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={rtl ? 'rtl' : 'ltr'}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#2D7DD2]/40 focus:border-[#2D7DD2]" />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#2D7DD2]/40 focus:border-[#2D7DD2]" />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const toInput = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <input type="datetime-local" value={toInput(value)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#2D7DD2]/40 focus:border-[#2D7DD2]" />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200" />
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <button onClick={() => onChange(!value)} className="flex-shrink-0">
        {value ? <ToggleRight size={28} className="text-emerald-500" /> : <ToggleLeft size={28} className="text-slate-400" />}
      </button>
      <span className="text-sm font-black text-slate-700">{label}</span>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
}

export default MobileSearchManager;
