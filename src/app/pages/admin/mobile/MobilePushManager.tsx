/**
 * MobilePushManager — Phase 11 admin pour Expo Push.
 *
 * Trois sous-onglets :
 *   ▸ Topics       — abonnements (Promotions, Flash sales, Rentrée…) avec
 *                    couleur, emoji, opt-in par défaut + flag "required".
 *   ▸ Campagnes    — broadcasts FR/AR + targeting (topics, wilayas, levels)
 *                    + bouton "Envoyer maintenant" qui hit l'edge fn.
 *   ▸ Stats        — vue read-only des dernières campagnes envoyées.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Bell, Calendar, CheckCircle2, Loader2, Pencil, Plus, Save, Send,
  Sparkles, Tag, ToggleLeft, ToggleRight, Trash2, X, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  deletePushCampaign, deletePushTopic,
  listAllPushCampaigns, listAllPushTopics,
  sendPushCampaign,
  upsertPushCampaign, upsertPushTopic,
  type PushCampaignPatch, type PushCampaignRow, type PushCampaignStatus,
  type PushTopicPatch, type PushTopicRow,
} from '../../../lib/adminMobileApi';

type SubTab = 'topics' | 'campaigns' | 'stats';

const STATUS_TONE: Record<PushCampaignStatus, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#F1F5F9', color: '#64748B', label: 'Brouillon' },
  scheduled: { bg: '#FFE9D6', color: '#FF7A1A', label: 'Programmé' },
  sending:   { bg: '#FFF4D6', color: '#D97706', label: 'En envoi' },
  sent:      { bg: '#DCFCE7', color: '#15803D', label: 'Envoyé' },
  failed:    { bg: '#FFE4E0', color: '#DC2626', label: 'Échec' },
  cancelled: { bg: '#F1F5F9', color: '#94A3B8', label: 'Annulé' },
};

export function MobilePushManager() {
  const { t } = useAdminUI();
  const [tab, setTab] = useState<SubTab>('campaigns');

  return (
    <div className="space-y-6">
      <div
        className="rounded-3xl border border-blue-100 p-5 flex items-center gap-4 shadow-sm"
        style={{ background: 'linear-gradient(135deg, rgba(255,122,26,0.14) 0%, rgba(124,93,219,0.14) 100%)' }}
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
             style={{ background: 'linear-gradient(135deg, #FF7A1A, #7C5DDB)' }}>
          <Bell size={26} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className={`text-2xl font-black ${t.text}`}>Notifications Push</h1>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>
            Diffusez des messages push (Expo) à votre audience selon les sujets, les wilayas et les niveaux.
            Chaque appareil contrôle ses préférences depuis l&apos;app — vous ciblez par <code>topic</code>, c&apos;est respecté.
          </p>
        </div>
      </div>

      <nav className={`flex flex-wrap gap-1.5 p-1 rounded-2xl border ${t.cardBorder} ${t.card} sticky top-3 z-10 shadow-sm`}>
        <SubTabButton active={tab === 'campaigns'} onClick={() => setTab('campaigns')} label="Campagnes" icon={Send} />
        <SubTabButton active={tab === 'topics'} onClick={() => setTab('topics')} label="Topics" icon={Tag} />
        <SubTabButton active={tab === 'stats'} onClick={() => setTab('stats')} label="Stats" icon={Sparkles} />
      </nav>

      {tab === 'campaigns' && <CampaignsPanel />}
      {tab === 'topics' && <TopicsPanel />}
      {tab === 'stats' && <StatsPanel />}
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
          ? 'bg-gradient-to-r from-[#FF7A1A] to-[#7C5DDB] text-white shadow-sm'
          : `${t.textMuted} hover:bg-slate-50`,
      ].join(' ')}
    >
      <Icon size={14} /> <span>{label}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Topics
// ────────────────────────────────────────────────────────────────────────

function TopicsPanel() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [list, setList] = useState<PushTopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PushTopicRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try { setList(await listAllPushTopics(token)); }
    catch (e) { console.error(e); toast.error('Chargement des topics échoué.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);

  const onToggle = async (r: PushTopicRow) => {
    if (!token) return;
    try { await upsertPushTopic({ topic_key: r.topic_key, is_active: !r.is_active }, token); void load(); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };
  const onDelete = async (r: PushTopicRow) => {
    if (!token) return;
    if (r.is_required && !confirm(`${r.label_fr} est marqué comme requis. Confirmer la suppression ?`)) return;
    if (!r.is_required && !confirm(`Supprimer le topic "${r.label_fr}" ?`)) return;
    try { await deletePushTopic(r.topic_key, token); void load(); toast.success('Supprimé.'); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-wrap items-center gap-3`}>
        <Tag size={20} className="text-[#7C5DDB]" />
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-black ${t.text}`}>{list.filter((l) => l.is_active).length} / {list.length} topics actifs</h3>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>
            Les topics avec <code>is_required</code> ne peuvent pas être désactivés par l&apos;utilisateur (ex. <code>order_status</code>).
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A3C6E] text-white text-xs font-black"
        >
          <Plus size={14} /> Nouveau topic
        </button>
      </div>

      {loading ? (
        <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-10 flex justify-center`}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-8 text-center`}>
          <Tag size={28} className={t.textMuted} />
          <p className={`mt-2 text-sm font-semibold ${t.textMuted}`}>Aucun topic. Créez-en un pour commencer.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <TopicCard key={r.topic_key} row={r} onEdit={() => { setEditing(r); setShowForm(true); }} onToggle={() => onToggle(r)} onDelete={() => onDelete(r)} />
          ))}
        </div>
      )}

      {showForm && (
        <TopicForm row={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); void load(); }} />
      )}
    </div>
  );
}

function TopicCard({ row, onEdit, onToggle, onDelete }: { row: PushTopicRow; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const { t } = useAdminUI();
  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-col gap-2`}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0"
             style={{ background: row.accent_color + '22', color: row.accent_color }}>
          {row.emoji || '🔔'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-sm font-black ${t.text} truncate`}>{row.label_fr}</h3>
            {row.is_required ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-black">REQUIS</span> : null}
            {row.default_opt_in ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black">OPT-IN</span> : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-black">OPT-OUT</span>}
            {row.is_active ? null : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-black">Inactif</span>}
          </div>
          <p className={`text-[11px] ${t.textMuted} truncate`} dir="rtl">{row.label_ar}</p>
          <p className={`text-[11px] ${t.textMuted} mt-1`}>
            Clé : <code className="bg-slate-50 px-1 rounded font-black">{row.topic_key}</code>
          </p>
        </div>
      </div>
      {row.description_fr ? <p className={`text-[11px] ${t.textMuted}`}>{row.description_fr}</p> : null}
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

function TopicForm({ row, onClose, onSaved }: { row: PushTopicRow | null; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState<PushTopicPatch>({
    topic_key: row?.topic_key ?? '',
    label_fr: row?.label_fr ?? '',
    label_ar: row?.label_ar ?? '',
    description_fr: row?.description_fr ?? '',
    description_ar: row?.description_ar ?? '',
    emoji: row?.emoji ?? '🔔',
    icon: row?.icon ?? '',
    accent_color: row?.accent_color ?? '#2D7DD2',
    default_opt_in: row?.default_opt_in ?? true,
    is_required: row?.is_required ?? false,
    sort_order: row?.sort_order ?? 100,
    is_active: row?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!token) return;
    if (!form.topic_key) return toast.error('La clé est requise.');
    if (!form.label_fr || !form.label_ar) return toast.error('Les libellés FR et AR sont requis.');
    setSaving(true);
    try {
      await upsertPushTopic({ ...form, topic_key: form.topic_key }, token);
      toast.success('Topic enregistré.');
      onSaved();
    } catch (e: unknown) { toast.error((e as Error).message || 'Échec.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={row ? `Modifier "${row.label_fr}"` : 'Nouveau topic'} onClose={onClose}>
      <div className="space-y-3">
        <TextField label="Clé (slug)" placeholder="promotions" value={form.topic_key ?? ''} onChange={(v) => setForm({ ...form, topic_key: v.toLowerCase().replace(/[^a-z0-9_]/g, '') })} disabled={!!row} />
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Libellé (FR)" value={form.label_fr ?? ''} onChange={(v) => setForm({ ...form, label_fr: v })} />
          <TextField label="Libellé (AR)" rtl value={form.label_ar ?? ''} onChange={(v) => setForm({ ...form, label_ar: v })} />
        </div>
        <TextAreaField label="Description (FR)" value={form.description_fr ?? ''} onChange={(v) => setForm({ ...form, description_fr: v || null })} />
        <TextAreaField label="Description (AR)" rtl value={form.description_ar ?? ''} onChange={(v) => setForm({ ...form, description_ar: v || null })} />
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="Emoji" placeholder="🔔" value={form.emoji ?? ''} onChange={(v) => setForm({ ...form, emoji: v })} />
          <ColorField label="Couleur" value={form.accent_color ?? '#2D7DD2'} onChange={(v) => setForm({ ...form, accent_color: v })} />
          <NumField label="Ordre" value={form.sort_order ?? 0} onChange={(n) => setForm({ ...form, sort_order: n })} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ToggleField label="Opt-in par défaut" value={!!form.default_opt_in} onChange={(b) => setForm({ ...form, default_opt_in: b })} />
          <ToggleField label="Requis (non désactivable)" value={!!form.is_required} onChange={(b) => setForm({ ...form, is_required: b })} />
          <ToggleField label="Actif" value={!!form.is_active} onChange={(b) => setForm({ ...form, is_active: b })} />
        </div>
      </div>
      <ModalFooter onSave={onSave} saving={saving} onClose={onClose} />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Campaigns
// ────────────────────────────────────────────────────────────────────────

function CampaignsPanel() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [list, setList] = useState<PushCampaignRow[]>([]);
  const [topics, setTopics] = useState<PushTopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PushCampaignRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [c, tt] = await Promise.all([listAllPushCampaigns(token), listAllPushTopics(token)]);
      setList(c); setTopics(tt);
    }
    catch (e) { console.error(e); toast.error('Chargement des campagnes échoué.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);

  const onDelete = async (c: PushCampaignRow) => {
    if (!token) return;
    if (!confirm(`Supprimer la campagne "${c.title_fr}" ?`)) return;
    try { await deletePushCampaign(c.id, token); void load(); toast.success('Supprimée.'); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };

  const onSend = async (c: PushCampaignRow) => {
    if (!token) return;
    if (c.status === 'sending' || c.status === 'sent') {
      toast.error(`Cette campagne est déjà ${c.status === 'sent' ? 'envoyée' : 'en envoi'}.`);
      return;
    }
    if (!confirm(`Envoyer "${c.title_fr}" maintenant ?\n\nLes destinataires seront résolus selon les filtres (topics + wilayas + niveaux).`)) return;
    setSendingId(c.id);
    try {
      const res = await sendPushCampaign(c.id, token);
      toast.success(`Envoi terminé — ${res.sent} envoyés, ${res.failed} échecs sur ${res.recipients} destinataires.`);
      void load();
    } catch (e: unknown) { toast.error((e as Error).message || 'Échec.'); }
    finally { setSendingId(null); }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-wrap items-center gap-3`}>
        <Send size={20} className="text-[#FF7A1A]" />
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-black ${t.text}`}>{list.length} campagne(s)</h3>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>
            Envoi via Expo Push (batch 100 par requête). Idempotent : une campagne déjà <code>sent</code> ne peut pas être renvoyée.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF7A1A] text-white text-xs font-black"
        >
          <Plus size={14} /> Nouvelle campagne
        </button>
      </div>

      {loading ? (
        <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-10 flex justify-center`}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-8 text-center`}>
          <Send size={28} className={t.textMuted} />
          <p className={`mt-2 text-sm font-semibold ${t.textMuted}`}>Aucune campagne. Créez-en une et envoyez-la.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <CampaignCard
              key={c.id} row={c} sending={sendingId === c.id}
              onEdit={() => { setEditing(c); setShowForm(true); }}
              onSend={() => onSend(c)} onDelete={() => onDelete(c)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CampaignForm
          row={editing}
          allTopics={topics}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}
    </div>
  );
}

function CampaignCard({ row, sending, onEdit, onSend, onDelete }: { row: PushCampaignRow; sending: boolean; onEdit: () => void; onSend: () => void; onDelete: () => void }) {
  const { t } = useAdminUI();
  const tone = STATUS_TONE[row.status];
  const isLocked = row.status === 'sent' || row.status === 'sending';
  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-col gap-3`}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
             style={{ background: 'linear-gradient(135deg,#FF7A1A,#7C5DDB)' }}>
          <Bell size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-sm font-black ${t.text} truncate`}>{row.title_fr}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-black" style={{ background: tone.bg, color: tone.color }}>
              {tone.label}
            </span>
          </div>
          <p className={`text-[11px] ${t.textMuted} truncate`} dir="rtl">{row.title_ar}</p>
          <p className={`text-[11px] ${t.textMuted} mt-1`}>{row.body_fr.slice(0, 80)}{row.body_fr.length > 80 ? '…' : ''}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10px] font-black">
        {row.target_topics.map((tp) => (
          <span key={tp} className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1A3C6E]">{tp}</span>
        ))}
        {row.target_wilayas?.length ? <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">📍 {row.target_wilayas.length} wilaya(s)</span> : null}
        {row.target_levels?.length ? <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">🎓 {row.target_levels.length} niveau(x)</span> : null}
      </div>
      {row.status === 'sent' || row.status === 'failed' ? (
        <div className={`text-[11px] ${t.textMuted} flex items-center gap-3`}>
          <span><CheckCircle2 size={11} className="inline" /> {row.sent_count} envoyés</span>
          {row.failed_count > 0 ? <span className="text-rose-600"><AlertCircle size={11} className="inline" /> {row.failed_count} échecs</span> : null}
          {row.sent_at ? <span><Calendar size={11} className="inline" /> {fmtDateTime(row.sent_at)}</span> : null}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
        <button
          onClick={onSend}
          disabled={isLocked || sending}
          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
          {sending ? 'Envoi…' : 'Envoyer'}
        </button>
        <button onClick={onEdit} disabled={isLocked} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-blue-50 text-[#1A3C6E] hover:bg-blue-100 disabled:opacity-50">
          <Pencil size={11} /> Éditer
        </button>
        <button onClick={onDelete} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function CampaignForm({ row, allTopics, onClose, onSaved }: { row: PushCampaignRow | null; allTopics: PushTopicRow[]; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState<PushCampaignPatch>({
    slug: row?.slug ?? '',
    title_fr: row?.title_fr ?? '',
    title_ar: row?.title_ar ?? '',
    body_fr: row?.body_fr ?? '',
    body_ar: row?.body_ar ?? '',
    image_url: row?.image_url ?? '',
    deep_link: row?.deep_link ?? '',
    target_topics: row?.target_topics ?? [],
    target_wilayas: row?.target_wilayas ?? null,
    target_levels: row?.target_levels ?? null,
    is_active: row?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const toggleTopic = (key: string) => {
    const cur = form.target_topics ?? [];
    setForm({ ...form, target_topics: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] });
  };

  const onSave = async () => {
    if (!token) return;
    if (!row && !form.slug) return toast.error('Le slug est requis.');
    if (!form.title_fr || !form.title_ar) return toast.error('Les titres FR et AR sont requis.');
    if (!form.body_fr || !form.body_ar) return toast.error('Les corps de message FR et AR sont requis.');
    if (!form.target_topics || form.target_topics.length === 0) return toast.error('Sélectionnez au moins un topic.');
    setSaving(true);
    try {
      await upsertPushCampaign(row ? { ...form, id: row.id } : form, token);
      toast.success('Campagne enregistrée.');
      onSaved();
    } catch (e: unknown) { toast.error((e as Error).message || 'Échec.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={row ? `Modifier "${row.title_fr}"` : 'Nouvelle campagne'} onClose={onClose}>
      <div className="space-y-3">
        {!row && (
          <TextField label="Slug" placeholder="promo-rentree-2026" value={form.slug ?? ''} onChange={(v) => setForm({ ...form, slug: v.toLowerCase().replace(/[^a-z0-9-]+/g, '-') })} />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Titre (FR)" value={form.title_fr ?? ''} onChange={(v) => setForm({ ...form, title_fr: v })} />
          <TextField label="Titre (AR)" rtl value={form.title_ar ?? ''} onChange={(v) => setForm({ ...form, title_ar: v })} />
        </div>
        <TextAreaField label="Message (FR)" value={form.body_fr ?? ''} onChange={(v) => setForm({ ...form, body_fr: v })} />
        <TextAreaField label="Message (AR)" rtl value={form.body_ar ?? ''} onChange={(v) => setForm({ ...form, body_ar: v })} />
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Image URL (optionnelle)" placeholder="https://..." value={form.image_url ?? ''} onChange={(v) => setForm({ ...form, image_url: v || null })} />
          <TextField label="Deep link (optionnel)" placeholder="/packs ou /loyalty" value={form.deep_link ?? ''} onChange={(v) => setForm({ ...form, deep_link: v || null })} />
        </div>
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">Topics ciblés (au moins 1)</label>
          <div className="flex flex-wrap gap-1.5">
            {allTopics.filter((t) => t.is_active).map((tp) => {
              const selected = form.target_topics?.includes(tp.topic_key);
              return (
                <button
                  key={tp.topic_key}
                  onClick={() => toggleTopic(tp.topic_key)}
                  className={`text-[11px] px-3 py-1.5 rounded-lg font-black transition-colors ${selected ? 'text-white shadow-sm' : 'bg-slate-50 text-slate-700'}`}
                  style={selected ? { background: tp.accent_color } : undefined}
                >
                  {tp.emoji} {tp.label_fr}
                </button>
              );
            })}
          </div>
        </div>
        <TextField
          label="Wilayas ciblées (codes séparés par virgule, vide = toutes)"
          placeholder="16, 31, 09"
          value={(form.target_wilayas ?? []).join(', ')}
          onChange={(v) => setForm({ ...form, target_wilayas: v.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean) })}
        />
        <TextField
          label="Niveaux ciblés (slugs séparés par virgule, vide = tous)"
          placeholder="3ap, 4ap, 5ap"
          value={(form.target_levels ?? []).join(', ')}
          onChange={(v) => setForm({ ...form, target_levels: v.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean) })}
        />
        <ToggleField label="Active" value={!!form.is_active} onChange={(b) => setForm({ ...form, is_active: b })} />
      </div>
      <ModalFooter onSave={onSave} saving={saving} onClose={onClose} />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stats
// ────────────────────────────────────────────────────────────────────────

function StatsPanel() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [list, setList] = useState<PushCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try { setList(await listAllPushCampaigns(token)); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const sentCampaigns = useMemo(() => list.filter((c) => c.status === 'sent' || c.status === 'failed'), [list]);
  const totals = useMemo(() => sentCampaigns.reduce(
    (acc, c) => ({ sent: acc.sent + c.sent_count, failed: acc.failed + c.failed_count }),
    { sent: 0, failed: 0 },
  ), [sentCampaigns]);

  if (loading) return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-10 flex justify-center`}>
      <Loader2 size={20} className="animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Campagnes envoyées" value={String(sentCampaigns.length)} icon={Send} tone="#FF7A1A" />
        <StatCard label="Notifs livrées" value={totals.sent.toLocaleString()} icon={CheckCircle2} tone="#15803D" />
        <StatCard label="Échecs" value={totals.failed.toLocaleString()} icon={AlertCircle} tone="#DC2626" />
      </div>

      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} overflow-hidden`}>
        <div className={`p-4 border-b ${t.cardBorder}`}>
          <h3 className={`text-sm font-black ${t.text}`}>Dernières campagnes envoyées</h3>
        </div>
        {sentCampaigns.length === 0 ? (
          <div className="p-8 text-center">
            <p className={`text-sm font-semibold ${t.textMuted}`}>Pas encore de campagnes envoyées.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sentCampaigns.slice(0, 12).map((c) => {
              const tone = STATUS_TONE[c.status];
              return (
                <div key={c.id} className="p-3 flex items-center gap-3">
                  <Bell size={14} className={t.textMuted} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-black ${t.text} truncate`}>{c.title_fr}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black" style={{ background: tone.bg, color: tone.color }}>{tone.label}</span>
                    </div>
                    <p className={`text-[11px] ${t.textMuted}`}>
                      {c.sent_count} envoyés · {c.failed_count} échecs · {c.sent_at ? fmtDateTime(c.sent_at) : '—'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: string }) {
  const { t } = useAdminUI();
  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex items-center gap-3`}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0" style={{ background: tone }}>
        <Icon size={20} />
      </div>
      <div>
        <p className={`text-[10px] font-black uppercase tracking-wide ${t.textMuted}`}>{label}</p>
        <p className={`text-2xl font-black ${t.text}`}>{value}</p>
      </div>
    </div>
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
      <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF7A1A] to-[#7C5DDB] text-white font-black shadow-md disabled:opacity-60">
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
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={rtl ? 'rtl' : 'ltr'}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#7C5DDB]/40 focus:border-[#7C5DDB] disabled:opacity-60 disabled:bg-slate-50" />
    </div>
  );
}

function TextAreaField({ label, value, onChange, rtl }: { label: string; value: string; onChange: (v: string) => void; rtl?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} dir={rtl ? 'rtl' : 'ltr'} rows={3}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#7C5DDB]/40 focus:border-[#7C5DDB]" />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#7C5DDB]/40 focus:border-[#7C5DDB]" />
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

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default MobilePushManager;
