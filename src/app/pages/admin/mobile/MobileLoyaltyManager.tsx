/**
 * MobileLoyaltyManager — Phase 8 control panel for the loyalty programme.
 *
 * Single page with four sub-tabs that mirror the database tables:
 *   ▸ Paramètres   — singleton settings (currency, earn rate, bonuses)
 *   ▸ Niveaux      — Bronze / Argent / Or / Platine (CRUD)
 *   ▸ Défis        — admin-curated missions with rewards (CRUD)
 *   ▸ Récompenses  — redeemable catalogue (CRUD)
 *
 * Each tab is realtime-aware via list queries. Mobile clients read the
 * same tables via anon SELECT and refresh their /loyalty hub on
 * postgres_changes.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Award, Calendar, ChevronDown, ChevronUp, Crown, Edit2, Flag, Gift,
  Loader2, Pencil, Plus, Save, Sparkles, Star, Ticket, Trash2, Trophy, X,
  CheckCircle2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { MediaField } from '../../../components/MediaField';
import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  saveLoyaltySettings,
  listAllLoyaltyLevels, upsertLoyaltyLevel, deleteLoyaltyLevel,
  listAllLoyaltyChallenges, upsertLoyaltyChallenge, deleteLoyaltyChallenge,
  listAllLoyaltyRewards, upsertLoyaltyReward, deleteLoyaltyReward,
  listAllCoupons,
  type LoyaltyLevelRow, type LoyaltyLevelPatch,
  type LoyaltyChallengeRow, type LoyaltyChallengePatch, type ChallengeType,
  type LoyaltyRewardRow, type LoyaltyRewardPatch, type RewardType,
  type LoyaltySettingsPatch,
} from '../../../lib/adminMobileApi';
import { supabaseClient } from '../../../lib/supabaseClient';

type SubTab = 'settings' | 'tiers' | 'challenges' | 'rewards';

const SUB_TABS: Array<{ key: SubTab; label: string; icon: React.ElementType }> = [
  { key: 'settings',   label: 'Paramètres',   icon: Sparkles },
  { key: 'tiers',      label: 'Niveaux',      icon: Crown },
  { key: 'challenges', label: 'Défis',        icon: Flag },
  { key: 'rewards',    label: 'Récompenses',  icon: Gift },
];

export function MobileLoyaltyManager() {
  const { t } = useAdminUI();
  const [tab, setTab] = useState<SubTab>('settings');

  return (
    <div className="space-y-6">
      {/* Header band */}
      <div
        className="rounded-3xl border border-amber-100 p-5 flex items-center gap-4 shadow-sm"
        style={{
          background: 'linear-gradient(135deg, rgba(255,201,60,0.18) 0%, rgba(124,93,219,0.14) 100%)',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
          style={{ background: 'linear-gradient(135deg, #FFC93C, #7C5DDB)' }}
        >
          <Trophy size={26} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className={`text-2xl font-black ${t.text}`}>Programme de fidélité</h1>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>
            Étoiles VERKING — points sur chaque commande, niveaux, défis dynamiques et catalogue de récompenses.
            Toutes les modifications se propagent en temps réel dans l&apos;application Expo.
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <nav className={`flex flex-wrap gap-1.5 p-1 rounded-2xl border ${t.cardBorder} ${t.card} sticky top-3 z-10 shadow-sm`}>
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors',
              tab === key
                ? 'bg-gradient-to-r from-[#FFC93C] to-[#7C5DDB] text-white shadow-sm'
                : `${t.textMuted} hover:bg-amber-50 hover:text-[#1A3C6E]`,
            ].join(' ')}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Active tab */}
      {tab === 'settings'   && <SettingsPanel />}
      {tab === 'tiers'      && <TiersPanel />}
      {tab === 'challenges' && <ChallengesPanel />}
      {tab === 'rewards'    && <RewardsPanel />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Settings panel — singleton form
// ────────────────────────────────────────────────────────────────────────

function SettingsPanel() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [form, setForm] = useState<LoyaltySettingsPatch & { _loaded: boolean }>({ _loaded: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabaseClient
        .from('mobile_loyalty_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();
      const row = (data ?? {}) as Record<string, unknown>;
      setForm({
        _loaded: true,
        is_enabled: row.is_enabled as boolean ?? true,
        currency_label_fr: (row.currency_label_fr as string) ?? 'Étoiles VERKING',
        currency_label_ar: (row.currency_label_ar as string) ?? 'نجوم فيركينغ',
        currency_icon: (row.currency_icon as string | null) ?? 'sparkles',
        point_value_da: Number(row.point_value_da ?? 1),
        earn_rate_per_da: Number(row.earn_rate_per_da ?? 0.01),
        signup_bonus: Number(row.signup_bonus ?? 100),
        referral_referrer_bonus: Number(row.referral_referrer_bonus ?? 200),
        referral_referee_bonus: Number(row.referral_referee_bonus ?? 100),
        terms_text_fr: (row.terms_text_fr as string | null) ?? null,
        terms_text_ar: (row.terms_text_ar as string | null) ?? null,
        // Phase 14 — welcome flow
        welcome_coupon_id: (row.welcome_coupon_id as string | null) ?? null,
        welcome_message_fr: (row.welcome_message_fr as string | null) ?? null,
        welcome_message_ar: (row.welcome_message_ar as string | null) ?? null,
        welcome_whatsapp_template_fr: (row.welcome_whatsapp_template_fr as string | null) ?? null,
        welcome_whatsapp_template_ar: (row.welcome_whatsapp_template_ar as string | null) ?? null,
        signup_bonus_step2: Number(row.signup_bonus_step2 ?? 100),
        signup_bonus_starts_at: (row.signup_bonus_starts_at as string | null) ?? null,
        signup_bonus_ends_at: (row.signup_bonus_ends_at as string | null) ?? null,
      });
    })();
  }, []);

  const onSave = async () => {
    if (!token) return;
    const { _loaded: _, ...patch } = form;
    setSaving(true);
    try {
      await saveLoyaltySettings(patch, token);
      toast.success('Paramètres enregistrés.');
    } catch (err) {
      console.error('[loyalty-settings] save', err);
      toast.error('Échec de l\'enregistrement.');
    } finally { setSaving(false); }
  };

  if (!form._loaded) {
    return (
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-10 flex justify-center`}>
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Master switch */}
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex items-center gap-3`}>
        <button
          onClick={() => setForm({ ...form, is_enabled: !form.is_enabled })}
          className="flex-shrink-0"
        >
          {form.is_enabled
            ? <ToggleRight size={36} className="text-emerald-500" />
            : <ToggleLeft size={36} className="text-slate-400" />}
        </button>
        <div className="flex-1">
          <h3 className={`text-sm font-black ${t.text}`}>Programme actif</h3>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>
            Désactiver le programme cache l&apos;onglet Fidélité dans l&apos;app et bloque les nouvelles attributions de points.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <NumField
          label="Valeur d&apos;1 point (en DA)"
          help="Utilisé pour afficher l&apos;équivalent monétaire (1 point ≈ X DA)."
          value={form.point_value_da ?? 1}
          step={0.01}
          onChange={(n) => setForm({ ...form, point_value_da: n })}
        />
        <NumField
          label="Taux d&apos;attribution (points / DA)"
          help="0.01 = 1 point pour chaque 100 DA dépensés."
          value={form.earn_rate_per_da ?? 0.01}
          step={0.001}
          onChange={(n) => setForm({ ...form, earn_rate_per_da: n })}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <NumField
          label="Bonus de bienvenue"
          help="Crédité lors du premier lancement de l&apos;app."
          value={form.signup_bonus ?? 0}
          onChange={(n) => setForm({ ...form, signup_bonus: n })}
        />
        <NumField
          label="Parrain (recompense pour celui qui invite)"
          value={form.referral_referrer_bonus ?? 0}
          onChange={(n) => setForm({ ...form, referral_referrer_bonus: n })}
        />
        <NumField
          label="Filleul (recompense pour l&apos;invité)"
          value={form.referral_referee_bonus ?? 0}
          onChange={(n) => setForm({ ...form, referral_referee_bonus: n })}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Nom de la monnaie (FR)" value={form.currency_label_fr ?? ''} onChange={(v) => setForm({ ...form, currency_label_fr: v })} />
        <TextField label="Nom de la monnaie (AR)" rtl value={form.currency_label_ar ?? ''} onChange={(v) => setForm({ ...form, currency_label_ar: v })} />
      </div>
      <TextField label="Icône Ionicons (ex. sparkles)" value={form.currency_icon ?? ''} onChange={(v) => setForm({ ...form, currency_icon: v })} />

      <TextAreaField label="Conditions (FR)" value={form.terms_text_fr ?? ''} onChange={(v) => setForm({ ...form, terms_text_fr: v || null })} />
      <TextAreaField label="Conditions (AR)" rtl value={form.terms_text_ar ?? ''} onChange={(v) => setForm({ ...form, terms_text_ar: v || null })} />

      {/* ─── Phase 14 — Welcome flow settings ─────────────────────────── */}
      <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎁</span>
          <h3 className="text-sm font-black text-orange-900">Pack de bienvenue (Phase 14)</h3>
        </div>
        <p className="text-xs text-orange-700/80">
          Récompenses accordées au premier <code>register_device</code>.
          Modifiable à chaud, idempotent côté serveur.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <NumField
            label="Bonus étape 2 (profil complété)"
            help="+ ces points quand l'utilisateur ajoute wilaya / niveau scolaire."
            value={form.signup_bonus_step2 ?? 100}
            onChange={(n) => setForm({ ...form, signup_bonus_step2: n })}
          />
          <WelcomeCouponPicker
            value={form.welcome_coupon_id ?? null}
            onChange={(id) => setForm({ ...form, welcome_coupon_id: id })}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Message de bienvenue (FR)" value={form.welcome_message_fr ?? ''} onChange={(v) => setForm({ ...form, welcome_message_fr: v || null })} />
          <TextField label="Message de bienvenue (AR)" rtl value={form.welcome_message_ar ?? ''} onChange={(v) => setForm({ ...form, welcome_message_ar: v || null })} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="WhatsApp template (FR)" value={form.welcome_whatsapp_template_fr ?? ''} onChange={(v) => setForm({ ...form, welcome_whatsapp_template_fr: v || null })} />
          <TextField label="WhatsApp template (AR)" rtl value={form.welcome_whatsapp_template_ar ?? ''} onChange={(v) => setForm({ ...form, welcome_whatsapp_template_ar: v || null })} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <DateField
            label="Début campagne (optionnel)"
            value={form.signup_bonus_starts_at ?? ''}
            onChange={(v) => setForm({ ...form, signup_bonus_starts_at: v || null })}
          />
          <DateField
            label="Fin campagne (optionnel)"
            value={form.signup_bonus_ends_at ?? ''}
            onChange={(v) => setForm({ ...form, signup_bonus_ends_at: v || null })}
          />
        </div>
        <p className="text-[10px] text-orange-700/70 italic">
          💡 Hors période, le signup_bonus est mis à 0 automatiquement par le RPC.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FFC93C] to-[#7C5DDB] text-white font-black shadow-md disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tiers panel
// ────────────────────────────────────────────────────────────────────────

function TiersPanel() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [levels, setLevels] = useState<LoyaltyLevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LoyaltyLevelRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try { setLevels(await listAllLoyaltyLevels(token)); }
    catch (e) { console.error(e); toast.error('Chargement des niveaux échoué.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);

  const onToggle = async (lvl: LoyaltyLevelRow) => {
    if (!token) return;
    try {
      await upsertLoyaltyLevel({ id: lvl.id, is_active: !lvl.is_active }, token);
      void load();
    } catch (e) { console.error(e); toast.error('Échec.'); }
  };

  const onDelete = async (lvl: LoyaltyLevelRow) => {
    if (!token) return;
    if (!confirm(`Supprimer le niveau "${lvl.name_fr}" ?`)) return;
    try { await deleteLoyaltyLevel(lvl.id, token); void load(); toast.success('Supprimé.'); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-wrap items-center gap-3`}>
        <Crown size={20} className="text-[#FFC93C]" />
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-black ${t.text}`}>{levels.filter(l => l.is_active).length} niveau(x) actif(s)</h3>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>Le niveau du client suit le total cumulé (lifetime_points).</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A3C6E] text-white text-xs font-black"
        >
          <Plus size={14} /> Nouveau niveau
        </button>
      </div>

      {loading ? (
        <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-10 flex justify-center`}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : levels.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-8 text-center`}>
          <Crown size={28} className={t.textMuted} />
          <p className={`mt-2 text-sm font-semibold ${t.textMuted}`}>Aucun niveau pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {levels.map((lvl) => (
            <div key={lvl.id} className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-col gap-2`}>
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0"
                  style={{ background: lvl.badge_color }}
                >
                  <Award size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-black ${t.text} truncate`}>{lvl.name_fr}</h3>
                    {lvl.is_active
                      ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black">Actif</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-black">Inactif</span>}
                  </div>
                  <p className={`text-[11px] ${t.textMuted}`} dir="rtl">{lvl.name_ar}</p>
                  <p className={`text-xs ${t.textMuted} mt-1`}>
                    Seuil : <span className={`font-black ${t.text}`}>{lvl.threshold_points}</span> pts cumulés
                  </p>
                </div>
              </div>
              {lvl.perks_fr.length > 0 && (
                <ul className={`mt-1 text-[11px] ${t.textMuted} space-y-0.5`}>
                  {lvl.perks_fr.slice(0, 3).map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Star size={10} className="mt-0.5 flex-shrink-0 text-[#FFC93C]" />
                      <span className="truncate">{p}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                <button onClick={() => onToggle(lvl)} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-slate-50 hover:bg-slate-100">
                  {lvl.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                  {lvl.is_active ? 'Actif' : 'Inactif'}
                </button>
                <button onClick={() => { setEditing(lvl); setShowForm(true); }} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-blue-50 text-[#1A3C6E] hover:bg-blue-100">
                  <Pencil size={11} /> Éditer
                </button>
                <button onClick={() => onDelete(lvl)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TierForm
          row={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}
    </div>
  );
}

function TierForm({ row, onClose, onSaved }: { row: LoyaltyLevelRow | null; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [form, setForm] = useState<LoyaltyLevelPatch>({
    level_key: row?.level_key ?? '',
    name_fr: row?.name_fr ?? '',
    name_ar: row?.name_ar ?? '',
    threshold_points: row?.threshold_points ?? 0,
    badge_color: row?.badge_color ?? '#2D7DD2',
    badge_icon: row?.badge_icon ?? 'medal-outline',
    perks_fr: row?.perks_fr ?? [],
    perks_ar: row?.perks_ar ?? [],
    sort_order: row?.sort_order ?? 0,
    is_active: row?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!token) return;
    if (!row && !form.level_key) { toast.error('La clé est requise.'); return; }
    if (!form.name_fr || !form.name_ar) { toast.error('Les noms FR et AR sont requis.'); return; }
    setSaving(true);
    try {
      await upsertLoyaltyLevel(row ? { ...form, id: row.id } : form, token);
      toast.success('Niveau enregistré.');
      onSaved();
    } catch (e: unknown) { console.error(e); toast.error((e as Error).message || 'Échec.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={row ? 'Modifier le niveau' : 'Nouveau niveau'} onClose={onClose}>
      <div className="space-y-3">
        {!row && (
          <TextField label="Clé (slug)" placeholder="bronze" value={form.level_key ?? ''} onChange={(v) => setForm({ ...form, level_key: v.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Nom (FR)" value={form.name_fr ?? ''} onChange={(v) => setForm({ ...form, name_fr: v })} />
          <TextField label="Nom (AR)" rtl value={form.name_ar ?? ''} onChange={(v) => setForm({ ...form, name_ar: v })} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <NumField label="Seuil (points cumulés)" value={form.threshold_points ?? 0} onChange={(n) => setForm({ ...form, threshold_points: n })} />
          <NumField label="Ordre" value={form.sort_order ?? 0} onChange={(n) => setForm({ ...form, sort_order: n })} />
          <div>
            <label className={`block text-[11px] font-black uppercase tracking-wide ${t.textMuted} mb-1`}>Couleur du badge</label>
            <input type="color" value={form.badge_color ?? '#2D7DD2'} onChange={(e) => setForm({ ...form, badge_color: e.target.value })} className="w-full h-10 rounded-xl border border-slate-200" />
          </div>
        </div>
        <TextField label="Icône (Ionicons)" placeholder="medal-outline / trophy-outline / diamond-outline" value={form.badge_icon ?? ''} onChange={(v) => setForm({ ...form, badge_icon: v })} />
        <ListField label="Avantages (FR)" values={form.perks_fr ?? []} onChange={(v) => setForm({ ...form, perks_fr: v })} placeholder="Coupon anniversaire" />
        <ListField label="Avantages (AR)" rtl values={form.perks_ar ?? []} onChange={(v) => setForm({ ...form, perks_ar: v })} placeholder="كوبون عيد ميلاد" />
        <ToggleField label="Actif" value={!!form.is_active} onChange={(b) => setForm({ ...form, is_active: b })} />
      </div>
      <ModalFooter onSave={onSave} saving={saving} onClose={onClose} />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Challenges panel
// ────────────────────────────────────────────────────────────────────────

const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  first_order:        'Première commande',
  spend_amount:       'Montant cumulé',
  order_count:        'Nombre de commandes',
  review:             'Avis publié',
  invite_friends:     'Parrainage (amis invités)',
  category_purchase:  'Achat dans une catégorie',
  daily_visit:        'Visite quotidienne',
};

function ChallengesPanel() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [list, setList] = useState<LoyaltyChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LoyaltyChallengeRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try { setList(await listAllLoyaltyChallenges(token)); }
    catch (e) { console.error(e); toast.error('Chargement des défis échoué.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);

  const onToggle = async (c: LoyaltyChallengeRow) => {
    if (!token) return;
    try { await upsertLoyaltyChallenge({ id: c.id, is_active: !c.is_active }, token); void load(); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };

  const onDelete = async (c: LoyaltyChallengeRow) => {
    if (!token) return;
    if (!confirm(`Supprimer le défi "${c.title_fr}" ?`)) return;
    try { await deleteLoyaltyChallenge(c.id, token); void load(); toast.success('Supprimé.'); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-wrap items-center gap-3`}>
        <Flag size={20} className="text-[#7C5DDB]" />
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-black ${t.text}`}>{list.filter(c => c.is_active).length} défi(s) actif(s)</h3>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>Affichés dans le hub Fidélité de l&apos;app, validés par RPC sécurisée.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7C5DDB] text-white text-xs font-black"
        >
          <Plus size={14} /> Nouveau défi
        </button>
      </div>

      {loading ? (
        <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-10 flex justify-center`}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-8 text-center`}>
          <Flag size={28} className={t.textMuted} />
          <p className={`mt-2 text-sm font-semibold ${t.textMuted}`}>Aucun défi configuré.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <div key={c.id} className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-col gap-2`}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg,#7C5DDB,#5B21B6)' }}>
                  <Flag size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-black ${t.text} truncate`}>{c.title_fr}</h3>
                    {c.is_active
                      ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black">Actif</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-black">Inactif</span>}
                  </div>
                  <p className={`text-[11px] ${t.textMuted} truncate`} dir="rtl">{c.title_ar}</p>
                </div>
              </div>
              <p className={`text-xs ${t.textMuted}`}>
                {CHALLENGE_TYPE_LABELS[c.challenge_type]} · cible <b>{c.target_value}</b> · récompense <b className="text-[#7C5DDB]">{c.reward_points} pts</b>
              </p>
              {(c.starts_at || c.ends_at) && (
                <p className={`text-[11px] ${t.textMuted} flex items-center gap-1`}>
                  <Calendar size={11} /> {fmtDate(c.starts_at)} → {fmtDate(c.ends_at)}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                <button onClick={() => onToggle(c)} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-slate-50 hover:bg-slate-100">
                  {c.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                  {c.is_active ? 'Actif' : 'Inactif'}
                </button>
                <button onClick={() => { setEditing(c); setShowForm(true); }} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-blue-50 text-[#1A3C6E] hover:bg-blue-100">
                  <Pencil size={11} /> Éditer
                </button>
                <button onClick={() => onDelete(c)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ChallengeForm
          row={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}
    </div>
  );
}

function ChallengeForm({ row, onClose, onSaved }: { row: LoyaltyChallengeRow | null; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState<LoyaltyChallengePatch>({
    challenge_key: row?.challenge_key ?? '',
    title_fr: row?.title_fr ?? '',
    title_ar: row?.title_ar ?? '',
    description_fr: row?.description_fr ?? '',
    description_ar: row?.description_ar ?? '',
    icon: row?.icon ?? 'flag-outline',
    challenge_type: row?.challenge_type ?? 'first_order',
    target_value: row?.target_value ?? 1,
    reward_points: row?.reward_points ?? 100,
    max_completions_per_user: row?.max_completions_per_user ?? 1,
    starts_at: row?.starts_at ?? null,
    ends_at: row?.ends_at ?? null,
    is_active: row?.is_active ?? true,
    sort_order: row?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!token) return;
    if (!row && !form.challenge_key) return toast.error('La clé est requise.');
    if (!form.title_fr || !form.title_ar) return toast.error('Les titres FR et AR sont requis.');
    setSaving(true);
    try {
      await upsertLoyaltyChallenge(row ? { ...form, id: row.id } : form, token);
      toast.success('Défi enregistré.');
      onSaved();
    } catch (e: unknown) { toast.error((e as Error).message || 'Échec.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={row ? 'Modifier le défi' : 'Nouveau défi'} onClose={onClose}>
      <div className="space-y-3">
        {!row && (
          <TextField label="Clé (slug)" placeholder="first_order" value={form.challenge_key ?? ''} onChange={(v) => setForm({ ...form, challenge_key: v.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Titre (FR)" value={form.title_fr ?? ''} onChange={(v) => setForm({ ...form, title_fr: v })} />
          <TextField label="Titre (AR)" rtl value={form.title_ar ?? ''} onChange={(v) => setForm({ ...form, title_ar: v })} />
        </div>
        <TextAreaField label="Description (FR)" value={form.description_fr ?? ''} onChange={(v) => setForm({ ...form, description_fr: v || null })} />
        <TextAreaField label="Description (AR)" rtl value={form.description_ar ?? ''} onChange={(v) => setForm({ ...form, description_ar: v || null })} />
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Type"
            value={form.challenge_type ?? 'first_order'}
            options={Object.entries(CHALLENGE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            onChange={(v) => setForm({ ...form, challenge_type: v as ChallengeType })}
          />
          <TextField label="Icône (Ionicons)" placeholder="flag-outline" value={form.icon ?? ''} onChange={(v) => setForm({ ...form, icon: v })} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <NumField label="Valeur cible" value={form.target_value ?? 1} step={1} onChange={(n) => setForm({ ...form, target_value: n })} />
          <NumField label="Récompense (points)" value={form.reward_points ?? 0} onChange={(n) => setForm({ ...form, reward_points: n })} />
          <NumField label="Complétion max / utilisateur" value={form.max_completions_per_user ?? 1} onChange={(n) => setForm({ ...form, max_completions_per_user: n })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <DateField label="Début" value={form.starts_at ?? ''} onChange={(v) => setForm({ ...form, starts_at: v || null })} />
          <DateField label="Fin" value={form.ends_at ?? ''} onChange={(v) => setForm({ ...form, ends_at: v || null })} />
        </div>
        <ToggleField label="Actif" value={!!form.is_active} onChange={(b) => setForm({ ...form, is_active: b })} />
      </div>
      <ModalFooter onSave={onSave} saving={saving} onClose={onClose} />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Rewards panel
// ────────────────────────────────────────────────────────────────────────

const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  coupon:        'Coupon (bon d\'achat)',
  free_shipping: 'Livraison gratuite',
  product:       'Produit du catalogue',
  merch:         'Goodies VERKING',
  custom:        'Personnalisé',
};

function RewardsPanel() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [list, setList] = useState<LoyaltyRewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LoyaltyRewardRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try { setList(await listAllLoyaltyRewards(token)); }
    catch (e) { console.error(e); toast.error('Chargement des récompenses échoué.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);

  const onToggle = async (r: LoyaltyRewardRow) => {
    if (!token) return;
    try { await upsertLoyaltyReward({ id: r.id, is_active: !r.is_active }, token); void load(); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };
  const onDelete = async (r: LoyaltyRewardRow) => {
    if (!token) return;
    if (!confirm(`Supprimer la récompense "${r.title_fr}" ?`)) return;
    try { await deleteLoyaltyReward(r.id, token); void load(); toast.success('Supprimé.'); }
    catch (e) { console.error(e); toast.error('Échec.'); }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-wrap items-center gap-3`}>
        <Gift size={20} className="text-[#FF7A1A]" />
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-black ${t.text}`}>{list.filter(r => r.is_active).length} récompense(s) active(s)</h3>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>Échangées via la RPC <code>loyalty_redeem_reward</code> (idempotente, vérifie balance + tier).</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF7A1A] text-white text-xs font-black"
        >
          <Plus size={14} /> Nouvelle récompense
        </button>
      </div>

      {loading ? (
        <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-10 flex justify-center`}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-8 text-center`}>
          <Gift size={28} className={t.textMuted} />
          <p className={`mt-2 text-sm font-semibold ${t.textMuted}`}>Aucune récompense configurée.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <div key={r.id} className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 flex flex-col gap-2`}>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg,#FF7A1A,#C2410C)' }}>
                  <Gift size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-black ${t.text} truncate`}>{r.title_fr}</h3>
                    {r.is_active
                      ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black">Actif</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-black">Inactif</span>}
                  </div>
                  <p className={`text-[11px] ${t.textMuted} truncate`} dir="rtl">{r.title_ar}</p>
                </div>
              </div>
              <p className={`text-xs ${t.textMuted}`}>
                {REWARD_TYPE_LABELS[r.reward_type]} · coût <b className="text-[#FF7A1A]">{r.cost_points} pts</b>
                {r.stock != null && <> · stock <b>{r.stock}</b></>}
                {r.required_level_key && <> · niveau requis <b>{r.required_level_key}</b></>}
              </p>
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                <button onClick={() => onToggle(r)} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-slate-50 hover:bg-slate-100">
                  {r.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                  {r.is_active ? 'Actif' : 'Inactif'}
                </button>
                <button onClick={() => { setEditing(r); setShowForm(true); }} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-blue-50 text-[#1A3C6E] hover:bg-blue-100">
                  <Pencil size={11} /> Éditer
                </button>
                <button onClick={() => onDelete(r)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <RewardForm
          row={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}
    </div>
  );
}

function RewardForm({ row, onClose, onSaved }: { row: LoyaltyRewardRow | null; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState<LoyaltyRewardPatch>({
    reward_key: row?.reward_key ?? '',
    title_fr: row?.title_fr ?? '',
    title_ar: row?.title_ar ?? '',
    description_fr: row?.description_fr ?? '',
    description_ar: row?.description_ar ?? '',
    icon: row?.icon ?? 'gift-outline',
    image_url: row?.image_url ?? '',
    video_url: (row as { video_url?: string | null } | null)?.video_url ?? null,
    cost_points: row?.cost_points ?? 100,
    reward_type: row?.reward_type ?? 'coupon',
    coupon_id: row?.coupon_id ?? null,
    product_id: row?.product_id ?? null,
    stock: row?.stock ?? null,
    per_user_limit: row?.per_user_limit ?? 1,
    starts_at: row?.starts_at ?? null,
    ends_at: row?.ends_at ?? null,
    required_level_key: row?.required_level_key ?? null,
    is_active: row?.is_active ?? true,
    sort_order: row?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!token) return;
    if (!row && !form.reward_key) return toast.error('La clé est requise.');
    if (!form.title_fr || !form.title_ar) return toast.error('Les titres FR et AR sont requis.');
    if (!form.cost_points || form.cost_points <= 0) return toast.error('Le coût doit être positif.');
    setSaving(true);
    try {
      await upsertLoyaltyReward(row ? { ...form, id: row.id } : form, token);
      toast.success('Récompense enregistrée.');
      onSaved();
    } catch (e: unknown) { toast.error((e as Error).message || 'Échec.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={row ? 'Modifier la récompense' : 'Nouvelle récompense'} onClose={onClose}>
      <div className="space-y-3">
        {!row && (
          <TextField label="Clé (slug)" placeholder="coupon_200da" value={form.reward_key ?? ''} onChange={(v) => setForm({ ...form, reward_key: v.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Titre (FR)" value={form.title_fr ?? ''} onChange={(v) => setForm({ ...form, title_fr: v })} />
          <TextField label="Titre (AR)" rtl value={form.title_ar ?? ''} onChange={(v) => setForm({ ...form, title_ar: v })} />
        </div>
        <TextAreaField label="Description (FR)" value={form.description_fr ?? ''} onChange={(v) => setForm({ ...form, description_fr: v || null })} />
        <TextAreaField label="Description (AR)" rtl value={form.description_ar ?? ''} onChange={(v) => setForm({ ...form, description_ar: v || null })} />
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Type"
            value={form.reward_type ?? 'coupon'}
            options={Object.entries(REWARD_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            onChange={(v) => setForm({ ...form, reward_type: v as RewardType })}
          />
          <NumField label="Coût (points)" value={form.cost_points ?? 0} onChange={(n) => setForm({ ...form, cost_points: n })} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <NumField label="Stock (vide = ∞)" value={form.stock ?? 0} onChange={(n) => setForm({ ...form, stock: n || null })} />
          <NumField label="Limite / utilisateur" value={form.per_user_limit ?? 1} onChange={(n) => setForm({ ...form, per_user_limit: n })} />
          <TextField label="Niveau requis (slug)" placeholder="argent | or | platine" value={form.required_level_key ?? ''} onChange={(v) => setForm({ ...form, required_level_key: v || null })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="ID coupon (si type = coupon)" value={form.coupon_id ?? ''} onChange={(v) => setForm({ ...form, coupon_id: v || null })} />
          <TextField label="ID produit (si type = product)" value={form.product_id ?? ''} onChange={(v) => setForm({ ...form, product_id: v || null })} />
        </div>
        <TextField label="Icône (Ionicons)" placeholder="gift-outline" value={form.icon ?? ''} onChange={(v) => setForm({ ...form, icon: v })} />
        <div className="grid gap-3 md:grid-cols-2">
          <MediaField
            label="Image récompense"
            kind="image"
            module="loyalty"
            value={form.image_url ?? ''}
            onChange={(url) => setForm({ ...form, image_url: url })}
            helper="Optionnel — sinon on retombe sur l’icône Ionicons + l’image du produit lié."
          />
          <MediaField
            label="Vidéo (optionnelle)"
            kind="video"
            module="loyalty"
            value={(form as { video_url?: string | null }).video_url ?? ''}
            onChange={(url) => setForm({ ...(form as LoyaltyRewardPatch & { video_url?: string | null }), video_url: url })}
            helper="MP4 ≤ 15 MB. Lue uniquement en Wi-Fi côté mobile."
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <DateField label="Début" value={form.starts_at ?? ''} onChange={(v) => setForm({ ...form, starts_at: v || null })} />
          <DateField label="Fin" value={form.ends_at ?? ''} onChange={(v) => setForm({ ...form, ends_at: v || null })} />
        </div>
        <ToggleField label="Actif" value={!!form.is_active} onChange={(b) => setForm({ ...form, is_active: b })} />
      </div>
      <ModalFooter onSave={onSave} saving={saving} onClose={onClose} />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Shared form widgets
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
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FFC93C] to-[#7C5DDB] text-white font-black shadow-md disabled:opacity-60"
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
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={rtl ? 'rtl' : 'ltr'}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FFC93C]/40 focus:border-[#FFC93C]"
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
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FFC93C]/40 focus:border-[#FFC93C]"
      />
    </div>
  );
}

function NumField({ label, help, value, onChange, step }: { label: string; help?: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FFC93C]/40 focus:border-[#FFC93C]"
      />
      {help && <p className="text-[10px] text-slate-400 mt-1">{help}</p>}
    </div>
  );
}

/**
 * WelcomeCouponPicker — picks a coupon from the existing catalog to be
 * issued automatically on signup. Stored in
 * `mobile_loyalty_settings.welcome_coupon_id`. Empty selection means
 * "no coupon, points only".
 */
function WelcomeCouponPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { token } = useAuth();
  const [coupons, setCoupons] = useState<{ id: string; code: string; title_fr: string | null; discount_type: string | null; value: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    void (async () => {
      try {
        const list = await listAllCoupons(token);
        setCoupons(list.map((c) => ({
          id: c.id,
          code: c.code,
          title_fr: c.title_fr,
          discount_type: c.discount_type,
          value: c.value,
        })));
      } catch (err) {
        console.error('[welcome-coupon-picker] load failed', err);
      } finally { setLoading(false); }
    })();
  }, [token]);

  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">
        🎫 Coupon de bienvenue
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FFC93C]/40 focus:border-[#FFC93C] disabled:bg-slate-50"
      >
        <option value="">— Aucun (points seuls) —</option>
        {coupons.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} · {c.title_fr ?? '(sans titre)'} · {c.discount_type === 'percent' ? `-${c.value}%` : c.discount_type === 'free_shipping' ? 'Livraison gratuite' : `-${c.value} DA`}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-slate-500 mt-1 italic">
        Sera issued automatiquement à chaque nouvelle inscription. Choisissez un coupon de type "Livraison gratuite" pour l&apos;effet le plus puissant en Algérie.
      </p>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // Convert ISO → input value (YYYY-MM-DDTHH:mm) and back.
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
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? new Date(v).toISOString() : '');
        }}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FFC93C]/40 focus:border-[#FFC93C]"
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
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold bg-white focus:ring-2 focus:ring-[#FFC93C]/40 focus:border-[#FFC93C]"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
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

function ListField({ label, values, onChange, rtl, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; rtl?: boolean; placeholder?: string }) {
  const add = () => onChange([...values, '']);
  const update = (i: number, v: string) => onChange(values.map((x, idx) => (idx === i ? v : x)));
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</label>
        <button onClick={add} className="inline-flex items-center gap-1 text-[11px] font-black text-[#7C5DDB]">
          <Plus size={12} /> Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={v}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              dir={rtl ? 'rtl' : 'ltr'}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FFC93C]/40 focus:border-[#FFC93C]"
            />
            <button onClick={() => remove(i)} className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 inline-flex items-center justify-center"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
}

export default MobileLoyaltyManager;
