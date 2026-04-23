import React, { useEffect, useState } from 'react';
import { Save, Lock, Eye, EyeOff, Info, Store, Phone, Mail, MapPin, Globe, CreditCard, Truck, ShieldCheck, LayoutPanelLeft, Zap, X, Settings as SettingsIcon, RefreshCw, Sparkles } from 'lucide-react';
import { adminApi, API_BASE, apiHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';
import { motion } from 'motion/react';

function Field({ label, value, onChange, placeholder = '', type = 'text', dir, icon: Icon, description }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; dir?: string; icon?: React.ElementType;
  description?: string;
}) {
  const { t } = useAdminUI();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={`block text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>{label}</label>
      </div>
      <div className="relative group">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
            <Icon size={16} />
          </div>
        )}
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} dir={dir}
          className={`w-full ${Icon ? 'pl-11' : 'pl-4'} pr-4 py-3.5 border rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all ${t.input} border-transparent shadow-sm`}
        />
      </div>
      {description && <p className={`text-[10px] ${t.textMuted} px-1`}>{description}</p>}
    </div>
  );
}

interface StoreSettings {
  store_name: string;
  store_subtitle: string;
  phone: string;
  email: string;
  whatsapp: string;
  address: string;
  facebook: string;
  instagram: string;
  currency: string;
  country: string;
  shipping_fee: string;
  free_shipping_threshold: string;
}

export function AdminSettings() {
  const { token, logout } = useAuth();
  const { t } = useAdminUI();
  const [showPass, setShowPass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_name: 'VERKING SCOLAIRE', store_subtitle: 'STP Stationery',
    phone: '+213 555 123 456', email: 'contact@verking-scolaire.dz',
    whatsapp: '+213555123456', address: 'Rue des Frères Belloul, Bordj El Bahri, Alger 16111',
    facebook: '', instagram: '', currency: 'DA', country: 'Algérie',
    shipping_fee: '500', free_shipping_threshold: '5000',
  });
  const [savingStore, setSavingStore] = useState(false);
  const [loadingStore, setLoadingStore] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/store-settings`, { headers: apiHeaders(token) })
      .then(r => r.json())
      .then(d => { if (d.settings) setStoreSettings({ ...storeSettings, ...d.settings }); })
      .catch(console.error)
      .finally(() => setLoadingStore(false));
  }, [token]);

  const handleSaveStore = async () => {
    if (!token) return;
    setSavingStore(true);
    try {
      await fetch(`${API_BASE}/store-settings`, {
        method: 'PUT',
        headers: apiHeaders(token),
        body: JSON.stringify(storeSettings),
      });
      toast.success('Configuration sauvegardée');
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setSavingStore(false); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Mots de passe différents'); return; }
    if (newPassword.length < 8) { toast.error('8 caractères minimum'); return; }
    if (!token) return;
    setSavingPass(true);
    try {
      await adminApi.put('/admin/password', { new_password: newPassword }, token);
      toast.success('Mot de passe mis à jour !');
      setTimeout(() => logout(), 2000);
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setSavingPass(false); }
  };

  const sectionHeader = (title: string, subtitle: string, icon: React.ElementType, color: string) => (
    <div className="flex items-center gap-4 mb-8">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 group-hover:rotate-0 transition-transform ${color}`}>
        {React.createElement(icon, { size: 24, className: "text-white" })}
      </div>
      <div>
         <h2 className={`text-xl font-black ${t.text} tracking-tight`}>{title}</h2>
         <p className={`text-xs ${t.textMuted}`}>{subtitle}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-10 max-w-5xl">
      {/* Premium header — mobile-first, touch-safe (44px+), Capacitor-ready */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-4 min-w-0">
          <motion.div
            initial={{ rotate: -8, scale: 0.85 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: 'backOut' }}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-slate-900/30"
            style={{ background: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)' }}
          >
            <SettingsIcon size={26} className="text-white drop-shadow" />
          </motion.div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`text-2xl sm:text-3xl font-black ${t.text} tracking-tight`}>Configuration</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Sync OK
              </span>
            </div>
            <p className={`text-xs sm:text-sm ${t.textMuted} mt-1`}>
              Contrôle centralisé de l'écosystème Verking
            </p>
          </div>
        </div>
        <button
          onClick={handleSaveStore}
          disabled={savingStore || loadingStore}
          className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white shadow-xl shadow-blue-900/20 transition-all active:scale-[0.97] disabled:opacity-60 ${savingStore ? 'bg-emerald-500' : 'bg-[#1A3C6E] hover:bg-[#0d2447]'}`}
        >
          {savingStore ? <ShieldCheck size={18} /> : loadingStore ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          <span>{savingStore ? 'Sauvegardé' : loadingStore ? 'Chargement...' : 'Enregistrer tout'}</span>
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Main Settings */}
        <div className="lg:col-span-8 space-y-8">

          {/* Identity Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${t.card} border ${t.cardBorder} rounded-[2.5rem] p-6 sm:p-10 shadow-sm overflow-hidden relative group`}>
            {sectionHeader("Identité Commerciale", "Comment vos clients vous perçoivent", Store, "bg-blue-600")}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
               <Field label="Nom Public" value={storeSettings.store_name || ''} onChange={v => setStoreSettings(s => ({ ...s, store_name: v }))} placeholder="VERKING SCOLAIRE" icon={Store} />
               <Field label="Slogan / Sous-marque" value={storeSettings.store_subtitle || ''} onChange={v => setStoreSettings(s => ({ ...s, store_subtitle: v }))} placeholder="STP Stationery" />
               <Field label="Assistance Téléphonique" value={storeSettings.phone || ''} onChange={v => setStoreSettings(s => ({ ...s, phone: v }))} placeholder="+213 555 123 456" icon={Phone} type="tel" />
               <Field label="Email de Contact" value={storeSettings.email || ''} onChange={v => setStoreSettings(s => ({ ...s, email: v }))} placeholder="contact@verking.dz" icon={Mail} type="email" />
            </div>
            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-blue-900/20">
               <Field label="Localisation Siège" value={storeSettings.address || ''} onChange={v => setStoreSettings(s => ({ ...s, address: v }))} placeholder="Rue des Frères Belloul..." icon={MapPin} />
            </div>
          </motion.div>

          {/* Shipping & Commerce */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${t.card} border ${t.cardBorder} rounded-[2.5rem] p-6 sm:p-10 shadow-sm group`}>
            {sectionHeader("Commerce & Logistique", "Paramètres monétaires et livraison", Truck, "bg-emerald-600")}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8">
               <Field label="Frais de livraison (DA)" value={String(storeSettings.shipping_fee || '')} onChange={v => setStoreSettings(s => ({ ...s, shipping_fee: v }))} placeholder="500" type="number" icon={Truck} description="Montant forfaitaire par commande" />
               <Field label="Seuil Gratuité (DA)" value={String(storeSettings.free_shipping_threshold || '')} onChange={v => setStoreSettings(s => ({ ...s, free_shipping_threshold: v }))} placeholder="5000" type="number" icon={Zap} description="Livraison gratuite au-delà de ce montant" />
            </div>

            <div className={`p-6 rounded-[2rem] bg-gray-50 dark:bg-blue-950/20 border ${t.cardBorder} flex flex-col gap-4`}>
               <h4 className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Modes de paiement supportés</h4>
               <div className="flex flex-wrap gap-2">
                  {['💵 Cash On Delivery', '💳 Carte CIB / Dahabia', '🏪 Store Pickup'].map(pm => (
                    <span key={pm} className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm border ${t.cardBorder} ${t.badge}`}>{pm}</span>
                  ))}
               </div>
            </div>
          </motion.div>

          {/* Social Media */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`${t.card} border ${t.cardBorder} rounded-[2.5rem] p-6 sm:p-10 shadow-sm group`}>
            {sectionHeader("Réseaux Sociaux", "Connectez vos communautés", Globe, "bg-orange-500")}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
               <Field label="WhatsApp Business" value={storeSettings.whatsapp || ''} onChange={v => setStoreSettings(s => ({ ...s, whatsapp: v }))} placeholder="+213..." icon={Phone} />
               <Field label="Instagram" value={storeSettings.instagram || ''} onChange={v => setStoreSettings(s => ({ ...s, instagram: v }))} placeholder="URL de votre profil" icon={Globe} />
               <Field label="Facebook" value={storeSettings.facebook || ''} onChange={v => setStoreSettings(s => ({ ...s, facebook: v }))} placeholder="URL de votre page" icon={Globe} />
               <Field label="Boutique Pays" value={storeSettings.country || ''} onChange={v => setStoreSettings(s => ({ ...s, country: v }))} placeholder="Algérie" icon={Globe} />
            </div>
          </motion.div>
        </div>

        {/* Right Column: Security & Info */}
        <div className="lg:col-span-4 space-y-8">

           {/* Security */}
           <div className={`p-6 sm:p-8 rounded-[2.5rem] ${t.card} border ${t.cardBorder} shadow-lg relative overflow-hidden`}>
              <div className="absolute top-0 right-0 p-4">
                 <ShieldCheck className="text-emerald-500/20" size={80} />
              </div>
              <h3 className={`text-lg font-black ${t.text} mb-6 flex items-center gap-2`}>
                 <Lock size={18} /> Sécurité Accès
              </h3>

              <form onSubmit={handlePasswordChange} className="space-y-6">
                 <div>
                    <label className={`block text-[10px] font-black uppercase mb-2 ${t.textMuted}`}>Nouveau mot de passe</label>
                    <div className="relative">
                       <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`w-full px-5 py-3 ${t.input} border rounded-2xl text-sm font-bold outline-none`} />
                       <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center">
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                       </button>
                    </div>
                 </div>
                 <div>
                    <label className={`block text-[10px] font-black uppercase mb-2 ${t.textMuted}`}>Confirmer le code</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`w-full px-5 py-3 ${t.input} border rounded-2xl text-sm font-bold outline-none`} />
                 </div>

                 <button type="submit" disabled={savingPass || !newPassword} className="w-full min-h-[44px] py-4 bg-gray-900 dark:bg-blue-600 text-white font-black rounded-2xl text-sm hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50 shadow-xl">
                    {savingPass ? 'Mise à jour...' : 'Confirmer le changement'}
                 </button>
                 <p className={`text-[10px] text-center ${t.textMuted}`}>⚠️ Déconnexion immédiate après changement.</p>
              </form>
           </div>

           {/* Architecture Info */}
           <div className={`p-6 sm:p-8 rounded-[2.5rem] bg-[#1A3C6E] text-white shadow-2xl relative overflow-hidden group`}>
              <LayoutPanelLeft className="absolute -bottom-4 -right-4 text-white/5 group-hover:rotate-12 transition-transform duration-700" size={140} />
              <div className="relative">
                 <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                    <Info size={18} /> Architecture V.2
                 </h3>
                 <div className="space-y-3">
                    {[
                      ['Platform', 'React + Vite + TW4'],
                      ['Backend', 'Hono + Supabase'],
                      ['Database', 'Supabase KV Store'],
                      ['Assets', 'Supabase CDN'],
                      ['Mobile', 'Capacitor-ready (APK/iOS)'],
                      ['Update', 'OTA Cloud Sync']
                    ].map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-white/10">
                         <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{label}</span>
                         <span className="text-xs font-bold text-blue-200">{val}</span>
                      </div>
                    ))}
                 </div>

                 <div className="mt-8 flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                       <ShieldCheck size={20} className="text-blue-300" />
                    </div>
                    <p className="text-[10px] font-medium text-white/70 leading-relaxed italic">
                       "Système Verking hautement sécurisé avec synchronisation en temps réel."
                    </p>
                 </div>
              </div>
           </div>

           {/* Logout Zone */}
           <button
              onClick={logout}
              className="w-full min-h-[44px] p-6 rounded-[2.5rem] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 flex items-center justify-center gap-3 font-black hover:bg-red-100 transition-colors group"
           >
              <span>Terminer la session</span>
              <X size={20} className="group-hover:rotate-90 transition-transform" />
           </button>
        </div>
      </div>
    </div>
  );
}
