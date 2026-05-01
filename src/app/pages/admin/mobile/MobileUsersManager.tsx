/**
 * MobileUsersManager — Phase 15 Admin User Hub.
 *
 * 3 sub-tabs:
 *   1. 👥 Tous — paginated table + filters + bulk + detail panel
 *   2. 🔄 Recovery Requests — approve / reject + auto-trust banner
 *   3. 🏆 Top Performers — leaderboards
 *
 * Layout: stats banner top, then tabs, then split-view (table left,
 * detail panel right). All RPCs wrapped in lib/adminMobileApi.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowDownAZ, ArrowUpAZ, BadgeCheck, Ban, CheckCircle2, Download,
  Eye, Loader2, MessageCircle, Phone, RefreshCw, Search,
  ShieldCheck, ShieldOff, Sparkles, Star, Tag, Trophy, UserPlus, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';

import { TagPickerModal } from '../../../components/admin/TagPickerModal';
import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  type AdminRecoveryRequestRow,
  type AdminUserAction,
  type AdminUserDetails,
  type AdminUserRow,
  type AdminUsersStats,
  getTopPerformersAdmin,
  getUserDetailsAdmin,
  getUsersStatsAdmin,
  listRecoveryRequestsAdmin,
  listUsersAdmin,
  resolveRecoveryRequestAdmin,
  userActionAdmin,
} from '../../../lib/adminMobileApi';

type SubTab = 'all' | 'recovery' | 'top';
type SortKey = 'newest' | 'oldest' | 'points' | 'streak';
type StatusFilter = '' | 'registered' | 'guest' | 'suspended';
type SegmentFilter = '' | 'new' | 'engaged' | 'dormant' | 'high_value';

const PAGE_SIZE = 25;

export function MobileUsersManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [tab, setTab] = useState<SubTab>('all');

  // ─── Stats ────────────────────────────────────────────────────────
  const [stats, setStats] = useState<AdminUsersStats | null>(null);
  const refreshStats = async () => {
    if (!token) return;
    try { setStats(await getUsersStatsAdmin(token)); }
    catch (err) { console.warn('[users-stats]', err); }
  };
  useEffect(() => { void refreshStats(); /* eslint-disable-next-line */ }, [token]);

  // ─── List state ───────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [wilayaFilter, setWilayaFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listUsersAdmin(token, {
        search: debouncedSearch || null,
        wilaya: wilayaFilter || null,
        status: statusFilter || null,
        tag:    tagFilter || null,
        segment: segmentFilter || null,
        sort, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      });
      setUsers(list);
      setTotalCount(list[0]?.total_count ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'List failed');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refreshUsers(); /* eslint-disable-next-line */ }, [
    token, debouncedSearch, wilayaFilter, statusFilter, tagFilter, segmentFilter, sort, page,
  ]);
  // Reset page when filters change
  useEffect(() => { setPage(0); }, [debouncedSearch, wilayaFilter, statusFilter, tagFilter, segmentFilter, sort]);

  // ─── Detail panel ─────────────────────────────────────────────────
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<AdminUserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (!selected || !token) { setDetails(null); return; }
    setDetailsLoading(true);
    getUserDetailsAdmin(token, selected)
      .then((d) => setDetails(d))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Details failed'))
      .finally(() => setDetailsLoading(false));
  }, [selected, token]);

  // ─── User actions ─────────────────────────────────────────────────
  const runAction = async (action: AdminUserAction, payload: Record<string, unknown> = {}) => {
    if (!token || !selected) return;
    try {
      const res = await userActionAdmin(token, selected, action, payload);
      if (res.ok) {
        toast.success(`Action ${action} OK`);
        await refreshUsers();
        // Refresh details panel
        const d = await getUserDetailsAdmin(token, selected);
        setDetails(d);
      } else {
        toast.error(res.code ?? 'Action failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  // Phase Final — branded picker (was window.prompt). Pulls suggestions
  // from `mobile_user_tags_pool` and still allows free-form custom tags.
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const onAddTag = () => setTagPickerOpen(true);
  const onAddTagPicked = (tag: string) => {
    void runAction('add_tag', { tag: tag.trim().toLowerCase() });
  };
  const onRemoveTag = (tag: string) => void runAction('remove_tag', { tag });
  const onAddNotes = () => {
    const notes = window.prompt('Note interne (visible aux admins):', String(details?.profile?.admin_notes ?? ''));
    if (notes == null) return;
    void runAction('set_notes', { notes });
  };
  const onSuspend = () => {
    const reason = window.prompt('Raison de la suspension :');
    if (!reason?.trim()) return;
    void runAction('suspend', { reason: reason.trim() });
  };
  const onReactivate = () => void runAction('reactivate');
  const onGrantPoints = () => {
    const ptsStr = window.prompt('Combien de points à créditer (négatif = débit) ?');
    if (!ptsStr) return;
    const pts = Number(ptsStr);
    if (!Number.isFinite(pts) || pts === 0) return;
    const reason = window.prompt('Raison du crédit (optionnel) :') || 'Admin grant';
    void runAction('grant_points', { points: pts, reason });
  };

  // ─── CSV export ───────────────────────────────────────────────────
  const exportCsv = () => {
    if (users.length === 0) {
      toast.info('Aucune ligne à exporter.');
      return;
    }
    const header = ['device_id', 'name', 'phone', 'wilaya', 'is_registered', 'is_suspended',
      'registered_at', 'tags', 'loyalty_balance', 'loyalty_lifetime', 'streak_days'];
    const lines = users.map((u) => [
      u.device_id,
      escapeCsv(u.name ?? ''),
      escapeCsv(u.phone ?? ''),
      escapeCsv(u.wilaya_code ?? ''),
      String(u.is_registered),
      String(u.is_suspended),
      u.registered_at ?? '',
      escapeCsv(u.tags.join(',')),
      String(u.loyalty_balance),
      String(u.loyalty_lifetime),
      String(u.streak_days),
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verking-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Export ${users.length} lignes`);
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Stats banner */}
      <StatsBanner stats={stats} onRefresh={refreshStats} t={t} />

      {/* Sub-tabs */}
      <div className={`flex items-center gap-2 rounded-2xl border ${t.cardBorder} ${t.card} p-2`}>
        <SubTabButton active={tab === 'all'} onClick={() => setTab('all')} icon={<Users size={14} />} label="👥 Tous les utilisateurs" />
        <SubTabButton active={tab === 'recovery'} onClick={() => setTab('recovery')} icon={<ShieldCheck size={14} />} label="🔄 Demandes de récupération" />
        <SubTabButton active={tab === 'top'} onClick={() => setTab('top')} icon={<Trophy size={14} />} label="🏆 Top utilisateurs" />
      </div>

      {tab === 'all' ? (
        <div className="grid gap-4 md:grid-cols-[1fr_360px]">
          {/* Left: filters + table */}
          <div className="space-y-3">
            {/* Search + filters */}
            <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-3 space-y-2`}>
              <div className="flex items-center gap-2">
                <Search size={16} className="text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par nom ou téléphone…"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} options={[
                  { value: '', label: 'Tous statuts' },
                  { value: 'registered', label: '✅ Inscrits' },
                  { value: 'guest', label: '👻 Invités' },
                  { value: 'suspended', label: '🚫 Suspendus' },
                ]} />
                <FilterSelect value={segmentFilter} onChange={(v) => setSegmentFilter(v as SegmentFilter)} options={[
                  { value: '', label: 'Tous segments' },
                  { value: 'new', label: '🆕 New (7j)' },
                  { value: 'engaged', label: '🔥 Engaged' },
                  { value: 'dormant', label: '😴 Dormant (30j)' },
                  { value: 'high_value', label: '💎 High Value (5k+)' },
                ]} />
                <FilterSelect value={sort} onChange={(v) => setSort(v as SortKey)} options={[
                  { value: 'newest', label: '↓ Plus récent' },
                  { value: 'oldest', label: '↑ Plus ancien' },
                  { value: 'points', label: '⭐ Points' },
                  { value: 'streak', label: '🔥 Streak' },
                ]} />
                <input
                  type="text"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value.toLowerCase())}
                  placeholder="Tag (vip, parent…)"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white"
                />
                <input
                  type="text"
                  value={wilayaFilter}
                  onChange={(e) => setWilayaFilter(e.target.value)}
                  placeholder="Wilaya (16, 31…)"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white w-28"
                />
                <button
                  type="button"
                  onClick={() => { setSearch(''); setStatusFilter(''); setSegmentFilter(''); setTagFilter(''); setWilayaFilter(''); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <X size={12} /> Reset
                </button>
              </div>
            </div>

            {/* Table */}
            <div className={`rounded-2xl border ${t.cardBorder} ${t.card} overflow-hidden`}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>👤 Nom</Th>
                    <Th>📞 Téléphone</Th>
                    <Th>📍 Wilaya</Th>
                    <Th>🏷️ Tags</Th>
                    <Th>⭐ Points</Th>
                    <Th>🔥 Streak</Th>
                    <Th>📅 Inscription</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="inline-block animate-spin text-blue-700" /></td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-400">Aucun utilisateur trouvé.</td></tr>
                  ) : (
                    users.map((u) => (
                      <tr
                        key={u.device_id}
                        onClick={() => setSelected(u.device_id)}
                        className={`cursor-pointer border-t border-gray-100 transition-colors ${selected === u.device_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 text-white text-xs font-black">
                              {(u.name ?? 'V').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="font-bold text-gray-900">{u.name ?? '—'}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">{u.phone ?? '—'}</td>
                        <td className="px-3 py-3">{u.wilaya_code ?? '—'}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.tags.slice(0, 3).map((tg) => <TagPill key={tg}>{tg}</TagPill>)}
                            {u.tags.length > 3 ? <span className="text-[10px] text-gray-400">+{u.tags.length - 3}</span> : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          <span className="text-gray-900 font-bold">{u.loyalty_balance.toLocaleString('fr-FR')}</span>
                          <span className="text-gray-400"> / {u.loyalty_lifetime.toLocaleString('fr-FR')}</span>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">{u.streak_days > 0 ? `🔥 ${u.streak_days}` : '—'}</td>
                        <td className="px-3 py-3 text-xs text-gray-500">{formatDate(u.registered_at)}</td>
                        <td className="px-3 py-3">
                          {u.is_suspended
                            ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">SUSPENDU</span>
                            : u.is_registered
                              ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">INSCRIT</span>
                              : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">INVITÉ</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                <span className="text-gray-500">
                  {totalCount > 0 ? `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, totalCount)} sur ${totalCount}` : '0 résultats'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded border border-gray-200 px-2 py-1 disabled:opacity-40"
                  >‹</button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * PAGE_SIZE >= totalCount}
                    className="rounded border border-gray-200 px-2 py-1 disabled:opacity-40"
                  >›</button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: detail panel */}
          <UserDetailPanel
            details={details}
            loading={detailsLoading}
            onClose={() => setSelected(null)}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onAddNotes={onAddNotes}
            onSuspend={onSuspend}
            onReactivate={onReactivate}
            onGrantPoints={onGrantPoints}
            t={t}
          />
        </div>
      ) : tab === 'recovery' ? (
        <RecoveryRequestsTab token={token} t={t} onResolved={refreshUsers} />
      ) : (
        <TopPerformersTab t={t} />
      )}

      {/* Phase Final — branded tag picker (replaces window.prompt). */}
      <TagPickerModal
        open={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        alreadyAdded={details?.profile?.tags ?? []}
        onAddTag={onAddTagPicked}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════

function StatsBanner({ stats, onRefresh, t }: { stats: AdminUsersStats | null; onRefresh: () => void; t: ReturnType<typeof useAdminUI>['t'] }) {
  return (
    <div className={`grid gap-3 md:grid-cols-4 rounded-2xl border ${t.cardBorder} ${t.card} p-4`}>
      <StatTile label="Total inscrits"      value={stats?.total ?? 0}   color="blue"    icon={<Users size={16} />} />
      <StatTile label="Aujourd'hui"         value={stats?.today ?? 0}   color="emerald" icon={<UserPlus size={16} />} />
      <StatTile label="7 derniers jours"    value={stats?.last_7d ?? 0} color="amber"   icon={<Sparkles size={16} />} />
      <StatTile label="30 derniers jours"   value={stats?.last_30d ?? 0} color="purple" icon={<Star size={16} />} />
      <button
        type="button"
        onClick={onRefresh}
        className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        style={{ position: 'absolute' }}
        title="Actualiser"
      >
        <RefreshCw size={14} />
      </button>
    </div>
  );
}

function StatTile({ label, value, color, icon }: { label: string; value: number; color: 'blue' | 'emerald' | 'amber' | 'purple'; icon: React.ReactNode }) {
  const palette: Record<typeof color, [string, string, string]> = {
    blue:    ['bg-blue-50',    'text-blue-700',    'from-blue-400 to-blue-600'],
    emerald: ['bg-emerald-50', 'text-emerald-700', 'from-emerald-400 to-emerald-600'],
    amber:   ['bg-amber-50',   'text-amber-700',   'from-amber-400 to-amber-600'],
    purple:  ['bg-purple-50',  'text-purple-700',  'from-purple-400 to-purple-600'],
  };
  const [bg, fg, gradient] = palette[color];
  return (
    <div className={`rounded-xl ${bg} p-3`}>
      <div className={`flex items-center gap-2 text-xs font-bold ${fg} uppercase tracking-wide`}>
        <div className={`flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br ${gradient} text-white`}>
          {icon}
        </div>
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-black ${fg}`}>{value.toLocaleString('fr-FR')}</div>
    </div>
  );
}

function SubTabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
        active ? 'bg-[#1A3C6E] text-white shadow' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide text-gray-500">{children}</th>;
}

function FilterSelect<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TagPill({ children }: { children: React.ReactNode }) {
  const colorByTag: Record<string, string> = {
    new:        'bg-amber-100  text-amber-700',
    engaged:    'bg-emerald-100 text-emerald-700',
    ambassador: 'bg-purple-100 text-purple-700',
    dormant:    'bg-gray-100   text-gray-600',
    vip:        'bg-rose-100   text-rose-700',
    parent:     'bg-blue-100   text-blue-700',
    student:    'bg-indigo-100 text-indigo-700',
    recovered:  'bg-cyan-100   text-cyan-700',
  };
  const cls = colorByTag[String(children)] ?? 'bg-gray-100 text-gray-700';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{String(children)}</span>;
}

function UserDetailPanel({
  details, loading, onClose, onAddTag, onRemoveTag, onAddNotes,
  onSuspend, onReactivate, onGrantPoints, t,
}: {
  details: AdminUserDetails | null;
  loading: boolean;
  onClose: () => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onAddNotes: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onGrantPoints: () => void;
  t: ReturnType<typeof useAdminUI>['t'];
}) {
  if (!details && !loading) {
    return (
      <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-8 text-center`}>
        <Eye className="mx-auto text-gray-400" size={32} />
        <p className="mt-3 text-sm font-semibold text-gray-500">Sélectionnez un utilisateur pour voir les détails.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-8 text-center`}>
        <Loader2 className="mx-auto animate-spin text-blue-700" />
      </div>
    );
  }
  const profile = (details?.profile ?? {}) as Record<string, unknown>;
  const loyalty = (details?.loyalty ?? {}) as Record<string, unknown>;
  const streak  = (details?.streak  ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(profile.tags) ? profile.tags as string[] : [];
  const isSuspended = profile.is_suspended === true;
  const phone = String(profile.phone ?? '');
  const e164 = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');

  return (
    <div className={`sticky top-4 rounded-2xl border ${t.cardBorder} ${t.card} p-4 space-y-3 max-h-[calc(100vh-2rem)] overflow-y-auto`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 text-white text-lg font-black">
            {String(profile.name ?? 'V').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="text-base font-black text-gray-900">{String(profile.name ?? '—')}</div>
            <div className="text-xs font-mono text-gray-500">{phone || '—'}</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X size={14} /></button>
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((tg) => (
          <button
            key={tg}
            type="button"
            onClick={() => onRemoveTag(tg)}
            title="Retirer ce tag"
            className="group inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700 hover:bg-red-100 hover:text-red-700"
          >
            {tg} <X size={10} className="opacity-0 group-hover:opacity-100" />
          </button>
        ))}
        <button onClick={onAddTag} className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] font-bold text-gray-500 hover:bg-gray-50">
          <Tag size={10} /> +
        </button>
      </div>

      {/* Loyalty mini-card */}
      <div className="rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 p-3 text-white">
        <div className="text-[10px] font-black uppercase tracking-wide opacity-80">Solde</div>
        <div className="text-2xl font-black">{Number(loyalty.balance_points ?? 0).toLocaleString('fr-FR')}</div>
        <div className="text-[10px] font-bold opacity-80">cumul {Number(loyalty.lifetime_points ?? 0).toLocaleString('fr-FR')}</div>
        <div className="mt-2 text-[11px] font-bold flex items-center gap-1">
          🔥 Streak: {Number(streak.consecutive_days ?? 0)} jours
          <span className="opacity-60">· {Number(streak.total_visits ?? 0)} visites</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-gray-500">Actions rapides</p>
        {phone ? (
          <a href={`https://wa.me/${e164}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 w-full rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
          >
            <MessageCircle size={14} /> Envoyer WhatsApp
          </a>
        ) : null}
        {phone ? (
          <a href={`tel:${phone}`}
            className="flex items-center gap-2 w-full rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
          >
            <Phone size={14} /> Appeler
          </a>
        ) : null}
        <button onClick={onGrantPoints}
          className="flex items-center gap-2 w-full rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50"
        >
          <Star size={14} /> Créditer / Débiter des points
        </button>
        <button onClick={onAddNotes}
          className="flex items-center gap-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          <BadgeCheck size={14} /> Note interne
        </button>
        {isSuspended ? (
          <button onClick={onReactivate}
            className="flex items-center gap-2 w-full rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
          >
            <ShieldCheck size={14} /> Réactiver
          </button>
        ) : (
          <button onClick={onSuspend}
            className="flex items-center gap-2 w-full rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
          >
            <Ban size={14} /> Suspendre
          </button>
        )}
      </div>

      {/* Notes */}
      {profile.admin_notes ? (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2 text-xs text-yellow-900">
          <div className="font-black text-[10px] uppercase tracking-wide mb-1">Notes admin</div>
          <p className="whitespace-pre-wrap">{String(profile.admin_notes)}</p>
        </div>
      ) : null}

      {/* Recent ledger */}
      {Array.isArray(details?.ledger) && details.ledger.length > 0 ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-500 mb-1">Dernières transactions</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {(details.ledger as Record<string, unknown>[]).slice(0, 8).map((l, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{String(l.event_type ?? '—')}</span>
                <span className={`font-mono font-bold ${Number(l.points_delta) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {Number(l.points_delta) >= 0 ? '+' : ''}{Number(l.points_delta).toLocaleString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Recovery Requests sub-tab ────────────────────────────────────────
function RecoveryRequestsTab({ token, t, onResolved }: {
  token: string | null; t: ReturnType<typeof useAdminUI>['t']; onResolved: () => void;
}) {
  const [list, setList] = useState<AdminRecoveryRequestRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'expired' | ''>('pending');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const rows = await listRecoveryRequestsAdmin(token, statusFilter || null);
      setList(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [token, statusFilter]);

  const onResolve = async (id: string, action: 'approve' | 'reject') => {
    if (!token) return;
    const notes = window.prompt(action === 'approve' ? 'Notes pour l\'approbation (optionnel) :' : 'Raison du rejet :');
    if (action === 'reject' && !notes?.trim()) {
      toast.error('Raison requise pour un rejet.');
      return;
    }
    try {
      const res = await resolveRecoveryRequestAdmin(token, id, action, notes ?? undefined);
      if (res.ok) {
        toast.success(`Demande ${action === 'approve' ? 'approuvée' : 'rejetée'} ${
          res.merged_balance != null ? `(merged ${res.merged_balance} pts)` : ''
        }`);
        await refresh();
        onResolved();
      } else {
        toast.error(res.code ?? 'Action failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-blue-700" />
          <h3 className={`text-sm font-black ${t.text}`}>Demandes de récupération de compte</h3>
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={(v: string) => setStatusFilter(v as typeof statusFilter)}
          options={[
            { value: 'pending',  label: '🟡 En attente' },
            { value: 'approved', label: '✅ Approuvées' },
            { value: 'rejected', label: '❌ Rejetées' },
            { value: 'expired',  label: '⏰ Expirées' },
            { value: '',         label: 'Toutes' },
          ]}
        />
      </div>
      {loading ? (
        <div className="py-12 text-center"><Loader2 className="inline-block animate-spin text-blue-700" /></div>
      ) : list.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          Aucune demande {statusFilter ? statusFilter : ''}.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((req) => (
            <RecoveryRequestRow key={req.id} req={req} onResolve={onResolve} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecoveryRequestRow({ req, onResolve }: {
  req: AdminRecoveryRequestRow;
  onResolve: (id: string, action: 'approve' | 'reject') => void;
}) {
  const trustColor = req.trust_score >= 150 ? 'text-emerald-700' : req.trust_score >= 100 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="rounded-xl border border-gray-200 p-3 hover:border-blue-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <ShieldCheck size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">{req.phone}</span>
              <span className={`rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold ${trustColor}`}>
                Trust {req.trust_score}
              </span>
              {req.trust_score >= 150 ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  ✓ Auto-safe
                </span>
              ) : null}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Demandé {formatDate(req.created_at)} · {req.reason ?? '—'}
            </div>
            <div className="text-[10px] font-mono text-gray-400 mt-0.5">
              old: {req.old_device_id ?? '—'} → new: {req.new_device_id}
            </div>
          </div>
        </div>
        {req.status === 'pending' ? (
          <div className="flex items-center gap-1">
            <button onClick={() => onResolve(req.id, 'approve')}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 size={12} /> Approuver
            </button>
            <button onClick={() => onResolve(req.id, 'reject')}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
            >
              <X size={12} /> Rejeter
            </button>
          </div>
        ) : (
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
            req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
            req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-600'
          }`}>
            {req.status.toUpperCase()}
          </span>
        )}
      </div>
      {req.handled_notes ? (
        <div className="mt-2 rounded bg-gray-50 px-2 py-1 text-[11px] text-gray-600 italic">
          📝 {req.handled_notes}
        </div>
      ) : null}
    </div>
  );
}

// ─── Top Performers sub-tab ───────────────────────────────────────────
function TopPerformersTab({ t }: { t: ReturnType<typeof useAdminUI>['t'] }) {
  const [points, setPoints] = useState<{ rank: number; display_name: string; metric_value: number; wilaya_code: string | null }[]>([]);
  const [streak, setStreak] = useState<typeof points>([]);

  useEffect(() => {
    void getTopPerformersAdmin('points', 10).then(setPoints);
    void getTopPerformersAdmin('streak', 10).then(setStreak);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Leaderboard t={t} title="🏆 Top Points" rows={points} unit="pts" />
      <Leaderboard t={t} title="🔥 Top Streak" rows={streak} unit="jours" />
    </div>
  );
}

function Leaderboard({ t, title, rows, unit }: {
  t: ReturnType<typeof useAdminUI>['t'];
  title: string;
  rows: { rank: number; display_name: string; metric_value: number; wilaya_code: string | null }[];
  unit: string;
}) {
  return (
    <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4`}>
      <h3 className={`text-sm font-black ${t.text} mb-3`}>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">Aucune donnée.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`;
            return (
              <div key={r.rank} className="flex items-center gap-3 rounded-lg bg-gray-50 px-2 py-2">
                <span className="text-base font-black w-8">{medal}</span>
                <span className="flex-1 font-bold text-gray-900 text-sm">{r.display_name}</span>
                {r.wilaya_code ? <span className="text-xs text-gray-500">📍 {r.wilaya_code}</span> : null}
                <span className="font-mono font-bold text-amber-700">{r.metric_value.toLocaleString('fr-FR')} {unit}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeCsv(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

void ArrowDownAZ; void ArrowUpAZ; void ShieldOff; void AlertCircle; // reserved for future
export default MobileUsersManager;
