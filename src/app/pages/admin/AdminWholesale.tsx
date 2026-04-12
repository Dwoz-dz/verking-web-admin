import React, { useEffect, useState, useMemo } from 'react';
import {
  Eye, X, MessageCircle, Mail, Phone, MapPin, Building2, User,
  Clock, CheckCircle2, XCircle, PhoneCall, Calendar, StickyNote,
  RefreshCw, TrendingUp, Inbox, ChevronRight, Star, Filter,
  Briefcase, FileText, Send,
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';

const STATUSES = [
  {
    value: 'pending', label: 'En attente', color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    dot: 'bg-yellow-500', icon: Clock, desc: 'Demande reçue, pas encore traitée'
  },
  {
    value: 'contacted', label: 'Contacté', color: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500', icon: PhoneCall, desc: 'Premier contact établi avec le prospect'
  },
  {
    value: 'approved', label: 'Approuvé', color: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500', icon: CheckCircle2, desc: 'Demande approuvée, partenariat actif'
  },
  {
    value: 'rejected', label: 'Refusé', color: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500', icon: XCircle, desc: 'Demande non retenue'
  },
];

// ── Types ──
interface WholesaleRequest {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email?: string;
  wilaya: string;
  message?: string;
  status: 'pending' | 'contacted' | 'approved' | 'rejected';
  admin_note?: string;
  created_at: string;
}

// ── Tooltip ──
function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-semibold rounded-lg whitespace-nowrap z-50 pointer-events-none shadow-xl">
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

export function AdminWholesale() {
  const { token } = useAuth();
  const { t, isDark } = useAdminUI();
  const [requests, setRequests] = useState<WholesaleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WholesaleRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const d = await adminApi.get('/wholesale', token);
      setRequests(d.requests || []);
    } catch (e) {
      toast.error(`Erreur: ${e}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [token]);

  const updateStatus = async (id: string, status: string) => {
    if (!token) return;
    setUpdatingStatus(true);
    try {
      await adminApi.put(`/wholesale/${id}`, { status }, token);
      const label = STATUSES.find(s => s.value === status)?.label;
      toast.success(`Statut → ${label}`);
      if (selected) setSelected((p: WholesaleRequest | null) => p ? ({ ...p, status: status as WholesaleRequest['status'] }) : null);
      load(true);
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setUpdatingStatus(false); }
  };

  const saveNote = async () => {
    if (!token || !selected) return;
    setSavingNote(true);
    try {
      await adminApi.put(`/wholesale/${selected.id}`, { admin_note: adminNote }, token);
      setSelected((p: WholesaleRequest | null) => p ? ({ ...p, admin_note: adminNote }) : null);
      toast.success('Note enregistrée');
      setShowNoteEditor(false);
      load(true);
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setSavingNote(false); }
  };

  const filtered = useMemo(() => requests.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return r.company_name?.toLowerCase().includes(s) ||
        r.contact_name?.toLowerCase().includes(s) ||
        r.phone?.includes(s) || r.wilaya?.toLowerCase().includes(s);
    }
    return true;
  }), [requests, filterStatus, search]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-[#1A3C6E] animate-spin" />
      <p className={`text-sm font-bold ${t.textMuted}`}>Chargement des demandes grossiste...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-3xl font-black ${t.text} tracking-tight`}>Demandes Grossiste</h1>
          <p className={`text-sm ${t.textMuted} mt-1`}>{requests.length} demande(s) au total · Pipeline B2B</p>
        </div>
        <Tooltip label="Rafraîchir la liste">
          <button onClick={() => load(false)}
            className={`p-2.5 rounded-xl border ${t.cardBorder} ${t.rowHover} ${t.textMuted} transition-all`}>
            <RefreshCw size={18} />
          </button>
        </Tooltip>
      </div>

      {/* Pipeline KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUSES.map(s => {
          const count = requests.filter(r => r.status === s.value).length;
          const Icon = s.icon;
          return (
            <Tooltip key={s.value} label={s.desc}>
              <button onClick={() => setFilterStatus(filterStatus === s.value ? '' : s.value)}
                className={`${t.card} border rounded-2xl p-5 shadow-sm w-full transition-all hover:shadow-md ${filterStatus === s.value ? `border-current ${s.color}` : `${t.cardBorder}`}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${s.dot} ${filterStatus === s.value ? 'scale-125' : ''} transition-transform`} />
                </div>
                <p className={`text-3xl font-black ${t.text}`}>{count}</p>
                <p className={`text-[10px] font-black uppercase tracking-wide ${t.textMuted} mt-1`}>{s.label}</p>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Building2 size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Entreprise, contact, wilaya, téléphone..."
            className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`} />
        </div>
        {(filterStatus || search) && (
          <button onClick={() => { setFilterStatus(''); setSearch(''); }}
            className={`px-4 py-2.5 border rounded-xl text-sm font-semibold ${t.cardBorder} ${t.textMuted} ${t.rowHover} transition-all flex items-center gap-2`}>
            <X size={14} /> Effacer
          </button>
        )}
      </div>

      {/* Table */}
      <div className={`${t.card} border ${t.cardBorder} rounded-2xl shadow-sm overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`${t.thead} text-xs ${t.theadText} uppercase tracking-wider border-b ${t.cardBorder}`}>
              <tr>
                <th className="text-start px-5 py-4">Entreprise</th>
                <th className="text-start px-4 py-4">Contact</th>
                <th className="text-start px-4 py-4 hidden sm:table-cell">Wilaya</th>
                <th className="text-start px-4 py-4">Statut</th>
                <th className="text-start px-4 py-4 hidden md:table-cell">Note admin</th>
                <th className="text-start px-4 py-4 hidden lg:table-cell">Date</th>
                <th className="text-start px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(req => {
                const status = STATUSES.find(s => s.value === req.status);
                const Icon = status?.icon || Clock;
                return (
                  <tr key={req.id}
                    className={`border-t ${t.rowBorder} ${t.rowHover} transition-colors cursor-pointer`}
                    onClick={() => { setSelected(req); setAdminNote(req.admin_note || ''); setShowNoteEditor(false); }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A3C6E] to-blue-500 text-white flex items-center justify-center text-xs font-black shrink-0">
                          {(req.company_name?.[0] || 'E').toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${t.text}`}>{req.company_name}</p>
                          {req.admin_note && <p className={`text-[10px] ${t.textMuted} flex items-center gap-0.5`}><StickyNote size={8} /> Note</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className={`text-sm font-semibold ${t.text}`}>{req.contact_name}</p>
                      <p className={`text-xs ${t.textMuted}`}>{req.phone}</p>
                    </td>
                    <td className={`px-4 py-4 text-xs ${t.textMuted} hidden sm:table-cell`}>
                      {req.wilaya ? <span className="flex items-center gap-1"><MapPin size={10} />{req.wilaya}</span> : '-'}
                    </td>
                    <td className="px-4 py-4">
                      <Tooltip label={status?.desc || ''}>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border ${status?.color}`}>
                          <Icon size={10} /> {status?.label}
                        </span>
                      </Tooltip>
                    </td>
                    <td className={`px-4 py-4 text-xs ${t.textMuted} hidden md:table-cell max-w-[160px]`}>
                      {req.admin_note
                        ? <span className="truncate block italic">{req.admin_note}</span>
                        : <span className="opacity-40 italic">—</span>
                      }
                    </td>
                    <td className={`px-4 py-4 text-xs ${t.textMuted} hidden lg:table-cell`}>
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(req.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <Tooltip label="Voir le détail de la demande">
                          <button onClick={e => { e.stopPropagation(); setSelected(req); setAdminNote(req.admin_note || ''); setShowNoteEditor(false); }}
                            className="p-2 rounded-xl text-blue-500 hover:bg-blue-50 transition-colors">
                            <Eye size={14} />
                          </button>
                        </Tooltip>
                        {req.phone && (
                          <Tooltip label="Contacter par WhatsApp">
                            <a href={`https://wa.me/${req.phone?.replace(/\D/g, '')}?text=Bonjour ${req.contact_name}, concernant votre demande grossiste chez VERKING SCOLAIRE...`}
                              target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="p-2 rounded-xl text-green-600 hover:bg-green-50 transition-colors">
                              <MessageCircle size={14} />
                            </a>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className={`py-20 text-center ${t.textMuted}`}>
              <Inbox size={48} className="mx-auto mb-4 opacity-10" />
              <p className="font-bold">Aucune demande trouvée</p>
              <p className="text-xs mt-1">Partagez votre page Grossiste pour recevoir des demandes</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${t.card} rounded-3xl w-full max-w-lg shadow-2xl border ${t.cardBorder} max-h-[90vh] flex flex-col`}>
            <div className={`flex items-center justify-between p-5 border-b ${t.divider} shrink-0`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A3C6E] to-blue-500 text-white flex items-center justify-center font-black text-lg">
                  {(selected.company_name?.[0] || 'E').toUpperCase()}
                </div>
                <div>
                  <h2 className={`font-black text-lg ${t.text}`}>{selected.company_name}</h2>
                  <p className={`text-xs ${t.textMuted}`}>Demande du {new Date(selected.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className={`p-2 rounded-xl ${t.rowHover}`}>
                <X size={18} className={t.textMuted} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Pipeline Stage */}
              <div className="flex items-center justify-between">
                <p className={`text-xs font-black uppercase tracking-wide ${t.textMuted}`}>Étape du pipeline</p>
                {(() => {
                  const status = STATUSES.find(s => s.value === selected.status);
                  const Icon = status?.icon || Clock;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border ${status?.color}`}>
                      <Icon size={12} /> {status?.label}
                    </span>
                  );
                })()}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: User, label: 'Contact', value: selected.contact_name },
                  { icon: Phone, label: 'Téléphone', value: selected.phone },
                  { icon: Mail, label: 'Email', value: selected.email || '-' },
                  { icon: MapPin, label: 'Wilaya', value: selected.wilaya },
                ].map(item => (
                  <div key={item.label} className={`p-3 rounded-xl border ${t.cardBorder}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <item.icon size={11} className={t.textMuted} />
                      <p className={`text-[10px] font-bold uppercase ${t.textMuted}`}>{item.label}</p>
                    </div>
                    <p className={`font-bold text-sm ${t.text} truncate`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Message */}
              {selected.message && (
                <div className={`rounded-xl p-4 ${isDark ? 'bg-blue-900/15 border-blue-800/30' : 'bg-blue-50 border-blue-100'} border`}>
                  <p className={`text-xs font-black uppercase tracking-wide mb-2 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                    <FileText size={11} className="inline mr-1" />Message du prospect
                  </p>
                  <p className={`text-sm ${t.text} leading-relaxed italic`}>{selected.message}</p>
                </div>
              )}

              {/* Admin Note */}
              <div className={`rounded-2xl p-4 border ${isDark ? 'border-yellow-800/40 bg-yellow-900/10' : 'border-yellow-200 bg-yellow-50/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-bold text-sm flex items-center gap-2 ${t.text}`}>
                    <StickyNote size={14} className="text-yellow-500" /> Note interne
                  </h4>
                  <button onClick={() => setShowNoteEditor(!showNoteEditor)}
                    className="text-xs text-yellow-600 font-bold hover:underline">
                    {showNoteEditor ? 'Annuler' : (selected.admin_note ? 'Modifier' : '+ Ajouter')}
                  </button>
                </div>
                {!showNoteEditor && selected.admin_note
                  ? <p className={`text-sm ${t.text} italic`}>{selected.admin_note}</p>
                  : !showNoteEditor && <p className={`text-xs ${t.textMuted} italic`}>Aucune note. Cliquez "+ Ajouter".</p>
                }
                {showNoteEditor && (
                  <div className="space-y-2 mt-2">
                    <textarea rows={3} value={adminNote} onChange={e => setAdminNote(e.target.value)}
                      placeholder="Suivi, remarques, décision..."
                      className={`w-full px-3 py-2.5 border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400/30 ${t.input}`} />
                    <button onClick={saveNote} disabled={savingNote}
                      className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50">
                      {savingNote ? 'Enregistrement...' : 'Sauvegarder'}
                    </button>
                  </div>
                )}
              </div>

              {/* Status Update */}
              <div>
                <h4 className={`font-bold text-sm mb-3 ${t.text}`}>Changer le statut</h4>
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map(s => {
                    const Icon = s.icon;
                    const isActive = selected.status === s.value;
                    return (
                      <Tooltip key={s.value} label={s.desc}>
                        <button onClick={() => updateStatus(selected.id, s.value)}
                          disabled={updatingStatus || isActive}
                          className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border w-full ${
                            isActive ? `${s.color} border-current shadow-md` : `${t.cardBorder} ${t.textMuted} ${t.rowHover} disabled:opacity-40`
                          }`}>
                          <Icon size={12} /> {s.label}
                          {isActive && <span className="text-[8px] ml-1">✓</span>}
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Contact Actions */}
              <div className="flex gap-2">
                <a href={`https://wa.me/${selected.phone?.replace(/\D/g, '')}?text=Bonjour ${selected.contact_name}, concernant votre demande grossiste chez VERKING SCOLAIRE...`}
                  target="_blank" rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm transition-colors">
                  <MessageCircle size={15} /> WhatsApp
                </a>
                {selected.email && (
                  <a href={`mailto:${selected.email}?subject=Demande grossiste VERKING SCOLAIRE`}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 border ${t.cardBorder} ${t.text} ${t.rowHover} font-bold rounded-xl text-sm transition-colors`}>
                    <Mail size={15} /> Email
                  </a>
                )}
                <a href={`tel:${selected.phone}`}
                  className={`px-4 flex items-center justify-center gap-2 py-3 border ${t.cardBorder} ${t.text} ${t.rowHover} font-bold rounded-xl text-sm transition-colors`}>
                  <Phone size={15} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}