// Lightweight wrapper over POST /media/upload (the same endpoint AdminMedia uses).
// Exposes { upload(file) → Promise<url|null>, state, progress } so any editor
// on the homepage admin can drop in an upload button without re-implementing
// the FileReader + base64 + fetch dance.
import { useCallback, useState } from 'react';
import { API_BASE, apiHeaders } from '../../../../../lib/api';
import { useAuth } from '../../../../../context/AuthContext';

export type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export function useMediaUpload() {
  const { token } = useAuth();
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);

  const upload = useCallback(async (file: File): Promise<string | null> => {
    if (!token) return null;
    setState('uploading');
    setProgress(10);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setProgress(55);
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
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      setProgress(100);
      setState('done');
      window.setTimeout(() => { setState('idle'); setProgress(0); }, 1500);
      return data?.media?.url || data?.url || null;
    } catch (err) {
      console.error('[useMediaUpload] failed', err);
      setState('error');
      window.setTimeout(() => { setState('idle'); setProgress(0); }, 2500);
      return null;
    }
  }, [token]);

  return { upload, state, progress };
}

/** Returns true when the URL points to a video resource (by extension). */
export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url);
}
