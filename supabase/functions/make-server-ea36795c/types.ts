export interface Product {
  id: string;
  name_fr: string;
  name_ar: string;
  description_fr: string;
  description_ar: string;
  price: number;
  sale_price?: number | null;
  images: string[];
  video_url?: string;
  category_id: string;
  stock: number;
  is_featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
  is_promo: boolean;
  is_active: boolean;
  show_on_homepage: boolean;
  show_in_featured?: boolean;
  show_in_best_sellers: boolean;
  show_in_new_arrivals: boolean;
  show_in_promotions: boolean;
  show_in_cartables: boolean;
  show_in_trousses: boolean;
  show_in_school_supplies: boolean;
  section_priority: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name_fr: string;
  name_ar: string;
  slug: string;
  image: string;
  order: number;
  is_active: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  customer_wilaya: string;
  items: any[];
  subtotal: number;
  shipping: number;
  total: number;
  payment_method: string;
  delivery_type: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface WholesaleRequest {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  wilaya: string;
  message: string;
  status: string;
  created_at: string;
}

export interface Banner {
  id: string;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string;
  subtitle_ar: string;
  cta_fr: string;
  cta_ar: string;
  image: string;
  link: string;
  is_active: boolean;
  order: number;
}

export interface ThemeSettings {
  primary_color: string;
  accent_color: string;
  bg_color: string;
  font_heading: string;
  font_body: string;
  button_radius: string;
  show_featured: boolean;
  show_new_arrivals: boolean;
  show_best_sellers: boolean;
  show_wholesale_section: boolean;
  show_testimonials: boolean;
  logo_text: string;
  logo_subtitle: string;
  logo_url: string;
  secondary_logo_url: string;
  hero_background_url: string;
}

export interface MediaFile {
  id: string;
  filename: string;
  path: string;
  url: string;
  content_type: string;
  size: number;
  created_at: string;
}
