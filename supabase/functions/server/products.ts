import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid } from "./db.ts";
import { Product } from "./types.ts";
import { isAdmin } from "./auth.ts";

export async function listProducts(c: any) {
  try {
    const q = c.req.query();
    const { 
      category, featured, new: isNew, best_seller, promo, search, 
      active, homepage, new_arrivals, best_sellers, cartables, 
      trousses, school_supplies 
    } = q;

    if (await useDB()) {
      try {
        let query = db.from('products').select('*');
        if (active === "true") query = query.eq('is_active', true);
        if (category) query = query.eq('category_id', category);
        if (featured === "true") query = query.eq('is_featured', true);
        if (isNew === "true") query = query.eq('is_new', true);
        if (best_seller === "true") query = query.eq('is_best_seller', true);
        if (promo === "true") query = query.eq('is_promo', true);
        if (homepage === "true") query = query.eq('show_on_homepage', true);
        if (new_arrivals === "true") query = query.eq('show_in_new_arrivals', true);
        if (best_sellers === "true") query = query.eq('show_in_best_sellers', true);
        if (cartables === "true") query = query.eq('show_in_cartables', true);
        if (trousses === "true") query = query.eq('show_in_trousses', true);
        if (school_supplies === "true") query = query.eq('show_in_school_supplies', true);
        
        if (search) {
          query = query.or(`name_fr.ilike.%${search}%,name_ar.ilike.%${search}%`);
        }
        
        query = query.order('sort_order', { ascending: true })
                     .order('created_at', { ascending: false });
        
        const { data, error } = await query;
        if (error) throw error;

        // Fetch images separately to avoid heavy joins and handle missing table gracefully
        const productIds = (data || []).map((p: any) => p.id);
        let imagesByProduct: Record<string, string[]> = {};
        
        if (productIds.length > 0) {
          try {
            const { data: imgs, error: imgError } = await db.from('product_images')
              .select('product_id, url, sort_order')
              .in('product_id', productIds)
              .order('sort_order', { ascending: true });
            
            if (imgError) {
               console.warn("Could not fetch product images from DB:", imgError.message);
            } else {
              for (const img of (imgs || [])) {
                if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
                imagesByProduct[img.product_id].push(img.url);
              }
            }
          } catch (e) {
            console.warn("Product images table access failed:", e.message);
          }
        }

        const products = (data || []).map((p: any) => ({
          ...p,
          images: imagesByProduct[p.id] || []
        }));
        
        return respond(c, { products, total: products.length });
      } catch (e) {
        console.error('Database products fetch failed, falling back to KV:', e.message);
      }
    }

    // ── KV Fallback ──
    const allItems = await kv.getByPrefix("products:data:");
    let products = allItems.map((i: any) => typeof i === 'string' ? JSON.parse(i) : i);

    if (active === "true") products = products.filter((p: any) => p.is_active);
    if (category) products = products.filter((p: any) => p.category_id === category);
    if (featured === "true") products = products.filter((p: any) => p.is_featured);
    if (isNew === "true") products = products.filter((p: any) => p.is_new);
    if (best_seller === "true") products = products.filter((p: any) => p.is_best_seller);
    if (promo === "true") products = products.filter((p: any) => p.is_promo || !!p.sale_price);
    if (homepage === "true") products = products.filter((p: any) => p.show_on_homepage);
    if (new_arrivals === "true") products = products.filter((p: any) => p.show_in_new_arrivals);
    if (best_sellers === "true") products = products.filter((p: any) => p.show_in_best_sellers);
    if (cartables === "true") products = products.filter((p: any) => p.show_in_cartables);
    if (trousses === "true") products = products.filter((p: any) => p.show_in_trousses);
    if (school_supplies === "true") products = products.filter((p: any) => p.show_in_school_supplies);
    
    if (search) {
      const s = search.toLowerCase();
      products = products.filter((p: any) => 
        (p.name_fr || "").toLowerCase().includes(s) || 
        (p.name_ar || "").includes(s)
      );
    }
    
    products.sort((a: any, b: any) => 
      (a.sort_order || 0) - (b.sort_order || 0) || 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return respond(c, { products, total: products.length });
  } catch (e) {
    return errRes(c, `Erreur lors de la récupération des produits: ${e.message}`);
  }
}

export async function getProduct(c: any) {
  try {
    const id = c.req.param("id");
    if (await useDB()) {
      try {
        const { data, error } = await db.from('products').select('*').eq('id', id).single();
        if (!error && data) {
          let images: string[] = [];
          try {
            const { data: imgs } = await db.from('product_images')
              .select('url')
              .eq('product_id', id)
              .order('sort_order', { ascending: true });
            images = (imgs || []).map((img: any) => img.url);
          } catch (e) {
             console.warn(`Images fetch failed for product ${id}:`, e.message);
          }
          return respond(c, { product: { ...data, images } });
        }
      } catch (e) {
        console.warn(`DB fetch failed for product ${id}, using KV:`, e.message);
      }
    }
    
    const val = await kv.get(`products:data:${id}`);
    const product = val ? (typeof val === 'string' ? JSON.parse(val) : val) : null;
    
    if (!product) return errRes(c, "Produit non trouvé", 404);
    return respond(c, { product });
  } catch (e) {
    return errRes(c, `Erreur lors de la récupération du produit: ${e.message}`);
  }
}

export async function createProduct(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Non autorisé", 401);
    const body = await c.req.json();
    const now = new Date().toISOString();

    if (await useDB()) {
      try {
        const images: string[] = body.images || [];
        const productData = {
          name_fr: body.name_fr || '',
          name_ar: body.name_ar || '',
          description_fr: body.description_fr || '',
          description_ar: body.description_ar || '',
          price: Number(body.price) || 0,
          sale_price: body.sale_price ? Number(body.sale_price) : null,
          category_id: body.category_id || null,
          stock: Number(body.stock) || 0,
          is_featured: Boolean(body.is_featured),
          is_new: Boolean(body.is_new),
          is_best_seller: Boolean(body.is_best_seller),
          is_promo: Boolean(body.is_promo),
          is_active: body.is_active !== false,
          show_on_homepage: Boolean(body.show_on_homepage),
          show_in_featured: Boolean(body.show_in_featured),
          show_in_best_sellers: Boolean(body.show_in_best_sellers),
          show_in_new_arrivals: Boolean(body.show_in_new_arrivals),
          show_in_promotions: Boolean(body.show_in_promotions),
          show_in_cartables: Boolean(body.show_in_cartables),
          show_in_trousses: Boolean(body.show_in_trousses),
          show_in_school_supplies: Boolean(body.show_in_school_supplies),
          section_priority: Number(body.section_priority) || 99,
          sort_order: Number(body.sort_order) || 99,
          updated_at: now,
          created_at: now
        };

        const { data, error } = await db.from('products').insert(productData).select().single();
        if (error) throw error;
        
        if (images.length > 0 && data) {
          try {
            await db.from('product_images').insert(
              images.map((url, i) => ({
                product_id: data.id,
                url,
                sort_order: i,
                is_primary: i === 0
              }))
            );
          } catch (e) {
            console.error("Failed to insert product images into DB:", e.message);
          }
        }
        return respond(c, { product: { ...data, images } }, 201);
      } catch (e) {
        console.error('DB product creation failed, attempting KV fallback:', e.message);
      }
    }

    const id = "prod-" + uid();
    const product: Product = {
      id,
      ...body,
      price: Number(body.price) || 0,
      stock: Number(body.stock) || 0,
      created_at: now,
      updated_at: now
    };
    
    await kv.set(`products:data:${id}`, JSON.stringify(product));
    
    // Maintain the legacy list if still used by some code
    const listStr = await kv.get("products:list");
    const list = listStr ? JSON.parse(listStr) : [];
    if (!list.includes(id)) {
      list.push(id);
      await kv.set("products:list", JSON.stringify(list));
    }
    
    return respond(c, { product }, 201);
  } catch (e) {
    return errRes(c, `Erreur lors de la création du produit: ${e.message}`);
  }
}

export async function updateProduct(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Non autorisé", 401);
    const id = c.req.param("id");
    const body = await c.req.json();
    const now = new Date().toISOString();

    if (await useDB()) {
      try {
        const images: string[] | undefined = body.images;
        const cleanBody: any = { ...body };
        
        // Remove fields that shouldn't be updated directly on the products table
        delete cleanBody.images;
        delete cleanBody.id;
        delete cleanBody.product_images;
        delete cleanBody.created_at;
        
        if (cleanBody.order !== undefined) {
          cleanBody.sort_order = cleanBody.order;
          delete cleanBody.order;
        }
        
        cleanBody.updated_at = now;

        const { data, error } = await db.from('products')
          .update(cleanBody)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        
        if (images !== undefined) {
          try {
            await db.from('product_images').delete().eq('product_id', id);
            if (images.length > 0) {
              await db.from('product_images').insert(
                images.map((url, i) => ({
                  product_id: id,
                  url,
                  sort_order: i,
                  is_primary: i === 0
                }))
              );
            }
          } catch (e) {
             console.error(`Failed to update product images for ${id}:`, e.message);
          }
        }
        return respond(c, { product: { ...data, images: images || [] } });
      } catch (e) {
        console.error(`DB product update failed for ${id}, attempting KV fallback:`, e.message);
      }
    }

    const val = await kv.get(`products:data:${id}`);
    const existing = val ? (typeof val === 'string' ? JSON.parse(val) : val) : null;
    
    if (!existing) return errRes(c, "Produit non trouvé", 404);
    
    const updated = { 
      ...existing, 
      ...body, 
      id, 
      updated_at: now 
    };
    
    await kv.set(`products:data:${id}`, JSON.stringify(updated));
    return respond(c, { product: updated });
  } catch (e) {
    return errRes(c, `Erreur lors de la mise à jour du produit: ${e.message}`);
  }
}

export async function deleteProduct(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Non autorisé", 401);
    const id = c.req.param("id");
    
    if (await useDB()) {
      try {
        const { error } = await db.from('products').delete().eq('id', id);
        if (error) throw error;
        return respond(c, { success: true });
      } catch (e) {
        console.error(`DB product delete failed for ${id}, fallback to KV:`, e.message);
      }
    }

    await kv.del(`products:data:${id}`);
    
    // Update the legacy list
    const listStr = await kv.get("products:list");
    if (listStr) {
      const list = JSON.parse(listStr).filter((i: string) => i !== id);
      await kv.set("products:list", JSON.stringify(list));
    }
    
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Erreur lors de la suppression du produit: ${e.message}`);
  }
}
