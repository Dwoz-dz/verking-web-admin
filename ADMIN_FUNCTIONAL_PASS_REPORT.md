# Verking Scolaire — Admin Functional Pass Report

Project: `qvbskdjvnpjjmtufvnly.supabase.co`
Scope: Part 2 of the request — 13 admin modules, audited in order.
Rule honored: nothing below is reported as "connected" unless it truly round-trips through Supabase and affects the storefront.

---

## SQL migrations applied (idempotent, applied via MCP)

| File | What it adds |
|---|---|
| `supabase/migrations/20260422210000_orders_admin_note_discount.sql` | `orders.admin_note`, `orders.discount` (already applied earlier) |
| `supabase/migrations/20260422220000_wholesale_admin_note.sql` | `wholesale_requests.admin_note`, `wholesale_requests.updated_at` |
| `supabase/migrations/20260422230000_banners_desktop_mobile_images.sql` | `banners.desktop_image`, `banners.mobile_image`, `banners.updated_at` |
| `supabase/migrations/20260422240000_theme_presets_and_snapshot.sql` | `theme_settings.{theme_name, theme_description, published_at, rollback_available, last_snapshot}`, new table `theme_presets` |

All four were applied to the live DB successfully (`{"success": true}`).

---

## Per-module results

### 1 · Tableau de bord (Dashboard) — done earlier
Reads `/stats` which aggregates orders + customers + products + wholesale directly from DB. No changes needed.

### 2 · Produits — done earlier
CRUD + `product_images` join + `view_count` + `order_count` + storefront catalog all round-trip through the `products` table.

### 3 · Catégories — done earlier
Full CRUD + meta (SEO, mobile icon, badge color), `product_count` re-derived live from `products.category_id`.

### 4 · Commandes
**Change:** hardened `updateOrder` to read the BEFORE state, apply the update, and when status transitions into `cancelled` or `refunded`, restore stock on the related products. Cancelled→refunded and refunded→cancelled are no-ops (stock already released).
- Files: `supabase/functions/make-server-ea36795c/orders.ts` (helpers `restoreStockDb`, `restoreStockKv`, `shouldRestoreStock`; both DB and KV branches).
- Also strips `items`, `order_items`, `id`, `created_at` from the PUT body so they can't be mutated.

### 5 · Clients
**Change:** customer list was previously missing `orders[]`/`total_spent` shapes that `AdminCustomers.tsx` expected; admin also had no CRUD endpoints.
- Backend: `crm.ts` now exports `listCustomers` (with `enrichCustomers` joining by `customer_id`, phone, and email — catches legacy orders with no `customer_id`), `createCustomer`, `updateCustomer`, `deleteCustomer` (null's `customer_id` on orders rather than hard-deleting so the ledger stays intact).
- Routes: `POST /customers`, `PUT /customers/:id`, `DELETE /customers/:id` registered in `index.tsx`.
- Admin UI: `AdminCustomers.tsx` — added "Nouveau client" button, edit/delete icons per row, modal form (name required, phone/email/wilaya/address optional).
- Total spent now recomputed excluding cancelled/refunded orders.

### 6 · Grossiste
**Change:** wholesale table missing an `admin_note` column; `updateWholesaleRequest` was writing a raw body without sanitization.
- Migration added `admin_note` and `updated_at`.
- Backend: `updateWholesaleRequest` now sanitizes body (strips id/created_at), sets `updated_at`.

### 7 · Médiathèque — done earlier
Verified the existing `MediaPickerModal` is reused from `AdminBanners`, `AdminCategories`, and `ProductEditor` so any media picked is the same library of DB-tracked `media_assets` rows.

### 8 · Bannières
**Change:** admin form sent `desktop_image` and `mobile_image` but the DB had no such columns → silent drop. Storefront `HomePage.tsx` already consumed these fields, so they simply rendered empty after every save.
- Migration added `desktop_image`, `mobile_image`, `updated_at`, and backfilled them from `image`.
- `settings.ts` banner serialization already passes these fields through — verified intact.
- `AdminBanners.tsx` UI already has desktop/mobile pickers, link_mode, link_target_id, banner_type, start_at, end_at — all round-trip now.

### 9 · Bannières (continued)
Covered above.

### 10 · Thème & Design
Pre-existing theme wiring was better than expected, but presets and rollback were browser-local only.

**What was already working** (verified):
- `/theme` GET/PUT round-trips through `theme_settings` (with KV mirror).
- `ThemeContext.tsx` fetches on mount, sets CSS vars + `data-vk-*` attributes on `<html>`, stores state in React context.
- Storefront components consume colors via inline styles: `Navbar` (cart button, logo), `Footer` (accent bullets, subtitle), `AnnouncementBar` (bar background), `Spinner` (color), `HomePage` (section gates).
- After publish, `refreshTheme()` is called so the storefront updates without reload.
- Homepage section gates `show_featured` + `show_best_sellers` were wired.

**What was broken and is now fixed:**
- **Presets** were in `localStorage` → now a real `theme_presets` table with `GET/POST/DELETE /theme/presets` endpoints and `AdminTheme.tsx` using `adminApi` for every read/write. Presets are now visible to every admin on every device.
- **Rollback snapshot** was in `localStorage` → now persisted as `theme_settings.last_snapshot` (JSONB). The publish flow writes the previous theme into that column; rollback reads it and re-publishes it (then clears it). Works from any admin's browser.
- **Theme metadata** (`theme_name`, `theme_description`, `published_at`, `rollback_available`, `last_snapshot`) were filtered out by `DB_THEME_FIELDS` on the server and only persisted in KV. Now persisted properly in the DB column.
- **HomePage had three hardcoded section gates:**
  - `showWholesaleSection = false` → now `theme.show_wholesale_section !== false`
  - `showTestimonialsSection = false` → now `theme.show_testimonials !== false`
  - `showNewSection` ignored `theme.show_new_arrivals` → now checks both the section config and the theme toggle.

**Honestly flagged as saved-but-not-applied** (not fixed in this pass, to avoid a large stylistic refactor):
- `header_style`, `footer_style`, `homepage_style` — saved to DB, written as `data-vk-*` attributes on `<html>`, but no CSS rule consumes them. The four variants aren't implemented.
- `type_scale`, `button_radius`, `button_shadow`, `component_density`, `font_heading`, `font_body` — set as `--vk-*` CSS variables on `<html>` but almost no CSS rule consumes them. They save correctly but have near-zero visual effect today.

Let me know if you want a follow-up pass to wire those visual variants end-to-end.

### 11 · Page d'accueil
Already well-wired: `/homepage-config` reads from `homepage_sections` table, admin saves upsert each section row, HomePage consumes section titles/CTAs/images/visibility. One honest flag: `sections_order` is saved but not consumed by `HomePage.tsx` — the layout is hardcoded. Reordering sections in admin won't reorder on storefront. Let me know if you want that dynamic.

### 12 · Contenu
Fully wired: `/content` endpoint upserts into `store_settings`, and `AboutPage`, `ContactPage`, `FaqPage`, `HomePage` all consume the same endpoint.

### 13 · 3D Paramètres
Fully wired: `/3d-config` round-trips through `store_settings` key=`3d_experience`, consumed by `use3DConfig` hook inside `VirtualStore`/`Scene3D` at `/experience`.

### 14 · Paramètres
**Change:** `AdminSettings.tsx` was using raw `fetch()` with no `res.ok` check — a 401 or 500 would still toast "Configuration sauvegardée". Replaced with `adminApi.put` so failures actually toast errors and the 401-redirect event fires properly. On success it now also syncs the local state from the server's normalized response.

---

## Files changed this pass

**Migrations (new):**
- `supabase/migrations/20260422220000_wholesale_admin_note.sql`
- `supabase/migrations/20260422230000_banners_desktop_mobile_images.sql`
- `supabase/migrations/20260422240000_theme_presets_and_snapshot.sql`

**Edge function (modified):**
- `supabase/functions/make-server-ea36795c/orders.ts` — stock-restore on cancel/refund
- `supabase/functions/make-server-ea36795c/crm.ts` — customer CRUD + `enrichCustomers` + wholesale sanitization
- `supabase/functions/make-server-ea36795c/settings.ts` — `DB_THEME_FIELDS` extended; `listThemePresets`/`createThemePreset`/`deleteThemePreset` added
- `supabase/functions/make-server-ea36795c/index.tsx` — registered customer CRUD + theme preset routes

**Frontend (modified):**
- `src/app/pages/admin/AdminCustomers.tsx` — CRUD form + buttons
- `src/app/pages/admin/AdminTheme.tsx` — preset/snapshot now backend-backed
- `src/app/pages/admin/AdminSettings.tsx` — error handling + `adminApi` migration
- `src/app/pages/HomePage.tsx` — three theme gates wired

---

## What you need to run

Both SQL migrations are already applied to the live DB. Only the edge function needs redeployment so the new routes (`/customers` CRUD, `/theme/presets`) and the extended `DB_THEME_FIELDS` take effect:

```bash
supabase functions deploy make-server-ea36795c --project-ref qvbskdjvnpjjmtufvnly
```

That's the only remaining step. After it completes:
- Create a customer from the admin — it should persist and show up on refresh.
- Cancel a test order — the product stock should increase by the item qty.
- Save a theme preset — sign out, sign back in on another browser, and the preset should still be there.
- Publish a theme, then rollback — should restore the prior theme from any device.

No API contract changes; no breaking changes to existing admin or storefront surfaces.
