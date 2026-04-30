import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Globe,
  Hash,
  DollarSign,
  Percent,
  TrendingDown,
  ShoppingBag,
  Award,
  Upload,
  Plus,
  ArrowUp,
  ArrowDown,
  Monitor,
  Zap,
  BarChart2,
  Eye,
  Package,
  RefreshCw,
  Save,
  Search,
  Check,
  AlertTriangle,
  ImageOff,
  Sparkles,
} from 'lucide-react';
import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import { adminApi } from '../../../lib/api';
import { Product, Category, ActiveTab } from './types';
import { Toggle, StockBadge } from './ProductRowComponents';
import { ProductCard } from '../../../components/ProductCard';
import { toast } from 'sonner';

/**
 * Smart Product Studio helpers.
 *
 * Readiness: a UI-only completeness signal so admins see at a glance
 * whether the product is ready to publish. Non-blocking — the real save
 * flow still validates on submit.
 *
 * Tab status: per-tab red/amber/green dot. Red = a required field is
 * missing on that tab, amber = optional-but-useful fields empty, green =
 * tab is complete.
 */
type TabStatus = 'empty' | 'partial' | 'complete' | 'error';

function computeReadiness(p: Partial<Product>): { score: number; checks: Array<{ key: string; label: string; done: boolean; required: boolean }> } {
  const hasName = !!(p.name_fr && p.name_fr.trim()) || !!(p.name_ar && p.name_ar.trim());
  const hasCategory = !!p.category_id;
  const hasPrice = typeof p.price === 'number' && p.price > 0;
  const hasImage = Array.isArray(p.images) && p.images.length > 0;
  const hasStock = typeof p.stock === 'number' && p.stock >= 0;
  const isActive = p.is_active !== false;
  const hasSeo = !!(p.meta_title || p.meta_description);

  const checks = [
    { key: 'name',     label: 'Nom FR/AR',         done: hasName,     required: true },
    { key: 'category', label: 'Catégorie',          done: hasCategory, required: true },
    { key: 'price',    label: 'Prix de vente',      done: hasPrice,    required: true },
    { key: 'image',    label: 'Au moins une image', done: hasImage,    required: true },
    { key: 'stock',    label: 'Stock renseigné',    done: hasStock,    required: true },
    { key: 'active',   label: 'Statut actif',       done: isActive,    required: false },
    { key: 'seo',      label: 'SEO (recommandé)',   done: hasSeo,      required: false },
  ];
  const weighted = checks.reduce((acc, c) => acc + (c.done ? (c.required ? 15 : 5) : 0), 0);
  const maxWeight = checks.reduce((acc, c) => acc + (c.required ? 15 : 5), 0);
  const score = Math.round((weighted / maxWeight) * 100);
  return { score, checks };
}

function tabStatus(tab: ActiveTab, p: Partial<Product>): TabStatus {
  switch (tab) {
    case 'info': {
      const hasName = !!(p.name_fr && p.name_fr.trim()) || !!(p.name_ar && p.name_ar.trim());
      const hasCategory = !!p.category_id;
      if (!hasName || !hasCategory) return 'error';
      const hasDesc = !!(p.description_fr || p.description_ar);
      return hasDesc ? 'complete' : 'partial';
    }
    case 'pricing': {
      const hasPrice = typeof p.price === 'number' && p.price > 0;
      if (!hasPrice) return 'error';
      const bad = typeof p.sale_price === 'number' && typeof p.price === 'number' && p.sale_price > p.price;
      if (bad) return 'error';
      const hasStock = typeof p.stock === 'number' && p.stock >= 0;
      return hasStock ? 'complete' : 'partial';
    }
    case 'media': {
      const hasImage = Array.isArray(p.images) && p.images.length > 0;
      return hasImage ? 'complete' : 'error';
    }
    case 'display': {
      const anyPlacement =
        !!p.show_on_homepage || !!p.show_in_featured || !!p.show_in_new_arrivals ||
        !!p.show_in_best_sellers || !!p.show_in_promotions;
      return anyPlacement ? 'complete' : 'partial';
    }
    case 'seo': {
      const hasSeo = !!(p.meta_title || p.meta_description);
      return hasSeo ? 'complete' : 'empty';
    }
    case 'analytics':
      return 'empty';
    default:
      return 'empty';
  }
}

/** Human-readable list of placements derived from the flags — used
 *  both by the "Will appear in" summary in the Affichage tab AND by
 *  admins to confirm the product's storefront visibility. */
function computePlacements(p: Partial<Product>): string[] {
  const out: string[] = [];
  if (p.is_active === false) return ['⚠️ Inactif — masqué partout'];
  if (p.show_on_homepage) out.push('Page d’accueil');
  if (p.show_in_featured || p.is_featured) out.push('Produits vedettes');
  if (p.show_in_new_arrivals || p.is_new) out.push('Nouveautés');
  if (p.show_in_best_sellers || p.is_best_seller) out.push('Best sellers');
  if (p.show_in_promotions || p.is_promo) out.push('Promotions');
  out.push('Boutique');
  return Array.from(new Set(out));
}

type InlineCategoryDraft = {
  name_fr: string;
  name_ar: string;
};

type MediaAsset = {
  id: string;
  url: string;
  filename?: string;
  content_type?: string;
};

interface ProductEditorProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  current: Partial<Product>;
  setCurrent: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  categories: Category[];
  onCreateCategory?: (payload: InlineCategoryDraft) => Promise<Category | null>;
  closeEditor: () => void;
  handleSave: () => void;
  saving: boolean;
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  handleFileUpload: (files: FileList) => Promise<void>;
  uploading: boolean;
  margin: number | null;
  imgUrl: string;
  setImgUrl: (v: string) => void;
  addImageUrl: () => void;
  removeImage: (i: number) => void;
  moveImage: (i: number, dir: 'up' | 'down') => void;
  setMainImage: (i: number) => void;
}

export function ProductEditor(props: ProductEditorProps) {
  const { isDark, t } = useAdminUI();
  const { token } = useAuth();
  const {
    isOpen, mode, current, setCurrent, categories, closeEditor, handleSave,
    saving, activeTab, setActiveTab, handleFileUpload, uploading,
    margin, imgUrl, setImgUrl, addImageUrl, removeImage, moveImage, setMainImage,
    onCreateCategory,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showInlineCategoryForm, setShowInlineCategoryForm] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState<MediaAsset[]>([]);
  const [mediaSearch, setMediaSearch] = useState('');
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [inlineCategory, setInlineCategory] = useState<InlineCategoryDraft>({
    name_fr: '',
    name_ar: '',
  });

  const field = <K extends keyof Product>(name: K, val: Product[K]) => {
    setCurrent(prev => ({ ...prev, [name]: val }));
  };

  const labelCls = `block text-xs font-bold ${t.text} mb-1.5 uppercase tracking-wider`;
  const labelArCls = `${labelCls} text-right`;
  const inputCls = `w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-all ${t.input}`;

  const mediaResults = useMemo(() => {
    const term = mediaSearch.trim().toLowerCase();
    return mediaLibrary
      .filter((item) => item?.content_type?.startsWith('image/'))
      .filter((item) => !term || (item.filename || '').toLowerCase().includes(term));
  }, [mediaLibrary, mediaSearch]);

  const loadMediaLibrary = async (force = false) => {
    if (!token) return;
    if (!force && mediaLibrary.length > 0) return;
    setLoadingMedia(true);
    try {
      const data = await adminApi.get('/media', token);
      const list = Array.isArray(data?.media) ? data.media : [];
      setMediaLibrary(list);
    } catch (error) {
      console.error(error);
      toast.error('Chargement de la mediatheque impossible.');
    } finally {
      setLoadingMedia(false);
    }
  };

  useEffect(() => {
    if (!isOpen || activeTab !== 'media') return;
    loadMediaLibrary(false);
  }, [activeTab, isOpen, token]);

  const resetInlineCategory = () => {
    setInlineCategory({ name_fr: '', name_ar: '' });
    setShowInlineCategoryForm(false);
  };

  const submitInlineCategory = async () => {
    if (!onCreateCategory) return;

    const payload = {
      name_fr: inlineCategory.name_fr.trim(),
      name_ar: inlineCategory.name_ar.trim(),
    };

    if (!payload.name_fr || !payload.name_ar) {
      toast.error('Renseignez les noms FR et AR de la categorie.');
      return;
    }

    setCreatingCategory(true);
    try {
      const created = await onCreateCategory(payload);
      if (!created?.id) return;

      field('category_id', created.id);
      resetInlineCategory();
    } catch (error) {
      console.error(error);
      toast.error('Creation de categorie impossible.');
    } finally {
      setCreatingCategory(false);
    }
  };

  const tabs: { id: ActiveTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'info', label: 'Infos', icon: Globe },
    { id: 'pricing', label: 'Prix & Stock', icon: DollarSign },
    { id: 'media', label: 'Images', icon: Upload },
    { id: 'display', label: 'Affichage', icon: Monitor },
    { id: 'seo', label: 'SEO', icon: Globe },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];

  // Smart Product Studio: compute readiness + per-tab status once per render.
  const readiness = useMemo(() => computeReadiness(current), [current]);
  const placements = useMemo(() => computePlacements(current), [current]);
  const statusByTab = useMemo(() => ({
    info: tabStatus('info', current),
    pricing: tabStatus('pricing', current),
    media: tabStatus('media', current),
    display: tabStatus('display', current),
    seo: tabStatus('seo', current),
    analytics: tabStatus('analytics', current),
  }), [current]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEditor} />

      <div className={`relative w-full max-w-6xl max-h-[92vh] ${t.card} border ${t.cardBorder} rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200`}>
        <div className={`px-6 py-4 border-b ${t.divider} shrink-0 bg-gradient-to-r ${isDark ? 'from-gray-900 to-gray-800' : 'from-white to-gray-50'}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className={`text-xl font-black ${t.text} flex items-center gap-2`}>
                <div className="w-8 h-8 rounded-lg bg-[#1A3C6E] flex items-center justify-center text-white">
                  {mode === 'add' ? <Plus size={18} /> : <Zap size={18} />}
                </div>
                {mode === 'add' ? 'Nouveau Produit' : 'Modifier Produit'}
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#1A3C6E] to-[#2e5a94] px-2 py-0.5 text-[10px] font-black text-white">
                  <Sparkles size={10} /> SMART STUDIO
                </span>
              </h2>
              <p className={`text-xs ${t.textMuted} mt-1`}>
                {readiness.score >= 85
                  ? '✓ Produit prêt à publier'
                  : readiness.score >= 60
                  ? 'Quelques champs à compléter pour une fiche premium'
                  : 'Remplissez les champs requis pour publier'}
              </p>
            </div>
            <button onClick={closeEditor} className={`p-2 rounded-xl ${t.rowHover} ${t.textMuted} transition-colors shrink-0`}>
              <X size={20} />
            </button>
          </div>

          {/* Readiness bar — live "Produit prêt à publier: XX%" signal.
              Never blocks saving; admins see at a glance whether a fiche
              is complete before they click Créer/Sauvegarder. */}
          <div className="mt-3 flex items-center gap-3">
            <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  readiness.score >= 85 ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                  : readiness.score >= 60 ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-red-400 to-rose-500'
                }`}
                style={{ width: `${readiness.score}%` }}
              />
            </div>
            <span className={`shrink-0 text-xs font-black ${
              readiness.score >= 85 ? 'text-emerald-600' : readiness.score >= 60 ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {readiness.score}%
            </span>
          </div>
        </div>

        <div className={`px-2 py-1 flex items-center gap-1 border-b ${t.divider} shrink-0 overflow-x-auto no-scrollbar`}>
          {tabs.map(tab => {
            const st = statusByTab[tab.id];
            const dotColor =
              st === 'complete' ? 'bg-emerald-500' :
              st === 'error' ? 'bg-rose-500' :
              st === 'partial' ? 'bg-amber-400' :
              'bg-gray-300';
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#1A3C6E] text-white shadow-md' : `${t.textMuted} ${t.rowHover}`}`}
                title={st === 'error' ? 'Champ(s) requis manquant(s)' : st === 'complete' ? 'OK' : st === 'partial' ? 'Partiellement rempli' : ''}
              >
                <tab.icon size={13} />
                {tab.label}
                <span className={`ms-1 inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden />
              </button>
            );
          })}
        </div>

        {/* Two-column body: editor fields on the left, live product card
            preview + readiness checks on the right. Stacks to one column
            on screens below lg so the form stays usable on tablets. */}
        <div className="flex-1 overflow-hidden">
          <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_340px]">
            <div className="overflow-y-auto">
              <div className="p-6 space-y-5">

            {activeTab === 'info' && (
              <div className="space-y-5">
                <div className={`p-3 rounded-2xl border ${t.cardBorder} ${isDark ? 'bg-blue-900/10' : 'bg-blue-50/50'} flex items-start gap-2`}>
                  <Sparkles size={14} className="text-[#1A3C6E] mt-0.5 shrink-0" />
                  <p className={`text-xs ${t.text}`}>
                    <span className="font-black">Astuce : </span>
                    commencez par choisir une catégorie, puis remplissez les noms et la description bilingues. La fiche sera validée dès que les champs requis sont remplis.
                  </p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${t.textMuted} flex items-center gap-2`}>
                    <Globe size={12} /> Noms bilingues
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>FR Nom francais *</label>
                      <input
                        className={inputCls}
                        value={current.name_fr || ''}
                        onChange={e => field('name_fr', e.target.value)}
                        placeholder="ex: Cartable Premium XL"
                      />
                    </div>
                    <div>
                      <label className={labelArCls}>AR الاسم بالعربية *</label>
                      <input
                        className={inputCls}
                        dir="rtl"
                        lang="ar"
                        value={current.name_ar || ''}
                        onChange={e => field('name_ar', e.target.value)}
                        placeholder="اسم المنتج"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className={labelCls}>Categorie *</label>
                    <button
                      type="button"
                      onClick={() => setShowInlineCategoryForm((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#1A3C6E]/20 bg-blue-50 px-3 py-2 text-[11px] font-black text-[#1A3C6E] transition-colors hover:bg-blue-100"
                    >
                      <Plus size={12} />
                      Ajouter
                    </button>
                  </div>
                  <select className={inputCls} value={current.category_id || ''} onChange={e => field('category_id', e.target.value)}>
                    <option value="">- Choisir une categorie -</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name_fr} / {c.name_ar}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Niveau scolaire / المستوى الدراسي</label>
                  <select
                    className={inputCls}
                    value={(current as any).level || ''}
                    onChange={e => field('level' as any, e.target.value || null)}
                  >
                    <option value="">- Tous les niveaux / كل المستويات -</option>
                    <option value="primaire">Primaire / ابتدائي</option>
                    <option value="moyen">Moyen / متوسط</option>
                    <option value="secondaire">Secondaire / ثانوي</option>
                    <option value="universite">Universite / جامعي</option>
                  </select>
                  <p className={`text-[11px] mt-1.5 ${t.textMuted}`}>
                    Utilise par le filtre "Niveau scolaire" sur la page Boutique.
                  </p>
                </div>

                {showInlineCategoryForm ? (
                  <div className={`rounded-2xl border ${t.cardBorder} p-4 ${t.rowHover} space-y-3`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={`text-sm font-black ${t.text}`}>Creation rapide de categorie</p>
                        <p className={`text-xs ${t.textMuted}`}>
                          La categorie sera creee dans le backend, activee et reliee directement au site.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={resetInlineCategory}
                        className={`rounded-xl border ${t.cardBorder} px-3 py-2 text-[11px] font-bold ${t.textMuted} ${t.rowHover}`}
                      >
                        Fermer
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <input
                        className={inputCls}
                        value={inlineCategory.name_fr}
                        onChange={(e) =>
                          setInlineCategory((prev) => ({ ...prev, name_fr: e.target.value }))
                        }
                        placeholder="Nom categorie FR"
                      />
                      <input
                        dir="rtl"
                        lang="ar"
                        className={inputCls}
                        value={inlineCategory.name_ar}
                        onChange={(e) =>
                          setInlineCategory((prev) => ({ ...prev, name_ar: e.target.value }))
                        }
                        placeholder="اسم الفئة"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={resetInlineCategory}
                        className={`rounded-xl border ${t.cardBorder} px-4 py-2.5 text-xs font-bold ${t.text} ${t.rowHover}`}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={submitInlineCategory}
                        disabled={creatingCategory}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#1A3C6E] px-4 py-2.5 text-xs font-black text-white disabled:opacity-60"
                      >
                        {creatingCategory ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Plus size={13} />
                        )}
                        Creer la categorie
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>FR Description francaise</label>
                    <textarea
                      rows={5}
                      className={`${inputCls} resize-none`}
                      value={current.description_fr || ''}
                      onChange={e => field('description_fr', e.target.value)}
                      placeholder="Description complete du produit..."
                    />
                  </div>
                  <div>
                    <label className={labelArCls}>AR الوصف بالعربية</label>
                    <textarea
                      rows={5}
                      dir="rtl"
                      lang="ar"
                      className={`${inputCls} resize-none`}
                      value={current.description_ar || ''}
                      onChange={e => field('description_ar', e.target.value)}
                      placeholder="وصف المنتج..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}><span className="flex items-center gap-1"><Hash size={10} /> SKU</span></label>
                    <input className={inputCls} value={current.sku || ''} onChange={e => field('sku', e.target.value)} placeholder="ex: VK-CART-001" />
                  </div>
                  <div>
                    <label className={labelCls}>Code-barres</label>
                    <input className={inputCls} value={current.barcode || ''} onChange={e => field('barcode', e.target.value)} placeholder="1234567890123" />
                  </div>
                  <div>
                    <label className={labelCls}>Ordre d'affichage</label>
                    <input type="number" className={inputCls} value={current.sort_order ?? 99} onChange={e => field('sort_order', Number(e.target.value))} min={1} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pricing' && (
              <div className="space-y-5">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${t.textMuted} flex items-center gap-2`}>
                    <DollarSign size={12} /> Tarification
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Prix de vente (DA) *</label>
                      <input type="number" className={inputCls} value={current.price ?? ''} onChange={e => field('price', Number(e.target.value))} placeholder="3500" min={0} />
                    </div>
                    <div>
                      <label className={labelCls}>Prix promo (DA)</label>
                      <input type="number" className={inputCls} value={current.sale_price ?? ''} onChange={e => field('sale_price', e.target.value ? Number(e.target.value) : undefined)} placeholder="Optionnel" min={0} />
                    </div>
                    <div>
                      <label className={labelCls}>Cout d'achat (DA)</label>
                      <input type="number" className={inputCls} value={current.cost_price ?? ''} onChange={e => field('cost_price', e.target.value ? Number(e.target.value) : undefined)} placeholder="Optionnel" min={0} />
                    </div>
                  </div>
                </div>

                {margin !== null && (
                  <div className={`p-4 rounded-2xl border ${margin > 40 ? 'bg-green-50 border-green-200' : margin > 20 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Percent size={16} className={margin > 40 ? 'text-green-600' : margin > 20 ? 'text-yellow-600' : 'text-red-600'} />
                        <span className={`font-bold text-sm ${margin > 40 ? 'text-green-700' : margin > 20 ? 'text-yellow-700' : 'text-red-700'}`}>Marge: {margin}%</span>
                      </div>
                      <div className={`text-sm font-bold ${margin > 40 ? 'text-green-700' : margin > 20 ? 'text-yellow-700' : 'text-red-700'}`}>
                        +{((typeof current.price === 'number' ? current.price : 0) - (typeof current.cost_price === 'number' ? current.cost_price : 0)).toLocaleString()} DA / unite
                      </div>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${margin > 40 ? 'bg-green-500' : margin > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(margin as number, 100)}%` }} />
                    </div>
                  </div>
                )}

                {typeof current.price === 'number' && typeof current.sale_price === 'number' && current.price > 0 && (
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-blue-900/20 border-blue-800/40' : 'bg-blue-50 border-blue-100'} flex items-center gap-3`}>
                    <TrendingDown size={16} className="text-blue-600" />
                    <div>
                      <span className="font-bold text-blue-700 text-sm">Remise: -{Math.round(((current.price - current.sale_price) / current.price) * 100)}%</span>
                      <span className={`text-xs ml-2 ${t.textMuted}`}>({(current.price - current.sale_price).toLocaleString()} DA d'economie)</span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className={`text-xs font-bold uppercase tracking-widest ${t.textMuted} flex items-center gap-2`}>
                      <ShoppingBag size={12} /> Gestion du stock
                    </p>
                    <p className={`text-[10px] ${t.textMuted}`}>
                      Mouvements détaillés → <span className="font-black">Gestionnaire de stock</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Quantite en stock *</label>
                      <input type="number" className={inputCls} value={current.stock ?? 0} onChange={e => field('stock', Number(e.target.value))} placeholder="0" min={0} />
                    </div>
                    <div>
                      <label className={labelCls}>Seuil alerte stock faible</label>
                      <input type="number" className={inputCls} value={current.low_stock_threshold ?? 5} onChange={e => field('low_stock_threshold', Number(e.target.value))} placeholder="5" min={0} />
                    </div>
                  </div>
                </div>

                {/* Promo price sanity check — blocks bad configurations from
                    getting to save. Non-invasive: we surface a warning, the
                    admin fixes it before clicking Créer/Sauvegarder. */}
                {typeof current.sale_price === 'number' && typeof current.price === 'number' && current.sale_price > current.price && (
                  <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                    <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-rose-800">Prix promo supérieur au prix de vente</p>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        Le prix promo doit être inférieur ou égal au prix de vente.
                      </p>
                    </div>
                  </div>
                )}

                <div className={`p-4 rounded-2xl border ${t.cardBorder} ${t.rowHover}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-semibold ${t.text}`}>Etat du stock</span>
                    <StockBadge stock={current.stock || 0} threshold={current.low_stock_threshold} />
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: isDark ? '#30363d' : '#f3f4f6' }}>
                    <div className={`h-full rounded-full transition-all ${(current.stock || 0) === 0 ? 'bg-red-500' : (current.stock || 0) <= (current.low_stock_threshold || 5) ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(((current.stock || 0) / Math.max(current.stock || 1, 100)) * 100, 100)}%` }} />
                  </div>
                </div>

                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${t.textMuted} flex items-center gap-2`}>
                    <Award size={12} /> Badges produit
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'is_active', badge: 'ACTIVE', label: 'Produit actif', desc: "Visible dans la boutique et l'app" },
                      { key: 'is_featured', badge: 'VEDETTE', label: 'Produit vedette', desc: "Mis en avant sur l'accueil" },
                      { key: 'is_new', badge: 'NEW', label: 'Nouveau produit', desc: 'Badge NOUVEAU affiche' },
                      { key: 'is_best_seller', badge: 'TOP', label: 'Top vente', desc: 'Badge BEST SELLER' },
                      { key: 'is_promo', badge: 'PROMO', label: 'En promotion', desc: 'Badge PROMO affiche' },
                    ].map(tog => {
                      const val = !!current[tog.key as keyof Product];
                      return (
                        <label key={tog.key} className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer border transition-all ${val ? (isDark ? 'border-blue-500/40 bg-blue-900/20' : 'border-[#1A3C6E]/20 bg-blue-50/50') : `${t.cardBorder} ${t.rowHover}`}`}>
                          <Toggle value={val} onChange={() => field(tog.key as keyof Product, !val)} />
                          <div>
                            <div className={`text-xs font-bold ${t.text}`}>
                              <span className="mr-1 text-[10px] font-black">{tog.badge}</span>
                              {tog.label}
                            </div>
                            <div className={`text-xs ${t.textMuted}`}>{tog.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'media' && (
              <div className="space-y-5">
                {(!Array.isArray(current.images) || current.images.length === 0) && (
                  <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3">
                    <AlertTriangle size={16} className="text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-amber-900">Aucune image assignée</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Ajoutez au moins une image — le ProductCard sur la boutique a besoin d’une image pour s’afficher correctement.
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${t.textMuted} flex items-center gap-2`}>
                    <Upload size={12} /> Upload d'images
                  </p>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-[#1A3C6E] bg-[#1A3C6E]/5 scale-[1.01]' : (isDark ? 'border-[#30363d] hover:border-[#58a6ff]/50 hover:bg-[#1c2128]' : 'border-gray-200 hover:border-[#1A3C6E]/40 hover:bg-blue-50/30')}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={e => { handleFileUpload(e.target.files!); }}
                    />
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-[#1A3C6E]/30 border-t-[#1A3C6E] animate-spin" />
                        <p className={`text-sm font-medium ${t.textMuted}`}>Upload en cours...</p>
                      </div>
                    ) : (
                      <>
                        <Upload size={28} className={`mx-auto mb-3 ${t.textMuted}`} />
                        <p className={`text-sm font-semibold ${t.text}`}>Glissez-deposez vos images ici</p>
                        <p className={`text-xs ${t.textMuted} mt-1`}>ou cliquez pour selectionner - JPG, PNG, WebP</p>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Ou coller une URL d'image</label>
                  <div className="flex gap-2">
                    <input
                      value={imgUrl}
                      onChange={e => setImgUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addImageUrl(); } }}
                      placeholder="https://example.com/image.jpg"
                      className={`flex-1 ${inputCls}`}
                    />
                    <button type="button" onClick={addImageUrl} className="px-4 py-2.5 bg-[#1A3C6E] text-white rounded-xl text-sm font-semibold hover:bg-[#0d2447] flex items-center gap-1.5"><Plus size={14} /> Ajouter</button>
                  </div>
                </div>

                <div className={`rounded-2xl border ${t.cardBorder} p-4 space-y-3`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-sm font-black ${t.text}`}>Mediatheque centralisee</p>
                      <p className={`text-xs ${t.textMuted}`}>
                        Reutilisez les assets uploades dans Produits, Categories, Banners et Homepage.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadMediaLibrary(true)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold ${t.cardBorder} ${t.rowHover} ${t.text}`}
                    >
                      <RefreshCw size={12} className={loadingMedia ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                  </div>

                  <div className="relative">
                    <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
                    <input
                      value={mediaSearch}
                      onChange={(event) => setMediaSearch(event.target.value)}
                      placeholder="Filtrer par nom de fichier..."
                      className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-xs focus:outline-none ${t.input}`}
                    />
                  </div>

                  {loadingMedia ? (
                    <div className={`rounded-xl border ${t.cardBorder} p-4 text-xs ${t.textMuted}`}>
                      Chargement de la mediatheque...
                    </div>
                  ) : mediaResults.length === 0 ? (
                    <div className={`rounded-xl border ${t.cardBorder} p-4 text-xs ${t.textMuted}`}>
                      Aucun asset image disponible pour cette recherche.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {mediaResults.slice(0, 18).map((asset) => {
                        const assignedIndex = (current.images || []).indexOf(asset.url);
                        const alreadyAssigned = assignedIndex >= 0;
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => {
                              if (alreadyAssigned) {
                                if (assignedIndex > 0) {
                                  setMainImage(assignedIndex);
                                  toast.success('Image principale mise a jour.');
                                }
                                return;
                              }
                              setCurrent((prev) => ({ ...prev, images: [...(prev.images || []), asset.url] }));
                              toast.success('Image assignee depuis la mediatheque.');
                            }}
                            className={`text-left rounded-xl border overflow-hidden transition-all ${alreadyAssigned ? 'border-[#1A3C6E] ring-1 ring-[#1A3C6E]/30' : `${t.cardBorder} hover:border-[#1A3C6E]/40`}`}
                          >
                            <div className="relative h-24 w-full overflow-hidden">
                              <img src={asset.url} alt={asset.filename || 'media'} className="h-full w-full object-cover" />
                              {alreadyAssigned && (
                                <div className="absolute top-2 right-2 rounded-lg bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black text-white inline-flex items-center gap-1">
                                  <Check size={10} />
                                  {assignedIndex === 0 ? 'MAIN' : 'ASSIGNED'}
                                </div>
                              )}
                            </div>
                            <div className={`px-2 py-1.5 text-[10px] font-semibold truncate ${t.textMuted}`}>
                              {asset.filename || 'media'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {(current.images || []).length > 0 && (
                  <div>
                    <label className={`${labelCls} flex items-center justify-between`}>
                      <span>Galerie ({(current.images || []).length} images)</span>
                      <span className={`text-xs font-normal ${t.textMuted}`}>La 1ere = image principale</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(current.images || []).map((img, i) => (
                        <div key={i} className={`relative group rounded-2xl overflow-hidden border-2 aspect-square ${i === 0 ? 'border-[#1A3C6E]' : t.cardBorder}`}>
                          <img src={img} alt="" className="w-full h-full object-cover" />
                          {i === 0 && <div className="absolute top-2 left-2 bg-[#1A3C6E] text-white text-[9px] font-bold px-2 py-0.5 rounded-lg">PRINCIPALE</div>}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                            <div className="flex gap-1">
                              <button onClick={() => moveImage(i, 'up')} disabled={i === 0} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg disabled:opacity-30"><ArrowUp size={11} className="text-white" /></button>
                              <button onClick={() => moveImage(i, 'down')} disabled={i === (current.images || []).length - 1} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg disabled:opacity-30"><ArrowDown size={11} className="text-white" /></button>
                            </div>
                            {i !== 0 && <button onClick={() => setMainImage(i)} className="px-2 py-1 bg-[#1A3C6E]/80 rounded-lg text-white text-[9px] font-bold">Principale</button>}
                            <button onClick={() => removeImage(i)} className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded-lg"><X size={11} className="text-white" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className={labelCls}>URL video (optionnel)</label>
                  <input className={inputCls} value={current.video_url || ''} onChange={e => field('video_url', e.target.value)} placeholder="YouTube, Vimeo..." />
                </div>
              </div>
            )}

            {activeTab === 'display' && (
              <div className="space-y-6">
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-blue-900/10 border-blue-800/30' : 'bg-blue-50 border-blue-100'} flex items-start gap-3`}>
                  <Monitor size={16} className="text-[#1A3C6E] mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-[#1A3C6E]">Merchandising Web + App</p>
                    <p className={`text-xs ${t.textMuted} mt-0.5`}>Controlez le placement sur le site et l'app.</p>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${t.cardBorder} bg-gradient-to-br from-white to-blue-50/40`}>
                  <p className={`text-[11px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>
                    Ce produit apparaitra dans
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {placements.map((p, i) => (
                      <li key={i} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#1A3C6E] shadow-sm ring-1 ring-black/5">
                        <Check size={10} className="text-emerald-600" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'show_on_homepage', badge: 'HOME', label: "Page d'accueil", desc: "Visible sur l'accueil" },
                    { key: 'show_in_featured', badge: 'VEDETTE', label: 'Section vedette', desc: 'Section "Produits vedettes"' },
                    { key: 'show_in_new_arrivals', badge: 'NEW', label: 'Nouveautes', desc: 'Section wasal hadithan' },
                    { key: 'show_in_best_sellers', badge: 'TOP', label: 'Meilleures ventes', desc: 'Section al-akthar mabi' },
                    { key: 'show_in_promotions', badge: 'PROMO', label: 'Promotions', desc: 'Section promo' },
                  ].map(item => {
                    const val = !!current[item.key as keyof Product];
                    return (
                      <div key={item.key} className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${val ? (isDark ? 'border-blue-500/30 bg-blue-900/15' : 'border-[#1A3C6E]/20 bg-blue-50/40') : `${t.cardBorder} ${t.rowHover}`}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black tracking-wide rounded bg-slate-100 px-2 py-1 text-slate-700">{item.badge}</span>
                          <div>
                            <p className={`text-sm font-semibold ${t.text}`}>{item.label}</p>
                            <p className={`text-xs ${t.textMuted}`}>{item.desc}</p>
                          </div>
                        </div>
                        <Toggle value={val} onChange={() => field(item.key as keyof Product, !val)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'seo' && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Meta Title (titre SEO)</label>
                    <span className={`text-[10px] font-bold ${((current.meta_title || '').length > 60) ? 'text-amber-600' : t.textMuted}`}>
                      {(current.meta_title || '').length} / 70
                    </span>
                  </div>
                  <input className={inputCls} value={current.meta_title || ''} onChange={e => field('meta_title', e.target.value)} maxLength={70} placeholder={current.name_fr ? `${current.name_fr} - Verking Scolaire` : 'Titre optimise pour Google'} />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Meta Description</label>
                    <span className={`text-[10px] font-bold ${((current.meta_description || '').length > 150) ? 'text-amber-600' : t.textMuted}`}>
                      {(current.meta_description || '').length} / 160
                    </span>
                  </div>
                  <textarea rows={3} className={`${inputCls} resize-none`} value={current.meta_description || ''} onChange={e => field('meta_description', e.target.value)} maxLength={160} placeholder="Phrase courte vendeuse - visible dans les resultats Google." />
                </div>

                <div className={`rounded-2xl border ${t.cardBorder} p-4 bg-white`}>
                  <p className={`text-[10px] font-black mb-2 ${t.textMuted} uppercase tracking-wider flex items-center gap-1.5`}>
                    <Globe size={10} /> Apercu Google
                  </p>
                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500 flex items-center gap-1">
                      <span className="inline-block h-4 w-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                      verkingscolaire.dz / produit / {(current.name_fr || 'produit').toLowerCase().replace(/\s+/g, '-').slice(0, 30)}
                    </div>
                    <div className="text-xl font-medium leading-tight text-[#1a0dab] hover:underline cursor-pointer line-clamp-2">
                      {current.meta_title || current.name_fr || 'Titre du produit'}
                    </div>
                    <div className="text-[13px] text-gray-600 leading-snug line-clamp-3">
                      {current.meta_description || current.description_fr || 'La description apparaitra ici. Remplissez Meta Description pour un meilleur controle.'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Tags / Mots-cles</label>
                  <input className={inputCls} value={(current.tags || []).join(', ')} onChange={e => field('tags', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))} placeholder="cartable, rentree scolaire, primaire..." />
                  <p className={`text-[11px] mt-1 ${t.textMuted}`}>Separez les mots-cles par des virgules.</p>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-5">
                {mode === 'add' ? (
                  <div className={`rounded-2xl border border-dashed ${t.cardBorder} p-10 text-center`}>
                    <BarChart2 size={44} className={`mx-auto mb-3 ${t.textMuted} opacity-40`} />
                    <p className={`text-sm font-black ${t.text}`}>Analytics disponibles apres publication</p>
                    <p className={`mt-1 text-xs ${t.textMuted}`}>
                      Les vues, commandes, revenus et mouvements de stock apparaitront ici des que ce produit aura ete cree.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Vues', value: current.view_count || 0, icon: Eye, color: 'text-blue-600' },
                      { label: 'Commandes', value: current.order_count || 0, icon: ShoppingBag, color: 'text-green-600' },
                      { label: 'Stock', value: current.stock || 0, icon: Package, color: 'text-orange-600' },
                      { label: 'Revenu', value: `${((current.order_count || 0) * (current.sale_price || current.price || 0)).toLocaleString()} DA`, icon: DollarSign, color: 'text-purple-600' },
                    ].map(stat => (
                      <div key={stat.label} className={`rounded-2xl p-4 flex items-center gap-3 border ${t.cardBorder} ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center">
                          <stat.icon size={18} className={stat.color} />
                        </div>
                        <div>
                          <div className={`text-xl font-black ${t.text}`}>{stat.value}</div>
                          <div className={`text-xs ${t.textMuted}`}>{stat.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
              </div>
            </div>

            <aside className={`hidden lg:flex flex-col border-l ${t.divider} ${isDark ? 'bg-gray-900/40' : 'bg-gradient-to-b from-slate-50/80 to-white'}`}>
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <p className={`text-[11px] font-black uppercase tracking-wider ${t.textMuted} flex items-center gap-1.5`}>
                  <Eye size={11} /> Apercu live
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  {mode === 'add' ? 'Brouillon' : 'Edition'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5">
                  {Array.isArray(current.images) && current.images.length > 0 ? (
                    <ProductCard
                      product={{
                        id: (current.id as string) || 'preview-draft',
                        name_fr: current.name_fr || 'Nom du produit',
                        name_ar: current.name_ar || 'اسم المنتج',
                        price: typeof current.price === 'number' ? current.price : 0,
                        sale_price: typeof current.sale_price === 'number' ? current.sale_price : undefined,
                        images: current.images,
                        stock: typeof current.stock === 'number' ? current.stock : 0,
                        is_active: current.is_active !== false,
                        is_featured: !!current.is_featured,
                        is_new: !!current.is_new,
                        is_best_seller: !!current.is_best_seller,
                        is_promo: !!current.is_promo,
                        category_id: current.category_id,
                      } as any}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                      <ImageOff size={28} className="text-gray-300" />
                      <p className="text-xs font-bold text-gray-500">Ajoutez une image</p>
                      <p className="text-[10px] text-gray-400">L apercu apparaitra des qu une image est disponible.</p>
                    </div>
                  )}
                </div>

                <div className={`rounded-2xl border ${t.cardBorder} bg-white p-3`}>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>
                    Completude ({readiness.score}%)
                  </p>
                  <ul className="space-y-1.5">
                    {readiness.checks.map((c) => (
                      <li key={c.key} className="flex items-center gap-2 text-[11px]">
                        <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${c.done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                          {c.done ? <Check size={10} /> : null}
                        </span>
                        <span className={`flex-1 font-semibold ${c.done ? 'text-gray-700' : 'text-gray-500'}`}>{c.label}</span>
                        {c.required && !c.done && (
                          <span className="text-[9px] font-black text-rose-600">REQUIS</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`rounded-2xl border ${t.cardBorder} bg-white p-3`}>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>
                    Visible dans
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {placements.map((p, i) => (
                      <li key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#1A3C6E]">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className={`px-6 py-4 border-t ${t.divider} shrink-0 bg-gray-50/50`}>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const i = tabs.findIndex(tab => tab.id === activeTab);
                  if (i > 0) setActiveTab(tabs[i - 1].id);
                }}
                disabled={activeTab === tabs[0].id}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border ${t.cardBorder} ${t.rowHover} ${t.text} disabled:opacity-30`}
              >
                Precedent
              </button>
              <button
                onClick={() => {
                  const i = tabs.findIndex(tab => tab.id === activeTab);
                  if (i < tabs.length - 1) setActiveTab(tabs[i + 1].id);
                }}
                disabled={activeTab === tabs[tabs.length - 1].id}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border ${t.cardBorder} ${t.rowHover} ${t.text} disabled:opacity-30`}
              >
                Suivant
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={closeEditor} className={`px-4 py-2.5 rounded-xl text-sm font-semibold border ${t.cardBorder} ${t.rowHover} ${t.text}`}>Annuler</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-[#1A3C6E] text-white font-bold rounded-xl text-sm disabled:opacity-60 flex items-center gap-2">
                {saving ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Save size={15} />}
                {mode === 'add' ? 'Creer' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
