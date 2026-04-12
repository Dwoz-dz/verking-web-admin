import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Upload, Trash2, Copy, Search, Image as ImageIcon, Film, Grid, List,
  X, Check, FolderOpen, RefreshCw, ExternalLink
} from 'lucide-react';
import { adminApi, API_BASE, apiHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';

interface MediaItem {
  id: string;
  filename: string;
  path: string;
  url: string;
  content_type: string;
  size: number;
  created_at: string;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminMedia() {
  const { token } = useAuth();
  const { t, isDark } = useAdminUI();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; progress: number }[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!token) return;
    try {
      const data = await adminApi.get('/media', token);
      setMedia(data.media || []);
    } catch (e) {
      console.error('Media load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const filtered = media.filter(m => {
    if (filter === 'image' && !m.content_type?.startsWith('image/')) return false;
    if (filter === 'video' && !m.content_type?.startsWith('video/')) return false;
    if (search && !m.filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const uploadFiles = async (files: File[]) => {
    if (!token) return;
    setUploading(true);
    const progresses = files.map(f => ({ name: f.name, progress: 0 }));
    setUploadProgress(progresses);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const base64 = e.target?.result as string;
              setUploadProgress(p => p.map((item, idx) => idx === i ? { ...item, progress: 50 } : item));
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
                throw new Error(err.error || 'Upload failed');
              }
              setUploadProgress(p => p.map((item, idx) => idx === i ? { ...item, progress: 100 } : item));
              resolve();
            } catch (err) { reject(err); }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        toast.success(`${file.name} uploadé !`);
      } catch (e) {
        toast.error(`Erreur upload ${file.name}: ${e}`);
      }
    }

    setUploading(false);
    setUploadProgress([]);
    load();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) uploadFiles(files);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) uploadFiles(files);
  }, [token]);

  const handleDelete = async (item: MediaItem) => {
    if (!confirm(`Supprimer "${item.filename}" ?`)) return;
    if (!token) return;
    try {
      await adminApi.del(`/media/${item.id}`, token);
      toast.success('Fichier supprimé');
      if (selected?.id === item.id) setSelected(null);
      load();
    } catch (e) { toast.error(`Erreur: ${e}`); }
  };

  const copyUrl = (item: MediaItem) => {
    const text = item.url;
    // Try modern API first, then fallback for restricted iframes
    const onSuccess = () => {
      setCopiedId(item.id);
      toast.success('URL copiée !');
      setTimeout(() => setCopiedId(null), 2000);
    };
    const fallbackCopy = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) { onSuccess(); return; }
      } catch {}
      // Last resort: show URL in a prompt for manual copy
      window.prompt('Copiez cette URL manuellement :', text);
      onSuccess();
    };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(onSuccess).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  };

  const isImage = (m: MediaItem) => m.content_type?.startsWith('image/');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #1A3C6E20', borderTopColor: '#1A3C6E' }} />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`text-2xl font-black ${t.text}`}>Médiathèque</h1>
          <p className={`text-sm ${t.textMuted}`}>{media.length} fichier(s) stockés sur Supabase Storage</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} className={`p-2.5 rounded-xl border ${t.cardBorder} ${t.rowHover} transition-colors`}>
            <RefreshCw size={16} className={t.textMuted} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileInput} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1A3C6E] hover:bg-[#0d2447] text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60"
          >
            <Upload size={16} />
            {uploading ? 'Upload en cours...' : 'Uploader des fichiers'}
          </button>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-4 space-y-2`}>
          <p className={`text-xs font-semibold ${t.textSmall} mb-2`}>Upload en cours...</p>
          {uploadProgress.map((p, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={t.textMuted}>{p.name}</span>
                <span className={t.textMuted}>{p.progress}%</span>
              </div>
              <div className={`h-1.5 rounded-full ${isDark ? 'bg-[#30363d]' : 'bg-gray-200'}`}>
                <div className="h-full bg-[#1A3C6E] rounded-full transition-all" style={{ width: `${p.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !dragOver && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-[#1A3C6E] bg-[#1A3C6E]/5'
            : isDark ? 'border-[#30363d] hover:border-[#484f58]' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <Upload size={28} className={`mx-auto mb-2 ${dragOver ? 'text-[#1A3C6E]' : t.textMuted}`} />
        <p className={`text-sm font-medium ${dragOver ? 'text-[#1A3C6E]' : t.textMuted}`}>
          {dragOver ? 'Déposez vos fichiers ici' : 'Glissez-déposez des fichiers ou cliquez pour uploader'}
        </p>
        <p className={`text-xs mt-1 ${t.textMuted}`}>Images (JPG, PNG, WebP, GIF) et vidéos (MP4, WebM) — Max 50MB</p>
      </div>

      {/* Filters & View */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              className={`pl-9 pr-4 py-2 border rounded-xl text-sm focus:outline-none w-48 ${t.input}`} />
          </div>
          {/* Filter buttons */}
          <div className={`flex rounded-xl border overflow-hidden ${t.cardBorder}`}>
            {(['all', 'image', 'video'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${filter === f ? 'bg-[#1A3C6E] text-white' : `${t.textMuted} ${t.rowHover}`}`}>
                {f === 'all' ? 'Tous' : f === 'image' ? 'Images' : 'Vidéos'}
              </button>
            ))}
          </div>
        </div>
        {/* View toggle */}
        <div className={`flex rounded-xl border overflow-hidden ${t.cardBorder}`}>
          <button onClick={() => setView('grid')}
            className={`p-2 transition-colors ${view === 'grid' ? 'bg-[#1A3C6E] text-white' : `${t.textMuted} ${t.rowHover}`}`}>
            <Grid size={16} />
          </button>
          <button onClick={() => setView('list')}
            className={`p-2 transition-colors ${view === 'list' ? 'bg-[#1A3C6E] text-white' : `${t.textMuted} ${t.rowHover}`}`}>
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Media Grid/List */}
      {filtered.length === 0 ? (
        <div className={`${t.card} border ${t.cardBorder} rounded-2xl py-20 text-center`}>
          <FolderOpen size={48} className={`mx-auto mb-4 ${t.textMuted} opacity-30`} />
          <p className={`${t.textMuted}`}>{search ? 'Aucun fichier trouvé' : 'Médiathèque vide — Uploadez vos premiers fichiers'}</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(item => (
            <div
              key={item.id}
              className={`group relative aspect-square rounded-2xl overflow-hidden border cursor-pointer transition-all ${
                selected?.id === item.id
                  ? 'ring-2 ring-[#1A3C6E] border-[#1A3C6E]'
                  : `${t.cardBorder} hover:border-[#1A3C6E]/50`
              }`}
              onClick={() => setSelected(selected?.id === item.id ? null : item)}
            >
              {isImage(item) ? (
                <img src={item.url} alt={item.filename} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className={`w-full h-full flex flex-col items-center justify-center ${isDark ? 'bg-[#21262d]' : 'bg-gray-100'}`}>
                  <Film size={28} className={t.textMuted} />
                  <p className={`text-xs mt-1 ${t.textMuted} truncate max-w-full px-2`}>{item.filename}</p>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); copyUrl(item); }}
                  className="p-2 bg-white/20 hover:bg-white/40 rounded-xl transition-colors"
                  title="Copier l'URL"
                >
                  {copiedId === item.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                  className="p-2 bg-red-500/60 hover:bg-red-500 rounded-xl transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={14} className="text-white" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60">
                <p className="text-white text-[9px] truncate font-medium">{item.filename}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${t.card} border ${t.cardBorder} rounded-2xl overflow-hidden`}>
          {filtered.map((item, i) => (
            <div key={item.id} className={`flex items-center gap-4 p-4 ${i > 0 ? `border-t ${t.rowBorder}` : ''} ${t.rowHover} cursor-pointer transition-colors`}
              onClick={() => setSelected(selected?.id === item.id ? null : item)}>
              <div className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 ${isDark ? 'bg-[#21262d]' : 'bg-gray-100'}`}>
                {isImage(item)
                  ? <img src={item.url} alt="" className="w-full h-full object-cover" />
                  : <Film size={20} className={`m-auto mt-3 ${t.textMuted}`} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${t.text}`}>{item.filename}</p>
                <div className={`flex items-center gap-3 text-xs ${t.textMuted} mt-0.5`}>
                  <span>{item.content_type}</span>
                  <span>•</span>
                  <span>{formatBytes(item.size)}</span>
                  <span>•</span>
                  <span>{new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); copyUrl(item); }}
                  className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-gray-100'}`}>
                  {copiedId === item.id ? <Check size={15} className="text-green-500" /> : <Copy size={15} className={t.textMuted} />}
                </button>
                <a href={item.url} target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-gray-100'}`}>
                  <ExternalLink size={15} className={t.textMuted} />
                </a>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                  className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${t.card} rounded-3xl w-full max-w-lg shadow-2xl border ${t.cardBorder}`}>
            <div className={`flex items-center justify-between p-5 border-b ${t.divider}`}>
              <h3 className={`font-bold ${t.text}`}>Détails du fichier</h3>
              <button onClick={() => setSelected(null)} className={`p-2 rounded-xl ${t.rowHover}`}>
                <X size={18} className={t.textMuted} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className={`rounded-2xl overflow-hidden aspect-video ${isDark ? 'bg-[#21262d]' : 'bg-gray-100'} flex items-center justify-center`}>
                {isImage(selected)
                  ? <img src={selected.url} alt={selected.filename} className="w-full h-full object-contain" />
                  : <Film size={48} className={t.textMuted} />
                }
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Nom', value: selected.filename },
                  { label: 'Type', value: selected.content_type },
                  { label: 'Taille', value: formatBytes(selected.size) },
                  { label: 'Date', value: new Date(selected.created_at).toLocaleString('fr-FR') },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className={`text-xs font-semibold w-16 ${t.textMuted}`}>{row.label}</span>
                    <span className={`text-xs flex-1 truncate ${t.text}`}>{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold w-16 ${t.textMuted}`}>URL</span>
                  <span className={`text-xs flex-1 truncate font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{selected.url}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => copyUrl(selected)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1A3C6E] hover:bg-[#0d2447] text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  {copiedId === selected.id ? <Check size={14} /> : <Copy size={14} />}
                  {copiedId === selected.id ? 'Copiée !' : 'Copier l\'URL'}
                </button>
                <button
                  onClick={() => handleDelete(selected)}
                  className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}