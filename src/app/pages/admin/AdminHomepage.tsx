import React, { useEffect, useState } from 'react';
import {
  Save, ArrowUp, ArrowDown, Eye, EyeOff, Layout, Image as ImageIcon,
  Package, Tag, Star, TrendingUp, Gift, Shield, MessageSquare,
  ChevronDown, ChevronUp, Zap, Globe
} from 'lucide-react';
import { adminApi, api, API_BASE, apiHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';

const SECTION_META: Record<string, { icon: React.ElementType; label: string; labelAr: string; color: string }> = {
  hero: { icon: ImageIcon, label: 'Hero / Bannière principale', labelAr: 'البانر الرئيسي', color: '#1A3C6E' },
  categories: { icon: Tag, label: 'Catégories', labelAr: 'الفئات', color: '#7c3aed' },
  featured: { icon: Star, label: 'Produits Vedettes', labelAr: 'منتجات مختارة', color: '#F57C00' },
  new_arrivals: { icon: Zap, label: 'Nouveautés', labelAr: 'وصل حديثاً', color: '#0891b2' },
  best_sellers: { icon: TrendingUp, label: 'Meilleures Ventes', labelAr: 'الأكثر مبيعاً', color: '#dc2626' },
  promotions: { icon: Gift, label: 'Promotions', labelAr: 'العروض الخاصة', color: '#16a34a' },
  trust: { icon: Shield, label: 'Section Confiance', labelAr: 'قسم الثقة', color: '#0891b2' },
  testimonials: { icon: MessageSquare, label: 'Témoignages Clients', labelAr: 'آراء العملاء', color: '#7c3aed' },
  wholesale: { icon: Package, label: 'Espace Grossiste', labelAr: 'قسم الجملة', color: '#065f46' },
};

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-all ${value ? 'bg-[#1A3C6E]' : 'bg-gray-300'}`}>
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${value ? 'left-6' : 'left-0.5'}`} />
    </button>
  );
}

function Field({ label, value, onChange, placeholder = '', dir, multiline = false, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; dir?: string; multiline?: boolean; type?: string;
}) {
  const cls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 bg-white text-gray-800';
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
      {multiline
        ? <textarea rows={2} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} dir={dir} className={cls + ' resize-none'} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} dir={dir} className={cls} />
      }
    </div>
  );
}

export function AdminHomepage() {
  const { token } = useAuth();
  const { t, isDark } = useAdminUI();
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>('hero');
  const [media, setMedia] = useState<any[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      const [cfgRes, mediaRes] = await Promise.all([
        api.get('/homepage-config'),
        adminApi.get('/media', token),
      ]);
      setConfig(cfgRes?.config || {});
      setMedia(mediaRes.media?.filter((m: any) => m.content_type?.startsWith('image/')) || []);
    } catch (e) {
      console.error('Load error:', e);
      toast.error('Erreur lors du chargement de la configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const handleSave = async () => {
    if (!token || !config) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/homepage-config`, {
        method: 'PUT',
        headers: apiHeaders(token),
        body: JSON.stringify(config),
      });
      toast.success('✅ Page d\'accueil mise à jour ! Visible sur le site et l\'app mobile.');
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setSaving(false); }
  };

  const updateSection = (key: string, update: any) => {
    setConfig((c: any) => {
      const current = c || {};
      const section = current[key] || {};
      return { ...current, [key]: { ...section, ...update } };
    });
  };

  const moveSection = (key: string, dir: 'up' | 'down') => {
    if (!config || !config.sections_order) return;
    const order = [...config.sections_order];
    const idx = order.indexOf(key);
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    setConfig((c: any) => ({ ...c, sections_order: order }));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #1A3C6E20', borderTopColor: '#1A3C6E' }} /></div>;

  const sections = config?.sections_order || Object.keys(SECTION_META);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`text-2xl font-black ${t.text}`}>Éditeur Page d'accueil</h1>
          <p className={`text-sm ${t.textMuted}`}>Contrôlez chaque section — synchronisé avec le site web et l'app mobile</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${isDark ? 'bg-green-950 text-green-400' : 'bg-green-100 text-green-700'}`}>
            <Globe size={11} />
            Sync Web + Mobile
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1A3C6E] hover:bg-[#0d2447] text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60">
            <Save size={14} />
            {saving ? 'Enregistrement...' : 'Enregistrer tout'}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isDark ? 'bg-blue-950/20 border-blue-900/30' : 'bg-blue-50 border-blue-200'}`}>
        <Layout size={18} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
        <div>
          <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>Centre de contrôle de la page d'accueil</p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            Activez/désactivez les sections, réorganisez leur ordre, modifiez les titres et images.
            Toutes les modifications sont synchronisées en temps réel sur le site web et l'application mobile.
          </p>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-3">
        {sections.map((key: string, idx: number) => {
          const meta = SECTION_META[key];
          if (!meta) return null;
          const section = config?.[key] || {};
          const isOpen = expanded === key;
          const Icon = meta.icon;

          return (
            <div key={key} className={`${t.card} border ${t.cardBorder} rounded-2xl overflow-hidden shadow-sm transition-all`}>
              {/* Section Header */}
              <div
                className={`flex items-center gap-4 p-4 cursor-pointer ${t.rowHover}`}
                onClick={() => setExpanded(isOpen ? null : key)}
              >
                {/* Drag Handle + Order */}
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSection(key, 'up'); }}
                    disabled={idx === 0}
                    className={`p-0.5 rounded transition-colors disabled:opacity-30 ${t.rowHover}`}
                  >
                    <ArrowUp size={13} className={t.textMuted} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSection(key, 'down'); }}
                    disabled={idx === sections.length - 1}
                    className={`p-0.5 rounded transition-colors disabled:opacity-30 ${t.rowHover}`}
                  >
                    <ArrowDown size={13} className={t.textMuted} />
                  </button>
                </div>

                {/* Icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                  style={{ backgroundColor: meta.color }}>
                  <Icon size={18} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${t.text}`}>{meta.label}</div>
                  <div className={`text-xs ${t.textMuted}`}>{meta.labelAr}</div>
                </div>

                {/* Position badge */}
                <div className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${t.badge}`}>
                  #{idx + 1}
                </div>

                {/* Enable toggle */}
                <div onClick={e => e.stopPropagation()}>
                  <Toggle
                    value={section.enabled !== false}
                    onChange={() => updateSection(key, { enabled: !(section.enabled !== false) })}
                  />
                </div>

                {/* Expand arrow */}
                <div className={t.textMuted}>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Expanded Editor */}
              {isOpen && (
                <div className={`border-t ${t.divider} p-5 space-y-4`}>
                  {/* Hero Section */}
                  {key === 'hero' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Titre (Français)" value={section.title_fr || ''} onChange={v => updateSection(key, { title_fr: v })} placeholder="Nouvelle Collection 2024" />
                        <Field label="العنوان (عربي)" value={section.title_ar || ''} onChange={v => updateSection(key, { title_ar: v })} placeholder="مجموعة جديدة 2024" dir="rtl" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Sous-titre (Français)" value={section.subtitle_fr || ''} onChange={v => updateSection(key, { subtitle_fr: v })} placeholder="Découvrez +60 modèles" multiline />
                        <Field label="العنوان الفرعي (عربي)" value={section.subtitle_ar || ''} onChange={v => updateSection(key, { subtitle_ar: v })} placeholder="اكتشف أكثر من 60 موديل" dir="rtl" multiline />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Bouton CTA (Français)" value={section.cta_fr || ''} onChange={v => updateSection(key, { cta_fr: v })} placeholder="Découvrir la collection" />
                        <Field label="زر الدعوة (عربي)" value={section.cta_ar || ''} onChange={v => updateSection(key, { cta_ar: v })} placeholder="اكتشف المجموعة" dir="rtl" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Image de fond</label>
                        <div className="flex gap-2 mb-2">
                          <input
                            value={section.image || ''}
                            onChange={e => updateSection(key, { image: e.target.value })}
                            placeholder="https://... URL de l'image ou choisir depuis la médiathèque"
                            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none text-gray-800"
                          />
                          <button
                            onClick={() => setShowMediaPicker(key)}
                            className="px-3 py-2.5 bg-[#1A3C6E] hover:bg-[#0d2447] text-white rounded-xl text-xs font-semibold"
                          >
                            Médiathèque
                          </button>
                        </div>
                        {section.image && (
                          <div className="rounded-xl overflow-hidden h-24 border border-gray-200">
                            <img src={section.image} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Categories / Trust / Testimonials / Wholesale */}
                  {['categories', 'trust', 'testimonials', 'wholesale'].includes(key) && (
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Titre (Français)" value={section.title_fr || ''} onChange={v => updateSection(key, { title_fr: v })} placeholder={meta.label} />
                      <Field label="العنوان (عربي)" value={section.title_ar || ''} onChange={v => updateSection(key, { title_ar: v })} placeholder={meta.labelAr} dir="rtl" />
                    </div>
                  )}

                  {/* Product Sections */}
                  {['featured', 'new_arrivals', 'best_sellers', 'promotions'].includes(key) && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Titre (Français)" value={section.title_fr || ''} onChange={v => updateSection(key, { title_fr: v })} placeholder={meta.label} />
                        <Field label="العنوان (عربي)" value={section.title_ar || ''} onChange={v => updateSection(key, { title_ar: v })} placeholder={meta.labelAr} dir="rtl" />
                      </div>
                      {section.limit !== undefined && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Nombre de produits à afficher</label>
                          <select
                            value={section.limit || 8}
                            onChange={e => updateSection(key, { limit: Number(e.target.value) })}
                            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white text-gray-800"
                          >
                            {[4, 6, 8, 10, 12, 16].map(n => <option key={n} value={n}>{n} produits</option>)}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {/* Status indicator */}
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${section.enabled !== false ? (isDark ? 'bg-green-950/30 text-green-400' : 'bg-green-50 text-green-700') : (isDark ? 'bg-red-950/30 text-red-400' : 'bg-red-50 text-red-600')}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${section.enabled !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                    {section.enabled !== false ? 'Section activée — visible sur le site et l\'app mobile' : 'Section désactivée — masquée du site et de l\'app mobile'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save button bottom */}
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-[#1A3C6E] hover:bg-[#0d2447] text-white font-black rounded-xl text-sm transition-colors shadow-lg disabled:opacity-60">
          <Save size={16} />
          {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </div>

      {/* Media Picker Modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${t.card} rounded-3xl w-full max-w-2xl shadow-2xl border ${t.cardBorder} max-h-[80vh] flex flex-col`}>
            <div className={`flex items-center justify-between p-5 border-b ${t.divider}`}>
              <h3 className={`font-bold ${t.text}`}>Choisir une image</h3>
              <button onClick={() => setShowMediaPicker(null)} className={`p-2 rounded-xl ${t.rowHover}`}>
                <span className={t.textMuted}>✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {media.length === 0 ? (
                <div className={`text-center py-12 ${t.textMuted}`}>
                  <ImageIcon size={36} className="mx-auto mb-3 opacity-30" />
                  <p>Médiathèque vide. Uploadez des images d'abord.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {media.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        updateSection(showMediaPicker, { image: m.url });
                        setShowMediaPicker(null);
                      }}
                      className="aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-[#1A3C6E] transition-all"
                    >
                      <img src={m.url} alt={m.filename} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
