import React, { useEffect, useRef, useState } from 'react';
import { Plus, Edit2, Trash2, X, Tag, UploadCloud, Eye, EyeOff, MoreHorizontal, MoveUp, MoveDown } from 'lucide-react';
import { adminApi, api, API_BASE, apiHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Category { id: string; name_fr: string; name_ar: string; slug: string; image: string; order: number; is_active: boolean; }
const EMPTY: Partial<Category> = { name_fr: '', name_ar: '', slug: '', image: '', order: 99, is_active: true };

export function AdminCategories() {
  const { token } = useAuth();
  const { t, isDark } = useAdminUI();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<Category>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const d = await api.get('/categories');
      // Sort by order
      const sorted = (d.categories || []).sort((a: Category, b: Category) => (a.order || 99) - (b.order || 99));
      setCategories(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setCurrent({ ...EMPTY }); setModal('add'); };
  const openEdit = (c: Category) => { setCurrent({ ...c }); setModal('edit'); };
  const closeModal = () => { setModal(null); setCurrent(EMPTY); };

  const handleNameFrChange = (v: string) => {
    setCurrent(p => ({
      ...p, name_fr: v,
      slug: p.slug || v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    }));
  };

  const handleFileUpload = async (file: File) => {
    if (!token) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const res = await fetch(`${API_BASE}/media/upload`, {
          method: 'POST',
          headers: apiHeaders(token),
          body: JSON.stringify({ filename: file.name, content_type: file.type, data: base64, size: file.size }),
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        setCurrent(p => ({ ...p, image: data.media.url }));
        toast.success('Image prête !');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      toast.error('Erreur upload');
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!token || !current.name_fr) { toast.error('Nom requis'); return; }
    setSaving(true);
    try {
      if (modal === 'add') await adminApi.post('/categories', current, token);
      else await adminApi.put(`/categories/${current.id}`, current, token);
      toast.success(modal === 'add' ? 'Catégorie créée' : 'Mis à jour');
      closeModal();
      load();
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer "${name}" ?`) || !token) return;
    try { 
      await adminApi.del(`/categories/${id}`, token); 
      toast.success('Supprimé'); 
      load(); 
    } catch (e) { 
      toast.error('Erreur suppression'); 
    }
  };

  const toggleActive = async (cat: Category) => {
    if (!token) return;
    try {
      await adminApi.put(`/categories/${cat.id}`, { is_active: !cat.is_active }, token);
      load();
    } catch (e) {
      toast.error('Erreur statut');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <div className="w-12 h-12 rounded-full animate-spin border-4 border-blue-100 border-t-blue-900" />
      <p className={`text-sm font-bold ${t.textMuted} animate-pulse`}>Chargement des catégories...</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-black ${t.text} tracking-tight`}>Catégories</h1>
          <p className={`text-sm ${t.textMuted} mt-1`}>{categories.length} segments organisés pour votre boutique</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-3 px-6 py-3 bg-[#1A3C6E] hover:bg-[#0d2447] text-white font-black rounded-2xl text-sm transition-all shadow-xl shadow-blue-900/20 active:scale-95">
          <Plus size={20} /> Nouveau segment
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {categories.map((cat, i) => (
          <motion.div 
            key={cat.id} 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`group relative ${t.card} rounded-[2rem] overflow-hidden border ${t.cardBorder} shadow-sm hover:shadow-xl transition-all duration-300 ${!cat.is_active ? 'opacity-50 grayscale' : ''}`}
          >
            <div className="aspect-[4/3] relative overflow-hidden bg-gray-50">
              {cat.image ? (
                <img src={cat.image} alt={cat.name_fr} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${t.cardSubtle}`}>
                  <Tag size={40} className={t.textMuted} />
                </div>
              )}
              
              <div className="absolute top-4 left-4">
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg ${cat.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'}`}>
                    {cat.is_active ? 'Public' : 'Masqué'}
                  </span>
              </div>

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                 <div className="flex gap-2 w-full">
                   <button onClick={() => openEdit(cat)} className={`flex-1 py-2.5 ${isDark ? 'bg-white text-blue-900' : 'bg-[#1A3C6E] text-white'} rounded-xl text-xs font-black shadow-lg hover:bg-amber-500 hover:text-white transition-colors`}>
                     Modifier
                   </button>
                   <button onClick={() => toggleActive(cat)} className="aspect-square w-10 bg-white/20 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-orange-500 transition-colors">
                     {cat.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                   </button>
                 </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className={`font-black ${t.text} truncate text-lg tracking-tight`}>{cat.name_fr}</h3>
                  <p className={`text-sm ${t.textMuted} mb-3`} dir="rtl">{cat.name_ar}</p>
                  
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${t.cardSubtle} border ${t.cardBorder}`}>
                       <span className={`text-[10px] font-black ${t.textMuted}`}>ORDRE</span>
                       <span className={`text-[10px] font-black ${t.text}`}>{cat.order}</span>
                    </div>
                    <span className={`text-[10px] font-bold ${t.textMuted}`}>/{cat.slug}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(cat.id, cat.name_fr)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shrink-0">
                   <Trash2 size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {categories.length === 0 && (
          <div className={`col-span-full ${t.card} rounded-[3rem] p-24 text-center border-2 border-dashed ${t.cardBorder}`}>
            <div className={`w-20 h-20 mx-auto mb-6 rounded-[2rem] ${t.cardSubtle} flex items-center justify-center`}>
              <Tag size={40} className={t.textMuted} />
            </div>
            <h3 className={`text-xl font-black ${t.text} mb-2`}>Aucune catégorie</h3>
            <p className={t.textMuted}>Commencez par organiser vos produits en segments.</p>
            <button onClick={openAdd} className="mt-8 px-8 py-3 bg-[#1A3C6E] text-white font-black rounded-2xl shadow-xl shadow-blue-900/10 active:scale-95 transition-all">
               Créer ma première catégorie
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-blue-950/40 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className={`${t.card} rounded-[2.5rem] w-full max-w-xl shadow-2xl relative overflow-hidden border ${t.cardBorder}`}
            >
              <div className={`flex items-center justify-between p-8 border-b ${t.cardBorder}`}>
                <div>
                  <h2 className={`text-xl font-black ${t.text}`}>{modal === 'add' ? 'Nouveau Segment' : 'Expert Modif'}</h2>
                  <p className={`text-xs ${t.textMuted}`}>Configuration de l'identité du point de vente</p>
                </div>
                <button onClick={closeModal} className={`p-3 rounded-2xl hover:bg-gray-100 ${t.rowHover} transition-colors`}>
                  <X size={20} className={t.textMuted} />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>Désignation (FR)</label>
                    <input value={current.name_fr || ''} onChange={e => handleNameFrChange(e.target.value)} placeholder="ex: Cartables Premium" className={`w-full px-5 py-3.5 ${t.input} border rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 transition-all outline-none`} />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>الإسم (AR)</label>
                    <input value={current.name_ar || ''} onChange={e => setCurrent(p => ({ ...p, name_ar: e.target.value }))} placeholder="الكرطابلات" dir="rtl" className={`w-full px-5 py-3.5 ${t.input} border rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none`} />
                  </div>
                </div>

                {/* Media Section */}
                <div>
                  <label className={`block text-[10px] font-black uppercase tracking-widest ${t.textMuted} mb-3`}>Visuel de couverture</label>
                  <div className={`relative rounded-3xl overflow-hidden border-2 border-dashed ${t.cardBorder} min-h-[160px] group transition-all`}>
                    {current.image ? (
                      <div className="relative h-full">
                        <img src={current.image} alt="Preview" className="w-full h-40 object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <button onClick={() => setCurrent(p => ({ ...p, image: '' }))} className="px-4 py-2 bg-red-500 text-white font-black rounded-xl text-xs shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                              Supprimer le visuel
                           </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-40 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                      >
                         {uploading ? (
                           <div className="w-8 h-8 rounded-full border-4 border-blue-100 border-t-blue-700 animate-spin" />
                         ) : (
                           <>
                             <div className="w-12 h-12 mb-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600">
                                <UploadCloud size={24} />
                             </div>
                             <p className={`text-xs font-bold ${t.text}`}>Déposez votre image ici</p>
                             <p className={`text-[10px] ${t.textMuted} mt-1 uppercase tracking-tight`}>JPG, PNG — Max 5MB</p>
                           </>
                         )}
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
                  
                  <div className="mt-4 flex items-center gap-3">
                     <span className={`text-[10px] font-black ${t.textMuted}`}>LIEN DIRECT :</span>
                     <input 
                       type="text" value={current.image || ''} onChange={e => setCurrent(p => ({ ...p, image: e.target.value }))}
                       placeholder="https://..." className={`flex-1 px-4 py-2 ${t.input} border rounded-xl text-[10px] font-mono outline-none`}
                     />
                  </div>
                </div>

                {/* Slug & Order */}
                <div className="grid grid-cols-2 gap-6">
                   <div>
                      <label className={`block text-[10px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>Slug URL</label>
                      <input value={current.slug || ''} onChange={e => setCurrent(p => ({ ...p, slug: e.target.value }))} className={`w-full px-5 py-3 ${t.input} border rounded-2xl text-xs font-mono outline-none`} />
                   </div>
                   <div>
                      <label className={`block text-[10px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>Ordre Prioritaire</label>
                      <input type="number" value={current.order ?? 99} onChange={e => setCurrent(p => ({ ...p, order: Number(e.target.value) }))} className={`w-full px-5 py-3 ${t.input} border rounded-2xl text-xs font-black outline-none`} />
                   </div>
                </div>

                {/* Status Toggle */}
                <div 
                  onClick={() => setCurrent(p => ({ ...p, is_active: !p.is_active }))}
                  className={`flex items-center justify-between p-5 rounded-2xl border cursor-pointer transition-all ${current.is_active ? 'bg-emerald-50 border-emerald-200' : `${t.cardSubtle} border-gray-200 shadow-inner`}`}
                >
                   <div className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-full border-2 ${current.is_active ? 'bg-emerald-500 border-white ring-4 ring-emerald-100' : 'bg-gray-200 border-gray-300'}`} />
                      <div>
                         <p className={`text-sm font-black ${current.is_active ? 'text-emerald-900' : t.text}`}>Visibilité Publique</p>
                         <p className={`text-[10px] font-bold ${current.is_active ? 'text-emerald-600' : t.textMuted}`}>Afficher cette collection sur le site et l'app</p>
                      </div>
                   </div>
                </div>
              </div>

              <div className={`p-8 bg-gray-50 dark:bg-blue-950/20 border-t ${t.cardBorder} flex gap-4`}>
                <button onClick={closeModal} className={`flex-1 py-4 font-black rounded-2xl text-sm ${t.textMuted} hover:bg-white transition-all`}>Annuler</button>
                <button 
                  onClick={handleSave} disabled={saving} 
                  className="flex-1 py-4 bg-[#1A3C6E] text-white font-black rounded-2xl text-sm shadow-xl shadow-blue-900/20 hover:bg-[#0d2447] disabled:opacity-50 transition-all active:scale-95"
                >
                  {saving ? 'Synchronisation...' : 'Enregistrer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
