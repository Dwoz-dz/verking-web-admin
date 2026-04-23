const WISHLIST_STORAGE_KEY = 'vk_wishlist_ids';
const WISHLIST_EVENT = 'vk_wishlist_updated';

function safeParseIds(raw: string | null) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed.filter((item) => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [] as string[];
  }
}

function emitWishlist(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WISHLIST_EVENT, { detail: ids }));
}

function writeWishlistIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage issues in private mode.
  }
  emitWishlist(ids);
}

export function getWishlistIds() {
  if (typeof window === 'undefined') return [] as string[];
  return safeParseIds(localStorage.getItem(WISHLIST_STORAGE_KEY));
}

export function isWishlisted(productId: string) {
  return getWishlistIds().includes(productId);
}

export function toggleWishlist(productId: string) {
  const current = getWishlistIds();
  const exists = current.includes(productId);
  const next = exists
    ? current.filter((id) => id !== productId)
    : [productId, ...current];
  writeWishlistIds(next);
  return !exists;
}

export function subscribeWishlistUpdates(handler: (ids: string[]) => void) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key !== WISHLIST_STORAGE_KEY) return;
    handler(safeParseIds(event.newValue));
  };
  const onCustom = (event: Event) => {
    const custom = event as CustomEvent<string[]>;
    handler(Array.isArray(custom.detail) ? custom.detail : getWishlistIds());
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(WISHLIST_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(WISHLIST_EVENT, onCustom);
  };
}

