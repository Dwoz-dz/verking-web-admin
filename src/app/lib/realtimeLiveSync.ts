import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabaseClient } from './supabaseClient';

export type LiveResource =
  | 'products'
  | 'categories'
  | 'banners'
  | 'store_settings'
  | 'homepage_config'
  | 'content'
  | 'theme'
  | 'orders'
  | 'customers'
  | 'wholesale'
  | 'hero_slides'
  | 'stocks';

export type LiveSource = 'realtime' | 'focus' | 'poll';

export type LiveSyncEvent = {
  resource: LiveResource;
  source: LiveSource;
  table?: string;
  rowId?: string;
  key?: string;
};

type LiveListener = (event: LiveSyncEvent) => void;

const TABLES = [
  'products',
  'categories',
  'banners',
  'store_settings',
  'homepage_sections',
  'theme_settings',
  'orders',
  'order_items',
  'customers',
  'wholesale_requests',
  'hero_slides',
  'stock_movements',
] as const;
const FALLBACK_POLL_MS = 45_000;
const FALLBACK_RESOURCES: LiveResource[] = [
  'products',
  'categories',
  'banners',
  'store_settings',
  'homepage_config',
  'content',
  'theme',
  'orders',
  'customers',
  'wholesale',
];

const listeners = new Set<LiveListener>();

let channel: RealtimeChannel | null = null;
let pollTimer: number | null = null;
let focusBound = false;
let refCount = 0;

function emit(event: LiveSyncEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Ignore listener failures.
    }
  });
}

function emitMany(resources: LiveResource[], source: LiveSource, extras: Partial<LiveSyncEvent> = {}) {
  const unique = Array.from(new Set(resources));
  unique.forEach((resource) => {
    emit({
      resource,
      source,
      ...extras,
    });
  });
}

function readStoreSettingsKey(payload: RealtimePostgresChangesPayload<any>) {
  const nextRow = payload.new as Record<string, unknown> | null;
  const prevRow = payload.old as Record<string, unknown> | null;
  const newKey = typeof nextRow?.key === 'string' ? nextRow.key : '';
  if (newKey) return newKey;
  const oldKey = typeof prevRow?.key === 'string' ? prevRow.key : '';
  return oldKey;
}

function readRowField(payload: RealtimePostgresChangesPayload<any>, field: string) {
  const nextRow = payload.new as Record<string, unknown> | null;
  const prevRow = payload.old as Record<string, unknown> | null;
  const nextValue = nextRow?.[field];
  if (typeof nextValue === 'string' && nextValue.length > 0) return nextValue;
  const prevValue = prevRow?.[field];
  if (typeof prevValue === 'string' && prevValue.length > 0) return prevValue;
  return undefined;
}

function mapPayloadToResources(payload: RealtimePostgresChangesPayload<any>): LiveResource[] {
  switch (payload.table) {
    case 'products':
      return ['products'];
    case 'categories':
      return ['categories'];
    case 'banners':
      return ['banners'];
    case 'homepage_sections':
      return ['homepage_config'];
    case 'theme_settings':
      return ['theme'];
    case 'orders':
    case 'order_items':
      // An order mutation often bumps the customer's total_orders and
      // lifetime_value too, so we emit both resources.
      return ['orders', 'customers'];
    case 'customers':
      return ['customers'];
    case 'wholesale_requests':
      return ['wholesale'];
    case 'hero_slides':
      return ['hero_slides'];
    case 'stock_movements':
      // Stock ledger entries also imply the products row's stock_qty changed
      // (the trigger updates both atomically), so refresh products too.
      return ['stocks', 'products'];
    case 'store_settings': {
      const key = readStoreSettingsKey(payload);
      if (key === 'general') return ['store_settings'];
      if (key === 'social' || key === 'content') return ['content', 'store_settings'];
      if (key === 'theme') return ['theme'];
      return ['content', 'store_settings', 'theme'];
    }
    default:
      return [...FALLBACK_RESOURCES];
  }
}

function startPollingFallback() {
  if (pollTimer !== null) return;
  pollTimer = window.setInterval(() => {
    emitMany(FALLBACK_RESOURCES, 'poll');
  }, FALLBACK_POLL_MS);
}

function stopPollingFallback() {
  if (pollTimer === null) return;
  window.clearInterval(pollTimer);
  pollTimer = null;
}

function handleWindowFocus() {
  emitMany(FALLBACK_RESOURCES, 'focus');
}

function bindFocusFallback() {
  if (focusBound) return;
  focusBound = true;
  window.addEventListener('focus', handleWindowFocus);
}

function unbindFocusFallback() {
  if (!focusBound) return;
  focusBound = false;
  window.removeEventListener('focus', handleWindowFocus);
}

function ensureRealtimeChannel() {
  if (channel) return;

  channel = supabaseClient.channel('vk-live-sync');
  TABLES.forEach((table) => {
    channel?.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        const resources = mapPayloadToResources(payload);
        emitMany(resources, 'realtime', {
          table: payload.table,
          rowId: readRowField(payload, 'id'),
          key: readRowField(payload, 'key'),
        });
      },
    );
  });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      stopPollingFallback();
      return;
    }
    if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      startPollingFallback();
    }
  });

  startPollingFallback();
  bindFocusFallback();
}

function teardownRealtimeChannel() {
  if (channel) {
    void supabaseClient.removeChannel(channel);
    channel = null;
  }
  stopPollingFallback();
  unbindFocusFallback();
}

export function subscribeRealtimeLiveSync(listener: LiveListener) {
  listeners.add(listener);
  refCount += 1;

  ensureRealtimeChannel();

  return () => {
    listeners.delete(listener);
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      teardownRealtimeChannel();
    }
  };
}

/**
 * Resource-filtered subscription. Callers pass the list of resources
 * they care about and a zero-arg callback; we wrap it so the listener
 * only fires for matching resources.
 */
export function subscribeRealtimeResources(
  resources: LiveResource[],
  listener: (event: LiveSyncEvent) => void,
) {
  const filter = new Set<LiveResource>(resources);
  const wrapped: LiveListener = (event) => {
    if (filter.has(event.resource)) {
      try {
        listener(event);
      } catch {
        // Ignore listener failures.
      }
    }
  };
  return subscribeRealtimeLiveSync(wrapped);
}
