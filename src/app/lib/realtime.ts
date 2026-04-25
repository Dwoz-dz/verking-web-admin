export const CONTENT_UPDATED_KEY = 'vk_content_updated_at';
export const CATEGORIES_UPDATED_KEY = 'vk_categories_updated_at';
export const CATEGORIES_UPDATED_EVENT = 'vk_categories_updated';

// Homepage config — fired by useHomepageConfig.publish() and
// persistSectionPartial() after a successful PUT. The storefront's
// HomePage subscribes to both the localStorage key (cross-tab fan-out)
// and the in-page event (same-tab) so it can reload IMMEDIATELY when
// admin saves, without waiting for the 45 s polling fallback or the
// window-focus reload.
export const HOMEPAGE_UPDATED_KEY = 'vk_homepage_updated_at';
export const HOMEPAGE_UPDATED_EVENT = 'vk_homepage_updated';

export function emitCategoriesUpdated() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CATEGORIES_UPDATED_KEY, String(Date.now()));
  } catch {
    // Ignore storage issues in restricted environments.
  }

  window.dispatchEvent(new Event(CATEGORIES_UPDATED_EVENT));
}

export function emitHomepageUpdated() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HOMEPAGE_UPDATED_KEY, String(Date.now()));
  } catch {
    // Ignore storage issues in restricted environments.
  }
  window.dispatchEvent(new Event(HOMEPAGE_UPDATED_EVENT));
}
