/**
 * MobileSchoolManager — Phase 9 admin control panel for the Algerian
 * school system + class packs.
 *
 *   ▸ Niveaux scolaires — 12 levels (1AP→3AS) grouped by cycle, CRUD-able.
 *   ▸ Packs Classe      — bundled product collections per level/cycle,
 *                         with bundle discount + level targeting + product
 *                         picker via comma-separated UUIDs.
 *
 * Both lists are realtime-aware via the underlying anon-readable tables.
 * Mobile clients refresh /packs and /onboarding/level on postgres_changes.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap, BookOpen, Backpack, Trophy, Loader2, Pencil, Plus, Save,
  ToggleLeft, ToggleRight, Trash2, X, Calendar, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { MediaField } from '../../../components/MediaField';
import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  listAllSchoolLevels, upsertSchoolLevel, deleteSchoolLevel,
  listAllClassPacks, upsertClassPack, deleteClassPack,
  type SchoolLevelRow, type SchoolLevelPatch, type SchoolCycle,
  type ClassPackRow, type ClassPackPatch, type ClassPackCycle,
} from '../../../lib/adminMobileApi';

type SubTab = 'levels' | 'packs';

const CYCLE_LABEL: Record<SchoolCycle, string> = {
  primaire: 'Primaire (1AP–5AP)',
  moyen: 'Moyen (1AM–4AM)',
  secondaire: 'Secondaire (1AS–3AS)',
};

const CYCLE_COLOR: Record<SchoolCycle, string> = {
  primaire: '#FF7A1A',
  moyen: '#43D9DB',
  secondaire: '#7C5DDB',
};

const CYCLE_ICON: Record<SchoolCycle, React.ElementType> = {
  primaire: Backpack,
  moyen: BookOpen,
  secondaire: Trophy,
};

export function MobileSchoolManager() {
  const { t } = useAdminUI();
  const [tab, setTab] = useState<SubTab>('levels');

  return (
    <div className="space-y-6">
      <div
        className="rounded-3xl border border-blue-100 p-5 flex items-center gap-4 shadow-sm"
        style={{ background: 'linear-gradient(135deg, rgba(255,122,26,0.14) 0%, rgba(67,217,219,0.12) 50%, rgba(124,93,219,0.14) 100%)' }}
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
             style={{ background: 'linear-gradient(135deg, #FF7A1A, #7C5DDB)' }}>
          <GraduationCap size={26} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className={`text-2xl font-black ${t.text}`}>Mode Étudiant & Packs Classe</h1>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>
            12 niveaux du système algérien (1AP → 3AS) + collections de fournitures bundlées par cycle.
            Les modifications sont visibles dans l&apos;app dès la prochaine ouverture.
          </p>
        </div>
      </div>

      <nav className={`flex flex-wrap gap-1.5 p-1 rounded-2xl border ${t.cardBorder} ${t.card} sticky top-3 z-10 shadow-sm`}>
        <SubTabButton active={tab === 'levels'} onClick={() => setTab('levels')} label="Niveaux scolaires" icon={GraduationCap} />
        <SubTabButton active={tab === 'packs'} onClick={() => setTab('packs')} label="Packs Classe" icon={Backpack} />
      </nav>

      {tab === 'levels' && <LevelsPanel />}
      {tab === 'packs' && <PacksPanel />}
    </div>
  );
}

function SubTabButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: React.ElementType }) {
  const { t } = useAdminUI();
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors',
        active
          ? 'bg-gradient-to-r from-[#FF7A1A] via-[#43D9DB] to-[#7C5DDB] text-white shadow-sm'
          : `${t.textMuted} hover:bg-slate-50`,
      ].join(' ')}
    >
      <Icon size={14} /> <span>{label}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Levels panel
// ────────────────────────────────────────────────────────────────────────

function LevelsPanel() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [levels, setLevels] = useState<SchoolLevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SchoolLevelRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try { setLevels(await listAllSchoolLevels(token)); }
    catch (e) { console.error(e); toast.error('Chargement des niveaux échoué.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);

  const grouped = useMemo(() => {
    const out: Record<SchoolCycle, SchoolLevelRow[]> = { primaire: [], moyen: [], secondaire: [] };
    for (const l of levels) out[l.cycle].push(l);
    for (const k of Object.keys(out) as SchoolCycle[]) out[k].sort((a, b) => a.sort_order - b.sort_order);
    return out;
  }, [levels]);

  const onToggle = async (l: SchoolLevelRow) => {
    if (!token) return;
    try { await upsertSchoolLevel({ level_key: l.level_key, is_active: !l.is_active }, token); void load(); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };
  const onDelete = async (l: SchoolLevelRow) => {
    if (!token) return;
    if (!confirm(`Supprimer le niveau "${l.short_label_fr}" ? Les packs et profils qui le référencent verront le lien remis à null.`)) return;
    try { await deleteSchoolLevel(l.level_key, token); void load(); toast.success('Supprimé.'); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-wrap items-center gap-3`}>
        <GraduationCap size={20} className="text-[#FF7A1A]" />
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-black ${t.text}`}>{levels.filter(l => l.is_active).length} / {levels.length} niveaux actifs</h3>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>
            Grille canonique algérienne — Primaire 5 niveaux, Moyen 4, Secondaire 3 (BAC inclus).
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A3C6E] text-white text-xs font-black"
        >
          <Plus size={14} /> Nouveau niveau
        </button>
      </div>

      {loading ? (
        <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-10 flex justify-center`}><Loader2 size={20} className="animate-spin" /></div>
      ) : (
        (['primaire', 'moyen', 'secondaire'] as SchoolCycle[]).map((cycle) => (
          <CycleSection
            key={cycle}
            cycle={cycle}
            rows={grouped[cycle]}
            onEdit={(row) => { setEditing(row); setShowForm(true); }}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))
      )}

      {showForm && (
        <LevelForm row={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); void load(); }} />
      )}
    </div>
  );
}

function CycleSection({
  cycle, rows, onEdit, onToggle, onDelete,
}: {
  cycle: SchoolCycle;
  rows: SchoolLevelRow[];
  onEdit: (r: SchoolLevelRow) => void;
  onToggle: (r: SchoolLevelRow) => void;
  onDelete: (r: SchoolLevelRow) => void;
}) {
  const { t } = useAdminUI();
  const Icon = CYCLE_ICON[cycle];
  const tone = CYCLE_COLOR[cycle];
  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 space-y-3`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: tone }}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className={`text-sm font-black ${t.text}`}>{CYCLE_LABEL[cycle]}</h2>
          <p className={`text-[11px] ${t.textMuted}`}>{rows.length} niveau(x)</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className={`text-xs ${t.textMuted} italic px-1`}>Aucun niveau dans ce cycle pour l&apos;instant.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <LevelCard key={row.level_key} row={row} onEdit={() => onEdit(row)} onToggle={() => onToggle(row)} onDelete={() => onDelete(row)} />
          ))}
        </div>
      )}
    </div>
  );
}

function LevelCard({ row, onEdit, onToggle, onDelete }: { row: SchoolLevelRow; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const { t } = useAdminUI();
  return (
    <div className={`rounded-xl border ${t.cardBorder} ${t.card} p-3 flex flex-col gap-2`}>
      <div className="flex items-start gap-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-sm flex-shrink-0" style={{ background: row.accent_color + '22', color: row.accent_color }}>
          {row.emoji || '🎓'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className={`text-sm font-black ${t.text}`}>{row.short_label_fr}</h4>
            {row.is_active
              ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black">Actif</span>
              : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-black">Inactif</span>}
          </div>
          <p className={`text-[11px] ${t.textMuted} truncate`}>{row.name_fr}</p>
          <p className={`text-[10px] ${t.textMuted} truncate`} dir="rtl">{row.name_ar}</p>
          {(row.age_min || row.age_max) && (
            <p className={`text-[10px] ${t.textMuted} mt-1`}>{row.age_min ?? '?'} – {row.age_max ?? '?'} ans</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
        <button onClick={onToggle} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-slate-50 hover:bg-slate-100">
          {row.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
          {row.is_active ? 'Actif' : 'Inactif'}
        </button>
        <button onClick={onEdit} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-blue-50 text-[#1A3C6E] hover:bg-blue-100">
          <Pencil size={11} /> Éditer
        </button>
        <button onClick={onDelete} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function LevelForm({ row, onClose, onSaved }: { row: SchoolLevelRow | null; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState<SchoolLevelPatch>({
    level_key: row?.level_key ?? '',
    cycle: row?.cycle ?? 'primaire',
    name_fr: row?.name_fr ?? '',
    name_ar: row?.name_ar ?? '',
    short_label_fr: row?.short_label_fr ?? '',
    short_label_ar: row?.short_label_ar ?? '',
    age_min: row?.age_min ?? null,
    age_max: row?.age_max ?? null,
    emoji: row?.emoji ?? '',
    accent_color: row?.accent_color ?? '#2D7DD2',
    sort_order: row?.sort_order ?? 100,
    is_active: row?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!token) return;
    if (!form.level_key) return toast.error('La clé est requise.');
    if (!form.name_fr || !form.name_ar) return toast.error('Les noms FR et AR sont requis.');
    if (!form.short_label_fr || !form.short_label_ar) return toast.error('Les libellés courts FR/AR sont requis.');
    setSaving(true);
    try {
      await upsertSchoolLevel({ ...form, level_key: form.level_key }, token);
      toast.success('Niveau enregistré.');
      onSaved();
    } catch (e: unknown) { toast.error((e as Error).message || 'Échec.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={row ? `Modifier ${row.short_label_fr}` : 'Nouveau niveau'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="Clé (slug)" placeholder="3ap" value={form.level_key ?? ''} onChange={(v) => setForm({ ...form, level_key: v.toLowerCase().replace(/[^a-z0-9_]/g, '') })} disabled={!!row} />
          <SelectField label="Cycle" value={form.cycle ?? 'primaire'} options={[
            { value: 'primaire', label: 'Primaire' },
            { value: 'moyen', label: 'Moyen' },
            { value: 'secondaire', label: 'Secondaire' },
          ]} onChange={(v) => setForm({ ...form, cycle: v as SchoolCycle })} />
          <NumField label="Ordre d'affichage" value={form.sort_order ?? 0} onChange={(n) => setForm({ ...form, sort_order: n })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Libellé court (FR)" placeholder="3AP" value={form.short_label_fr ?? ''} onChange={(v) => setForm({ ...form, short_label_fr: v })} />
          <TextField label="Libellé court (AR)" rtl value={form.short_label_ar ?? ''} onChange={(v) => setForm({ ...form, short_label_ar: v })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Nom complet (FR)" value={form.name_fr ?? ''} onChange={(v) => setForm({ ...form, name_fr: v })} />
          <TextField label="Nom complet (AR)" rtl value={form.name_ar ?? ''} onChange={(v) => setForm({ ...form, name_ar: v })} />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <NumField label="Âge min" value={form.age_min ?? 0} onChange={(n) => setForm({ ...form, age_min: n || null })} />
          <NumField label="Âge max" value={form.age_max ?? 0} onChange={(n) => setForm({ ...form, age_max: n || null })} />
          <TextField label="Emoji" placeholder="🎒" value={form.emoji ?? ''} onChange={(v) => setForm({ ...form, emoji: v })} />
          <ColorField label="Couleur" value={form.accent_color ?? '#2D7DD2'} onChange={(v) => setForm({ ...form, accent_color: v })} />
        </div>
        <ToggleField label="Actif (visible dans l'app)" value={!!form.is_active} onChange={(b) => setForm({ ...form, is_active: b })} />
      </div>
      <ModalFooter onSave={onSave} saving={saving} onClose={onClose} />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Packs panel
// ────────────────────────────────────────────────────────────────────────

const PACK_CYCLE_LABEL: Record<ClassPackCycle, string> = {
  primaire: 'Primaire',
  moyen: 'Moyen',
  secondaire: 'Secondaire',
  all: 'Tous niveaux',
};

function PacksPanel() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [packs, setPacks] = useState<ClassPackRow[]>([]);
  const [levels, setLevels] = useState<SchoolLevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClassPackRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [p, l] = await Promise.all([listAllClassPacks(token), listAllSchoolLevels(token)]);
      setPacks(p); setLevels(l);
    } catch (e) { console.error(e); toast.error('Chargement des packs échoué.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);

  const onToggle = async (p: ClassPackRow) => {
    if (!token) return;
    try { await upsertClassPack({ id: p.id, is_active: !p.is_active }, token); void load(); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };
  const onDelete = async (p: ClassPackRow) => {
    if (!token) return;
    if (!confirm(`Supprimer le pack "${p.title_fr}" ?`)) return;
    try { await deleteClassPack(p.id, token); void load(); toast.success('Supprimé.'); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-wrap items-center gap-3`}>
        <Backpack size={20} className="text-[#FF7A1A]" />
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-black ${t.text}`}>{packs.filter(p => p.is_active).length} pack(s) actif(s)</h3>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>Bundles produits + remise de groupe pour la rentrée.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF7A1A] text-white text-xs font-black"
        >
          <Plus size={14} /> Nouveau pack
        </button>
      </div>

      {loading ? (
        <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-10 flex justify-center`}><Loader2 size={20} className="animate-spin" /></div>
      ) : packs.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-8 text-center`}>
          <Backpack size={28} className={t.textMuted} />
          <p className={`mt-2 text-sm font-semibold ${t.textMuted}`}>Aucun pack pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packs.map((p) => (
            <PackCard
              key={p.id}
              row={p}
              onEdit={() => { setEditing(p); setShowForm(true); }}
              onToggle={() => onToggle(p)}
              onDelete={() => onDelete(p)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <PackForm
          row={editing}
          allLevels={levels}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}
    </div>
  );
}

function PackCard({ row, onEdit, onToggle, onDelete }: { row: ClassPackRow; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const { t } = useAdminUI();
  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} overflow-hidden`}>
      <div className="h-20 flex items-center justify-center text-4xl"
           style={{ background: `linear-gradient(135deg, ${row.accent_color}33, ${row.accent_color}88)` }}>
        {row.badge_emoji || '🎒'}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className={`text-sm font-black ${t.text} truncate`}>{row.title_fr}</h3>
              {row.is_featured && <Sparkles size={11} className="text-[#FFC93C] flex-shrink-0" />}
              {row.is_active
                ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black">Actif</span>
                : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-black">Inactif</span>}
            </div>
            <p className={`text-[11px] ${t.textMuted} truncate`} dir="rtl">{row.title_ar}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {row.cycle && <Pill color="#1A3C6E" bg="#E5EFFB">{PACK_CYCLE_LABEL[row.cycle]}</Pill>}
          {row.bundle_discount_percent > 0 && <Pill color="#FF7A1A" bg="#FFE9D6">-{row.bundle_discount_percent}%</Pill>}
          <Pill color="#1A3C6E" bg="#F1F3F9">{row.product_ids.length} articles</Pill>
          {row.stock != null && <Pill color="#7C5DDB" bg="#EFE9FF">stock {row.stock}</Pill>}
        </div>
        {row.level_keys.length > 0 && (
          <p className={`text-[10px] ${t.textMuted}`}>
            Niveaux : <span className="font-black">{row.level_keys.join(', ').toUpperCase()}</span>
          </p>
        )}
        {(row.starts_at || row.ends_at) && (
          <p className={`text-[11px] ${t.textMuted} flex items-center gap-1`}>
            <Calendar size={11} /> {fmtDate(row.starts_at)} → {fmtDate(row.ends_at)}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-slate-100">
          <button onClick={onToggle} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-slate-50 hover:bg-slate-100">
            {row.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
            {row.is_active ? 'Actif' : 'Inactif'}
          </button>
          <button onClick={onEdit} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-blue-50 text-[#1A3C6E] hover:bg-blue-100">
            <Pencil size={11} /> Éditer
          </button>
          <button onClick={onDelete} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  );
}

function Pill({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-black" style={{ color, background: bg }}>{children}</span>
  );
}

function PackForm({ row, allLevels, onClose, onSaved }: { row: ClassPackRow | null; allLevels: SchoolLevelRow[]; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState<ClassPackPatch>({
    slug: row?.slug ?? '',
    title_fr: row?.title_fr ?? '',
    title_ar: row?.title_ar ?? '',
    subtitle_fr: row?.subtitle_fr ?? '',
    subtitle_ar: row?.subtitle_ar ?? '',
    description_fr: row?.description_fr ?? '',
    description_ar: row?.description_ar ?? '',
    cycle: row?.cycle ?? 'primaire',
    level_keys: row?.level_keys ?? [],
    cover_image_url: row?.cover_image_url ?? '',
    video_url: (row as { video_url?: string | null } | null)?.video_url ?? null,
    badge_emoji: row?.badge_emoji ?? '🎒',
    accent_color: row?.accent_color ?? '#FF7A1A',
    product_ids: row?.product_ids ?? [],
    bundle_discount_percent: row?.bundle_discount_percent ?? 0,
    stock: row?.stock ?? null,
    starts_at: row?.starts_at ?? null,
    ends_at: row?.ends_at ?? null,
    display_priority: row?.display_priority ?? 0,
    is_active: row?.is_active ?? true,
    is_featured: row?.is_featured ?? false,
    sort_order: row?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [productIdsRaw, setProductIdsRaw] = useState((row?.product_ids ?? []).join(', '));

  const onSave = async () => {
    if (!token) return;
    if (!row && !form.slug) return toast.error('Le slug est requis.');
    if (!form.title_fr || !form.title_ar) return toast.error('Les titres FR et AR sont requis.');
    const productIds = productIdsRaw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      await upsertClassPack(row ? { ...form, id: row.id, product_ids: productIds } : { ...form, product_ids: productIds }, token);
      toast.success('Pack enregistré.');
      onSaved();
    } catch (e: unknown) { toast.error((e as Error).message || 'Échec.'); }
    finally { setSaving(false); }
  };

  const toggleLevel = (key: string) => {
    const cur = form.level_keys ?? [];
    setForm({ ...form, level_keys: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] });
  };

  return (
    <Modal title={row ? `Modifier ${row.title_fr}` : 'Nouveau pack'} onClose={onClose}>
      <div className="space-y-3">
        {!row && (
          <TextField label="Slug" placeholder="rentree-3ap-2026" value={form.slug ?? ''} onChange={(v) => setForm({ ...form, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Titre (FR)" value={form.title_fr ?? ''} onChange={(v) => setForm({ ...form, title_fr: v })} />
          <TextField label="Titre (AR)" rtl value={form.title_ar ?? ''} onChange={(v) => setForm({ ...form, title_ar: v })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Sous-titre (FR)" value={form.subtitle_fr ?? ''} onChange={(v) => setForm({ ...form, subtitle_fr: v || null })} />
          <TextField label="Sous-titre (AR)" rtl value={form.subtitle_ar ?? ''} onChange={(v) => setForm({ ...form, subtitle_ar: v || null })} />
        </div>
        <TextAreaField label="Description (FR)" value={form.description_fr ?? ''} onChange={(v) => setForm({ ...form, description_fr: v || null })} />
        <TextAreaField label="Description (AR)" rtl value={form.description_ar ?? ''} onChange={(v) => setForm({ ...form, description_ar: v || null })} />

        <div className="grid gap-3 md:grid-cols-3">
          <SelectField label="Cycle" value={form.cycle ?? 'primaire'} options={[
            { value: 'primaire', label: 'Primaire' },
            { value: 'moyen', label: 'Moyen' },
            { value: 'secondaire', label: 'Secondaire' },
            { value: 'all', label: 'Tous niveaux' },
          ]} onChange={(v) => setForm({ ...form, cycle: v as ClassPackCycle })} />
          <TextField label="Emoji badge" value={form.badge_emoji ?? ''} onChange={(v) => setForm({ ...form, badge_emoji: v })} />
          <ColorField label="Couleur" value={form.accent_color ?? '#FF7A1A'} onChange={(v) => setForm({ ...form, accent_color: v })} />
        </div>

        <div>
          <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">Niveaux ciblés</label>
          <div className="flex flex-wrap gap-1.5">
            {allLevels.filter(l => l.is_active).map((l) => {
              const selected = form.level_keys?.includes(l.level_key);
              return (
                <button
                  key={l.level_key}
                  onClick={() => toggleLevel(l.level_key)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-black transition-colors ${selected ? 'text-white' : 'bg-slate-50 text-slate-700'}`}
                  style={selected ? { background: l.accent_color } : undefined}
                >
                  {l.emoji} {l.short_label_fr}
                </button>
              );
            })}
          </div>
        </div>

        <TextAreaField
          label="IDs des produits (séparés par virgule)"
          value={productIdsRaw}
          onChange={setProductIdsRaw}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <NumField label="Remise bundle (%)" value={form.bundle_discount_percent ?? 0} step={0.5} onChange={(n) => setForm({ ...form, bundle_discount_percent: n })} />
          <NumField label="Stock (vide = ∞)" value={form.stock ?? 0} onChange={(n) => setForm({ ...form, stock: n || null })} />
          <NumField label="Priorité d'affichage" value={form.display_priority ?? 0} onChange={(n) => setForm({ ...form, display_priority: n })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <DateField label="Début" value={form.starts_at ?? ''} onChange={(v) => setForm({ ...form, starts_at: v || null })} />
          <DateField label="Fin" value={form.ends_at ?? ''} onChange={(v) => setForm({ ...form, ends_at: v || null })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <MediaField
            label="Image de couverture"
            kind="image"
            module="class-packs"
            value={form.cover_image_url ?? ''}
            onChange={(url) => setForm({ ...form, cover_image_url: url })}
            helper="Image principale du Pack Classe (carrés sur la home, hero sur /packs)."
          />
          <MediaField
            label="Vidéo (optionnelle)"
            kind="video"
            module="class-packs"
            value={(form as { video_url?: string | null }).video_url ?? ''}
            onChange={(url) => setForm({ ...(form as ClassPackPatch & { video_url?: string | null }), video_url: url })}
            helper="MP4 ≤ 15 MB. Lue uniquement en Wi-Fi côté mobile."
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ToggleField label="Actif" value={!!form.is_active} onChange={(b) => setForm({ ...form, is_active: b })} />
          <ToggleField label="À la une (Featured)" value={!!form.is_featured} onChange={(b) => setForm({ ...form, is_featured: b })} />
        </div>
      </div>
      <ModalFooter onSave={onSave} saving={saving} onClose={onClose} />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Shared widgets
// ────────────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF7A1A] via-[#43D9DB] to-[#7C5DDB] text-white font-black shadow-md disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Enregistrer
      </button>
    </div>
  );
}

function TextField({ label, value, onChange, rtl, placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; rtl?: boolean; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={rtl ? 'rtl' : 'ltr'}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF7A1A]/40 focus:border-[#FF7A1A] disabled:opacity-60 disabled:bg-slate-50"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange, rtl }: { label: string; value: string; onChange: (v: string) => void; rtl?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={rtl ? 'rtl' : 'ltr'}
        rows={3}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF7A1A]/40 focus:border-[#FF7A1A]"
      />
    </div>
  );
}

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF7A1A]/40 focus:border-[#FF7A1A]"
      />
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
      <input
        type="datetime-local"
        value={toInput(value)}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF7A1A]/40 focus:border-[#FF7A1A]"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold bg-white focus:ring-2 focus:ring-[#FF7A1A]/40 focus:border-[#FF7A1A]"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
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

export default MobileSchoolManager;
