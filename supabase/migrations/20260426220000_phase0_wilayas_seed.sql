-- Phase 0 — Wilayas reference table + seed.
--
-- Foundational table for the geo-aware mobile experience: shipping
-- zones, address validation, per-wilaya banners and recommendations
-- will all FK back to `wilayas.code`.
--
-- This migration is intentionally read-only for the public (anon) role:
-- the 58 wilayas of Algeria are administrative facts, not editable
-- content. Pricing/ETA/banners *per wilaya* live in a separate table
-- (`mobile_shipping_zones`, added in Phase 1) so this reference data
-- stays stable.
--
-- Region buckets follow the common Algerian commercial convention:
--   Centre, Est, Ouest, Sud. They power region-level admin actions
--   like "set free shipping for all of Centre" without us having to
--   re-classify wilayas in code.

CREATE TABLE IF NOT EXISTS public.wilayas (
  code TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('centre','est','ouest','sud')),
  sort_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.wilayas IS
  'Reference table — 58 administrative wilayas of Algeria. Read-only for anon. Per-wilaya editable data lives in mobile_shipping_zones.';

-- RLS: anyone can read, only service_role writes (no admin UI for this table).
ALTER TABLE public.wilayas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wilayas_anon_read   ON public.wilayas;
DROP POLICY IF EXISTS wilayas_authed_read ON public.wilayas;

CREATE POLICY wilayas_anon_read   ON public.wilayas FOR SELECT TO anon          USING (true);
CREATE POLICY wilayas_authed_read ON public.wilayas FOR SELECT TO authenticated USING (true);

-- Seed (idempotent — re-running does nothing if rows already exist).
INSERT INTO public.wilayas (code, name_fr, name_ar, region, sort_order) VALUES
  ('01', 'Adrar',                'أدرار',          'sud',    1),
  ('02', 'Chlef',                'الشلف',          'ouest',  2),
  ('03', 'Laghouat',             'الأغواط',        'sud',    3),
  ('04', 'Oum El Bouaghi',       'أم البواقي',     'est',    4),
  ('05', 'Batna',                'باتنة',          'est',    5),
  ('06', 'Béjaïa',               'بجاية',          'centre', 6),
  ('07', 'Biskra',               'بسكرة',          'sud',    7),
  ('08', 'Béchar',               'بشار',           'sud',    8),
  ('09', 'Blida',                'البليدة',        'centre', 9),
  ('10', 'Bouira',               'البويرة',        'centre', 10),
  ('11', 'Tamanrasset',          'تمنراست',        'sud',    11),
  ('12', 'Tébessa',              'تبسة',           'est',    12),
  ('13', 'Tlemcen',              'تلمسان',         'ouest',  13),
  ('14', 'Tiaret',               'تيارت',          'ouest',  14),
  ('15', 'Tizi Ouzou',           'تيزي وزو',       'centre', 15),
  ('16', 'Alger',                'الجزائر',        'centre', 16),
  ('17', 'Djelfa',               'الجلفة',         'sud',    17),
  ('18', 'Jijel',                'جيجل',           'est',    18),
  ('19', 'Sétif',                'سطيف',           'est',    19),
  ('20', 'Saïda',                'سعيدة',          'ouest',  20),
  ('21', 'Skikda',               'سكيكدة',         'est',    21),
  ('22', 'Sidi Bel Abbès',       'سيدي بلعباس',    'ouest',  22),
  ('23', 'Annaba',               'عنابة',          'est',    23),
  ('24', 'Guelma',               'قالمة',          'est',    24),
  ('25', 'Constantine',          'قسنطينة',        'est',    25),
  ('26', 'Médéa',                'المدية',         'centre', 26),
  ('27', 'Mostaganem',           'مستغانم',        'ouest',  27),
  ('28', 'M''Sila',              'المسيلة',        'centre', 28),
  ('29', 'Mascara',              'معسكر',          'ouest',  29),
  ('30', 'Ouargla',              'ورقلة',          'sud',    30),
  ('31', 'Oran',                 'وهران',          'ouest',  31),
  ('32', 'El Bayadh',            'البيض',          'sud',    32),
  ('33', 'Illizi',               'إليزي',          'sud',    33),
  ('34', 'Bordj Bou Arréridj',   'برج بوعريريج',   'est',    34),
  ('35', 'Boumerdès',            'بومرداس',        'centre', 35),
  ('36', 'El Tarf',              'الطارف',         'est',    36),
  ('37', 'Tindouf',              'تندوف',          'sud',    37),
  ('38', 'Tissemsilt',           'تيسمسيلت',       'ouest',  38),
  ('39', 'El Oued',              'الوادي',         'sud',    39),
  ('40', 'Khenchela',            'خنشلة',          'est',    40),
  ('41', 'Souk Ahras',           'سوق أهراس',      'est',    41),
  ('42', 'Tipaza',               'تيبازة',         'centre', 42),
  ('43', 'Mila',                 'ميلة',           'est',    43),
  ('44', 'Aïn Defla',            'عين الدفلى',     'centre', 44),
  ('45', 'Naâma',                'النعامة',        'sud',    45),
  ('46', 'Aïn Témouchent',       'عين تموشنت',     'ouest',  46),
  ('47', 'Ghardaïa',             'غرداية',         'sud',    47),
  ('48', 'Relizane',             'غليزان',         'ouest',  48),
  ('49', 'Timimoun',             'تيميمون',        'sud',    49),
  ('50', 'Bordj Badji Mokhtar',  'برج باجي مختار', 'sud',    50),
  ('51', 'Ouled Djellal',        'أولاد جلال',     'sud',    51),
  ('52', 'Béni Abbès',           'بني عباس',       'sud',    52),
  ('53', 'In Salah',             'عين صالح',       'sud',    53),
  ('54', 'In Guezzam',           'عين قزام',       'sud',    54),
  ('55', 'Touggourt',            'تقرت',           'sud',    55),
  ('56', 'Djanet',               'جانت',           'sud',    56),
  ('57', 'El M''Ghair',          'المغير',         'sud',    57),
  ('58', 'El Meniaa',            'المنيعة',        'sud',    58)
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS wilayas_region_idx     ON public.wilayas (region);
CREATE INDEX IF NOT EXISTS wilayas_sort_order_idx ON public.wilayas (sort_order);
