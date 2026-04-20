import React, { useEffect, useState } from 'react';
import { X, UploadCloud, Image as ImageIcon, Search, Loader2 } from 'lucide-react';
import { adminApi, API_BASE, apiHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';

interface MediaItem {
  id: string;
  url: string;
  filename?: string;
  content_type?: string;
}

interface MediaPickerModalProps {
  onSelect: (url: string) => void;
  onClose: () => void;
  title?: string;
}

export function MediaPickerModal({ onSelect, onClose, title = 'Médiathèque' }: MediaPickerModalProps) {
  const { token } = useAuth();
  const { t } = useAdminUI();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!token) return;
    adminApi.get('/media', token)
      .then((d: any) => setMedia(d?.media || d?.assets || []))
      .catch(() => setMedia([]))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = media.filter(m =>
    !search || (m.filename || m.url || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = async (file: File) => {
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
        const data = await res.json();
        if (data.media?.url) {
          setMedia(prev => [data.media, ...prev]);
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={`${t.card} w-full max-w-4xl rounded-3xl border ${t.cardBorder} flex flex-col max-h-[90vh] shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className={`text-lg font-black ${t.text} flex items-center gap-2`}>
            <ImageIcon size={18} className="text-[#1A3C6E]" /> {title}
          </h3>
          <div className="flex items-center gap-3">
            <label className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A3C6E] text-white text-xs font-black cursor-pointer hover:bg-[#0d2447] transition-all ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              {uploading ? 'Upload...' : 'Uploader'}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
            </label>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A3C6E] focus:ring-1 focus:ring-[#1A3C6E]/20"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={28} className="animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <ImageIcon size={36} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 font-medium">Aucune image dans la médiathèque</p>
              <p className="text-xs text-gray-400 mt-1">Uploadez une image pour commencer</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onSelect(item.url); onClose(); }}
                  className="group overflow-hidden rounded-2xl border-2 border-transparent hover:border-[#1A3C6E] bg-gray-50 transition-all text-left hover:shadow-lg"
                >
                  <div className="relative h-28 w-full overflow-hidden bg-gray-100">
                    <img src={item.url} alt={item.filename || 'media'} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-[#1A3C6E]/0 group-hover:bg-[#1A3C6E]/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="bg-white/90 text-[#1A3C6E] text-[10px] font-black px-3 py-1 rounded-full shadow">Choisir</span>
                    </div>
                  </div>
                  <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-gray-600">{item.filename || 'image'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
