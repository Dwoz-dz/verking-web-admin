import React, { useEffect, useState, useMemo } from 'react';
import {
  Search, Users, Phone, MapPin, ShoppingBag, TrendingUp, X,
  MessageCircle, Star, Crown, Calendar, ChevronRight, RefreshCw,
  Package, Clock, Award, BarChart3, Filter, Mail, ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';

// ── Types ──
interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  wilaya?: string;
  total_spent: number;
  orders: any[];
  created_at: string;
  type?: 'retail' | 'wholesale';
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

// Customer segment helper
function getSegment(totalSpent: number, orderCount: number): { label: string; color: string; icon: React.ElementType; bg: string } {
  if (totalSpent >= 50000 || orderCount >= 10) return { label: 'VIP', color: 'text-yellow-700', icon: Crown, bg: 'bg-yellow-100 border-yellow-200' };
  if (totalSpent >= 20000 || orderCount >= 5) return { label: 'Fidèle', color: 'text-purple-700', icon: Award, bg: 'bg-purple-100 border-purple-200' };
  if (orderCount >= 2) return { label: 'Régulier', color: 'text-blue-700', icon: Star, bg: 'bg-blue-100 border-blue-200' };
  return { label: 'Nouveau', color: 'text-gray-600', icon: Users, bg: 'bg-gray-100 border-gray-200' };
}

export function AdminCustomers() {
  const { token } = useAuth();
  const { t, isDark } = useAdminUI();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [filterSegment, setFilterSegment] = useState('');
  const [sortBy, setSortBy] = useState<'spent' | 'orders' | 'recent'>('spent');

  useEffect(() => {
    if (!token) return;
    adminApi.get('/customers', token)
      .then(d => setCustomers(d.customers || []))
      .catch(() => toast.error('Impossible de charger les clients.'))
      .finally(() => setLoading(false));
  }, [token]);

  const totalRevenue = useMemo(() => customers.reduce((s, c) => s + (c.total_spent || 0), 0), [customers]);
  const avgOrder = useMemo(() => customers.length > 0 ? Math.round(totalRevenue / customers.length) : 0, [totalRevenue, customers]);
  const vipCount = useMemo(() => customers.filter(c => (c.total_spent || 0) >= 50000 || (c.orders || []).length >= 10).length, [customers]);
  const topSpender = useMemo(() => customers.reduce((best, c) => (c.total_spent || 0) > (best?.total_spent || 0) ? c : best, null as Customer | null), [customers]);

  const sorted = useMemo(() => {
    const list = [...customers];
    if (sortBy === 'spent') list.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
    else if (sortBy === 'orders') list.sort((a, b) => (b.orders || []).length - (a.orders || []).length);
    else list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return list;
  }, [customers, sortBy]);

  const filtered = useMemo(() => sorted.filter(c => {
    if (filterSegment) {
      const seg = getSegment(c.total_spent || 0, (c.orders || []).length);
      if (seg.label !== filterSegment) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return c.name?.toLowerCase().includes(s) || c.phone?.includes(s) ||
        c.wilaya?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
    }
    return true;
  }), [sorted, search, filterSegment]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-[#1A3C6E] animate-spin" />
      <p className={`text-sm font-bold ${t.textMuted}`}>Chargement des clients...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-black ${t.text} tracking-tight`}>Clients</h1>
        <p className={`text-sm ${t.textMuted} mt-1`}>{customers.length} client(s) enregistré(s)</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total clients', value: customers.length, icon: Users, color: '#1A3C6E', sub: 'Tous segments', tooltip: 'Nombre total de clients enregistrés via les commandes' },
          { label: 'CA Client Total', value: `${totalRevenue.toLocaleString()} DA`, icon: TrendingUp, color: '#F57C00', sub: 'Revenue cumulé', tooltip: 'Chiffre d\'affaires total généré par tous les clients' },
          { label: 'Panier Moyen', value: `${avgOrder.toLocaleString()} DA`, icon: ShoppingBag, color: '#16a34a', sub: 'Par client', tooltip: 'Dépense moyenne calculée sur l\'ensemble des clients' },
          { label: 'Clients VIP', value: vipCount, icon: Crown, color: '#d97706', sub: '+50 000 DA ou +10 CMD', tooltip: 'Clients ayant dépensé plus de 50 000 DA ou passé 10 commandes ou plus' },
        ].map((kpi, i) => (
          <Tooltip key={i} label={kpi.tooltip}>
            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-5 shadow-sm flex items-start gap-4 cursor-default w-full`}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow"
                style={{ background: `linear-gradient(135deg, ${kpi.color}, ${kpi.color}cc)` }}>
                <kpi.icon size={19} />
              </div>
              <div className="min-w-0">
                <p className={`text-xl font-black ${t.text} truncate`}>{kpi.value}</p>
                <p className={`text-[10px] font-black ${t.textMuted} uppercase tracking-wide`}>{kpi.label}</p>
                <p className={`text-[10px] ${t.textMuted} mt-0.5`}>{kpi.sub}</p>
              </div>
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Top Spender Banner */}
      {topSpender && (
        <div className={`${isDark ? 'bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-800/40' : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'} border rounded-2xl p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 text-white flex items-center justify-center font-black text-lg shadow">
              {(topSpender.name?.[0] || 'C').toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Crown size={14} className="text-yellow-500" />
                <span className={`text-xs font-black uppercase tracking-wide ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>Meilleur client</span>
              </div>
              <p className={`font-black ${t.text}`}>{topSpender.name}</p>
              <p className={`text-xs ${t.textMuted}`}>{(topSpender.total_spent || 0).toLocaleString()} DA dépensés · {(topSpender.orders || []).length} commandes</p>
            </div>
          </div>
          <button onClick={() => setSelected(topSpender)}
            className={`text-xs font-bold ${isDark ? 'text-yellow-300' : 'text-yellow-700'} hover:underline flex items-center gap-1`}>
            Voir profil <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Segment Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {['', 'VIP', 'Fidèle', 'Régulier', 'Nouveau'].map(seg => (
            <Tooltip key={seg} label={seg ? `Filtrer: clients "${seg}"` : 'Afficher tous les clients'}>
              <button onClick={() => setFilterSegment(seg)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${filterSegment === seg ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]' : `${t.cardBorder} ${t.textMuted} ${t.rowHover}`}`}>
                {seg || `Tous (${customers.length})`}
              </button>
            </Tooltip>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom, téléphone, wilaya..."
            className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`} />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className={`px-4 py-2.5 border rounded-xl text-sm font-semibold focus:outline-none ${t.input}`}>
          <option value="spent">Trier: Dépenses (↓)</option>
          <option value="orders">Trier: Commandes (↓)</option>
          <option value="recent">Trier: Plus récent</option>
        </select>
      </div>

      {/* Table */}
      {customers.length === 0 ? (
        <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-20 text-center`}>
          <Users size={56} className={`mx-auto mb-4 ${t.textMuted} opacity-10`} />
          <p className={`font-bold ${t.text}`}>Aucun client enregistré</p>
          <p className={`text-xs mt-1 ${t.textMuted}`}>Les clients sont ajoutés automatiquement lors des commandes.</p>
        </div>
      ) : (
        <div className={`${t.card} border ${t.cardBorder} rounded-2xl shadow-sm overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={`${t.thead} text-xs ${t.theadText} uppercase tracking-wider border-b ${t.cardBorder}`}>
                <tr>
                  <th className="text-start px-5 py-4">Client</th>
                  <th className="text-start px-4 py-4 hidden sm:table-cell">Téléphone</th>
                  <th className="text-start px-4 py-4 hidden md:table-cell">Wilaya</th>
                  <th className="text-start px-4 py-4">Segment</th>
                  <th className="text-start px-4 py-4">Commandes</th>
                  <th className="text-start px-4 py-4 hidden lg:table-cell">Dépenses</th>
                  <th className="text-start px-4 py-4 hidden xl:table-cell">Client depuis</th>
                  <th className="text-start px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(customer => {
                  const seg = getSegment(customer.total_spent || 0, (customer.orders || []).length);
                  const SegIcon = seg.icon;
                  return (
                    <tr key={customer.id}
                      className={`border-t ${t.rowBorder} ${t.rowHover} transition-colors cursor-pointer`}
                      onClick={() => setSelected(customer)}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl text-white flex items-center justify-center text-sm font-black shrink-0 shadow"
                            style={{ background: 'linear-gradient(135deg, #1A3C6E, #2d5ba5)' }}>
                            {(customer.name?.[0] || 'C').toUpperCase()}
                          </div>
                          <div>
                            <div className={`font-bold text-sm ${t.text}`}>{customer.name || 'Client'}</div>
                            {customer.email && <div className={`text-[10px] ${t.textMuted}`}>{customer.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-4 text-xs ${t.textMuted} hidden sm:table-cell`}>{customer.phone || '-'}</td>
                      <td className={`px-4 py-4 text-xs ${t.textMuted} hidden md:table-cell`}>
                        {customer.wilaya ? (
                          <span className="flex items-center gap-1"><MapPin size={10} />{customer.wilaya}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4">
                        <Tooltip label={`Segment: ${seg.label} — basé sur dépenses et nb commandes`}>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${seg.bg} ${seg.color}`}>
                            <SegIcon size={10} />
                            {seg.label}
                          </span>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-black">
                          {(customer.orders || []).length}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm font-black text-[#1A3C6E]`}>
                            {(customer.total_spent || 0).toLocaleString()} DA
                          </span>
                          {customers.length > 0 && (
                            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'} w-20`}>
                              <div className="h-full rounded-full bg-[#1A3C6E]"
                                style={{ width: `${Math.min(((customer.total_spent || 0) / (topSpender?.total_spent || 1)) * 100, 100)}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-4 text-xs ${t.textMuted} hidden xl:table-cell`}>
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {customer.created_at ? new Date(customer.created_at).toLocaleDateString('fr-FR') : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          {customer.phone && (
                            <Tooltip label="Contacter via WhatsApp">
                              <a href={`https://wa.me/${customer.phone?.replace(/\D/g, '')}?text=Bonjour ${customer.name}...`}
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
                <Users size={40} className="mx-auto mb-4 opacity-10" />
                <p className="font-bold">Aucun client trouvé</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${t.card} rounded-3xl w-full max-w-lg shadow-2xl border ${t.cardBorder} max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between p-5 border-b ${t.divider} sticky top-0 ${t.card} z-10`}>
              <h3 className={`font-black ${t.text}`}>Profil client</h3>
              <button onClick={() => setSelected(null)} className={`p-2 rounded-xl ${t.rowHover}`}>
                <X size={18} className={t.textMuted} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Avatar + Identity */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl text-white flex items-center justify-center text-3xl font-black shadow-xl"
                  style={{ background: 'linear-gradient(135deg, #1A3C6E, #2d5ba5)' }}>
                  {(selected.name?.[0] || 'C').toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {(() => { const seg = getSegment(selected.total_spent || 0, (selected.orders || []).length); const SIcon = seg.icon; return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${seg.bg} ${seg.color}`}>
                        <SIcon size={9} /> {seg.label}
                      </span>
                    ); })()}
                    {selected.type === 'wholesale' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">
                        📦 Grossiste
                      </span>
                    )}
                  </div>
                  <p className={`font-black text-xl ${t.text}`}>{selected.name}</p>
                  <p className={`text-xs ${t.textMuted}`}>
                    Client depuis {selected.created_at ? new Date(selected.created_at).toLocaleDateString('fr-FR') : '-'}
                  </p>
                </div>
              </div>

              {/* Spending Visualization */}
              <div className={`p-4 rounded-2xl border ${t.cardBorder} ${isDark ? 'bg-gray-800/40' : 'bg-gray-50/50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-xs font-black uppercase tracking-wide ${t.textMuted}`}>Volume d'achat</p>
                  <p className={`text-xl font-black text-[#1A3C6E]`}>{(selected.total_spent || 0).toLocaleString()} DA</p>
                </div>
                <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div className="h-full rounded-full bg-gradient-to-r from-[#1A3C6E] to-blue-400 transition-all"
                    style={{ width: `${Math.min(((selected.total_spent || 0) / Math.max(topSpender?.total_spent || 1, 1)) * 100, 100)}%` }} />
                </div>
                <p className={`text-[10px] ${t.textMuted} mt-1.5`}>
                  {topSpender?.id === selected.id ? '🏆 Meilleur client' : `${Math.round(((selected.total_spent || 0) / Math.max(topSpender?.total_spent || 1, 1)) * 100)}% du meilleur client`}
                </p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Phone, label: 'Téléphone', value: selected.phone || '-' },
                  { icon: MapPin, label: 'Wilaya', value: selected.wilaya || '-' },
                  { icon: ShoppingBag, label: 'Commandes', value: `${(selected.orders || []).length} commande(s)` },
                  { icon: TrendingUp, label: 'Total dépensé', value: `${(selected.total_spent || 0).toLocaleString()} DA` },
                ].map(info => (
                  <div key={info.label} className={`p-3 rounded-xl border ${t.cardBorder}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <info.icon size={12} className={t.textMuted} />
                      <span className={`text-[10px] font-bold uppercase ${t.textMuted}`}>{info.label}</span>
                    </div>
                    <p className={`font-black text-sm ${t.text}`}>{info.value}</p>
                  </div>
                ))}
              </div>

              {selected.email && (
                <div className={`p-3 rounded-xl border ${t.cardBorder} flex items-center gap-2`}>
                  <Mail size={14} className={t.textMuted} />
                  <span className={`font-semibold text-sm ${t.text}`}>{selected.email}</span>
                </div>
              )}

              {/* Order History */}
              {(selected.orders || []).length > 0 && (
                <div>
                  <h4 className={`font-bold text-sm mb-3 flex items-center gap-2 ${t.text}`}>
                    <Package size={14} /> Historique des commandes
                  </h4>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {(selected.orders || []).slice(0, 10).map((order: any, i: number) => (
                      <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${t.cardBorder} ${t.rowHover}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#1A3C6E]/10 text-[#1A3C6E] flex items-center justify-center">
                            <Package size={12} />
                          </div>
                          <div>
                            <p className={`text-xs font-mono font-bold ${t.text}`}>{order.order_number || `CMD-${i + 1}`}</p>
                            <p className={`text-[10px] ${t.textMuted}`}>
                              {order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : '-'}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-black text-[#1A3C6E]`}>
                          {(order.total || 0).toLocaleString()} DA
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-2">
                {selected.phone && (
                  <a href={`https://wa.me/${selected.phone?.replace(/\D/g, '')}?text=Bonjour ${selected.name}...`}
                    target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm transition-colors">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                )}
                {selected.phone && (
                  <a href={`tel:${selected.phone}`}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 border ${t.cardBorder} ${t.text} ${t.rowHover} font-bold rounded-xl text-sm transition-colors`}>
                    <Phone size={16} /> Appeler
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
