import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid, MEDIA_BUCKET } from "./db.ts";
import { MediaFile } from "./types.ts";
import { isAdmin } from "./auth.ts";

export async function uploadMedia(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const { filename, content_type, data: fileData, size } = await c.req.json();
    if (!fileData) return errRes(c, "No file data", 400);

    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    // Fix for Deno: use Uint8Array from base64
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    const path = `uploads/${Date.now()}-${uid()}-${safeName}`;

    const { error: uploadError } = await db.storage.from(MEDIA_BUCKET).upload(path, bytes.buffer, { 
      contentType: content_type || 'image/jpeg', 
      upsert: false 
    });
    
    if (uploadError) return errRes(c, `Storage upload error: ${uploadError.message}`);

    const { data: urlData } = db.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    const id = 'media-' + uid();
    const media: MediaFile = { 
      id, 
      filename, 
      path, 
      url: urlData.publicUrl, 
      content_type: content_type || 'image/jpeg', 
      size: size || bytes.length, 
      created_at: new Date().toISOString() 
    };

    if (await useDB()) {
      try {
        const { data: dbM } = await db.from('media_assets').insert({ 
          filename, 
          storage_path: path, 
          url: urlData.publicUrl, 
          content_type: content_type || 'image/jpeg', 
          size_bytes: size || bytes.length 
        }).select().single();
        
        if (dbM) {
          return respond(c, { 
            media: { 
              id: dbM.id, 
              filename: dbM.filename, 
              path: dbM.storage_path, 
              url: dbM.url, 
              content_type: dbM.content_type, 
              size: dbM.size_bytes, 
              created_at: dbM.created_at 
            } 
          }, 201);
        }
      } catch (e) {
        console.error("DB media asset record creation failed:", e.message);
      }
    }
    
    await kv.set(`media:data:${id}`, JSON.stringify(media));
    return respond(c, { media }, 201);
  } catch (e) {
    return errRes(c, `Upload error: ${e.message}`);
  }
}

export async function listMedia(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    if (await useDB()) {
      try {
        const { data, error } = await db.from('media_assets').select('*').order('created_at', { ascending: false });
        if (!error) {
          return respond(c, { 
            media: (data || []).map(m => ({ 
              id: m.id, 
              filename: m.filename, 
              path: m.storage_path, 
              url: m.url, 
              content_type: m.content_type, 
              size: m.size_bytes, 
              created_at: m.created_at 
            })), 
            total: (data || []).length 
          });
        }
      } catch (e) {
        console.error('DB media list failed:', e.message);
      }
    }
    const all = await kv.getByPrefix("media:data:");
    const media = all.map((m: any) => typeof m === 'string' ? JSON.parse(m) : m);
    media.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return respond(c, { media, total: media.length });
  } catch (e) {
    return errRes(c, `Media list error: ${e.message}`);
  }
}

export async function deleteMedia(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param('id');
    
    if (await useDB()) {
      try {
        const { data: item } = await db.from('media_assets').select('storage_path').eq('id', id).single();
        if (item) {
          await db.storage.from(MEDIA_BUCKET).remove([item.storage_path]);
          await db.from('media_assets').delete().eq('id', id);
          return respond(c, { success: true });
        }
      } catch (e) {
        console.error(`DB media delete failed for ${id}:`, e.message);
      }
    }
    
    const val = await kv.get(`media:data:${id}`);
    const item = val ? (typeof val === 'string' ? JSON.parse(val) : val) : null;
    
    if (item) {
      try {
        await db.storage.from(MEDIA_BUCKET).remove([item.path]);
      } catch (e) {
        console.warn(`Storage file removal failed for ${item.path}:`, e.message);
      }
      await kv.del(`media:data:${id}`);
    }
    
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Delete media error: ${e.message}`);
  }
}
