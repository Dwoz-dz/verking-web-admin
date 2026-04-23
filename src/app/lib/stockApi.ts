import { supabaseClient } from './supabaseClient';

/**
 * Client-side wrappers around the `admin_adjust_stock` and
 * `admin_stock_movements` RPCs. Both functions are SECURITY DEFINER in
 * Postgres and validate the admin token against `kv_store_ea36795c`, so
 * we call them with the public anon key + pass the admin token as a
 * parameter. This keeps the new stock manager completely independent
 * of the Deno edge function (no redeploy required).
 */

export type StockAdjustMode = 'set' | 'increase' | 'decrease' | 'threshold';

export type StockAdjustPayload = {
  productId: string;
  mode: StockAdjustMode;
  value: number;
  reason?: string;
  adminLabel?: string;
  token: string;
};

export type StockAdjustResult = {
  success: boolean;
  mode: StockAdjustMode;
  product_id?: string;
  old_stock?: number;
  new_stock?: number;
  delta?: number;
  new_threshold?: number;
};

export type StockMovement = {
  id: string;
  product_id: string;
  action_type: string;
  old_quantity: number;
  new_quantity: number;
  delta: number;
  reason: string | null;
  admin_label: string | null;
  source: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function assertToken(token: string | undefined | null): asserts token is string {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing admin token for stock action');
  }
}

export async function adjustStock(payload: StockAdjustPayload): Promise<StockAdjustResult> {
  assertToken(payload.token);
  const { data, error } = await supabaseClient.rpc('admin_adjust_stock', {
    p_token: payload.token,
    p_product_id: payload.productId,
    p_mode: payload.mode,
    p_value: Math.trunc(payload.value),
    p_reason: payload.reason || null,
    p_admin_label: payload.adminLabel || null,
  });
  if (error) {
    throw new Error(error.message || 'Stock adjustment failed');
  }
  return (data || { success: false, mode: payload.mode }) as StockAdjustResult;
}

export async function listStockMovements(opts: {
  token: string;
  productId?: string;
  limit?: number;
}): Promise<StockMovement[]> {
  assertToken(opts.token);
  const { data, error } = await supabaseClient.rpc('admin_stock_movements', {
    p_token: opts.token,
    p_product_id: opts.productId || null,
    p_limit: opts.limit ?? 150,
  });
  if (error) {
    throw new Error(error.message || 'Unable to load stock movements');
  }
  return Array.isArray(data) ? (data as StockMovement[]) : [];
}
