import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Search, Eye, X, Phone, MapPin, Package, DollarSign, ClipboardList,
  MessageCircle, Printer, RefreshCw, StickyNote, ChevronRight, Clock,
  CheckCircle2, Truck, AlertTriangle, XCircle, RotateCcw, Filter,
  ChevronDown, Download, Calendar, TrendingUp, ShoppingBag, User,
} from 'lucide-react';
import { adminApi, ORDER_STATUSES, PAYMENT_METHODS } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export interface OrderItem {
  id: string;
  name_fr: string;
  name_ar: string;
  price: number;
  qty: number;
  image?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_wilaya: string;
  customer_address: string;
  delivery_type: 'home_delivery' | 'store_pickup';
  payment_method: string;
  status: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  notes?: string;
  admin_note?: string;
  created_at: string;
  items: OrderItem[];
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

// Status icon mapping
const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  confirmed: CheckCircle2,
  processing: RotateCcw,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
  refunded: AlertTriangle,
};

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const COLOR_DOT: Record<string, string> = {
  blue: 'bg-blue-500', green: 'bg-green-500', yellow: 'bg-yellow-500',
  red: 'bg-red-500', purple: 'bg-purple-500', indigo: 'bg-indigo-500',
};

export function AdminOrders() {
  const { token } = useAuth();
  const { t, isDark } = useAdminUI();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [dateFilter, setDateFilter] = useState('');

  const load = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const d = await adminApi.get('/orders', token);
      // Sort orders by date descending
      const sorted = (d.orders || []).sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setOrders(sorted);
    } catch (e) {
      toast.error(`Erreur chargement: ${e}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const filtered = useMemo(() => orders.filter(o => {
    if (filterStatus && o.status !== filterStatus) return false;
    if (dateFilter) {
      const created = new Date(o.created_at).getTime();
      const now = Date.now();
      const day = 86400000;
      if (dateFilter === 'today') {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        if (created < start.getTime()) return false;
      } else if (dateFilter === 'yesterday') {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = start.getTime();
        start.setDate(start.getDate() - 1);
        if (created < start.getTime() || created >= end) return false;
      } else if (dateFilter === '7days') {
        if (created < now - 7 * day) return false;
      }
    }
    if (search) {
      const s = search.toLowerCase();
      return o.order_number?.toLowerCase().includes(s) ||
        o.customer_name?.toLowerCase().includes(s) ||
        o.customer_phone?.includes(s);
    }
    return true;
  }), [orders, filterStatus, search, dateFilter]);

  const stats = useMemo(() => ({
    total: orders.length,
    revenue: orders.reduce((s, o) => s + (o.total || 0), 0),
    pending: orders.filter(o => o.status === 'pending').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }), [orders]);

  const updateStatus = async (orderId: string, status: string) => {
    if (!token) return;
    setUpdatingStatus(true);
    try {
      await adminApi.put(`/orders/${orderId}`, { status }, token);
      const label = ORDER_STATUSES.find(s => s.value === status)?.label_fr;
      toast.success(`Statut mis à jour → ${label}`);
      if (selected) setSelected(p => p ? { ...p, status } : null);
      load(true);
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setUpdatingStatus(false); }
  };

  const saveNote = async () => {
    if (!token || !selected || !adminNote.trim()) return;
    setSavingNote(true);
    try {
      await adminApi.put(`/orders/${selected.id}`, { admin_note: adminNote }, token);
      setSelected(p => p ? { ...p, admin_note: adminNote } : null);
      toast.success('Note enregistrée');
      setShowNoteInput(false);
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setSavingNote(false); }
  };

  const handlePrint = () => {
    if (!selected) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Commande ${selected.order_number}</title>
      <style>body{font-family:sans-serif;padding:40px;max-width:600px;margin:auto}h1{font-size:24px;font-weight:900}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #eee;text-align:left}.total{font-size:18px;font-weight:900}.badge{padding:4px 12px;border-radius:99px;font-weight:700;font-size:11px}</style>
      </head><body>
      <h1>Commande ${selected.order_number}</h1>
      <p>${new Date(selected.created_at).toLocaleString('fr-FR')}</p>
      <hr/><h3>Client</h3>
      <p>${selected.customer_name} — ${selected.customer_phone}</p>
      <p>${selected.customer_wilaya || ''} ${selected.customer_address || ''}</p>
      <hr/><h3>Articles</h3>
      <table><tr><th>Produit</th><th>Qté</th><th>Prix</th></tr>
      ${(selected.items || []).map((i: OrderItem) => `<tr><td>${i.name_fr}</td><td>${i.qty}</td><td>${((i.price || 0) * (i.qty || 1)).toLocaleString()} DA</td></tr>`).join('')}
      </table><hr/>
      <p>Sous-total: ${(selected.subtotal || 0).toLocaleString()} DA</p>
      <p>Livraison: ${(selected.shipping || 0).toLocaleString()} DA</p>
      <p class="total">Total: ${(selected.total || 0).toLocaleString()} DA</p>
      </body></html>`);
    w.document.close();
    w.print();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-[#1A3C6E] animate-spin" />
      <p className={`text-sm font-bold ${t.textMuted}`}>Chargement des commandes...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-3xl font-black ${t.text} tracking-tight`}>Commandes</h1>
          <p className={`text-sm ${t.textMuted} mt-1`}>{orders.length} commande(s) au total</p>
        </div>
        <Tooltip label="Rafraîchir la liste des commandes">
          <button onClick={() => load(true)} disabled={refreshing}
            className={`p-2.5 rounded-xl border ${t.cardBorder} ${t.rowHover} ${t.textMuted} transition-all`}>
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </Tooltip>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total commandes', value: stats.total, icon: ShoppingBag, color: '#1A3C6E', sub: 'Toutes périodes' },
          { label: 'CA Total', value: `${stats.revenue.toLocaleString()} DA`, icon: TrendingUp, color: '#16a34a', sub: 'Chiffre d\'affaires' },
          { label: 'En attente', value: stats.pending, icon: Clock, color: '#F57C00', sub: 'À traiter' },
          { label: 'Livrées', value: stats.delivered, icon: CheckCircle2, color: '#7c3aed', sub: 'Complétées' },
        ].map((kpi, i) => (
          <div key={i} className={`${t.card} border ${t.cardBorder} rounded-2xl p-5 shadow-sm flex items-center gap-4`}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow"
              style={{ background: `linear-gradient(135deg, ${kpi.color}, ${kpi.color}cc)` }}>
              <kpi.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className={`text-xl font-black ${t.text} truncate`}>{kpi.value}</p>
              <p className={`text-xs font-bold ${t.textMuted} uppercase tracking-wide`}>{kpi.label}</p>
              <p className={`text-[10px] ${t.textMuted} mt-0.5`}>{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterStatus('')}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${!filterStatus ? 'bg-[#1A3C6E] text-white border-[#1A3C6E] shadow-md' : `${t.cardBorder} ${t.textMuted} ${t.rowHover}`}`}>
          Tous ({orders.length})
        </button>
        {ORDER_STATUSES.map(s => {
          const count = orders.filter(o => o.status === s.value).length;
          const Icon = STATUS_ICONS[s.value] || Clock;
          return (
            <Tooltip key={s.value} label={`Filtrer par: ${s.label_fr}`}>
              <button onClick={() => setFilterStatus(filterStatus === s.value ? '' : s.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${filterStatus === s.value ? `${COLOR_MAP[s.color]} border-current shadow-md` : `${t.cardBorder} ${t.textMuted} ${t.rowHover}`}`}>
                <Icon size={12} />
                {s.label_fr} ({count})
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Search + Filter Bar */}
      <div className="flex gap-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="N° commande, nom, téléphone..."
            className={`w-full pl-11 pr-4 py-3.5 border rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 transition-all ${t.input} border-gray-100 focus:border-blue-100 focus:ring-blue-50`} />
          {search && (
            <button onClick={() => setSearch('')} className={`absolute right-4 top-1/2 -translate-y-1/2 ${t.textMuted} hover:text-red-500`}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {[
            { label: "Aujourd'hui", range: 'today' },
            { label: 'Hier', range: 'yesterday' },
            { label: '7 derniers jours', range: '7days' },
          ].map(r => (
            <button key={r.range}
              onClick={() => setDateFilter(dateFilter === r.range ? '' : r.range)}
              className={`px-4 py-3 rounded-2xl text-xs font-black border transition-all ${dateFilter === r.range ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]' : `${t.cardBorder} ${t.textMuted} hover:bg-gray-50`}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={`${t.card} border ${t.cardBorder} rounded-2xl shadow-sm overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`${t.thead} text-xs ${t.theadText} uppercase tracking-wider border-b ${t.cardBorder}`}>
              <tr>
                <th className="text-start px-5 py-4">N° Commande</th>
                <th className="text-start px-4 py-4">Client</th>
                <th className="text-start px-4 py-4 hidden sm:table-cell">Total</th>
                <th className="text-start px-4 py-4 hidden md:table-cell">Paiement</th>
                <th className="text-start px-4 py-4">Statut</th>
                <th className="text-start px-4 py-4 hidden lg:table-cell">Date</th>
                <th className="text-start px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const status = ORDER_STATUSES.find(s => s.value === order.status);
                const pm = PAYMENT_METHODS.find(p => p.value === order.payment_method);
                const Icon = STATUS_ICONS[order.status] || Clock;
                return (
                  <tr key={order.id} className={`border-t ${t.rowBorder} ${t.rowHover} transition-colors cursor-pointer`}
                    onClick={() => { setSelected(order); setAdminNote(order.admin_note || ''); setShowNoteInput(false); }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                         <div className="font-mono text-xs font-black text-[#1A3C6E]">{order.order_number}</div>
                         {new Date(order.created_at).getTime() > Date.now() - 3600000 && (
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-500/50" />
                         )}
                      </div>
                      {order.admin_note && (
                        <div className={`text-[10px] mt-0.5 ${t.textMuted} flex items-center gap-1 font-bold`}>
                          <StickyNote size={9} /> Note admin
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1A3C6E] to-[#2d5ba5] text-white flex items-center justify-center text-xs font-black shrink-0">
                          {(order.customer_name?.[0] || 'C').toUpperCase()}
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${t.text}`}>{order.customer_name}</div>
                          <div className={`text-[10px] ${t.textMuted}`}>{order.customer_phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-4 font-black text-sm hidden sm:table-cell text-[#1A3C6E]`}>
                      {(order.total || 0).toLocaleString()} DA
                    </td>
                    <td className={`px-4 py-4 text-xs ${t.textMuted} hidden md:table-cell`}>{pm?.icon} {pm?.label_fr}</td>
                    <td className="px-4 py-4">
                      <Tooltip label={`Statut actuel: ${status?.label_fr}`}>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border ${COLOR_MAP[status?.color || 'blue']}`}>
                          <Icon size={10} />
                          {status?.label_fr}
                        </span>
                      </Tooltip>
                    </td>
                    <td className={`px-4 py-4 text-xs ${t.textMuted} hidden lg:table-cell`}>
                      <div className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(order.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <Tooltip label="Voir le détail de la commande">
                          <button onClick={e => { e.stopPropagation(); setSelected(order); setAdminNote(order.admin_note || ''); setShowNoteInput(false); }}
                            className="p-2 rounded-xl text-blue-500 hover:bg-blue-50 transition-colors">
                            <Eye size={14} />
                          </button>
                        </Tooltip>
                        {order.customer_phone && (
                          <Tooltip label="Contacter via WhatsApp">
                            <a href={`https://wa.me/${order.customer_phone?.replace(/\D/g, '')}?text=Bonjour ${order.customer_name}, concernant votre commande ${order.order_number}...`}
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
              <ClipboardList size={48} className="mx-auto mb-4 opacity-10" />
              <p className="font-bold">Aucune commande trouvée</p>
              {(search || filterStatus) && (
                <button onClick={() => { setSearch(''); setFilterStatus(''); }}
                  className="mt-3 text-xs text-blue-600 hover:underline">
                  Effacer les filtres
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${t.card} rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col border ${t.cardBorder}`}>
            
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-5 border-b ${t.divider} shrink-0`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1A3C6E] text-white flex items-center justify-center">
                  <Package size={18} />
                </div>
                <div>
                  <h2 className={`font-black text-lg ${t.text}`}>{selected.order_number}</h2>
                  <p className={`text-xs ${t.textMuted}`}>{new Date(selected.created_at).toLocaleString('fr-FR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip label="Imprimer / Exporter la commande">
                  <button onClick={handlePrint}
                    className={`p-2 rounded-xl ${t.rowHover} ${t.textMuted} transition-colors`}>
                    <Printer size={16} />
                  </button>
                </Tooltip>
                {selected.customer_phone && (
                  <Tooltip label="Contacter le client sur WhatsApp">
                    <a href={`https://wa.me/${selected.customer_phone?.replace(/\D/g, '')}?text=Bonjour ${selected.customer_name}, concernant votre commande ${selected.order_number}...`}
                      target="_blank" rel="noreferrer"
                      className="p-2 rounded-xl text-green-600 hover:bg-green-50 transition-colors">
                      <MessageCircle size={16} />
                    </a>
                  </Tooltip>
                )}
                <button onClick={() => setSelected(null)} className={`p-2 rounded-xl ${t.rowHover}`}>
                  <X size={18} className={t.textMuted} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Status Timeline */}
              <div className={`rounded-2xl p-4 border ${t.cardBorder}`}>
                <h3 className={`font-bold text-sm mb-4 flex items-center gap-2 ${t.text}`}>
                  <Clock size={14} /> Statut de la commande
                </h3>
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {ORDER_STATUSES.slice(0, 5).map((s, i, arr) => {
                    const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
                    const currentIdx = statusOrder.indexOf(selected.status);
                    const stepIdx = statusOrder.indexOf(s.value);
                    const isPast = stepIdx < currentIdx;
                    const isCurrent = s.value === selected.status;
                    const Icon = STATUS_ICONS[s.value] || Clock;
                    return (
                      <React.Fragment key={s.value}>
                        <div className="flex flex-col items-center gap-1 min-w-[60px]">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                            isCurrent ? 'border-[#1A3C6E] bg-[#1A3C6E] text-white shadow-lg scale-110' :
                            isPast ? 'border-green-500 bg-green-500 text-white' :
                            isDark ? 'border-gray-700 bg-gray-800 text-gray-500' : 'border-gray-200 bg-gray-50 text-gray-300'
                          }`}>
                            <Icon size={13} />
                          </div>
                          <span className={`text-[9px] font-bold text-center leading-tight ${isCurrent ? 'text-[#1A3C6E]' : isPast ? 'text-green-600' : t.textMuted}`}>
                            {s.label_fr}
                          </span>
                        </div>
                        {i < arr.length - 1 && (
                          <div className={`flex-1 h-0.5 mt-[-12px] min-w-[20px] ${isPast || isCurrent ? 'bg-green-400' : isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Customer Info (Upgraded) */}
              <div className={`rounded-3xl p-6 border ${t.cardBorder} shadow-sm relative overflow-hidden`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className={`font-black text-sm ${t.text}`}>Détails du Client</h3>
                    <p className={`text-[10px] ${t.textMuted} font-bold uppercase tracking-widest`}>Verification Identity</p>
                  </div>
                  <div className="ms-auto">
                     <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-tighter shadow-sm">Client Vérifié</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                       <User size={16} className="text-gray-400 mt-0.5" />
                       <div>
                         <p className={`text-[10px] font-black uppercase text-gray-400 tracking-wider`}>Nom complet</p>
                         <p className={`font-black text-sm mt-0.5 ${t.text}`}>{selected.customer_name}</p>
                       </div>
                    </div>
                    <div className="flex items-start gap-3">
                       <Phone size={16} className="text-gray-400 mt-0.5" />
                       <div>
                         <p className={`text-[10px] font-black uppercase text-gray-400 tracking-wider`}>Téléphone</p>
                         <p className={`font-black text-sm mt-0.5 ${t.text}`}>{selected.customer_phone}</p>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                       <Truck size={16} className="text-gray-400 mt-0.5" />
                       <div>
                         <p className={`text-[10px] font-black uppercase text-gray-400 tracking-wider`}>Mode de Livraison</p>
                         <p className={`font-black text-sm mt-0.5 ${t.text}`}>{selected.delivery_type === 'store_pickup' ? '🏪 Retrait Magasin' : '🚚 Livraison à Domicile'}</p>
                       </div>
                    </div>
                    <div className="flex items-start gap-3">
                       <MapPin size={16} className="text-gray-400 mt-0.5" />
                       <div>
                         <p className={`text-[10px] font-black uppercase text-gray-400 tracking-wider`}>Wilaya & Adresse</p>
                         <p className={`font-black text-sm mt-0.5 ${t.text} line-clamp-2`}>{selected.customer_wilaya || '-'}, {selected.customer_address || '-'}</p>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className={`font-bold text-sm mb-3 flex items-center gap-2 ${t.text}`}>
                  <Package size={14} /> Articles commandés ({(selected.items || []).length})
                </h3>
                <div className="space-y-2">
                  {(selected.items || []).map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${t.rowHover} border ${t.cardBorder}`}>
                      {item.image
                        ? <img src={item.image} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 shadow" />
                        : <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}><Package size={20} className={t.textMuted} /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${t.text}`}>{item.name_fr}</p>
                        <p className={`text-xs ${t.textMuted}`}>{item.qty} × {(item.price || 0).toLocaleString()} DA</p>
                      </div>
                      <p className={`text-sm font-black shrink-0 ${t.text}`}>{((item.price || 0) * (item.qty || 1)).toLocaleString()} DA</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className={`rounded-2xl p-4 border ${t.cardBorder} space-y-2`}>
                <div className={`flex justify-between text-sm ${t.textMuted}`}><span>Sous-total</span><span>{(selected.subtotal || 0).toLocaleString()} DA</span></div>
                <div className={`flex justify-between text-sm ${t.textMuted}`}><span>Livraison</span><span>{(selected.shipping || 0).toLocaleString()} DA</span></div>
                {selected.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600"><span>Remise</span><span>-{(selected.discount || 0).toLocaleString()} DA</span></div>
                )}
                <div className={`flex justify-between font-black text-lg border-t ${t.divider} pt-3 ${t.text}`}>
                  <span>Total</span><span className="text-[#1A3C6E]">{(selected.total || 0).toLocaleString()} DA</span>
                </div>
              </div>

              {/* Customer Notes */}
              {selected.notes && (
                <div className={`rounded-xl p-3 text-xs ${isDark ? 'bg-yellow-900/20 border-yellow-800/40 text-yellow-300' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
                  <div className="flex items-center gap-1.5 font-bold mb-1"><StickyNote size={12} /> Note client</div>
                  {selected.notes}
                </div>
              )}

              {/* Admin Notes */}
              <div className={`rounded-2xl p-4 border ${isDark ? 'border-blue-800/40 bg-blue-900/10' : 'border-blue-100 bg-blue-50/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-bold text-sm flex items-center gap-2 ${t.text}`}><StickyNote size={14} className="text-blue-500" /> Note admin</h3>
                  <button onClick={() => setShowNoteInput(!showNoteInput)}
                    className="text-xs text-blue-600 font-bold hover:underline">
                    {showNoteInput ? 'Annuler' : (selected.admin_note ? 'Modifier' : '+ Ajouter')}
                  </button>
                </div>
                {!showNoteInput && selected.admin_note && (
                  <p className={`text-sm ${t.text} italic`}>{selected.admin_note}</p>
                )}
                {!showNoteInput && !selected.admin_note && (
                  <p className={`text-xs ${t.textMuted} italic`}>Aucune note admin. Cliquez sur "+ Ajouter".</p>
                )}
                {showNoteInput && (
                  <div className="space-y-2 mt-2">
                    <textarea rows={3} value={adminNote} onChange={e => setAdminNote(e.target.value)}
                      placeholder="Ajouter une note interne sur cette commande..."
                      className={`w-full px-3 py-2.5 border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`} />
                    <button onClick={saveNote} disabled={savingNote || !adminNote.trim()}
                      className="px-4 py-2 bg-[#1A3C6E] text-white text-xs font-bold rounded-xl hover:bg-[#0d2447] disabled:opacity-50 transition-colors">
                      {savingNote ? 'Enregistrement...' : 'Sauvegarder la note'}
                    </button>
                  </div>
                )}
              </div>

              {/* Order Lifecycle Actions (Upgraded) */}
              <div className={`rounded-3xl p-6 border ${t.cardBorder} bg-gradient-to-br transition-all ${isDark ? 'from-gray-800 to-gray-900' : 'from-white to-gray-50'}`}>
                <h3 className={`font-black text-sm mb-5 flex items-center gap-2 ${t.text}`}>
                  <RefreshCw size={14} className="text-[#1A3C6E]" /> Cycle de Vie de la Commande
                </h3>
                
                <div className="space-y-4">
                   {/* Main Action Button */}
                   {selected.status === 'new' && (
                     <button onClick={() => updateStatus(selected.id, 'confirmed')} disabled={updatingStatus}
                       className="w-full py-5 bg-[#1A3C6E] text-white font-black rounded-2xl shadow-xl shadow-blue-900/10 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                       <CheckCircle2 size={20} /> Confirmer la Commande
                     </button>
                   )}
                   {selected.status === 'confirmed' && (
                     <button onClick={() => updateStatus(selected.id, 'processing')} disabled={updatingStatus}
                       className="w-full py-5 bg-amber-500 text-white font-black rounded-2xl shadow-xl shadow-amber-900/10 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                       <RotateCcw size={20} /> Lancer la Préparation
                     </button>
                   )}
                   {selected.status === 'processing' && (
                     <button onClick={() => updateStatus(selected.id, 'shipped')} disabled={updatingStatus}
                       className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-900/10 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                       <Truck size={20} /> Marquer comme Expédiée
                     </button>
                   )}
                   {selected.status === 'shipped' && (
                     <button onClick={() => updateStatus(selected.id, 'delivered')} disabled={updatingStatus}
                       className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-900/10 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                       <CheckCircle2 size={20} /> Confirmer la Livraison
                     </button>
                   )}

                   {/* Secondary/Danger Actions */}
                   <div className="grid grid-cols-2 gap-3">
                     {['delivered', 'cancelled', 'refunded'].indexOf(selected.status) === -1 && (
                       <button onClick={() => { if(confirm('Annuler cette commande ?')) updateStatus(selected.id, 'cancelled'); }} disabled={updatingStatus}
                         className={`py-3.5 rounded-2xl font-bold text-xs border ${t.cardBorder} text-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-2`}>
                         <XCircle size={14} /> Annuler
                       </button>
                     )}
                     {selected.status === 'delivered' && (
                       <button onClick={() => updateStatus(selected.id, 'refunded')} disabled={updatingStatus}
                         className={`py-3.5 rounded-2xl font-bold text-xs border ${t.cardBorder} text-amber-600 hover:bg-amber-50 transition-all flex items-center justify-center gap-2`}>
                         <AlertTriangle size={14} /> Rembourser
                       </button>
                     )}
                     <button onClick={() => setShowNoteInput(true)}
                       className={`py-3.5 rounded-2xl font-bold text-xs border ${t.cardBorder} ${t.textMuted} hover:bg-gray-100 transition-all flex items-center justify-center gap-2`}>
                       <StickyNote size={14} /> Note Interne
                     </button>
                   </div>

                   {/* Quick Status Change (Small icons for direct jump) */}
                   <div className="pt-4 border-t border-dashed border-gray-200">
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Changement d'état rapide</p>
                     <div className="flex gap-2">
                       {ORDER_STATUSES.map(s => {
                         const Icon = STATUS_ICONS[s.value] || Clock;
                         return (
                           <Tooltip key={s.value} label={s.label_fr}>
                             <button onClick={() => updateStatus(selected.id, s.value)} disabled={updatingStatus || selected.status === s.value}
                               className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${selected.status === s.value ? `${COLOR_MAP[s.color]} border-current shadow-inner` : `${t.cardBorder} ${t.textMuted} ${t.rowHover} opacity-40 hover:opacity-100`}`}>
                               <Icon size={14} />
                             </button>
                           </Tooltip>
                         );
                       })}
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}