import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, Palette, Monitor, Type, Layers, CheckCircle2, Layout, Sparkles, Smartphone, Chrome } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export function AdminTheme() {
  const { token } = useAuth();
  const { theme: currentTheme, refreshTheme } = useTheme();
  const { t } = useAdminUI();
  const [form, setForm] = useState({ ...currentTheme });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'colors' | 'identity' | 'sections' | 'preview'>('colors');

  useEffect(() => { setForm({ ...currentTheme }); }, [currentTheme]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await adminApi.put('/theme', form, token);
      await refreshTheme();
      toast.success('Thème synchronisé avec succès');
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setSaving(false); }
  };

  const PRESETS = [
    { name: 'Marine Deep', primary: '#1A3C6E', accent: '#F57C00' },
    { name: 'Royal Gold', primary: '#1e3a8a', accent: '#fbbf24' },
    { name: 'Forest Premium', primary: '#064e3b', accent: '#fb923c' },
    { name: 'Silk Purple', primary: '#581c87', accent: '#f472b6' },
    { name: 'Teal Modern', primary: '#134e4a', accent: '#2dd4bf' },
    { name: 'Slate Dark', primary: '#0f172a', accent: '#38bdf8' },
    { name: 'Rosewood', primary: '#4c0519', accent: '#fecdd3' },
    { name: 'Desert Night', primary: '#451a03', accent: '#fcd34d' },
  ];

  const sidebarItem = (id: typeof activeTab, label: string, icon: React.ElementType) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-black transition-all ${activeTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : `${t.textMuted} hover:bg-gray-100 dark:hover:bg-blue-900/20 hover:text-blue-600`}`}
    >
      {React.createElement(icon, { size: 18 })}
      <span>{label}</span>
      {activeTab === id && <motion.div layoutId="activeDot" className="w-1.5 h-1.5 rounded-full bg-white ml-auto" />}
    </button>
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-black ${t.text} tracking-tight`}>Branding & Design</h1>
          <p className={`text-sm ${t.textMuted} mt-1`}>Pilotez l'identité visuelle de votre plateforme en temps réel</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setForm({ ...currentTheme })} className="p-3 rounded-2xl border border-gray-200 dark:border-blue-900/30 text-gray-500 hover:bg-white transition-all shadow-sm">
            <RotateCcw size={20} />
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-3 px-8 py-3 bg-[#1A3C6E] text-white font-black rounded-2xl text-sm shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
            <Save size={18} />
            {saving ? 'Publication...' : 'Publier le Design'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className={`lg:col-span-3 space-y-2 p-3 rounded-[2.5rem] ${t.cardSubtle} border ${t.cardBorder}`}>
           {sidebarItem('colors', 'Palettes & Couleurs', Palette)}
           {sidebarItem('identity', 'Identité de Marque', Type)}
           {sidebarItem('sections', 'Structure Accueil', Layout)}
           {sidebarItem('preview', 'Laboratoire Aperçu', Monitor)}
        </div>

        {/* Dynamic Content Area */}
        <div className="lg:col-span-9">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
               className={`${t.card} border ${t.cardBorder} rounded-[2.5rem] p-10 min-h-[500px] shadow-sm`}
             >
                {activeTab === 'colors' && (
                  <div className="space-y-10">
                    <div>
                       <h2 className={`text-xl font-black ${t.text} mb-6 flex items-center gap-2`}>
                          <Sparkles size={20} className="text-amber-500" /> Palettes Expert
                       </h2>
                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {PRESETS.map(preset => (
                             <button 
                               key={preset.name} 
                               onClick={() => setForm(p => ({ ...p, primary_color: preset.primary, accent_color: preset.accent }))}
                               className={`relative group p-4 rounded-3xl border-2 transition-all ${form.primary_color === preset.primary ? 'border-blue-600 bg-blue-50/50' : `${t.cardBorder} hover:border-gray-300`}`}
                             >
                               <div className="flex flex-col gap-3">
                                  <div className="flex -space-x-2">
                                     <div className="w-8 h-8 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: preset.primary }} />
                                     <div className="w-8 h-8 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: preset.accent }} />
                                  </div>
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${t.text}`}>{preset.name}</span>
                               </div>
                               {form.primary_color === preset.primary && (
                                 <div className="absolute top-2 right-2 text-blue-600">
                                    <CheckCircle2 size={16} />
                                 </div>
                               )}
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="pt-10 border-t border-gray-100 dark:border-blue-900/20">
                       <h2 className={`text-xl font-black ${t.text} mb-6`}>Couleurs de haute précision</h2>
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          {[
                            { key: 'primary_color', label: 'Couleur Principale', desc: 'Identité, Boutons, Nav' },
                            { key: 'accent_color', label: 'Accent Marketing', desc: 'Alertes, Badges, CTA' },
                            { key: 'bg_color', label: 'Arrière-plan', desc: 'Surface globale du site' },
                          ].map(({ key, label, desc }) => (
                            <div key={key} className={`p-6 rounded-[2rem] border ${t.cardBorder} hover:shadow-md transition-all`}>
                               <div className="flex items-center gap-4 mb-4">
                                  <div className="relative group">
                                     <div className="w-14 h-14 rounded-2xl shadow-inner border border-gray-100" style={{ backgroundColor: (form as any)[key] }} />
                                     <input type="color" value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className="absolute inset-0 opacity-0 cursor-pointer" />
                                  </div>
                                  <div className="min-w-0">
                                     <p className={`text-[10px] font-black uppercase tracking-widest ${t.text}`}>{label}</p>
                                     <p className={`text-[10px] font-mono font-bold ${t.textMuted}`}>{(form as any)[key]}</p>
                                  </div>
                               </div>
                               <p className={`text-[10px] leading-relaxed ${t.textMuted}`}>{desc}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'identity' && (
                  <div className="space-y-10">
                     <h2 className={`text-xl font-black ${t.text} flex items-center gap-2`}>
                        <Type size={20} className="text-blue-500" /> Signature de la Boutique
                     </h2>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-4">
                           <label className={`block text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Nom de l'enseigne</label>
                           <input 
                             value={(form as any).logo_text || ''} onChange={e => setForm(p => ({ ...p, logo_text: e.target.value }))}
                             className={`w-full px-6 py-4 ${t.input} border rounded-2xl font-black text-lg outline-none focus:ring-4 focus:ring-blue-500/10 transition-all`}
                           />
                        </div>
                        <div className="space-y-4">
                           <label className={`block text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Sous-titre Branding</label>
                           <input 
                             value={(form as any).logo_subtitle || ''} onChange={e => setForm(p => ({ ...p, logo_subtitle: e.target.value }))}
                             className={`w-full px-6 py-4 ${t.input} border rounded-2xl font-bold text-sm tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all uppercase`}
                           />
                        </div>
                     </div>
                     <div className={`p-8 rounded-[2rem] bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed ${t.cardBorder} text-center`}>
                        <p className={`text-xs ${t.textMuted} mb-4 font-bold`}>Aperçu de la signature</p>
                        <div className="inline-block p-6 rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-blue-900/40">
                           <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300">{(form as any).logo_text || 'VERKING'}</h3>
                           <p className="text-[10px] font-black tracking-[0.3em] text-amber-600">{(form as any).logo_subtitle || 'STATIONERY'}</p>
                        </div>
                     </div>
                  </div>
                )}

                {activeTab === 'sections' && (
                  <div className="space-y-8">
                     <h2 className={`text-xl font-black ${t.text} flex items-center gap-2`}>
                        <Layout size={20} className="text-emerald-500" /> Pilotage du Storefront
                     </h2>
                     <div className="grid grid-cols-1 gap-4">
                        {[
                          { key: 'show_featured', label: '⭐ Collection Vedette', desc: 'Produits mis en avant via l\'admin' },
                          { key: 'show_new_arrivals', label: '✨ Zone Nouveautés', desc: 'Derniers arrivages automatiques' },
                          { key: 'show_best_sellers', label: '🔥 Top Ventes', desc: 'Algorithme basé sur les commandes' },
                          { key: 'show_wholesale_section', label: '📦 Espace B2B Jomla', desc: 'Section réservée aux grossistes' },
                          { key: 'show_testimonials', label: '💬 Section Social Proof', desc: 'Avis clients et preuve sociale' },
                        ].map(({ key, label, desc }) => (
                          <div 
                            key={key} onClick={() => setForm(p => ({ ...p, [key]: !(p as any)[key] }))}
                            className={`flex items-center justify-between p-6 rounded-[2rem] border-2 cursor-pointer transition-all ${ (form as any)[key] ? 'border-blue-600 bg-blue-50/20' : `${t.cardBorder} hover:bg-gray-50 dark:hover:bg-blue-900/10` }`}
                          >
                             <div>
                                <h4 className={`text-sm font-black ${t.text}`}>{label}</h4>
                                <p className={`text-[10px] ${t.textMuted} mt-1`}>{desc}</p>
                             </div>
                             <div className={`w-14 h-7 rounded-full p-1 transition-all ${ (form as any)[key] ? 'bg-blue-600' : 'bg-gray-300' }`}>
                                <motion.div animate={{ x: (form as any)[key] ? 28 : 0 }} className="w-5 h-5 rounded-full bg-white shadow-lg" />
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>
                )}

                {activeTab === 'preview' && (
                  <div className="space-y-8 h-full">
                     <div className="flex items-center justify-between">
                        <h2 className={`text-xl font-black ${t.text}`}>Direct Laboratory</h2>
                        <div className="flex gap-2 p-1 rounded-xl bg-gray-100 dark:bg-blue-900/20">
                           <button className="p-2 rounded-lg bg-white shadow-sm text-blue-600"><Chrome size={18} /></button>
                           <button className="p-2 rounded-lg text-gray-400"><Smartphone size={18} /></button>
                        </div>
                     </div>
                     
                     <div className="flex-1 rounded-[2rem] overflow-hidden border border-gray-200 dark:border-blue-900/30 shadow-2xl scale-95 origin-top transition-transform hover:scale-100 duration-1000">
                        {/* Fake Browser */}
                        <div className="h-7 bg-gray-200 dark:bg-gray-800 flex items-center px-4 gap-1.5 border-b border-gray-300">
                           <div className="w-2 h-2 rounded-full bg-rose-400" />
                           <div className="w-2 h-2 rounded-full bg-amber-400" />
                           <div className="w-2 h-2 rounded-full bg-emerald-400" />
                           <div className="flex-1 max-w-[200px] h-4 mx-auto bg-white/50 rounded-md" />
                        </div>
                        {/* Mock Site */}
                        <div className="min-h-[400px]" style={{ backgroundColor: form.bg_color }}>
                           <div className="py-4 px-8 flex items-center justify-between" style={{ backgroundColor: form.primary_color }}>
                              <div className="text-white font-black text-base">{(form as any).logo_text || 'VERKING'}</div>
                              <div className="flex gap-4 text-[10px] text-white/70 font-bold">
                                 <span>Boutique</span>
                                 <span>Gros</span>
                                 <span>Contact</span>
                              </div>
                           </div>
                           <div className="p-12 text-center">
                              <span className="px-5 py-2 rounded-full text-white text-[10px] font-black shadow-lg mb-6 inline-block" style={{ backgroundColor: form.accent_color }}>
                                 EXCLUSIVE OFFER
                              </span>
                              <h3 className="text-3xl font-black text-gray-900 dark:text-gray-100 mb-6 leading-tight">Expert Solaire<br />Collection 2026</h3>
                              <div className="flex justify-center gap-4">
                                 <div className="px-8 py-3 rounded-2xl text-white font-black text-xs shadow-xl" style={{ backgroundColor: form.primary_color }}>Découvrir</div>
                                 <div className="px-8 py-3 rounded-2xl text-white font-black text-xs shadow-xl" style={{ backgroundColor: form.accent_color }}>Boutique</div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
                )}
             </motion.div>
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
