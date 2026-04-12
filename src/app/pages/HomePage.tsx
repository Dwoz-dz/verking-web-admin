import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Truck, ShieldCheck, CreditCard, ChevronRight, Headphones, Star } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { api } from '../lib/api';
import { ProductCard } from '../components/ProductCard';

export function HomePage() {
  const { lang, dir } = useLang();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/products?active=true')
         .then(d => setProducts(d.products || []))
         .catch(e => { console.error('Products error', e); setProducts([]); }),
      api.get('/categories')
         .then(d => setCategories(d.categories || []))
         .catch(e => { console.error('Categories error', e); setCategories([]); }),
    ]).finally(() => setLoading(false));
  }, []);

  const featured = products.filter(p => p.show_on_homepage || p.is_featured).slice(0, 4);
  const newArrivals = products.filter(p => p.show_in_new_arrivals || p.is_new).slice(0, 4);
  const bestSellers = products.filter(p => p.show_in_best_sellers || p.is_best_seller).slice(0, 4);
  const promos = products.filter(p => p.show_in_promotions || (p.sale_price && p.sale_price < p.price)).slice(0, 4);
  
  const displayCategories = categories.filter(c => c.is_active !== false).slice(0, 4);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div dir={dir} className="bg-[#FDFBF7] text-gray-900 font-sans w-full overflow-x-hidden">
      
      {/* ── 1. HERO SECTION (Dynamic, Vibrant, Kid & Parent Friendly) ── */}
      <section className="relative w-full pt-2 pb-0 px-2 md:px-4 max-w-[1400px] mx-auto">
        <div className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden min-h-[400px] md:min-h-[500px] bg-sky-100 flex flex-col justify-end shadow-xl shadow-sky-900/10 border-2 md:border-4 border-white/50">
          
          <div className="absolute inset-0 w-full h-full">
            {/* The user will place their custom image here, but we set object-position so the backpacks show well */}
            <img 
              src="/verking-hero.png"
              onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2022&auto=format&fit=crop'; }}
              alt="Verking Scolaire Collection" 
              className="w-full h-full object-cover object-bottom"
            />
            {/* A warmer, sun-kissed gradient that matches the autumn/school vibe */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A3C6E]/90 via-[#1A3C6E]/30 to-transparent"></div>
          </div>

          {/* Hero Content */}
          <div className="relative z-10 p-4 md:p-10 flex flex-col items-center text-center w-full max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 px-3 py-1 rounded-full mb-4 text-white shadow-lg">
              <Star size={12} className="text-amber-400 fill-amber-400" />
              <span className="font-bold text-[10px] md:text-xs tracking-wider">
                {lang === 'ar' ? 'تشكيلة 2026 الجديدة' : 'NOUVELLE COLLECTION 2026'}
              </span>
              <Star size={14} className="text-amber-400 fill-amber-400" />
            </div>
            
            <h2 className="text-white font-black text-4xl md:text-5xl lg:text-6xl leading-[1.1] mb-4 tracking-tight drop-shadow-xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {lang === 'ar' ? (
                <>اكتشف تشكيلة<br/><span className="text-amber-400">الكرطابل</span> والمقالم</>
              ) : (
                <>Découvrez notre collection<br/>de <span className="text-amber-400">cartables</span> et trousses</>
              )}
            </h2>
            <p className="text-sky-50 text-sm md:text-lg font-bold mb-8 max-w-xl mx-auto leading-relaxed drop-shadow-md">
              {lang === 'ar' 
                ? 'محافظ مدرسية، مقالم، ولوازم عصرية بجودة عالية لتجربة مدرسية أفضل.' 
                : 'Cartables, trousses et fournitures modernes de qualité pour une rentrée réussie.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link to="/shop" className="w-full sm:w-auto bg-[#E5252A] text-white hover:bg-[#c91d22] px-8 py-3 rounded-full font-black text-xs md:text-sm uppercase tracking-wider transition-all hover:scale-105 shadow-xl shadow-red-600/30">
                {lang === 'ar' ? 'تسوق الآن' : 'Acheter maintenant'}
              </Link>
              <Link to="/shop?promo=true" className="w-full sm:w-auto bg-amber-400 text-[#1A3C6E] hover:bg-amber-500 px-8 py-3 rounded-full font-black text-xs md:text-sm uppercase tracking-wider transition-all hover:scale-105 shadow-xl shadow-amber-500/20">
                {lang === 'ar' ? 'اكتشف المجموعة' : 'Découvrir la collection'}
              </Link>
            </div>
          </div>
        </div>

        {/* Playful & Clean Trust Bar */}
        <div className="relative -mt-4 z-20 mx-4 md:mx-auto max-w-4xl bg-white rounded-xl shadow-lg shadow-sky-900/5 p-3 md:p-4 grid grid-cols-2 md:grid-cols-4 gap-2 divide-x divide-gray-100 rtl:divide-x-reverse border border-gray-50">
          <div className="flex flex-col items-center justify-center text-center gap-1.5 group">
            <div className="w-10 h-10 bg-sky-50 text-[#1A3C6E] group-hover:bg-[#1A3C6E] group-hover:text-white transition-colors rounded-full flex items-center justify-center">
              <Truck size={20} />
            </div>
            <span className="font-bold text-[10px] md:text-xs text-gray-800">{lang === 'ar' ? 'توصيل سريع' : 'Livraison rapide'}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-1.5 group">
            <div className="w-10 h-10 bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors rounded-full flex items-center justify-center">
              <CreditCard size={20} />
            </div>
            <span className="font-bold text-[10px] md:text-xs text-gray-800">{lang === 'ar' ? 'الدفع عند الاستلام' : 'Paiement à la livraison'}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-1.5 group">
            <div className="w-10 h-10 bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors rounded-full flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <span className="font-bold text-[10px] md:text-xs text-gray-800">{lang === 'ar' ? 'جودة عالية' : 'Qualité premium'}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-1.5 group">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors rounded-full flex items-center justify-center">
              <Headphones size={20} />
            </div>
            <span className="font-bold text-[10px] md:text-xs text-gray-800">{lang === 'ar' ? 'دعم الزبائن' : 'Support client'}</span>
          </div>
        </div>
      </section>

      {/* ── 2. CATEGORIES SECTION (Vibrant & Inviting) ── */}
      <section className="py-12 md:py-16 px-4 md:px-8 max-w-[1400px] mx-auto">
        <h2 className="text-2xl md:text-3xl font-black text-center text-[#1A3C6E] tracking-tight mb-8" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          {lang === 'ar' ? 'الأقسام الرئيسية' : 'NOS CATÉGORIES'}
        </h2>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {(displayCategories.length > 0 ? displayCategories : [
             { id: 'c1', name_ar: 'محافظ مدرسية', name_fr: 'Cartables', image: '/product-promo-1.png' },
             { id: 'c2', name_ar: 'مقالم', name_fr: 'Trousses', image: '/product-promo-2.png' },
             { id: 'c3', name_ar: 'لوازم مدرسية', name_fr: 'Fournitures', image: 'https://images.unsplash.com/photo-1497681883844-82b4f0a359a4?q=80&w=600' },
             { id: 'c4', name_ar: 'عروض خاصة', name_fr: 'Promotions', image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600' }
          ]).map((cat, i) => (
            <Link key={cat.id || i} to={`/shop?category=${cat.id}`} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-md border-2 border-transparent hover:border-amber-300 transition-all duration-300 hover:-translate-y-1">
              <img 
                src={cat.image || 'https://images.unsplash.com/photo-1588690153163-99b380cedad9?q=80&w=600'} 
                alt={lang === 'ar' ? cat.name_ar : cat.name_fr} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A3C6E]/90 via-[#1A3C6E]/40 to-transparent"></div>
              <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col items-center text-center">
                <h3 className="font-black text-white text-xl md:text-2xl mb-2 tracking-tight drop-shadow-md">
                  {lang === 'ar' ? cat.name_ar : cat.name_fr}
                </h3>
                <span className="inline-flex items-center gap-1 bg-[#E5252A] text-white px-4 py-1.5 rounded-full font-bold text-[10px] md:text-xs shadow-md translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  {lang === 'ar' ? 'تسوق' : 'Shop'} <ChevronRight size={14} className="rtl:rotate-180" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 3. FEATURED PRODUCTS (AliExpress Style Grid) ── */}
      <section className="py-10 bg-white rounded-3xl shadow-md shadow-sky-900/5 mx-2 md:mx-6 px-3 md:px-6 mb-8 border border-gray-50">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-6 h-1 bg-amber-400 rounded-full"></span>
                <h2 className="text-2xl md:text-3xl font-black text-[#1A3C6E] tracking-tight">
                  {lang === 'ar' ? 'منتجات مختارة' : 'Sélection Premium'}
                </h2>
              </div>
              <p className="text-gray-500 font-medium text-xs md:text-sm md:ml-8 rtl:mr-8">
                {lang === 'ar' ? 'اختيارات مميزة تجمع بين الجودة والأناقة.' : 'Des choix soigneusement sélectionnés.'}
              </p>
            </div>
            <Link to="/shop?featured=true" className="inline-flex items-center gap-1 text-[#E5252A] font-bold hover:text-[#c91d22] transition-colors bg-red-50/50 px-4 py-2 rounded-full text-xs md:text-sm">
              {lang === 'ar' ? 'عرض الكل' : 'Voir Tout'} <ChevronRight size={14} className="rtl:rotate-180" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
            {(featured.length > 0 ? featured.slice(0, 5) : [
              { id: '1', name_fr: 'Cartable Marcelo 3D Fille', name_ar: 'محفظة مارسيليو 3D للبنات', price: 4500, sale_price: 3200, images: ['/product-promo-1.png'], category_id: '1', stock: 10, is_new: true, rating: 4.8 },
              { id: '2', name_fr: 'Sac à dos Garçon Racing', name_ar: 'حقيبة ظهر أولاد سباق', price: 3800, images: ['/product-promo-2.png'], category_id: '1', stock: 5, rating: 4.9, review_count: 85 },
              { id: '3', name_fr: 'Trousse Premium', name_ar: 'مقلمة بريميوم', price: 1200, sale_price: 900, images: ['https://images.unsplash.com/photo-1588690153163-99b380cedad9?q=80&w=600'], category_id: '2', stock: 0, rating: 4.7, review_count: 120 },
              { id: '4', name_fr: 'Pack Scolaire Complet', name_ar: 'حزمة أدوات مدرسية', price: 8500, images: ['https://images.unsplash.com/photo-1497681883844-82b4f0a359a4?q=80&w=600'], category_id: '1', stock: 15, rating: 5.0, review_count: 340 },
              { id: '5', name_fr: 'Sac à dos Mignon', name_ar: 'حقيبة ظهر لطيفة', price: 2900, sale_price: 2400, images: ['https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600'], category_id: '1', stock: 15, rating: 4.6, review_count: 1500 }
            ]).map(product => <ProductCard key={product.id} product={product} />)}
          </div>
        </div>
      </section>

      {/* ── 4. BEST SELLERS SECTION ── */}
      <section className="py-10 md:py-14 px-3 md:px-6 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-6 h-1 bg-sky-400 rounded-full"></span>
              <h2 className="text-2xl md:text-3xl font-black text-[#1A3C6E] tracking-tight">
                {lang === 'ar' ? 'الأكثر مبيعًا' : 'Meilleures ventes'}
              </h2>
            </div>
            <p className="text-gray-500 font-medium text-xs md:text-sm md:ml-8 rtl:mr-8">
              {lang === 'ar' ? 'المنتجات التي يفضّلها زبائننا أكثر من غيرها.' : 'Les produits les plus appréciés par nos clients.'}
            </p>
          </div>
          <Link to="/shop?bestseller=true" className="inline-flex items-center gap-1 text-sky-600 font-bold hover:text-sky-700 transition-colors bg-sky-50/50 px-4 py-2 rounded-full text-xs md:text-sm">
            {lang === 'ar' ? 'عرض الكل' : 'Voir Tout'} <ChevronRight size={14} className="rtl:rotate-180" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
          {(bestSellers.length > 0 ? bestSellers.slice(0, 5) : [
             { id: '4', name_fr: 'Pack Scolaire Complet', name_ar: 'حزمة أدوات مدرسية', price: 8500, images: ['https://images.unsplash.com/photo-1497681883844-82b4f0a359a4?q=80&w=600'], category_id: '1', stock: 15, rating: 5.0, review_count: 340 },
             { id: '1', name_fr: 'Cartable Marcelo 3D Fille', name_ar: 'محفظة مارسيليو 3D للبنات', price: 4500, sale_price: 3200, images: ['/product-promo-1.png'], category_id: '1', stock: 10, is_new: true, rating: 4.8 },
             { id: '2', name_fr: 'Sac à dos Garçon Racing', name_ar: 'حقيبة ظهر أولاد سباق', price: 3800, images: ['/product-promo-2.png'], category_id: '1', stock: 5, rating: 4.9, review_count: 85 },
             { id: '5', name_fr: 'Sac à dos Mignon', name_ar: 'حقيبة ظهر لطيفة', price: 2900, sale_price: 2400, images: ['https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600'], category_id: '1', stock: 15, rating: 4.6, review_count: 1500 },
             { id: '3', name_fr: 'Trousse Premium', name_ar: 'مقلمة بريميوم', price: 1200, sale_price: 900, images: ['https://images.unsplash.com/photo-1588690153163-99b380cedad9?q=80&w=600'], category_id: '2', stock: 0, rating: 4.7, review_count: 120 },
          ]).map(product => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {/* ── 5. NEW ARRIVALS & PROMOTIONS (Playful Dual Banner Layout) ── */}
      <section className="py-12 bg-sky-50/50 px-3 md:px-6 border-t border-sky-100 border-dashed">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
            
            {/* New Arrivals Block */}
            <div className="bg-white p-5 md:p-8 rounded-3xl shadow-md border border-gray-50 shadow-sky-900/5 hover:-translate-y-1 transition-transform">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-[#1A3C6E] tracking-tight mb-1 flex items-center gap-2">
                     <span className="text-xl">✨</span> {lang === 'ar' ? 'وصلنا حديثًا' : 'Nouveautés'}
                  </h2>
                  <p className="text-gray-500 font-medium text-xs md:text-sm">
                    {lang === 'ar' ? 'اكتشف أحدث الإضافات إلى مجموعتنا.' : 'Découvrez les dernières nouveautés de notre collection.'}
                  </p>
                </div>
                <Link to="/shop?new=true" className="text-sky-500 hover:text-sky-600 font-bold text-xs transition-colors shrink-0 bg-sky-50 w-8 h-8 flex items-center justify-center rounded-full shadow-sm">
                   <ChevronRight size={16} className="rtl:rotate-180" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(newArrivals.length > 0 ? newArrivals.slice(0, 2) : [
                  { id: '1', name_fr: 'Cartable Marcelo 3D', name_ar: 'محفظة مارسيليو 3D', price: 4500, sale_price: 3200, images: ['/product-promo-1.png'], category_id: '1', stock: 10, is_new: true, rating: 4.9 },
                  { id: '2', name_fr: 'Sac Racing', name_ar: 'حقيبة سباق', price: 3800, images: ['/product-promo-2.png'], category_id: '1', stock: 5, rating: 4.7 }
                ]).map(product => <ProductCard key={product.id} product={product} />)}
              </div>
            </div>

            {/* Promos Block */}
            <div className="bg-[#FFF8F8] p-5 md:p-8 rounded-3xl shadow-md border border-red-50 hover:-translate-y-1 transition-transform">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-[#E5252A] tracking-tight mb-1 flex items-center gap-2">
                    <span className="text-xl">🔥</span> {lang === 'ar' ? 'عروض مميزة' : 'Promotions'}
                  </h2>
                  <p className="text-red-700/80 font-medium text-xs md:text-sm">
                    {lang === 'ar' ? 'استفد من أسعار خاصة لفترة محدودة.' : 'Profitez d’offres spéciales pour une durée limitée.'}
                  </p>
                </div>
                <Link to="/shop?promo=true" className="text-[#E5252A] hover:text-red-700 font-bold text-xs transition-colors shrink-0 bg-red-50 w-8 h-8 flex items-center justify-center rounded-full shadow-sm">
                   <ChevronRight size={16} className="rtl:rotate-180" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(promos.length > 0 ? promos.slice(0, 2) : [
                   { id: '1', name_fr: 'Pack Premium', name_ar: 'مجموعة بريميوم', price: 4500, sale_price: 3200, images: ['/product-promo-1.png'], category_id: '1', stock: 10, rating: 4.9 },
                   { id: '2', name_fr: 'Sac Racing', name_ar: 'حقيبة سباق', price: 3800, sale_price: 2500, images: ['/product-promo-2.png'], category_id: '1', stock: 5, rating: 4.7 }
                ]).map(product => <ProductCard key={product.id} product={product} />)}
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* ── 6. WHOLESALE CTA SECTION (Vibrant Institutional) ── */}
      <section className="py-16 px-4 md:px-8">
        <div className="max-w-[1000px] mx-auto text-center bg-gradient-to-br from-[#1A3C6E] to-[#0A1A32] rounded-3xl p-8 md:p-14 shadow-xl relative overflow-hidden text-white">
            {/* Playful abstract shapes in background */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -translate-x-1/2 translate-y-1/2"></div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1 rounded-full mb-4 text-white text-[10px] md:text-xs font-black uppercase tracking-wider">
                <Truck size={12} className="text-amber-400" /> VERKING BUSINESS
              </div>
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight leading-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {lang === 'ar' ? 'فضاء الجملة للموزعين والتجار' : 'Espace grossiste pour distributeurs'}
              </h2>
              <p className="text-blue-100 text-xs md:text-sm font-medium mb-8 max-w-xl mx-auto leading-relaxed">
                {lang === 'ar' 
                  ? 'انضم إلى شبكة شركائنا واستفد من عروض خاصة، أسعار تنافسية، وخدمة موجهة للطلبات بالجملة.' 
                  : 'Rejoignez notre réseau de partenaires et profitez d’offres dédiées et d’un service pensé pour les commandes en gros.'}
              </p>
              <Link to="/wholesale" className="inline-block bg-amber-400 text-[#1A3C6E] hover:bg-amber-500 px-8 py-3 rounded-full font-black text-xs md:text-sm uppercase tracking-wider transition-transform hover:scale-105 shadow-md shadow-amber-500/20">
                {lang === 'ar' ? 'اكتشف فضاء الجملة' : 'Découvrir l’espace grossiste'}
              </Link>
            </div>
        </div>
      </section>

    </div>
  );
}
