-- ========================================================================
-- Phase 3 — System Integration Pass
-- Adds every column the admin UI promised but the DB silently dropped.
-- Idempotent: all ADD COLUMNs use IF NOT EXISTS; all values are nullable
-- with safe defaults so the migration never breaks existing rows.
-- ========================================================================

-- -----------------------------
-- 1) PRODUCTS — missing fields
-- -----------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price          numeric(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold integer DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku                 text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode             text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url           text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title          text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description    text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags                text[]  DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS view_count          integer DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS order_count         integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_sku         ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_view_count  ON products (view_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_order_count ON products (order_count DESC);

-- -----------------------------
-- 2) CATEGORIES — meta fields
-- -----------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS show_on_homepage      boolean DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS short_description_fr  text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS short_description_ar  text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_title_fr          text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_title_ar          text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_description_fr    text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_description_ar    text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS featured              boolean DEFAULT false;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS mobile_icon           text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS badge_color           text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS card_style            text DEFAULT 'default';

-- -----------------------------
-- 3) CUSTOMERS — lifetime metrics
-- -----------------------------
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders    integer     DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_value  numeric(12,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_order_at   timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS segment         text        DEFAULT 'new';

CREATE INDEX IF NOT EXISTS idx_customers_segment        ON customers (segment);
CREATE INDEX IF NOT EXISTS idx_customers_lifetime_value ON customers (lifetime_value DESC);

-- -----------------------------
-- 4) THEME — extended design tokens
--    The edge function previously wrote only 13 fields; now it writes 22.
-- -----------------------------
ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS secondary_color   text DEFAULT '#12335E';
ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS card_color        text DEFAULT '#FFFFFF';
ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS border_color      text DEFAULT '#E5E7EB';
ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS type_scale        text DEFAULT 'comfortable';
ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS button_shadow     text DEFAULT 'medium';
ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS component_density text DEFAULT 'comfortable';
ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS header_style      text DEFAULT 'classic';
ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS footer_style      text DEFAULT 'classic';
ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS homepage_style    text DEFAULT 'classic';

-- -----------------------------
-- 5) BANNERS — link routing
--    link_mode was previously stored in KV only; now it's a first-class column
--    so storefront can route Hero/Promo CTAs to /product/:id or /shop?category=:id.
-- -----------------------------
ALTER TABLE banners ADD COLUMN IF NOT EXISTS link_mode      text DEFAULT 'url';
ALTER TABLE banners ADD COLUMN IF NOT EXISTS link_target_id text;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS banner_type    text DEFAULT 'hero';
ALTER TABLE banners ADD COLUMN IF NOT EXISTS start_at       timestamptz;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS end_at         timestamptz;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS priority       integer DEFAULT 100;

-- -----------------------------
-- 6) BACKFILL — give existing customers a reasonable segment
-- -----------------------------
UPDATE customers
   SET segment = CASE
     WHEN lifetime_value >= 30000 THEN 'vip'
     WHEN total_orders   >= 3     THEN 'loyal'
     WHEN total_orders   >= 1     THEN 'active'
     ELSE 'new'
   END
 WHERE segment IS NULL OR segment = 'new';
