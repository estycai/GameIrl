import { Place } from "./places";
import { normalizeString } from "./normalize";

export const HISTORY_MAX = 10;

/**
 * Returns a new array with place added to the front, any existing entry with
 * the same id removed, capped at max. Never mutates input.
 */
export function addToHistory(
  list: Place[],
  place: Place,
  max = HISTORY_MAX
): Place[] {
  const filtered = list.filter((item) => item.id !== place.id);
  const updated = [place, ...filtered];
  if (updated.length > max) {
    return updated.slice(0, max);
  }
  return updated;
}

/**
 * Filters history list preserving order. If query is empty or whitespace,
 * returns list unchanged (most recent first). Otherwise filters entries where
 * normalized name or detail contains normalized query.
 */
export function matchHistory(list: Place[], query: string): Place[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return list;
  }
  const normalizedQuery = normalizeString(trimmed);
  return list.filter((place) => {
    const normName = normalizeString(place.name);
    const normDetail = normalizeString(place.detail);
    return normName.includes(normalizedQuery) || normDetail.includes(normalizedQuery);
  });
}

/**
 * Parses raw JSON string into Place[]. Drops invalid entries or invalid JSON safely.
 */
export function parseHistory(raw: string | null): Place[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const valid: Place[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      typeof candidate.detail === "string" &&
      Array.isArray(candidate.center) &&
      candidate.center.length === 2 &&
      typeof candidate.center[0] === "number" &&
      typeof candidate.center[1] === "number" &&
      Number.isFinite(candidate.center[0]) &&
      Number.isFinite(candidate.center[1])
    ) {
      valid.push({
        id: candidate.id,
        name: candidate.name,
        detail: candidate.detail,
        center: [candidate.center[0], candidate.center[1]],
      });
    }
  }

  return valid;
}
