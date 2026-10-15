/**
 * Strips accents/diacritics and converts to lowercase for accent-insensitive matching.
 */
export function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
