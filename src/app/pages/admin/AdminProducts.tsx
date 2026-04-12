import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { adminApi, api, API_BASE, apiHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';

// Types
import { Product, Category, ActiveTab, ViewMode, FilterStatus, FilterStock, SortField } from './products/types';

// Sub-components
import { ProductStats } from './products/ProductStats';
import { ProductToolbar } from './products/ProductToolbar';
import { ProductBulkActions } from './products/ProductBulkActions';
import { ProductTable } from './products/ProductTable';
import { ProductGrid } from './products/ProductGrid';
import { ProductEditor } from './products/ProductEditor';

const EMPTY_PRODUCT: Partial<Product> = {
  name_fr: '', name_ar: '', description_fr: '', description_ar: '',
  price: 0, sale_price: undefined, cost_price: undefined,
  images: [], video_url: '', category_id: '', stock: 0, low_stock_threshold: 5,
  sku: '', barcode: '', meta_title: '', meta_description: '',
  is_featured: false, is_new: false, is_best_seller: false, is_promo: false, is_active: true,
  show_on_homepage: false, show_in_featured: false, show_in_best_sellers: false,
  show_in_new_arrivals: false, show_in_promotions: false,
  show_in_cartables: false, show_in_trousses: false, show_in_school_supplies: false,
  section_priority: 99, sort_order: 99,
};

export function AdminProducts() {
  const { token } = useAuth();
  const { t, isDark } = useAdminUI();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Filters
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterStock, setFilterStock] = useState<FilterStock>('all');
  const [filterBadge, setFilterBadge] = useState('');
  const [sortField, setSortField] = useState<SortField>('sort_order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickActionMenu, setQuickActionMenu] = useState<string | null>(null);

  // Editor
  const [editorMode, setEditorMode] = useState<'add' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<Product>>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('info');
  const [imgUrl, setImgUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // ── LOAD DATA ──
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        adminApi.get('/products', token),
        api.get('/categories')
      ]);
      setProducts(p.products || []);
      setCategories(c.categories || []);
    } catch (e) {
      toast.error(`Erreur chargement: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Handle outside clicks for menus
  useEffect(() => {
    const handler = () => { setQuickActionMenu(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ── FILTER & SORT ──
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        if (filterCat && p.category_id !== filterCat) return false;
        if (filterStatus === 'active' && !p.is_active) return false;
        if (filterStatus === 'inactive' && p.is_active) return false;
        if (filterStock === 'out' && p.stock !== 0) return false;
        if (filterStock === 'low' && (p.stock === 0 || p.stock > (p.low_stock_threshold || 5))) return false;
        if (filterBadge === 'featured' && !p.is_featured) return false;
        if (filterBadge === 'new' && !p.is_new) return false;
        if (filterBadge === 'promo' && !p.is_promo) return false;
        if (filterBadge === 'best_seller' && !p.is_best_seller) return false;
        if (filterBadge === 'homepage' && !p.show_on_homepage) return false;
        if (filterBadge === 'cartables' && !p.show_in_cartables) return false;
        if (filterBadge === 'trousses' && !p.show_in_trousses) return false;
        if (search) {
          const s = search.toLowerCase();
          return (p.name_fr || '').toLowerCase().includes(s) || 
                 (p.name_ar || '').includes(s) || 
                 (p.sku || '').toLowerCase().includes(s);
        }
        return true;
      })
      .sort((a, b) => {
        let va: string | number = '';
        let vb: string | number = '';
        
        if (sortField === 'name') { va = a.name_fr || ''; vb = b.name_fr || ''; }
        else if (sortField === 'price') { va = a.price || 0; vb = b.price || 0; }
        else if (sortField === 'stock') { va = a.stock || 0; vb = b.stock || 0; }
        else if (sortField === 'updated') { va = a.updated_at || ''; vb = b.updated_at || ''; }
        else { va = a.sort_order ?? 99; vb = b.sort_order ?? 99; }
        
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [products, search, filterCat, filterStatus, filterStock, filterBadge, sortField, sortDir]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.is_active).length,
    lowStock: products.filter(p => p.stock > 0 && p.stock <= (p.low_stock_threshold || 5)).length,
    outOfStock: products.filter(p => p.stock === 0).length,
    featured: products.filter(p => p.is_featured).length,
  }), [products]);

  // ── SELECTION ──
  const toggleSelect = (id: string) => {
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    setSelected(s => s.size === filteredProducts.length ? new Set() : new Set(filteredProducts.map(p => p.id)));
  };

  // ── CRUD HANDLERS ──
  const handleSave = async () => {
    if (!token) return;
    if (!current.name_fr || !current.category_id || current.price === undefined) {
      return toast.error('Veuillez remplir les champs obligatoires (Nom, Catégorie, Prix)');
    }

    setSaving(true);
    try {
      const payload = { ...current };
      // Remove timestamps if they exist to let the DB handle it
      delete (payload as any).created_at;
      delete (payload as any).updated_at;

      if (editorMode === 'add') {
        await adminApi.post('/products', payload, token);
        toast.success('Produit créé avec succès');
      } else {
        await adminApi.put(`/products/${current.id}`, payload, token);
        toast.success('Produit mis à jour');
      }
      load();
      setEditorMode(null);
    } catch (e) {
      toast.error(`Erreur sauvegarde: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!token || !confirm(`Voulez-vous vraiment supprimer "${name}" ?`)) return;
    try {
      await adminApi.del(`/products/${id}`, token);
      toast.success('Produit supprimé');
      load();
    } catch (e) {
      toast.error(`Erreur suppression: ${e}`);
    }
  };

  const handleDuplicate = async (p: Product) => {
    if (!token) return;
    try {
      const copy = { 
        ...p, 
        name_fr: `${p.name_fr} (Copie)`, 
        sku: p.sku ? `${p.sku}-COPY` : undefined 
      };
      delete (copy as any).id;
      delete (copy as any).created_at;
      delete (copy as any).updated_at;
      
      await adminApi.post('/products', copy, token);
      toast.success('Produit dupliqué');
      load();
    } catch (e) {
      toast.error(`Erreur duplication: ${e}`);
    }
  };

  const toggleActive = async (p: Product) => {
    if (!token) return;
    try {
      await adminApi.put(`/products/${p.id}`, { is_active: !p.is_active }, token);
      setProducts(prev => prev.map(item => item.id === p.id ? { ...item, is_active: !item.is_active } : item));
    } catch (e) {
      toast.error(`Erreur statut: ${e}`);
    }
  };

  const toggleFeatured = async (p: Product) => {
    if (!token) return;
    try {
      await adminApi.put(`/products/${p.id}`, { is_featured: !p.is_featured }, token);
      setProducts(prev => prev.map(item => item.id === p.id ? { ...item, is_featured: !item.is_featured } : item));
      toast.success(p.is_featured ? 'Retiré des vedettes' : 'Mis en vedette');
    } catch (e) {
      toast.error(`Erreur vedette: ${e}`);
    }
  };

  const bulkAction = async (action: string, extra?: any) => {
    if (!token || selected.size === 0) return;
    const ids = Array.from(selected);
    try {
      // In a real app, we would have a bulk endpoint. 
      // For now, we iterate (as in the original code).
      for (const id of ids) {
        const p = products.find(p => p.id === id);
        if (!p) continue;

        let patch: any = {};
        if (action === 'activate') patch = { is_active: true };
        else if (action === 'deactivate') patch = { is_active: false };
        else if (action === 'delete') { await adminApi.del(`/products/${id}`, token); continue; }
        else if (action === 'feature') patch = { is_featured: true };
        else if (action === 'unfeature') patch = { is_featured: false };
        else if (action === 'category') patch = { category_id: extra };
        else if (action === 'section_homepage') patch = { show_on_homepage: true };

        if (Object.keys(patch).length > 0) {
          await adminApi.put(`/products/${id}`, patch, token);
        }
      }
      toast.success(`Action appliquée sur ${ids.length} produit(s)`);
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error(`Erreur bulk: ${e}`);
    }
  };

  // ── MEDIA HANDLERS ──
  const handleFileUpload = async (files: FileList) => {
    if (!token || !files.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const base64 = e.target?.result as string;
              const res = await fetch(`${API_BASE}/media/upload`, {
                method: 'POST', 
                headers: apiHeaders(token),
                body: JSON.stringify({ 
                  filename: file.name, 
                  content_type: file.type, 
                  data: base64, 
                  size: file.size 
                }),
              });
              const data = await res.json();
              if (data.media?.url) {
                setCurrent(p => ({ ...p, images: [...(p.images || []), data.media.url] }));
                toast.success(`✅ ${file.name} uploadé`);
              }
            } catch { 
              toast.error(`Erreur upload: ${file.name}`); 
            }
            resolve();
          };
          reader.readAsDataURL(file);
        });
      } catch { /* ignore */ }
    }
    setUploading(false);
  };

  const addImageUrl = () => {
    if (!imgUrl.trim()) return;
    setCurrent(p => ({ ...p, images: [...(p.images || []), imgUrl.trim()] }));
    setImgUrl('');
  };

  const removeImage = (i: number) => setCurrent(p => ({ ...p, images: (p.images || []).filter((_, idx) => idx !== i) }));
  
  const moveImage = (i: number, dir: 'up' | 'down') => {
    const imgs = [...(current.images || [])];
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= imgs.length) return;
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    setCurrent(p => ({ ...p, images: imgs }));
  };

  const setMainImage = (i: number) => {
    const imgs = [...(current.images || [])];
    const [img] = imgs.splice(i, 1);
    setCurrent(p => ({ ...p, images: [img, ...imgs] }));
  };

  // ── RENDER ──

  const margin = useMemo(() => {
    const p = current.price;
    const c = current.cost_price;
    if (typeof p !== 'number' || typeof c !== 'number' || p === 0) return null;
    return Math.round(((p - c) / p) * 100);
  }, [current.price, current.cost_price]);

  if (loading && products.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-[#1A3C6E] animate-spin" />
      <p className={`text-sm font-bold ${t.textMuted}`}>Chargement de l'inventaire...</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${t.text} flex items-center gap-3`}>
            📦 Gestion des Produits
          </h1>
          <p className={`${t.textMuted} mt-1 text-sm font-medium`}>
            Total: {products.length} produits répartis dans {categories.length} catégories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className={`p-2.5 rounded-xl border ${t.cardBorder} ${t.rowHover} ${t.textMuted} transition-all`} title="Actualiser">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setCurrent({ ...EMPTY_PRODUCT }); setEditorMode('add'); setActiveTab('info'); }} 
            className="flex items-center gap-2 px-6 py-2.5 bg-[#1A3C6E] hover:bg-[#0d2447] text-white font-black rounded-xl text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95">
            <Plus size={18} strokeWidth={3} /> Nouveau Produit
          </button>
        </div>
      </div>

      <ProductStats stats={stats} />

      <div className="space-y-4">
        <ProductToolbar 
          search={search} setSearch={setSearch}
          filterCat={filterCat} setFilterCat={setFilterCat}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          showFilters={showFilters} setShowFilters={setShowFilters}
          sortField={sortField} setSortField={setSortField}
          sortDir={sortDir} setSortDir={setSortDir}
          viewMode={viewMode} setViewMode={setViewMode}
          categories={categories}
          filterBadge={filterBadge} setFilterBadge={setFilterBadge}
          filterStock={filterStock} setFilterStock={setFilterStock}
        />

        <ProductBulkActions 
          selectedCount={selected.size}
          clearSelected={() => setSelected(new Set())}
          bulkAction={bulkAction}
          categories={categories}
        />

        {viewMode === 'table' ? (
          <ProductTable 
            products={products}
            filtered={filteredProducts}
            categories={categories}
            selected={selected}
            toggleAll={toggleAll}
            toggleSelect={toggleSelect}
            toggleSort={(f) => {
              if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
              else { setSortField(f); setSortDir('asc'); }
            }}
            toggleActive={toggleActive}
            toggleFeatured={toggleFeatured}
            openEdit={(p) => { setCurrent({ ...p }); setEditorMode('edit'); setActiveTab('info'); }}
            handleDuplicate={handleDuplicate}
            handleDelete={handleDelete}
            quickActionMenu={quickActionMenu}
            setQuickActionMenu={setQuickActionMenu}
          />
        ) : (
          <ProductGrid 
            filtered={filteredProducts}
            categories={categories}
            isDark={isDark}
            openEdit={(p) => { setCurrent({ ...p }); setEditorMode('edit'); setActiveTab('info'); }}
            handleDuplicate={handleDuplicate}
          />
        )}
      </div>

      <ProductEditor 
        isOpen={editorMode !== null}
        mode={editorMode || 'add'}
        current={current}
        setCurrent={setCurrent}
        categories={categories}
        closeEditor={() => setEditorMode(null)}
        handleSave={handleSave}
        saving={saving}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleFileUpload={handleFileUpload}
        uploading={uploading}
        margin={margin}
        imgUrl={imgUrl}
        setImgUrl={setImgUrl}
        addImageUrl={addImageUrl}
        removeImage={removeImage}
        moveImage={moveImage}
        setMainImage={setMainImage}
      />
    </div>
  );
}
