import React, { useEffect, useState } from 'react';
import {
  Save, Plus, Trash2, FileText, HelpCircle, Phone, Globe,
  Info, ChevronRight, BookOpen, Star, Eye, EyeOff, ArrowUp,
  ArrowDown, MessageSquare, MapPin, Clock, Mail, Instagram, Facebook,
} from 'lucide-react';
import { adminApi, api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';

// ── Tooltip ──
function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-semibold rounded-lg whitespace-nowrap z-50 pointer-events-none shadow-xl max-w-[240px] text-center">
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

// ── CharCount ──
function CharCount({ value, max }: { value: string; max: number }) {
  const { t } = useAdminUI();
  const count = value.length;
  const isOver = count > max;
  return (
    <span className={`text-[10px] font-bold ${isOver ? 'text-red-500' : t.textMuted}`}>
      {count}/{max}
    </span>
  );
}

// ── Textarea Field ──
function TextareaField({ label, value, onChange, rows = 4, dir, maxLength, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  rows?: number; dir?: string; maxLength?: number; placeholder?: string;
}) {
  const { t } = useAdminUI();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>{label}</label>
        {maxLength && <CharCount value={value} max={maxLength} />}
      </div>
      <textarea
        rows={rows} dir={dir} value={value} onChange={e => onChange(e.target.value)}
        maxLength={maxLength} placeholder={placeholder}
        className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 resize-none transition-colors ${t.input}`}
      />
    </div>
  );
}

// ── Input Field ──
function InputField({ label, value, onChange, placeholder, icon: Icon, tooltip }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon?: React.ElementType; tooltip?: string;
}) {
  const { t } = useAdminUI();
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <label className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>{label}</label>
        {tooltip && (
          <Tooltip label={tooltip}>
            <Info size={11} className={`${t.textMuted} cursor-help`} />
          </Tooltip>
        )}
      </div>
      <div className="relative">
        {Icon && <Icon size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />}
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full ${Icon ? 'pl-9' : 'pl-4'} pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-colors ${t.input}`} />
      </div>
    </div>
  );
}

const TABS = [
  { key: 'about', label: 'À propos', icon: BookOpen, desc: 'Histoire et présentation de la marque' },
  { key: 'contact', label: 'Contact', icon: Phone, desc: 'Coordonnées et horaires' },
  { key: 'faq', label: 'FAQ', icon: HelpCircle, desc: 'Questions fréquentes' },
] as const;

export function AdminContent() {
  const { token } = useAuth();
  const { t, isDark } = useAdminUI();
  const [content, setContent] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'about' | 'contact' | 'faq'>('about');

  useEffect(() => {
    api.get('/content')
      .then(d => setContent(d.content || {}))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await adminApi.put('/content', content, token);
      toast.success('✅ Contenu mis à jour avec succès !');
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setSaving(false); }
  };

  const set = (key: string, val: any) => setContent((p: any) => ({ ...p, [key]: val }));

  const addFaq = () => set('faq', [...(content.faq || []), { q_fr: '', q_ar: '', a_fr: '', a_ar: '' }]);
  const removeFaq = (i: number) => set('faq', (content.faq || []).filter((_: any, idx: number) => idx !== i));
  const updateFaq = (i: number, key: string, value: string) =>
    set('faq', (content.faq || []).map((f: any, idx: number) => idx === i ? { ...f, [key]: value } : f));
  const moveFaq = (i: number, dir: 'up' | 'down') => {
    const arr = [...(content.faq || [])];
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set('faq', arr);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-[#1A3C6E] animate-spin" />
      <p className={`text-sm font-bold ${t.textMuted}`}>Chargement du contenu...</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-3xl font-black ${t.text} tracking-tight`}>Gestion du Contenu</h1>
          <p className={`text-sm ${t.textMuted} mt-1`}>Textes, FAQ et informations visibles sur le site</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noreferrer"
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-semibold ${t.cardBorder} ${t.textMuted} ${t.rowHover} transition-all`}>
            <Eye size={14} /> Voir le site
          </a>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1A3C6E] hover:bg-[#0d2447] text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60">
            <Save size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer tout'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-2xl border ${t.cardBorder} ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <Tooltip key={tab.key} label={tab.desc}>
              <button onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.key
                    ? `bg-[#1A3C6E] text-white shadow-md`
                    : `${t.textMuted} ${t.rowHover}`
                }`}>
                <Icon size={13} /> {tab.label}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* ── TAB: About ── */}
      {activeTab === 'about' && (
        <div className="space-y-5">
          {/* Hero Text */}
          <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-4`}>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={16} className="text-[#1A3C6E]" />
              <h2 className={`font-bold ${t.text}`}>Page «&nbsp;À propos&nbsp;»</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextareaField
                label="Description (Français)" rows={6}
                value={content.about_fr || ''} onChange={v => set('about_fr', v)}
                maxLength={2000}
                placeholder="Présentez VERKING SCOLAIRE en français..."
              />
              <TextareaField
                label="الوصف (عربي)" rows={6} dir="rtl"
                value={content.about_ar || ''} onChange={v => set('about_ar', v)}
                maxLength={2000}
                placeholder="قدم VERKING SCOLAIRE بالعربية..."
              />
            </div>
          </div>

          {/* Brand Values */}
          <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Star size={16} className="text-orange-500" />
              <h2 className={`font-bold ${t.text}`}>Valeurs de la marque</h2>
              <Tooltip label="Ces textes apparaissent dans la section 'Notre histoire' sur la page À propos">
                <Info size={13} className={`${t.textMuted} cursor-help`} />
              </Tooltip>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextareaField
                label="Slogan / Accroche (FR)" rows={2}
                value={content.brand_tagline_fr || ''} onChange={v => set('brand_tagline_fr', v)}
                maxLength={160} placeholder="ex: La rentrée, avec style."
              />
              <TextareaField
                label="الشعار (AR)" rows={2} dir="rtl"
                value={content.brand_tagline_ar || ''} onChange={v => set('brand_tagline_ar', v)}
                maxLength={160} placeholder="مثال: عودة للمدرسة بأسلوب راقٍ"
              />
              <TextareaField
                label="Notre histoire (FR)" rows={4}
                value={content.brand_story_fr || ''} onChange={v => set('brand_story_fr', v)}
                maxLength={500} placeholder="Fondée en..., VERKING SCOLAIRE..."
              />
              <TextareaField
                label="قصتنا (AR)" rows={4} dir="rtl"
                value={content.brand_story_ar || ''} onChange={v => set('brand_story_ar', v)}
                maxLength={500} placeholder="تأسست في..."
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Contact ── */}
      {activeTab === 'contact' && (
        <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-6 shadow-sm space-y-5`}>
          <div className="flex items-center gap-2 mb-2">
            <Phone size={16} className="text-green-600" />
            <h2 className={`font-bold ${t.text}`}>Informations de contact</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Adresse" value={content.address || ''}
              onChange={v => set('address', v)} icon={MapPin}
              placeholder="Rue des Frères Belloul, Alger 16111"
              tooltip="Adresse physique du magasin — visible sur la page Contact et Footer" />
            <InputField label="Téléphone" value={content.phone || ''}
              onChange={v => set('phone', v)} icon={Phone}
              placeholder="+213 555 123 456"
              tooltip="Numéro principal de contact" />
            <InputField label="Email" value={content.email || ''}
              onChange={v => set('email', v)} icon={Mail}
              placeholder="contact@verking-scolaire.dz"
              tooltip="Email de contact affiché sur le site" />
            <InputField label="WhatsApp" value={content.whatsapp || ''}
              onChange={v => set('whatsapp', v)} icon={MessageSquare}
              placeholder="213555123456 (sans +)"
              tooltip="Numéro WhatsApp pour le bouton de contact rapide (sans le + initial)" />
            <InputField label="Horaires d'ouverture" value={content.working_hours || ''}
              onChange={v => set('working_hours', v)} icon={Clock}
              placeholder="Dim → Jeu: 08h00 – 18h00"
              tooltip="Horaires visibles sur la page Contact" />
            <InputField label="Facebook URL" value={content.facebook || ''}
              onChange={v => set('facebook', v)} icon={Facebook}
              placeholder="https://facebook.com/verking.scolaire"
              tooltip="Lien vers la page Facebook — visible dans le footer" />
            <InputField label="Instagram URL" value={content.instagram || ''}
              onChange={v => set('instagram', v)} icon={Instagram}
              placeholder="https://instagram.com/verking.scolaire"
              tooltip="Lien vers le compte Instagram" />
          </div>

          {/* Preview */}
          <div className={`rounded-2xl p-4 border ${isDark ? 'border-blue-800/30 bg-blue-900/10' : 'border-blue-100 bg-blue-50/50'}`}>
            <p className={`text-xs font-black uppercase tracking-wide mb-3 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
              <Eye size={11} className="inline mr-1" />Aperçu carte contact
            </p>
            <div className="space-y-1.5 text-sm">
              {content.address && <p className={t.text}><MapPin size={12} className="inline mr-1.5" />{content.address}</p>}
              {content.phone && <p className={t.text}><Phone size={12} className="inline mr-1.5" />{content.phone}</p>}
              {content.email && <p className={t.text}><Mail size={12} className="inline mr-1.5" />{content.email}</p>}
              {content.working_hours && <p className={t.text}><Clock size={12} className="inline mr-1.5" />{content.working_hours}</p>}
              {!content.address && !content.phone && !content.email && (
                <p className={`italic text-xs ${t.textMuted}`}>Remplissez les informations ci-dessus...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: FAQ ── */}
      {activeTab === 'faq' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`font-bold ${t.text}`}>Questions fréquentes</h2>
              <p className={`text-xs ${t.textMuted} mt-0.5`}>{(content.faq || []).length} question(s) — visible sur la page FAQ</p>
            </div>
            <button onClick={addFaq}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1A3C6E] text-white font-bold rounded-xl text-sm hover:bg-[#0d2447] transition-colors">
              <Plus size={14} /> Ajouter une FAQ
            </button>
          </div>

          {(content.faq || []).length === 0 ? (
            <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-14 text-center`}>
              <HelpCircle size={48} className={`mx-auto mb-4 ${t.textMuted} opacity-20`} />
              <p className={`font-bold ${t.text}`}>Aucune FAQ configurée</p>
              <p className={`text-xs mt-1 ${t.textMuted}`}>Cliquez sur «&nbsp;Ajouter une FAQ&nbsp;» pour commencer</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(content.faq || []).map((faq: any, i: number) => (
                <div key={i} className={`${t.card} border ${t.cardBorder} rounded-2xl overflow-hidden shadow-sm`}>
                  <div className={`flex items-center justify-between px-5 py-3 border-b ${t.divider} ${isDark ? 'bg-gray-800/50' : 'bg-gray-50/80'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-lg bg-[#1A3C6E] text-white text-[10px] font-black flex items-center justify-center`}>
                        {i + 1}
                      </span>
                      <span className={`text-xs font-bold ${t.text} truncate max-w-[200px]`}>
                        {faq.q_fr || 'Nouvelle question...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip label="Monter">
                        <button onClick={() => moveFaq(i, 'up')} disabled={i === 0}
                          className={`p-1.5 rounded-lg ${t.rowHover} ${t.textMuted} disabled:opacity-30`}>
                          <ArrowUp size={12} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Descendre">
                        <button onClick={() => moveFaq(i, 'down')} disabled={i === (content.faq || []).length - 1}
                          className={`p-1.5 rounded-lg ${t.rowHover} ${t.textMuted} disabled:opacity-30`}>
                          <ArrowDown size={12} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Supprimer cette FAQ">
                        <button onClick={() => removeFaq(i)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wide ${t.textMuted} mb-1.5`}>
                        Question (FR)
                      </label>
                      <input value={faq.q_fr} onChange={e => updateFaq(i, 'q_fr', e.target.value)}
                        placeholder="Comment puis-je..."
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`} />
                    </div>
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wide ${t.textMuted} mb-1.5`}>
                        السؤال (AR)
                      </label>
                      <input value={faq.q_ar} onChange={e => updateFaq(i, 'q_ar', e.target.value)}
                        dir="rtl" placeholder="كيف يمكنني..."
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 ${t.input}`} />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>Réponse (FR)</label>
                        <CharCount value={faq.a_fr} max={500} />
                      </div>
                      <textarea rows={3} value={faq.a_fr} onChange={e => updateFaq(i, 'a_fr', e.target.value)}
                        maxLength={500}
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 resize-none ${t.input}`} />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className={`text-xs font-bold uppercase tracking-wide ${t.textMuted}`}>الإجابة (AR)</label>
                        <CharCount value={faq.a_ar} max={500} />
                      </div>
                      <textarea rows={3} dir="rtl" value={faq.a_ar} onChange={e => updateFaq(i, 'a_ar', e.target.value)}
                        maxLength={500}
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 resize-none ${t.input}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Save bottom CTA */}
          {(content.faq || []).length > 0 && (
            <div className="flex justify-end pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#1A3C6E] hover:bg-[#0d2447] text-white font-black rounded-xl text-sm transition-colors shadow-lg disabled:opacity-60">
                <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer la FAQ'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
