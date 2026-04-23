import { projectId, publicAnonKey } from '/utils/supabase/info';

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-ea36795c`;

export function publicHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
  };
}

export function adminHeaders(token: string | null) {
  if (!token) throw new Error('Missing admin token for protected endpoint');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-Admin-Token': token,
  };
}

export const api = {
  async get(path: string) {
    const res = await fetch(`${API_BASE}${path}`, { headers: publicHeaders() });
    if (!res.ok) throw new Error(`API GET ${path}: ${res.status}`);
    return res.json();
  },
  async post(path: string, body: any) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: publicHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API POST ${path}: ${res.status}`);
    return res.json();
  },
};

export const adminApi = {
  async get(path: string, token: string) {
    if (!token) throw new Error(`Admin API GET ${path}: No token provided`);
    const res = await fetch(`${API_BASE}${path}`, { headers: adminHeaders(token) });
    if (!res.ok) {
      if (res.status === 401) window.dispatchEvent(new Event('vk_admin_logout'));
      throw new Error(`Admin API GET ${path}: ${res.status}`);
    }
    return res.json();
  },
  async post(path: string, body: any, token: string) {
    if (!token) throw new Error(`Admin API POST ${path}: No token provided`);
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: adminHeaders(token),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (res.status === 401) window.dispatchEvent(new Event('vk_admin_logout'));
      throw new Error(`Admin API POST ${path}: ${res.status}`);
    }
    return res.json();
  },
  async put(path: string, body: any, token: string) {
    if (!token) throw new Error(`Admin API PUT ${path}: No token provided`);
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: adminHeaders(token),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (res.status === 401) window.dispatchEvent(new Event('vk_admin_logout'));
      throw new Error(`Admin API PUT ${path}: ${res.status}`);
    }
    return res.json();
  },
  async del(path: string, token: string) {
    if (!token) throw new Error(`Admin API DELETE ${path}: No token provided`);
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: adminHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) window.dispatchEvent(new Event('vk_admin_logout'));
      throw new Error(`Admin API DELETE ${path}: ${res.status}`);
    }
    return res.json();
  },
};

export const WILAYAS = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar', 'Blida', 'Bouira',
  'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda',
  'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem', "M'Sila", 'Mascara', 'Ouargla',
  'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
  'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent', 'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar',
  'Ouled Djellal', 'Béni Abbès', 'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', "El M'Ghair", 'El Menia',
];

export const PAYMENT_METHODS = [
  { value: 'cash_on_delivery', label_fr: 'Paiement à la livraison', label_ar: 'الدفع عند الاستلام', icon: '💵' },
  { value: 'in_store', label_fr: 'Paiement en magasin', label_ar: 'الدفع في المحل', icon: '🏪' },
  { value: 'bank_card', label_fr: 'Carte bancaire (CIB)', label_ar: 'البطاقة البنكية (CIB)', icon: '💳' },
  { value: 'edahabia', label_fr: 'Edahabia (Algérie Poste)', label_ar: 'بطاقة البريد (إيداهبية)', icon: '📮' },
];

export const ORDER_STATUSES = [
  { value: 'new', label_fr: 'Nouveau', label_ar: 'جديد', color: 'blue' },
  { value: 'confirmed', label_fr: 'Confirmé', label_ar: 'مؤكد', color: 'indigo' },
  { value: 'processing', label_fr: 'En traitement', label_ar: 'قيد المعالجة', color: 'yellow' },
  { value: 'shipped', label_fr: 'Expédié', label_ar: 'تم الشحن', color: 'purple' },
  { value: 'delivered', label_fr: 'Livré', label_ar: 'تم التسليم', color: 'green' },
  { value: 'cancelled', label_fr: 'Annulé', label_ar: 'ملغى', color: 'red' },
  { value: 'refunded', label_fr: 'Remboursé', label_ar: 'مسترد', color: 'red' },
];

export const apiHeaders = adminHeaders;
