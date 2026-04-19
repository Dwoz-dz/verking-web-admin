
export interface Product {
  id: string; 
  name_fr: string; 
  name_ar: string;
  description_fr: string; 
  description_ar: string;
  price: number; 
  sale_price?: number; 
  cost_price?: number;
  images: string[]; 
  video_url?: string; 
  category_id: string;
  stock: number; 
  low_stock_threshold?: number;
  sku?: string; 
  barcode?: string; 
  tags?: string[];
  meta_title?: string; 
  meta_description?: string;
  is_featured: boolean; 
  is_new: boolean; 
  is_best_seller: boolean;
  is_promo: boolean; 
  is_active: boolean;
  show_on_homepage: boolean; 
  show_in_featured: boolean;
  show_in_best_sellers: boolean; 
  show_in_new_arrivals: boolean;
  show_in_promotions: boolean; 
  show_in_cartables: boolean;
  show_in_trousses: boolean; 
  show_in_school_supplies: boolean;
  section_priority: number; 
  sort_order: number;
  view_count?: number; 
  order_count?: number;
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
  sort_order?: number;
  is_active: boolean; 
  show_on_homepage?: boolean;
  short_description_fr?: string;
  short_description_ar?: string;
  featured?: boolean;
  mobile_icon?: string;
  badge_color?: string;
  card_style?: string;
  product_count?: number;
}

export const EMPTY_PRODUCT: Partial<Product> = {
  name_fr: '', 
  name_ar: '', 
  description_fr: '', 
  description_ar: '',
  price: 0, 
  sale_price: undefined, 
  cost_price: undefined,
  images: [], 
  video_url: '', 
  category_id: '', 
  stock: 0, 
  low_stock_threshold: 5,
  sku: '', 
  barcode: '', 
  meta_title: '', 
  meta_description: '',
  is_featured: false, 
  is_new: false, 
  is_best_seller: false, 
  is_promo: false, 
  is_active: true,
  show_on_homepage: false, 
  show_in_featured: false, 
  show_in_best_sellers: false,
  show_in_new_arrivals: false, 
  show_in_promotions: false,
  show_in_cartables: false, 
  show_in_trousses: false, 
  show_in_school_supplies: false,
  section_priority: 99, 
  sort_order: 99,
};

export type FilterStatus = 'all' | 'active' | 'inactive';
export type FilterStock = 'all' | 'low' | 'out';
export type SortField = 'name' | 'price' | 'stock' | 'updated' | 'sort_order';
export type ActiveTab = 'info' | 'pricing' | 'media' | 'display' | 'seo' | 'analytics';
export type ViewMode = 'table' | 'grid';
