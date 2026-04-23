function corruptionScore(value: string) {
  const mojibakeMatches = value.match(/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178]/g) || [];
  const replacementMatches = value.match(/\uFFFD/g) || [];
  return (mojibakeMatches.length * 2) + (replacementMatches.length * 4);
}

function decodeLatin1AsUtf8(value: string) {
  const codePoints = Array.from(value).map((char) => char.codePointAt(0) ?? 0);
  if (codePoints.some((code) => code > 255)) return value;
  return new TextDecoder().decode(Uint8Array.from(codePoints));
}

function repairLikelyMojibake(value: string) {
  if (!/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178\uFFFD]/.test(value)) return value;

  try {
    const repaired = decodeLatin1AsUtf8(value);
    if (!repaired || repaired === value) return value;
    return corruptionScore(repaired) < corruptionScore(value) ? repaired : value;
  } catch {
    return value;
  }
}

export function sanitizeDisplayText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;

  let normalized = repairLikelyMojibake(value)
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n');

  try {
    normalized = normalized.normalize('NFC');
  } catch {
    // Ignore unavailable Unicode normalization support.
  }

  const trimmed = normalized.trim();
  return trimmed || fallback;
}

export function pickLocalizedText(
  fr: unknown,
  ar: unknown,
  lang: 'fr' | 'ar',
  fallback = '',
) {
  const primary = sanitizeDisplayText(lang === 'ar' ? ar : fr);
  const secondary = sanitizeDisplayText(lang === 'ar' ? fr : ar);
  return primary || secondary || fallback;
}
