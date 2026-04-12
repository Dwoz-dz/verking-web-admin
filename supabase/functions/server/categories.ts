import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid } from "./db.ts";
import { Category } from "./types.ts";
import { isAdmin } from "./auth.ts";

export async function listCategories(c: any) {
  try {
    if (await useDB()) {
      try {
        const { data, error } = await db.from('categories').select('*').order('sort_order', { ascending: true });
        if (!error) return respond(c, { categories: data });
      } catch (e) { console.error('DB categories list failed:', e.message); }
    }
    const val = await kv.get("categories:data");
    const categories: Category[] = val ? (typeof val === 'string' ? JSON.parse(val) : val) : [];
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    return respond(c, { categories });
  } catch (e) { return errRes(c, `Categories list error: ${e.message}`); }
}

export async function createCategory(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    if (await useDB()) {
      try {
        const { data, error } = await db.from('categories').insert({ ...body, sort_order: body.order || 0 }).select().single();
        if (!error) return respond(c, { category: data }, 201);
      } catch (e) { console.error('DB category create failed:', e.message); }
    }
    const current = await kv.get("categories:data");
    const categories: Category[] = current ? (typeof current === 'string' ? JSON.parse(current) : current) : [];
    const category = { ...body, id: uid() };
    categories.push(category);
    await kv.set("categories:data", JSON.stringify(categories));
    return respond(c, { category }, 201);
  } catch (e) { return errRes(c, `Category create error: ${e.message}`); }
}

export async function updateCategory(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    if (await useDB()) {
      try {
        const updateData = { ...body };
        if (updateData.order !== undefined) {
           updateData.sort_order = updateData.order;
           delete updateData.order;
        }
        const { data, error } = await db.from('categories').update(updateData).eq('id', id).select().single();
        if (!error) return respond(c, { category: data });
      } catch (e) { console.error('DB category update failed:', e.message); }
    }
    const current = await kv.get("categories:data");
    const categories: Category[] = current ? (typeof current === 'string' ? JSON.parse(current) : current) : [];
    const idx = categories.findIndex(ca => ca.id === id);
    if (idx < 0) return errRes(c, "Category not found", 404);
    categories[idx] = { ...categories[idx], ...body, id };
    await kv.set("categories:data", JSON.stringify(categories));
    return respond(c, { category: categories[idx] });
  } catch (e) { return errRes(c, `Category update error: ${e.message}`); }
}

export async function deleteCategory(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param('id');
    if (await useDB()) {
      try {
        const { error } = await db.from('categories').delete().eq('id', id);
        if (!error) return respond(c, { success: true });
      } catch (e) { console.error('DB category delete failed:', e.message); }
    }
    const current = await kv.get("categories:data");
    const categories: Category[] = current ? (typeof current === 'string' ? JSON.parse(current) : current) : [];
    const filtered = categories.filter(ca => ca.id !== id);
    await kv.set("categories:data", JSON.stringify(filtered));
    return respond(c, { success: true });
  } catch (e) { return errRes(c, `Category delete error: ${e.message}`); }
}
