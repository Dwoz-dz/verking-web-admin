/**
 * MobileCartSettings — editable form for the mobile checkout knobs.
 *
 * Persists via `admin-mobile-config/cart` edge function. The mobile app
 * reads these values on cart-open to enforce min order, compute shipping,
 * and decide which checkout buttons to show.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Loader2, Plus, Save, Settings as SettingsIcon, ShieldCheck, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { useAdminUI } from '../../../context/AdminUIContext';
import { supabaseClient } from '../../../lib/supabaseClient';
import { saveMobileCart, saveTrustSignals, type MobileCartPatch, type TrustSignal } from '../../../lib/adminMobileApi';
import { useMediaUpload, isVideoUrl } from '../home/shared/media/useMediaUpload';

type CheckoutMode = 'whatsapp' | 'app' | 'both';

interface CartRow {
  min_order: number | null;
  free_delivery_threshold: number | null;
  default_delivery_price: number | null;
  whatsapp_enabled: boolean | null;
  cod_enabled: boolean | null;
  checkout_mode: CheckoutMode | null;
  trust_signals: TrustSignal[] | null;
}

const DEFAULT_TRUST_SIGNALS: TrustSignal[] = [
  { key: 'shipping', enabled: true, icon: 'rocket-outline',         label_fr: 'Livraison Yalidine / ZR Express', label_ar: 'التوصيل عبر ياليدين / ZR' },
  { key: 'cod',      enabled: true, icon: 'cash-outline',           label_fr: 'Paiement à la livraison',          label_ar: 'الدفع عند الاستلام' },
  { key: 'whatsapp', enabled: true, icon: 'logo-whatsapp',          label_fr: 'Support WhatsApp 24/7',            label_ar: 'دعم واتساب 24/7' },
  { key: 'warranty', enabled: true, icon: 'shield-checkmark-outline', label_fr: 'Garantie 7 jours',                label_ar: 'ضمان 7 أيام' },
  { key: 'social',   enabled: true, icon: 'people-outline',         label_fr: '+10 000 clients satisfaits',       label_ar: '+10000 عميل راضٍ' },
];

const EMPTY: CartRow = {
  min_order: null,
  free_delivery_threshold: null,
  default_delivery_price: null,
  whatsapp_enabled: null,
  cod_enabled: null,
  checkout_mode: null,
  trust_signals: null,
};

export function MobileCartSettings() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CartRow>(EMPTY);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('mobile_cart_settings')
        .select('min_order,free_delivery_threshold,default_delivery_price,whatsapp_enabled,cod_enabled,checkout_mode,trust_signals')
        .eq('id', 'default')
        .maybeSingle();
      if (error) throw error;
      if (data) setForm(data as CartRow);
    } catch (err) {
      console.error('[mobile-cart] load failed:', err);
      toast.error('Impossible de charger les paramètres.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const setField = <K extends keyof CartRow>(key: K, value: CartRow[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const patch: MobileCartPatch = {
        min_order: form.min_order,
        free_delivery_threshold: form.free_delivery_threshold,
        default_delivery_price: form.default_delivery_price,
        whatsapp_enabled: form.whatsapp_enabled,
        cod_enabled: form.cod_enabled,
        checkout_mode: form.checkout_mode,
        trust_signals: form.trust_signals ?? undefined,
      };
      await saveMobileCart(patch, token);
      toast.success('Paramètres panier enregistrés.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec enregistrement.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ─── Trust signals helpers ───────────────────────────────────────
  const trustSignals = form.trust_signals ?? DEFAULT_TRUST_SIGNALS;

  const updateSignal = (idx: number, patch: Partial<TrustSignal>) => {
    const next = [...trustSignals];
    next[idx] = { ...next[idx], ...patch };
    setField('trust_signals', next);
  };
  const moveSignal = (idx: number, direction: -1 | 1) => {
    const next = [...trustSignals];
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setField('trust_signals', next);
  };
  const removeSignal = (idx: number) => {
    setField('trust_signals', trustSignals.filter((_, i) => i !== idx));
  };
  const addSignal = () => {
    const next: TrustSignal = {
      key: `custom_${Date.now()}`,
      enabled: true,
      icon: 'star-outline',
      label_fr: '',
      label_ar: '',
    };
    setField('trust_signals', [...trustSignals, next]);
  };
  const resetSignalsToDefault = () => setField('trust_signals', DEFAULT_TRUST_SIGNALS);

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="animate-spin text-blue-700" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between rounded-2xl border ${t.cardBorder} ${t.card} p-4`}>
        <div className="flex items-center gap-2">
          <SettingsIcon size={16} className="text-emerald-700" />
          <h2 className={`text-sm font-black ${t.text}`}>Paramètres panier mobile</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setForm(EMPTY)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw size={13} /> Réinitialiser
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-4 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
            {saving ? 'Enregistrement…' : 'Publier'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <PriceField
          label="Commande minimum"
          value={form.min_order}
          placeholder="0 = pas de minimum"
          onChange={(v) => setField('min_order', v)}
        />
        <PriceField
          label="Livraison gratuite dès"
          value={form.free_delivery_threshold}
          placeholder="Vide = pas de seuil"
          onChange={(v) => setField('free_delivery_threshold', v)}
        />
        <PriceField
          label="Frais de livraison"
          value={form.default_delivery_price}
          placeholder="0 = pas de frais"
          onChange={(v) => setField('default_delivery_price', v)}
        />

        <ToggleField
          label="WhatsApp activé"
          value={form.whatsapp_enabled}
          onChange={(v) => setField('whatsapp_enabled', v)}
          hint="Affiche le bouton vert WhatsApp dans le panier."
        />
        <ToggleField
          label="Cash on delivery (COD)"
          value={form.cod_enabled}
          onChange={(v) => setField('cod_enabled', v)}
          hint="Permet le paiement à la livraison."
        />

        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">
            Mode checkout
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {(['whatsapp', 'app', 'both'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setField('checkout_mode', mode)}
                className={`rounded-xl border px-2 py-2 text-xs font-bold uppercase ${
                  form.checkout_mode === mode
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setField('checkout_mode', null)}
            className="mt-2 w-full text-[11px] text-gray-500 underline"
          >
            Effacer (utiliser « both » par défaut)
          </button>
        </div>
      </div>

      <div className={`rounded-2xl border border-blue-200 bg-blue-50/40 p-4 text-xs ${t.text}`}>
        <strong className="text-blue-700">Mode checkout :</strong> <code>both</code>
        affiche WhatsApp + bouton de validation app (recommandé). <code>whatsapp</code>
        force tous les checkouts vers WhatsApp uniquement. <code>app</code> désactive
        WhatsApp côté checkout (mais le bouton de contact dans À propos reste actif).
      </div>

      {/* ─── Trust signals editor ─────────────────────────────────── */}
      <div className={`rounded-2xl border ${t.cardBorder} ${t.card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-700" />
            <h3 className={`text-sm font-black ${t.text}`}>
              Trust signals ({trustSignals.filter((s) => s.enabled).length}/{trustSignals.length} actifs)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetSignalsToDefault}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw size={12} /> Réinitialiser
            </button>
            <button
              type="button"
              onClick={addSignal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
            >
              <Plus size={12} /> Ajouter
            </button>
          </div>
        </div>

        <p className={`text-[11px] ${t.textMuted}`}>
          Affichés dans l&apos;empty-cart et le checkout. Réordonnez avec ↑/↓.
          Icons: noms Ionicons (ex: <code>shield-checkmark-outline</code>) ou emoji.
        </p>

        <ul className="space-y-2">
          {trustSignals.map((s, idx) => (
            <li
              key={s.key + idx}
              className={`flex items-center gap-2 rounded-xl border ${t.cardBorder} ${t.card} p-2 ${s.enabled ? '' : 'opacity-60'}`}
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveSignal(idx, -1)}
                  disabled={idx === 0}
                  className="rounded-md p-0.5 text-gray-500 hover:bg-blue-50 disabled:opacity-30"
                  title="Monter"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSignal(idx, 1)}
                  disabled={idx === trustSignals.length - 1}
                  className="rounded-md p-0.5 text-gray-500 hover:bg-blue-50 disabled:opacity-30"
                  title="Descendre"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
              <GripVertical size={14} className="text-gray-400" />
              <TrustSignalIconCell
                value={s.icon_url ?? null}
                onChange={(url) => updateSignal(idx, { icon_url: url })}
              />
              <input
                type="text"
                value={s.icon ?? ''}
                onChange={(e) => updateSignal(idx, { icon: e.target.value })}
                className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-xs font-mono"
                placeholder="ionicon"
                title="Nom Ionicons (fallback si pas d'image)"
              />
              <input
                type="text"
                value={s.label_fr}
                onChange={(e) => updateSignal(idx, { label_fr: e.target.value })}
                className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs"
                placeholder="Label FR"
              />
              <input
                type="text"
                value={s.label_ar}
                onChange={(e) => updateSignal(idx, { label_ar: e.target.value })}
                dir="rtl"
                className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs"
                placeholder="Label AR"
              />
              <button
                type="button"
                onClick={() => updateSignal(idx, { enabled: !s.enabled })}
                className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${
                  s.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'
                }`}
              >
                {s.enabled ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() => removeSignal(idx)}
                className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50"
              >
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PriceField({
  label, value, placeholder, onChange,
}: {
  label: string; value: number | null; placeholder: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 bg-white">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex items-center gap-1">
        <input
          type="number"
          min={0}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <span className="text-xs font-bold text-gray-500">DA</span>
      </div>
    </div>
  );
}

function ToggleField({
  label, value, onChange, hint,
}: {
  label: string; value: boolean | null;
  onChange: (v: boolean | null) => void;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 bg-white">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-xl border px-2 py-2 text-xs font-bold ${
            value === true ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          Activé
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-xl border px-2 py-2 text-xs font-bold ${
            value === false ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          Désactivé
        </button>
      </div>
      {hint ? <p className="text-[10px] text-gray-500 mt-1.5">{hint}</p> : null}
    </div>
  );
}

/**
 * TrustSignalIconCell — tiny uploader that fits inside the trust
 * signals row. Shows a 32px thumb when set, an upload chip when empty.
 * Reuses `useMediaUpload` so the asset lands in the canonical
 * `make-ea36795c-media` bucket like every other admin upload.
 */
function TrustSignalIconCell({
  value, onChange,
}: { value: string | null; onChange: (url: string | null) => void }) {
  const inputRef = (window as unknown as { ___tsinputs?: Map<string, HTMLInputElement> });
  void inputRef; // anchor for stylelinters; the real input is created inline below
  const { upload, state } = useMediaUpload();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Image uniquement (JPG, PNG, SVG…).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Icône trop lourde (max 2 MB).');
      return;
    }
    const url = await upload(file);
    if (url) onChange(url);
    else toast.error('Échec upload.');
  };

  const fileInputId = `trust-icon-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <label
      htmlFor={fileInputId}
      className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border ${
        value ? 'border-emerald-200 bg-emerald-50/40' : 'border-dashed border-gray-300 bg-gray-50'
      } overflow-hidden`}
      title={value ? 'Cliquer pour remplacer' : "Téléverser l'icône"}
    >
      {value && !isVideoUrl(value) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="icon" className="h-full w-full object-contain" />
      ) : (
        <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
          {state === 'uploading' ? '…' : 'IMG'}
        </span>
      )}
      <input
        id={fileInputId}
        type="file"
        accept="image/*"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onChange(null);
          }}
          className="absolute -right-1 -top-1 rounded-full border border-white bg-red-500 px-1 text-[8px] font-black text-white shadow"
          title="Effacer l'image"
        >
          ×
        </button>
      ) : null}
    </label>
  );
}

export default MobileCartSettings;
