import React, { useEffect, useRef, useState } from 'react';
import { Plus, Edit2, Trash2, X, Image, UploadCloud } from 'lucide-react';
import { adminApi, API_BASE, apiHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

interface Banner { id: string; title_fr: string; title_ar: string; subtitle_fr: string; subtitle_ar: string; cta_fr: string; cta_ar: string; image: string; link: string; is_active: boolean; order: number; }
const EMPTY: Partial<Banner> = { title_fr: '', title_ar: '', subtitle_fr: '', subtitle_ar: '', cta_fr: 'Découvrir', cta_ar: 'اكتشف', image: '', link: '/shop', is_active: true, order: 1 };

export function AdminBanners() {
  const { token } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<Banner>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!token) return;
    const d = await adminApi.get('/banners/all', token);
    setBanners(d.banners || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [token]);

  const openAdd = () => { setCurrent({ ...EMPTY }); setModal('add'); };
  const openEdit = (b: Banner) => { setCurrent({ ...b }); setModal('edit'); };
  const closeModal = () => { setModal(null); setCurrent(EMPTY); };

  // ── Upload image depuis l'ordinateur ──
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
          body: JSON.stringify({
            filename: file.name,
            content_type: file.type,
            data: base64,
            size: file.size,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Upload échoué');
        }
        const data = await res.json();
        setCurrent(p => ({ ...p, image: data.media.url }));
        toast.success('Image uploadée avec succès !');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      toast.error(`Erreur upload: ${e}`);
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!token || !current.title_fr || !current.image) { toast.error('Titre FR et image requis'); return; }
    setSaving(true);
    try {
      if (modal === 'add') await adminApi.post('/banners', current, token);
      else await adminApi.put(`/banners/${current.id}`, current, token);
      toast.success(modal === 'add' ? 'Bannière ajoutée !' : 'Bannière mise à jour !');
      closeModal();
      load();
    } catch (e) { toast.error(`Erreur: ${e}`); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette bannière ?') || !token) return;
    try { await adminApi.del(`/banners/${id}`, token); toast.success('Bannière supprimée'); load(); }
    catch (e) { toast.error(`Erreur: ${e}`); }
  };

  const toggleActive = async (b: Banner) => {
    if (!token) return;
    await adminApi.put(`/banners/${b.id}`, { is_active: !b.is_active }, token);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #1A3C6E20', borderTopColor: '#1A3C6E' }}></div></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Bannières</h1>
          <p className="text-sm text-gray-500">{banners.length} bannière(s) configurée(s)</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 bg-[#1A3C6E] hover:bg-[#0d2447] text-white font-bold rounded-xl text-sm transition-colors shadow-sm">
          <Plus size={17} /> Ajouter
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {banners.map(banner => (
          <div key={banner.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 ${!banner.is_active ? 'opacity-60' : ''}`}>
            <div className="relative aspect-video bg-gray-100">
              {banner.image ? (
                <img src={banner.image} alt={banner.title_fr} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Image size={36} className="text-gray-300" /></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
                <p className="font-bold text-white text-sm">{banner.title_fr}</p>
                <p className="text-white/70 text-xs">{banner.subtitle_fr}</p>
              </div>
              <div className="absolute top-2 right-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${banner.is_active ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
                  {banner.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-gray-500" dir="rtl">{banner.title_ar}</p>
                <p className="text-xs text-gray-400">Ordre: {banner.order} • Lien: {banner.link}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => toggleActive(banner)} className={`p-1.5 rounded-lg text-xs ${banner.is_active ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'} transition-colors`}>
                  {banner.is_active ? 'Désact.' : 'Act.'}
                </button>
                <button onClick={() => openEdit(banner)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(banner.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {banners.length === 0 && (
          <div className="col-span-2 bg-white rounded-2xl p-16 text-center border border-gray-100">
            <Image size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="text-gray-400">Aucune bannière. Ajoutez-en une !</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-black text-gray-800">{modal === 'add' ? 'Nouvelle bannière' : 'Modifier la bannière'}</h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput label="Titre (FR) *" value={current.title_fr || ''} onChange={(v: string) => setCurrent(p => ({ ...p, title_fr: v }))} />
                <LabeledInput label="العنوان (AR)" value={current.title_ar || ''} onChange={(v: string) => setCurrent(p => ({ ...p, title_ar: v }))} dir="rtl" />
                <LabeledInput label="Sous-titre (FR)" value={current.subtitle_fr || ''} onChange={(v: string) => setCurrent(p => ({ ...p, subtitle_fr: v }))} />
                <LabeledInput label="العنوان الفرعي (AR)" value={current.subtitle_ar || ''} onChange={(v: string) => setCurrent(p => ({ ...p, subtitle_ar: v }))} dir="rtl" />
                <LabeledInput label="Bouton CTA (FR)" value={current.cta_fr || ''} onChange={(v: string) => setCurrent(p => ({ ...p, cta_fr: v }))} />
                <LabeledInput label="نص الزر (AR)" value={current.cta_ar || ''} onChange={(v: string) => setCurrent(p => ({ ...p, cta_ar: v }))} dir="rtl" />
              </div>

              {/* ── Image Section ── */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Image de la bannière *</label>

                {/* Preview */}
                {current.image ? (
                  <div className="relative mb-3 rounded-xl overflow-hidden border border-gray-200">
                    <img src={current.image} alt="Aperçu" className="w-full h-36 object-cover" />
                    <button
                      onClick={() => setCurrent(p => ({ ...p, image: '' }))}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow transition-colors"
                      title="Supprimer l'image"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  /* Drop zone */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-3 border-2 border-dashed border-gray-200 rounded-xl h-28 flex flex-col items-center justify-center cursor-pointer hover:border-[#1A3C6E] hover:bg-blue-50/40 transition-all group"
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-7 h-7 rounded-full animate-spin" style={{ border: '3px solid #1A3C6E20', borderTopColor: '#1A3C6E' }} />
                        <p className="text-xs text-gray-400">Upload en cours...</p>
                      </div>
                    ) : (
                      <>
                        <UploadCloud size={28} className="text-gray-300 group-hover:text-[#1A3C6E] transition-colors mb-1" />
                        <p className="text-xs text-gray-400 group-hover:text-[#1A3C6E]">Cliquez pour choisir une image</p>
                        <p className="text-[10px] text-gray-300 mt-0.5">JPG, PNG, WEBP — max 10 Mo</p>
                      </>
                    )}
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                  }}
                />

                {/* Bouton upload + champ URL */}
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1A3C6E] hover:bg-[#0d2447] disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm shrink-0"
                  >
                    <UploadCloud size={15} />
                    {uploading ? 'Upload...' : 'Depuis l\'ordinateur'}
                  </button>
                  <span className="text-xs text-gray-400 shrink-0">ou</span>
                  <input
                    type="text"
                    value={current.image || ''}
                    onChange={(e) => setCurrent(p => ({ ...p, image: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1A3C6E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <LabeledInput label="Lien (URL)" value={current.link || ''} onChange={(v: string) => setCurrent(p => ({ ...p, link: v }))} placeholder="/shop" />
                <LabeledInput label="Ordre" type="number" value={String(current.order || 1)} onChange={(v: string) => setCurrent(p => ({ ...p, order: Number(v) }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${current.is_active ? 'bg-[#1A3C6E]' : 'bg-gray-300'}`}
                  onClick={() => setCurrent(p => ({ ...p, is_active: !p.is_active }))}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${current.is_active ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Bannière active</span>
              </label>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={closeModal} className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#1A3C6E] text-white font-black rounded-xl text-sm hover:bg-[#0d2447] disabled:opacity-60">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text', placeholder = '', dir }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} dir={dir}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
    </div>
  );
}