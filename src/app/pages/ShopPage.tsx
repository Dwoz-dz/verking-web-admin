import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Search, SlidersHorizontal, X, ChevronDown, Filter, LayoutGrid, List, Sparkles, AlertCircle, Star, TrendingUp, Zap, Tag, ShoppingCart } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { tr, formatPrice } from '../lib/translations';
import { api } from '../lib/api';
import { CATEGORIES_UPDATED_EVENT, CATEGORIES_UPDATED_KEY } from '../lib/realtime';
import { ProductCard } from '../components/ProductCard';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export function ShopPage() {
  const { lang, dir } = useLang();
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilterMobile, setShowFilterMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const catParam = searchParams.get('category') || '';
  const querySearchParam = searchParams.get('search') || '';
  const featuredParam = searchParams.get('featured') === 'true';
  const newParam = searchParams.get('new') === 'true';
  const bestParam =
    searchParams.get('best_seller') === 'true' ||
    searchParams.get('bestseller') === 'true';
  const promoParam = searchParams.get('promo') === 'true';
  
  const [sortBy, setSortBy] = useState('new');
  const [priceRange, setPriceRange] = useState<number>(15000); // Max default

  const loadCategories = useCallback(async () => {
    const data = await api.get('/categories').catch(() => ({ categories: [] }));
    setCategories(data?.categories || []);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/products?active=true').then(d => setProducts(d.products || [])),
      loadCategories(),
    ]).finally(() => setLoading(false));
  }, [loadCategories]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === CATEGORIES_UPDATED_KEY) {
        loadCategories();
      }
    };

    const onCategoriesUpdated = () => loadCategories();
    const onFocus = () => loadCategories();

    window.addEventListener('storage', onStorage);
    window.addEventListener(CATEGORIES_UPDATED_EVENT, onCategoriesUpdated);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CATEGORIES_UPDATED_EVENT, onCategoriesUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadCategories]);

  useEffect(() => {
    setSearch(querySearchParam);
  }, [querySearchParam]);

  const filtered = useMemo(() => {
    let res = [...products];
    if (catParam) res = res.filter(p => p.category_id === catParam);
    if (featuredParam) res = res.filter(p => p.is_featured || p.show_on_homepage);
    if (newParam) res = res.filter(p => p.is_new || p.show_in_new_arrivals);
    if (bestParam) res = res.filter(p => p.is_best_seller || p.show_in_best_sellers);
    if (promoParam) res = res.filter(p => p.show_in_promotions || (p.sale_price && p.sale_price < p.price));
    
    if (search) {
      const s = search.toLowerCase();
      res = res.filter(p => 
        (p.name_fr || '').toLowerCase().includes(s) || 
        (p.name_ar || '').includes(s) ||
        (p.sku || '').toLowerCase().includes(s)
      );
    }
    
    res = res.filter(p => (p.sale_price || p.price) <= priceRange);

    if (sortBy === 'price_asc') res.sort((a, b) => (a.sale_price || a.price) - (b.sale_price || b.price));
    else if (sortBy === 'price_desc') res.sort((a, b) => (b.sale_price || b.price) - (a.sale_price || a.price));
    else if (sortBy === 'name_asc') res.sort((a, b) => (lang === 'ar' ? a.name_ar : a.name_fr).localeCompare(lang === 'ar' ? b.name_ar : b.name_fr));
    else res.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    
    return res;
  }, [products, catParam, featuredParam, newParam, bestParam, promoParam, search, sortBy, priceRange, lang]);

  const toggleFilter = (key: string) => {
    setSearchParams(prev => {
      const np = new URLSearchParams(prev);
      if (key === 'best_seller') {
        const isActive = np.get('best_seller') === 'true' || np.get('bestseller') === 'true';
        if (isActive) {
          np.delete('best_seller');
          np.delete('bestseller');
        } else {
          np.set('best_seller', 'true');
          np.delete('bestseller');
        }
        return np;
      }
      if (np.get(key) === 'true') np.delete(key);
      else np.set(key, 'true');
      return np;
    });
  };

  const clearFilters = () => {
    setSearchParams({});
    setSearch('');
    setPriceRange(20000);
  };

  const SidebarContent = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
        <div className="flex items-center gap-2 font-black text-gray-900">
           <Filter size={18} />
           {tr('filter', lang)}
        </div>
        {(catParam || featuredParam || newParam || bestParam || promoParam || search || priceRange < 20000) && (
          <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all">
            {lang === 'ar' ? 'مسح الكل' : 'Effacer'}
          </button>
        )}
      </div>

      {/* Search Within Shop */}
      <div className="mb-10">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 block">{tr('search_placeholder', lang)}</label>
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث...' : 'Chercher...'}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="mb-10">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 block">{tr('categories', lang)}</label>
        <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar pr-1">
          <FilterButton 
            active={!catParam} 
            onClick={() => setSearchParams(prev => { prev.delete('category'); return prev; })}
            label={tr('all_products', lang)} 
            theme={theme}
          />
          {categories.filter(c => c.is_active).map(cat => (
            <FilterButton 
              key={cat.id}
              active={catParam === cat.id}
              onClick={() => {
                setSearchParams({ category: cat.id });
                if (showFilterMobile) setShowFilterMobile(false);
              }}
              label={lang === 'ar' ? cat.name_ar : cat.name_fr}
              theme={theme}
            />
          ))}
        </div>
      </div>

      {/* Status Toggles */}
      <div className="mb-10">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 block">{lang === 'ar' ? 'خصائص' : 'Propriétés'}</label>
        <div className="space-y-3">
           <BadgeToggle active={featuredParam} onClick={() => toggleFilter('featured')} label={tr('featured', lang)} icon={<Star size={14} className="text-orange-400" />} />
           <BadgeToggle active={newParam} onClick={() => toggleFilter('new')} label={tr('new_arrivals', lang)} icon={<Sparkles size={14} className="text-blue-500" />} />
           <BadgeToggle active={bestParam} onClick={() => toggleFilter('best_seller')} label={tr('best_sellers', lang)} icon={<TrendingUp size={14} className="text-green-500" />} />
           <BadgeToggle active={promoParam} onClick={() => toggleFilter('promo')} label={tr('sale_badge', lang)} icon={<Zap size={14} className="text-red-500 fill-current" />} />
        </div>
      </div>

      {/* Price Slider */}
      <div>
        <div className="flex items-center justify-between mb-4">
           <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block">{lang === 'ar' ? 'السعر (دج)' : 'PRIX (DA)'}</label>
           <span className="text-xs font-black text-blue-700">{priceRange.toLocaleString()} DA</span>
        </div>
        <input
          type="range"
          min="0"
          max="20000"
          step="500"
          value={priceRange}
          onChange={e => setPriceRange(Number(e.target.value))}
          className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-700"
        />
        <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400">
           <span>0 DA</span>
           <span>20,000 DA</span>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-orange-500 animate-spin"></div>
        <p className="text-gray-500 font-medium">{lang === 'ar' ? 'جاري تحميل المتجر...' : 'Chargement de la boutique...'}</p>
      </div>
    </div>
  );

  return (
    <div dir={dir} className="bg-[#F8FAFC] min-h-screen pb-20">
      {/* ── HEADER BREADCRUMB ── */}
      <section className="bg-white border-b border-gray-100 py-10 pt-28">
        <div className="container mx-auto px-6">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <nav className="flex items-center gap-2 text-xs text-gray-400 mb-4 font-bold uppercase tracking-wider">
                  <Link to="/" className="hover:text-blue-700 transition-colors uppercase">{tr('home', lang)}</Link>
                  <ChevronDown size={12} className="-rotate-90 rtl:rotate-90" />
                  <span className="text-gray-900">{tr('shop', lang)}</span>
                </nav>
                <h1 className="text-4xl sm:text-5xl font-black text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  {tr('all_products', lang)}
                </h1>
                <p className="text-gray-500 mt-2 font-medium">
                  {filtered.length} {lang === 'ar' ? 'منتوج متوفر حالياً' : 'produits disponibles'}
                </p>
              </div>
              <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                 <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-md text-blue-700' : 'text-gray-400'}`}>
                    <LayoutGrid size={20} />
                 </button>
                 <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-md text-blue-700' : 'text-gray-400'}`}>
                    <List size={20} />
                 </button>
              </div>
           </div>
        </div>
      </section>

      <div className="container mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* ── SIDEBAR FILTERS ── */}
          <aside className="hidden lg:block lg:w-80 shrink-0">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 sticky top-28">
              <SidebarContent />
            </div>
          </aside>

          {/* ── MAIN PRODUCT GRID ── */}
          <main className="flex-1">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 gap-4">
               <div className="flex items-center gap-3 flex-1">
                  <span className="text-sm font-black text-gray-900">
                    {filtered.length} {lang === 'ar' ? 'منتج' : 'produit(s)'}
                  </span>
                  <div className="h-5 w-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium hidden sm:block">
                    {lang === 'ar' ? 'من أصل' : 'sur'} {products.length}
                  </span>
               </div>
               <div className="flex items-center gap-3">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="bg-white border border-gray-100 py-2.5 px-4 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/10 shadow-sm"
                  >
                    <option value="new">{tr('sort_new', lang)}</option>
                    <option value="price_asc">{tr('sort_price_asc', lang)}</option>
                    <option value="price_desc">{tr('sort_price_desc', lang)}</option>
                    <option value="name_asc">{lang === 'ar' ? 'الاسم' : 'Nom (A-Z)'}</option>
                  </select>
                  <button 
                    onClick={() => setShowFilterMobile(true)}
                    className="lg:hidden p-2.5 bg-white border border-gray-100 rounded-2xl text-gray-900 shadow-sm"
                  >
                    <SlidersHorizontal size={18} />
                  </button>
               </div>
            </div>

            {/* Active filter chips */}
            {(catParam || featuredParam || newParam || bestParam || promoParam || search || priceRange < 20000) && (
              <div className="flex items-center gap-2 flex-wrap mb-6 pb-4 border-b border-gray-100">
                <Tag size={13} className="text-gray-400 shrink-0" />
                <span className="text-xs font-bold text-gray-400 shrink-0">
                  {lang === 'ar' ? 'الفلاتر النشطة:' : 'Filtres actifs:'}
                </span>
                {catParam && (
                  <button onClick={() => setSearchParams(prev => { prev.delete('category'); return prev; })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-200 transition-colors">
                    {categories.find(c => c.id === catParam)?.[lang === 'ar' ? 'name_ar' : 'name_fr'] || catParam}
                    <X size={10} />
                  </button>
                )}
                {featuredParam && (
                  <button onClick={() => toggleFilter('featured')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-xl text-xs font-bold hover:bg-orange-200 transition-colors">
                    {tr('featured', lang)} <X size={10} />
                  </button>
                )}
                {newParam && (
                  <button onClick={() => toggleFilter('new')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A3C6E]/10 text-[#1A3C6E] rounded-xl text-xs font-bold hover:bg-[#1A3C6E]/20 transition-colors">
                    {tr('new_arrivals', lang)} <X size={10} />
                  </button>
                )}
                {bestParam && (
                  <button onClick={() => toggleFilter('best_seller')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-200 transition-colors">
                    {tr('best_sellers', lang)} <X size={10} />
                  </button>
                )}
                {promoParam && (
                  <button onClick={() => toggleFilter('promo')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 rounded-xl text-xs font-bold hover:bg-red-200 transition-colors">
                    {lang === 'ar' ? 'تخفيضات' : 'Promos'} <X size={10} />
                  </button>
                )}
                {priceRange < 20000 && (
                  <button onClick={() => setPriceRange(20000)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors">
                    ≤ {priceRange.toLocaleString()} DA <X size={10} />
                  </button>
                )}
                {search && (
                  <button onClick={() => setSearch('')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors">
                    "{search}" <X size={10} />
                  </button>
                )}
                <button onClick={clearFilters}
                  className="ml-auto text-xs font-bold text-red-500 hover:text-red-700 transition-colors">
                  {lang === 'ar' ? 'مسح الكل' : 'Tout effacer'}
                </button>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[3rem] p-24 text-center border border-gray-50 shadow-sm"
                >
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle size={40} className="text-gray-300" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">{tr('no_products', lang)}</h3>
                  <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                    {lang === 'ar' ? 'حاول تغيير معايير البحث أو التصفية.' : 'Essayez de modifier vos critères de recherche ou de filtrage.'}
                  </p>
                  <button onClick={clearFilters} className="px-8 py-3 bg-[#1A3C6E] text-white font-bold rounded-2xl shadow-lg hover:scale-105 transition-all">
                    {lang === 'ar' ? 'إعادة الضبط' : 'Réinitialiser'}
                  </button>
                </motion.div>
              ) : viewMode === 'list' ? (
                <div className="flex flex-col gap-4">
                  {filtered.map((p, i) => (
                    <motion.div
                      layout key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <ProductListRow product={p} lang={lang} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-5 grid-cols-2 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((p, i) => (
                    <motion.div
                      layout key={p.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <ProductCard product={p} />
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Mobile Filter Modal */}
      <AnimatePresence>
        {showFilterMobile && (
          <div className="fixed inset-0 z-[100] lg:hidden">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                onClick={() => setShowFilterMobile(false)}
              />
              <motion.div 
                initial={{ x: dir === 'rtl' ? '100%' : '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: dir === 'rtl' ? '100%' : '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`absolute top-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-[85%] sm:w-[50%] h-full bg-white p-8 overflow-y-auto shadow-2xl`}
              >
                <div className="flex items-center justify-between mb-8 pb-4 border-b">
                    <h2 className="text-2xl font-black text-blue-900">{tr('filter', lang)}</h2>
                    <button onClick={() => setShowFilterMobile(false)} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                      <X size={20} />
                    </button>
                </div>
                <SidebarContent />
                <div className="mt-12">
                   <button 
                    onClick={() => setShowFilterMobile(false)}
                    className="w-full py-5 bg-blue-900 text-white font-black rounded-2xl shadow-xl shadow-blue-900/20"
                   >
                     {lang === 'ar' ? 'تطبيق الفلاتر' : 'Appliquer'}
                   </button>
                </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── SUB-COMPONENTS ──

function ProductListRow({ product, lang }: { product: any; lang: string }) {
  const { addItem } = useCart();
  const { theme } = useTheme();
  const name = lang === 'ar' ? product.name_ar : product.name_fr;
  const effectivePrice = product.sale_price || product.price;
  const discount = product.sale_price ? Math.round((1 - product.sale_price / product.price) * 100) : 0;
  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({ product_id: product.id, name_fr: product.name_fr, name_ar: product.name_ar, price: product.price, sale_price: product.sale_price, image: product.images?.[0] || '', qty: 1, stock: product.stock });
    toast.success(lang === 'ar' ? '✓ أضيف للسلة' : '✓ Ajouté au panier');
  };
  return (
    <Link to={`/product/${product.id}`}
      className="flex items-center gap-5 bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md hover:border-gray-200 transition-all group">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 bg-gray-50">
        <img src={product.images?.[0] || 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=200&q=80'} alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 text-sm line-clamp-2 group-hover:text-[#1A3C6E] transition-colors">{name}</p>
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="font-black text-base" style={{ color: theme.primary_color }}>{formatPrice(effectivePrice, lang)}</span>
          {product.sale_price && <span className="text-xs text-gray-400 line-through">{formatPrice(product.price, lang)}</span>}
          {discount > 0 && <span className="text-[10px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-lg">-{discount}%</span>}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {product.is_new && <span className="text-[10px] font-black bg-[#1A3C6E] text-white px-2 py-0.5 rounded-lg">NOUVEAU</span>}
          {product.is_best_seller && <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg">BEST SELLER</span>}
          {product.stock === 0
            ? <span className="text-[10px] text-red-500 font-bold">Épuisé</span>
            : <span className="text-[10px] text-green-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />En stock</span>
          }
        </div>
      </div>
      <button onClick={handleAdd} disabled={product.stock === 0}
        className="shrink-0 p-3 rounded-2xl text-white shadow-md hover:scale-110 active:scale-95 transition-all disabled:opacity-30"
        style={{ backgroundColor: theme.primary_color }}>
        <ShoppingCart size={16} />
      </button>
    </Link>
  );
}

function FilterButton({ active, onClick, label, theme }: { active: boolean; onClick: () => void; label: string; theme: any }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-start px-4 py-3 rounded-2xl text-sm font-bold transition-all relative overflow-hidden group ${
        active ? 'text-white shadow-xl translate-x-1' : 'text-gray-500 hover:bg-gray-50'
      }`}
      style={active ? { backgroundColor: '#1A3C6E' } : {}}
    >
      {active && <motion.div layoutId="active-cat-bg" className="absolute left-0 top-0 h-full w-1.5 bg-orange-500" />}
      {label}
    </button>
  );
}

function BadgeToggle({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
        active ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? 'bg-white shadow-sm' : 'bg-gray-50'}`}>
          {icon}
        </div>
        <span className={`text-sm font-bold ${active ? 'text-blue-900' : 'text-gray-600'}`}>{label}</span>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'bg-blue-700 border-blue-700' : 'border-gray-200'}`}>
         {active && <X size={10} className="text-white" />}
      </div>
    </button>
  );
}
