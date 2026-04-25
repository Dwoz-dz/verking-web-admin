// Tiny localStorage helper that wraps payloads with a version marker so we
// can evolve the on-disk schema without showing admins a stale draft that
// silently misses fields.
//
// Wire format on disk:
//   { "__v": <number>, "value": <T> }
//
// Migration path: if the stored value is the bare T (legacy plain JSON,
// no __v wrapper), readVersioned() optionally runs a `migrateLegacy`
// adapter to upgrade it to the current shape, then re-writes it under the
// current version number. This keeps existing browsers happy across
// upgrades — admins do not lose their unsaved draft when we bump the
// schema version.
//
// All functions are SSR-safe: they no-op gracefully when window is
// undefined (e.g. during Vite's pre-bundle). They also swallow JSON
// parse errors so a corrupted entry can never crash the app — we just
// fall back to the caller's default.

type Envelope<T> = { __v: number; value: T };

function isEnvelope<T>(input: unknown): input is Envelope<T> {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as Record<string, unknown>).__v === 'number' &&
    'value' in (input as Record<string, unknown>)
  );
}

export interface ReadVersionedOptions<T> {
  /**
   * Adapter that converts a legacy un-wrapped payload into the current
   * shape. Called when the stored entry has no __v marker. If omitted,
   * legacy entries are accepted as-is (cast to T).
   */
  migrateLegacy?: (legacy: unknown) => T | null;
  /**
   * Adapter for stored entries whose __v is older than the current
   * version. Defaults to "treat as missing" — return null to drop them.
   */
  migrateOlder?: (legacyValue: unknown, fromVersion: number) => T | null;
}

export function readVersioned<T>(
  key: string,
  currentVersion: number,
  options: ReadVersionedOptions<T> = {},
): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Wrapped payload — match version, migrate, or drop.
  if (isEnvelope<T>(parsed)) {
    if (parsed.__v === currentVersion) {
      return parsed.value;
    }
    if (options.migrateOlder) {
      const upgraded = options.migrateOlder(parsed.value, parsed.__v);
      if (upgraded === null) return null;
      writeVersioned(key, currentVersion, upgraded);
      return upgraded;
    }
    return null;
  }

  // Legacy un-wrapped payload — let caller decide how to upgrade.
  if (options.migrateLegacy) {
    const upgraded = options.migrateLegacy(parsed);
    if (upgraded === null) return null;
    writeVersioned(key, currentVersion, upgraded);
    return upgraded;
  }

  // No migration adapter provided — accept as-is and re-wrap so future
  // reads are fast-path.
  const accepted = parsed as T;
  writeVersioned(key, currentVersion, accepted);
  return accepted;
}

export function writeVersioned<T>(key: string, version: number, value: T): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const envelope: Envelope<T> = { __v: version, value };
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    // Quota or serialization errors are silent on purpose.
    return false;
  }
}

export function removeVersioned(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
