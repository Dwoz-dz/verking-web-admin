export const CONTENT_UPDATED_KEY = 'vk_content_updated_at';
export const CATEGORIES_UPDATED_KEY = 'vk_categories_updated_at';
export const CATEGORIES_UPDATED_EVENT = 'vk_categories_updated';

export function emitCategoriesUpdated() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CATEGORIES_UPDATED_KEY, String(Date.now()));
  } catch {
    // Ignore storage issues in restricted environments.
  }

  window.dispatchEvent(new Event(CATEGORIES_UPDATED_EVENT));
}
