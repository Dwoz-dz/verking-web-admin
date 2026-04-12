-- ============================================================
-- VERKING SCOLAIRE - Production Database Schema
-- Execute this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================
-- Run each section in order. If a table already exists, it will be skipped.
-- ============================================================

-- 1. ADMIN USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'editor')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default admin (password: Admin@Verking2024 hashed with pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO admin_users (email, password_hash, name, role)
VALUES (
  'admin@verking-scolaire.dz',
  crypt('Admin@Verking2024', gen_salt('bf')),
  'Super Admin',
  'super_admin'
) ON CONFLICT (email) DO NOTHING;

-- 2. CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  phone TEXT UNIQUE NOT NULL,
  email TEXT DEFAULT '',
  wilaya TEXT DEFAULT '',
  address TEXT DEFAULT '',
  customer_type TEXT NOT NULL DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale')),
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_orders INT NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_fr TEXT NOT NULL DEFAULT '',
  name_ar TEXT NOT NULL DEFAULT '',
  slug TEXT UNIQUE NOT NULL,
  description_fr TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  image TEXT DEFAULT '',
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 99,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_fr TEXT NOT NULL DEFAULT '',
  name_ar TEXT NOT NULL DEFAULT '',
  description_fr TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2),
  cost_price NUMERIC(12,2),
  sku TEXT DEFAULT '',
  barcode TEXT DEFAULT '',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  stock INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  weight_grams INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  -- Visibility & placement flags
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_new BOOLEAN NOT NULL DEFAULT false,
  is_best_seller BOOLEAN NOT NULL DEFAULT false,
  is_promo BOOLEAN NOT NULL DEFAULT false,
  show_on_homepage BOOLEAN NOT NULL DEFAULT false,
  show_in_featured BOOLEAN NOT NULL DEFAULT false,
  show_in_best_sellers BOOLEAN NOT NULL DEFAULT false,
  show_in_new_arrivals BOOLEAN NOT NULL DEFAULT false,
  show_in_promotions BOOLEAN NOT NULL DEFAULT false,
  show_in_cartables BOOLEAN NOT NULL DEFAULT false,
  show_in_trousses BOOLEAN NOT NULL DEFAULT false,
  show_in_school_supplies BOOLEAN NOT NULL DEFAULT false,
  section_priority INT NOT NULL DEFAULT 99,
  sort_order INT NOT NULL DEFAULT 99,
  -- SEO
  meta_title TEXT DEFAULT '',
  meta_description TEXT DEFAULT '',
  -- Stats
  view_count INT NOT NULL DEFAULT 0,
  order_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PRODUCT IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- 6. PRODUCT VARIANTS (optional future use)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name_fr TEXT NOT NULL DEFAULT '',
  name_ar TEXT NOT NULL DEFAULT '',
  sku TEXT DEFAULT '',
  price NUMERIC(12,2),
  stock INT NOT NULL DEFAULT 0,
  attributes JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. BANNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_fr TEXT NOT NULL DEFAULT '',
  title_ar TEXT NOT NULL DEFAULT '',
  subtitle_fr TEXT DEFAULT '',
  subtitle_ar TEXT DEFAULT '',
  cta_fr TEXT DEFAULT 'Voir plus',
  cta_ar TEXT DEFAULT '',
  image TEXT DEFAULT '',
  link TEXT DEFAULT '/shop',
  target TEXT DEFAULT '_self',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 99,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. HOMEPAGE SECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS homepage_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT UNIQUE NOT NULL,
  title_fr TEXT DEFAULT '',
  title_ar TEXT DEFAULT '',
  subtitle_fr TEXT DEFAULT '',
  subtitle_ar TEXT DEFAULT '',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 99,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default homepage sections
INSERT INTO homepage_sections (section_key, title_fr, title_ar, is_enabled, sort_order, config) VALUES
  ('hero', 'Nouvelle Collection Rentree 2024', '', true, 1, '{"cta_fr":"Decouvrir la collection","cta_ar":"","image":""}'),
  ('categories', 'Nos Categories', '', true, 2, '{}'),
  ('featured', 'Produits Vedettes', '', true, 3, '{"limit":8}'),
  ('new_arrivals', 'Nouveautes', '', true, 4, '{"limit":8}'),
  ('best_sellers', 'Meilleures Ventes', '', true, 5, '{"limit":8}'),
  ('promotions', 'Promotions', '', true, 6, '{}'),
  ('cartables', 'Cartables', '', true, 7, '{"limit":8}'),
  ('trousses', 'Trousses', '', true, 8, '{"limit":8}'),
  ('school_supplies', 'Fournitures Scolaires', '', true, 9, '{"limit":8}'),
  ('trust', 'Pourquoi nous choisir', '', true, 10, '{}'),
  ('testimonials', 'Avis clients', '', true, 11, '{}'),
  ('wholesale', 'Espace Grossiste', '', true, 12, '{}')
ON CONFLICT (section_key) DO NOTHING;

-- 9. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT DEFAULT '',
  customer_address TEXT DEFAULT '',
  customer_wilaya TEXT DEFAULT '',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery',
  delivery_type TEXT NOT NULL DEFAULT 'delivery',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','confirmed','processing','shipped','delivered','cancelled','returned')),
  notes TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  tracking_number TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- 10. ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_fr TEXT NOT NULL DEFAULT '',
  product_name_ar TEXT DEFAULT '',
  product_image TEXT DEFAULT '',
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 1,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 11. WHOLESALE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS wholesale_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  wilaya TEXT DEFAULT '',
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','approved','rejected')),
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. MEDIA ASSETS
-- ============================================================
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  content_type TEXT DEFAULT 'image/jpeg',
  size_bytes INT DEFAULT 0,
  alt_text TEXT DEFAULT '',
  folder TEXT DEFAULT 'general',
  uploaded_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. STORE SETTINGS (key-value for flexibility)
-- ============================================================
CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert defaults
INSERT INTO store_settings (key, value) VALUES
  ('general', '{"store_name":"VERKING SCOLAIRE","store_subtitle":"STP Stationery","phone":"+213 555 123 456","email":"contact@verking-scolaire.dz","whatsapp":"+213555123456","address":"Rue des Freres Belloul, Bordj El Bahri, Alger 16111","currency":"DA","country":"Algerie","shipping_fee":500,"free_shipping_threshold":5000}'),
  ('social', '{"facebook":"https://facebook.com/verking.scolaire","instagram":"https://instagram.com/verking.scolaire","tiktok":"","youtube":""}'),
  ('about_fr', '"VERKING SCOLAIRE est une marque algerienne specialisee dans les articles scolaires haut de gamme."'),
  ('about_ar', '"VERKING SCOLAIRE علامة جزائرية متخصصة في الأدوات المدرسية عالية الجودة."'),
  ('working_hours', '"Dim-Jeu: 08h00-18h00 | Ven-Sam: 09h00-14h00"'),
  ('faq', '[]')
ON CONFLICT (key) DO NOTHING;

-- 14. THEME SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS theme_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  primary_color TEXT NOT NULL DEFAULT '#1A3C6E',
  accent_color TEXT NOT NULL DEFAULT '#F57C00',
  bg_color TEXT NOT NULL DEFAULT '#F8FAFC',
  font_heading TEXT NOT NULL DEFAULT 'Montserrat',
  font_body TEXT NOT NULL DEFAULT 'Inter',
  button_radius TEXT NOT NULL DEFAULT 'xl',
  logo_text TEXT NOT NULL DEFAULT 'VERKING SCOLAIRE',
  logo_subtitle TEXT NOT NULL DEFAULT 'STP STATIONERY',
  logo_image TEXT DEFAULT '',
  show_featured BOOLEAN NOT NULL DEFAULT true,
  show_new_arrivals BOOLEAN NOT NULL DEFAULT true,
  show_best_sellers BOOLEAN NOT NULL DEFAULT true,
  show_wholesale_section BOOLEAN NOT NULL DEFAULT true,
  show_testimonials BOOLEAN NOT NULL DEFAULT true,
  custom_css TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO theme_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 15. APP SETTINGS (for mobile app config)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  platform TEXT DEFAULT 'all' CHECK (platform IN ('all', 'web', 'mobile')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value, platform) VALUES
  ('app_version', '"1.0.0"', 'mobile'),
  ('maintenance_mode', 'false', 'all'),
  ('force_update', 'false', 'mobile')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_homepage ON products(show_on_homepage) WHERE show_on_homepage = true;
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'admin_users','customers','categories','products','banners',
    'homepage_sections','orders','wholesale_requests','theme_settings'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON %I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY (optional - enable as needed)
-- ============================================================
-- For now, the Edge Function uses SERVICE_ROLE_KEY which bypasses RLS.
-- When you're ready for client-side access, enable RLS:
--
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public read products" ON products FOR SELECT USING (is_active = true);
-- etc.

-- ============================================================
-- DONE! Your production database is ready.
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS for Admin Auth
-- ============================================================

-- Verify admin password using pgcrypto
CREATE OR REPLACE FUNCTION verify_admin_password(admin_email TEXT, admin_password TEXT)
RETURNS TABLE(valid BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT (password_hash = crypt(admin_password, password_hash)) AS valid
  FROM admin_users
  WHERE email = admin_email AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin password using pgcrypto
CREATE OR REPLACE FUNCTION update_admin_password(admin_email TEXT, new_password TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE admin_users
  SET password_hash = crypt(new_password, gen_salt('bf'))
  WHERE email = admin_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ALL DONE! Run this entire script in Supabase SQL Editor.
-- Then use the /admin/seed endpoint to populate initial data.
-- ============================================================