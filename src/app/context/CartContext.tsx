import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  product_id: string;
  name_fr: string;
  name_ar: string;
  price: number;
  sale_price?: number;
  image: string;
  qty: number;
  stock: number;
}

interface CartCtx {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  count: number;
  freeShippingThreshold: number;
  shippingFee: number;
  isFreeShipping: boolean;
  progressToFree: number;
}

const CartContext = createContext<CartCtx>({
  items: [], addItem: () => {}, removeItem: () => {}, updateQty: () => {}, clearCart: () => {}, 
  total: 0, count: 0, freeShippingThreshold: 5000, shippingFee: 400, isFreeShipping: false, progressToFree: 0
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('vk_cart') || '[]'); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('vk_cart', JSON.stringify(items)); }, [items]);

  const addItem = (item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === item.product_id);
      if (existing) {
        return prev.map(i => i.product_id === item.product_id ? { ...i, qty: Math.min(i.qty + item.qty, i.stock) } : i);
      }
      return [...prev, item];
    });
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.product_id !== id));
  const updateQty = (id: string, qty: number) => setItems(prev => prev.map(i => i.product_id === id ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) } : i));
  const clearCart = () => setItems([]);

  const effectivePrice = (item: CartItem) => item.sale_price || item.price;
  const total = items.reduce((s, i) => s + effectivePrice(i) * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  // Dynamic values (could be fetched from settings later)
  const freeShippingThreshold = 5000;
  const shippingFee = 400;
  const isFreeShipping = total >= freeShippingThreshold;
  const progressToFree = isFreeShipping ? 100 : Math.min(100, (total / freeShippingThreshold) * 100);

  return (
    <CartContext.Provider value={{ 
      items, addItem, removeItem, updateQty, clearCart, total, count,
      freeShippingThreshold, shippingFee, isFreeShipping, progressToFree
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() { return useContext(CartContext); }
