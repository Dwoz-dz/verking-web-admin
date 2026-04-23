const MOJIBAKE_PATTERN = /[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178\uFFFD]/;

export function scoreCorruption(value: string) {
  const mojibakeMatches = value.match(/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178]/g) || [];
  const replacementMatches = value.match(/\uFFFD/g) || [];
  return (mojibakeMatches.length * 2) + (replacementMatches.length * 4);
}

function decodeLatin1AsUtf8(value: string) {
  const codePoints = Array.from(value).map((char) => char.codePointAt(0) ?? 0);
  if (codePoints.some((code) => code > 255)) return value;
  return new TextDecoder('utf-8').decode(Uint8Array.from(codePoints));
}

export function repairLikelyMojibake(value: string) {
  if (!MOJIBAKE_PATTERN.test(value)) return value;
  try {
    const repaired = decodeLatin1AsUtf8(value);
    if (!repaired || repaired === value) return value;
    return scoreCorruption(repaired) < scoreCorruption(value) ? repaired : value;
  } catch {
    return value;
  }
}

export function normalizeUnicodeText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  let normalized = repairLikelyMojibake(value)
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n');
  try {
    normalized = normalized.normalize('NFC');
  } catch {
    // Ignore environments without Unicode normalization support.
  }
  return normalized.trim();
}

export function normalizeSafeText(value: unknown, fallback = '') {
  const normalized = normalizeUnicodeText(value, fallback);
  if (!normalized) return normalizeUnicodeText(fallback, '');
  if (scoreCorruption(normalized) > 0) {
    const fallbackNormalized = normalizeUnicodeText(fallback, '');
    return fallbackNormalized || normalized;
  }
  return normalized;
}

export function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const parsed = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(parsed)) return true;
    if (['false', '0', 'no', 'off'].includes(parsed)) return false;
  }
  return fallback;
}

export function normalizeOrder(value: unknown, fallback = 0, max = 9999) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(0, Math.min(max, Math.trunc(fallback)));
  return Math.max(0, Math.min(max, Math.trunc(parsed)));
}

export function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return `#${raw.toUpperCase()}`;
  return fallback;
}

export function normalizeOptionalHexColor(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return `#${raw.toUpperCase()}`;
  return '';
}

export function normalizeUrlOrPath(value: unknown, fallback = '') {
  const normalized = normalizeUnicodeText(value, '');
  if (!normalized) return fallback;
  // Accept relative paths (/shop), hash anchors (#newsletter) and
  // mailto:/tel: links — these are all valid CTA targets on the storefront.
  if (normalized.startsWith('/')) return normalized;
  if (normalized.startsWith('#') && normalized.length > 1) return normalized;
  if (/^(mailto:|tel:)/i.test(normalized)) return normalized;
  try {
    const url = new URL(normalized);
    if (url.protocol === 'http:' || url.protocol === 'https:') return normalized;
  } catch {
    // Ignore invalid URLs.
  }
  return fallback;
}

export function normalizeOptionalDateTime(value: unknown) {
  const normalized = normalizeUnicodeText(value, '');
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function slugify(value: string) {
  const normalized = normalizeUnicodeText(value, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateBilingualPair(fr: string, ar: string, frLabel: string, arLabel: string) {
  const issues: string[] = [];
  if (!normalizeUnicodeText(fr, '')) issues.push(`${frLabel} est obligatoire.`);
  if (!normalizeUnicodeText(ar, '')) issues.push(`${arLabel} est obligatoire.`);
  return issues;
}

export function validateDateRange(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) return null;
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Plage de dates invalide.';
  if (end < start) return 'La date de fin doit etre posterieure a la date de debut.';
  return null;
}
