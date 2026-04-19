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
} from 'lucide-react';
import { useAdminUI } from '../../../context/AdminUIContext';
import { useAuth } from '../../../context/AuthContext';
import { adminApi } from '../../../lib/api';
import { Product, Category, ActiveTab } from './types';
import { Toggle, StockBadge } from './ProductRowComponents';
import { toast } from 'sonner';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEditor} />

      <div className={`relative w-full max-w-4xl max-h-[90vh] ${t.card} border ${t.cardBorder} rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200`}>
        <div className={`px-6 py-4 border-b ${t.divider} flex items-center justify-between shrink-0 bg-gradient-to-r ${isDark ? 'from-gray-900 to-gray-800' : 'from-white to-gray-50'}`}>
          <div>
            <h2 className={`text-xl font-black ${t.text} flex items-center gap-2`}>
              <div className="w-8 h-8 rounded-lg bg-[#1A3C6E] flex items-center justify-center text-white">
                {mode === 'add' ? <Plus size={18} /> : <Zap size={18} />}
              </div>
              {mode === 'add' ? 'Nouveau Produit' : 'Modifier Produit'}
            </h2>
            <p className={`text-xs ${t.textMuted} mt-1`}>Configurez les details, les prix et le placement du produit</p>
          </div>
          <button onClick={closeEditor} className={`p-2 rounded-xl ${t.rowHover} ${t.textMuted} transition-colors`}>
            <X size={20} />
          </button>
        </div>

        <div className={`px-2 py-1 flex items-center gap-1 border-b ${t.divider} shrink-0 overflow-x-auto no-scrollbar`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#1A3C6E] text-white shadow-md' : `${t.textMuted} ${t.rowHover}`}`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">

            {activeTab === 'info' && (
              <div className="space-y-5">
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
                  <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${t.textMuted} flex items-center gap-2`}>
                    <ShoppingBag size={12} /> Gestion du stock
                  </p>
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
                <div className="space-y-2">
                  {[
                    { key: 'show_on_homepage', badge: 'HOME', label: "Page d'accueil", desc: "Visible sur l'accueil" },
                    { key: 'show_in_featured', badge: 'VEDETTE', label: 'Section vedette', desc: 'Section "Produits vedettes"' },
                    { key: 'show_in_new_arrivals', badge: 'NEW', label: 'Nouveautes', desc: 'Section "وصل حديثا"' },
                    { key: 'show_in_best_sellers', badge: 'TOP', label: 'Meilleures ventes', desc: 'Section "الاكثر مبيعا"' },
                    { key: 'show_in_promotions', badge: 'PROMO', label: 'Promotions', desc: 'Section "عروض خاصة"' },
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
                  <label className={labelCls}>Meta Title (titre SEO)</label>
                  <input className={inputCls} value={current.meta_title || ''} onChange={e => field('meta_title', e.target.value)} maxLength={70} />
                </div>
                <div>
                  <label className={labelCls}>Meta Description</label>
                  <textarea rows={3} className={`${inputCls} resize-none`} value={current.meta_description || ''} onChange={e => field('meta_description', e.target.value)} maxLength={160} />
                </div>
                <div className={`p-4 rounded-2xl border ${t.cardBorder}`}>
                  <p className={`text-xs font-bold mb-3 ${t.textMuted} uppercase tracking-wider`}>Apercu Google</p>
                  <div className="text-blue-600 text-base font-medium truncate">{current.meta_title || current.name_fr || 'Titre du produit'}</div>
                  <div className={`text-xs ${t.textMuted} leading-relaxed line-clamp-2`}>{current.meta_description || current.description_fr || 'Description...'}</div>
                </div>
                <div>
                  <label className={labelCls}>Tags / Mots-cles</label>
                  <input className={inputCls} value={(current.tags || []).join(', ')} onChange={e => field('tags', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))} />
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-5">
                {mode === 'add' ? (
                  <div className={`py-16 text-center ${t.textMuted}`}>
                    <BarChart2 size={40} className="mx-auto mb-3 opacity-20" />
                    <p>Analytics disponibles apres creation</p>
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
