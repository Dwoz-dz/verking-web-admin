/**
 * MobileShippingManager — per-wilaya shipping config editor.
 *
 * Loads the 58 wilayas joined with their `mobile_shipping_zones` row,
 * groups them by region (Centre / Est / Ouest / Sud) and lets the admin
 * edit fee / ETA / free-threshold / enabled inline. Edits accumulate
 * locally; "Publier" pushes only the dirty rows to
 * `admin-mobile-config/shipping-zones-bulk` in one round-trip.
 *
 * Bulk actions:
 *   ▸ Region-level fee setter ("Set all of Centre to 400 DA")
 *   ▸ Region toggle (enable/disable a whole region)
 * Both stage edits in the same draft buffer and surface in the
 * "modified" badge until Publier.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, MapPin, RotateCcw, Save, Search, Sparkles, Truck,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import {
  saveShippingZonesBulk,
  type MobileShippingZonePatch,
} from '../../../lib/adminMobileApi';
import { supabaseClient } from '../../../lib/supabaseClient';

type Region = 'centre' | 'est' | 'ouest' | 'sud';
const REGION_ORDER: Region[] = ['centre', 'est', 'ouest', 'sud'];
const REGION_LABEL_FR: Record<Region, string> = {
  centre: 'Centre', est: 'Est', ouest: 'Ouest', sud: 'Sud',
};
const REGION_TONE: Record<Region, string> = {
  centre: 'bg-blue-50 text-blue-700 border-blue-200',
  est:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  ouest:  'bg-orange-50 text-orange-700 border-orange-200',
  sud:    'bg-amber-50 text-amber-800 border-amber-200',
};

interface ZoneRow {
  wilaya_code: string;
  name_fr: string;
  name_ar: string;
  region: Region;
  sort_order: number;
  fee: number;
  free_threshold_override: number | null;
  eta_days_min: number | null;
  eta_days_max: number | null;
  carrier_default: string;
  is_enabled: boolean;
}

function sameRow(a: ZoneRow, b: ZoneRow): boolean {
  return (
    a.fee === b.fee &&
    (a.free_threshold_override ?? null) === (b.free_threshold_override ?? null) &&
    (a.eta_days_min ?? null) === (b.eta_days_min ?? null) &&
    (a.eta_days_max ?? null) === (b.eta_days_max ?? null) &&
    a.carrier_default === b.carrier_default &&
    a.is_enabled === b.is_enabled
  );
}

function rowToPatch(row: ZoneRow): MobileShippingZonePatch {
  return {
    wilaya_code: row.wilaya_code,
    fee: row.fee,
    free_threshold_override: row.free_threshold_override,
    eta_days_min: row.eta_days_min,
    eta_days_max: row.eta_days_max,
    carrier_default: row.carrier_default,
    is_enabled: row.is_enabled,
  };
}

export function MobileShippingManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [remote, setRemote] = useState<ZoneRow[]>([]);
  const [draft, setDraft] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regionFilter, setRegionFilter] = useState<Region | 'all'>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: wilayas, error: wErr }, { data: zones, error: zErr }] = await Promise.all([
        supabaseClient
          .from('wilayas')
          .select('code,name_fr,name_ar,region,sort_order')
          .order('sort_order', { ascending: true }),
        supabaseClient
          .from('mobile_shipping_zones')
          .select('wilaya_code,fee,free_threshold_override,eta_days_min,eta_days_max,carrier_default,is_enabled'),
      ]);
      if (wErr) throw wErr;
      if (zErr) throw zErr;

      const byCode = new Map<string, Record<string, unknown>>();
      for (const z of (zones ?? []) as Record<string, unknown>[]) {
        byCode.set(String(z.wilaya_code), z);
      }

      const merged: ZoneRow[] = ((wilayas ?? []) as Record<string, unknown>[]).map((w) => {
        const z = byCode.get(String(w.code)) ?? {};
        return {
          wilaya_code: String(w.code),
          name_fr: String(w.name_fr ?? ''),
          name_ar: String(w.name_ar ?? ''),
          region: (w.region as Region) ?? 'centre',
          sort_order: Number(w.sort_order ?? 0),
          fee: typeof z.fee === 'number' ? (z.fee as number) : 0,
          free_threshold_override:
            typeof z.free_threshold_override === 'number'
              ? (z.free_threshold_override as number)
              : null,
          eta_days_min: typeof z.eta_days_min === 'number' ? (z.eta_days_min as number) : null,
          eta_days_max: typeof z.eta_days_max === 'number' ? (z.eta_days_max as number) : null,
          carrier_default:
            typeof z.carrier_default === 'string' ? (z.carrier_default as string) : 'yalidine',
          is_enabled: z.is_enabled === false ? false : true,
        };
      });

      setRemote(merged);
      setDraft(merged);
    } catch (err) {
      console.error('[shipping] load failed:', err);
      toast.error('Impossible de charger les zones de livraison.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const dirtyRows = useMemo(() => {
    const remoteByCode = new Map(remote.map((r) => [r.wilaya_code, r]));
    return draft.filter((d) => {
      const r = remoteByCode.get(d.wilaya_code);
      return r ? !sameRow(r, d) : false;
    });
  }, [remote, draft]);

  const enabledCount = useMemo(() => draft.filter((d) => d.is_enabled).length, [draft]);
  const billedCount  = useMemo(() => draft.filter((d) => d.is_enabled && d.fee > 0).length, [draft]);
  const freeCount    = useMemo(() => draft.filter((d) => d.is_enabled && d.fee === 0).length, [draft]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return draft.filter((d) => {
      if (regionFilter !== 'all' && d.region !== regionFilter) return false;
      if (!q) return true;
      return (
        d.wilaya_code.includes(q) ||
        d.name_fr.toLowerCase().includes(q) ||
        d.name_ar.includes(q)
      );
    });
  }, [draft, regionFilter, search]);

  const grouped = useMemo(() => {
    const out: Record<Region, ZoneRow[]> = { centre: [], est: [], ouest: [], sud: [] };
    for (const row of filtered) out[row.region].push(row);
    return out;
  }, [filtered]);

  const updateRow = (code: string, patch: Partial<ZoneRow>) => {
    setDraft((prev) => prev.map((d) => (d.wilaya_code === code ? { ...d, ...patch } : d)));
  };

  const setRegionFee = (region: Region, fee: number) => {
    setDraft((prev) => prev.map((d) => (d.region === region ? { ...d, fee } : d)));
  };
  const toggleRegion = (region: Region, enabled: boolean) => {
    setDraft((prev) => prev.map((d) => (d.region === region ? { ...d, is_enabled: enabled } : d)));
  };

  const onPublish = async () => {
    if (!token || dirtyRows.length === 0) return;
    setSaving(true);
    try {
      const payload = dirtyRows.map(rowToPatch);
      await saveShippingZonesBulk(payload, token);
      toast.success(`${dirtyRows.length} zone(s) publiée(s).`);
      setRemote(draft);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec publication.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => setDraft(remote);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="animate-spin text-blue-700" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-blue-700" />
            <h2 className={`text-sm font-black ${t.text}`}>
              Zones de livraison ({enabledCount}/{draft.length} actives · {billedCount} payantes · {freeCount} gratuites)
            </h2>
            {dirtyRows.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                <Sparkles size={10} /> {dirtyRows.length} modifié(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={dirtyRows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <RotateCcw size={13} /> Annuler
            </button>
            <button
              type="button"
              onClick={() => void onPublish()}
              disabled={dirtyRows.length === 0 || saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
              {saving ? 'Publication…' : 'Publier'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {(['all', ...REGION_ORDER] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegionFilter(r)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-colors ${
                  regionFilter === r
                    ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r === 'all' ? 'Toutes' : REGION_LABEL_FR[r]}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code, nom FR, اسم..."
              className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2 text-xs"
            />
          </div>
          {regionFilter !== 'all' && (
            <RegionBulkActions
              region={regionFilter as Region}
              onSetFee={(fee) => setRegionFee(regionFilter as Region, fee)}
              onToggle={(enabled) => toggleRegion(regionFilter as Region, enabled)}
            />
          )}
        </div>
      </div>

      {/* Grouped tables */}
      {REGION_ORDER.map((region) => {
        const rows = grouped[region];
        if (rows.length === 0) return null;
        return (
          <section
            key={region}
            className={`rounded-2xl border ${t.cardBorder} ${t.card} overflow-hidden`}
          >
            <header className={`flex items-center gap-2 px-4 py-2.5 border-b ${t.divider}`}>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${REGION_TONE[region]}`}
              >
                {REGION_LABEL_FR[region]}
              </span>
              <span className={`text-xs ${t.textMuted}`}>{rows.length} wilaya(s)</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr className="text-left text-[10px] font-black uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Wilaya</th>
                    <th className="px-3 py-2">Frais (DA)</th>
                    <th className="px-3 py-2">Livraison gratuite dès</th>
                    <th className="px-3 py-2">Délais (j)</th>
                    <th className="px-3 py-2">Transporteur</th>
                    <th className="px-3 py-2 text-center">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <ZoneRowEditor key={row.wilaya_code} row={row} onChange={updateRow} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <p className={`text-[11px] ${t.textMuted} flex items-center gap-1`}>
        <MapPin size={11} />
        Les changements sont visibles dans l&apos;app mobile dès la publication —
        en moins de 5 secondes via Realtime.
      </p>
    </div>
  );
}

function ZoneRowEditor({
  row, onChange,
}: { row: ZoneRow; onChange: (code: string, patch: Partial<ZoneRow>) => void }) {
  return (
    <tr className={`border-t border-gray-100 ${row.is_enabled ? '' : 'opacity-50'}`}>
      <td className="px-3 py-2 font-mono font-bold text-gray-700">{row.wilaya_code}</td>
      <td className="px-3 py-2">
        <div className="font-bold text-gray-800">{row.name_fr}</div>
        <div className="text-[11px] text-gray-500" dir="rtl">{row.name_ar}</div>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          value={row.fee}
          onChange={(e) =>
            onChange(row.wilaya_code, {
              fee: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)),
            })
          }
          className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-xs text-right"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          value={row.free_threshold_override ?? ''}
          placeholder="—"
          onChange={(e) =>
            onChange(row.wilaya_code, {
              free_threshold_override:
                e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
            })
          }
          className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-xs text-right"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            value={row.eta_days_min ?? ''}
            placeholder="—"
            onChange={(e) =>
              onChange(row.wilaya_code, {
                eta_days_min:
                  e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
              })
            }
            className="w-12 rounded-lg border border-gray-200 px-1 py-1 text-xs text-center"
          />
          <span className="text-gray-400">→</span>
          <input
            type="number"
            min={0}
            value={row.eta_days_max ?? ''}
            placeholder="—"
            onChange={(e) =>
              onChange(row.wilaya_code, {
                eta_days_max:
                  e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
              })
            }
            className="w-12 rounded-lg border border-gray-200 px-1 py-1 text-xs text-center"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <select
          value={row.carrier_default}
          onChange={(e) => onChange(row.wilaya_code, { carrier_default: e.target.value })}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
        >
          <option value="yalidine">Yalidine</option>
          <option value="zr">ZR Express</option>
          <option value="ecotrack">Ecotrack</option>
          <option value="other">Autre</option>
        </select>
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={() => onChange(row.wilaya_code, { is_enabled: !row.is_enabled })}
          className={`inline-flex items-center justify-center w-10 h-6 rounded-full transition-colors ${
            row.is_enabled ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
              row.is_enabled ? 'translate-x-2' : '-translate-x-2'
            }`}
          />
        </button>
      </td>
    </tr>
  );
}

function RegionBulkActions({
  region, onSetFee, onToggle,
}: {
  region: Region;
  onSetFee: (fee: number) => void;
  onToggle: (enabled: boolean) => void;
}) {
  const [fee, setFee] = useState<string>('');
  return (
    <div className="ml-auto flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-1.5 bg-gray-50">
      <span className="text-[10px] font-black uppercase tracking-wide text-gray-500">
        Bulk · {REGION_LABEL_FR[region]}
      </span>
      <input
        type="number"
        min={0}
        value={fee}
        placeholder="Fee DA"
        onChange={(e) => setFee(e.target.value)}
        className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs text-right"
      />
      <button
        type="button"
        onClick={() => {
          const n = Number(fee);
          if (Number.isFinite(n) && n >= 0) {
            onSetFee(n);
            setFee('');
          }
        }}
        disabled={fee === ''}
        className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
      >
        Set fee
      </button>
      <button
        type="button"
        onClick={() => onToggle(true)}
        className="rounded-lg border border-emerald-200 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50"
      >
        Activer tout
      </button>
      <button
        type="button"
        onClick={() => onToggle(false)}
        className="rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50"
      >
        Désactiver
      </button>
    </div>
  );
}

export default MobileShippingManager;
