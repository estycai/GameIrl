import { Place } from "./places";
import { normalizeString } from "./normalize";

export const SUGGESTION_LIMIT = 3;

export type SuggestionSource = "history" | "result";

export interface Suggestion {
  place: Place;
  source: SuggestionSource;
}

/**
 * Merges history entries and results up to limit. History comes first.
 * De-duplicates by id OR normalized name|detail.
 */
export function mergeSuggestions(
  history: Place[],
  results: Place[],
  limit = SUGGESTION_LIMIT
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const seenIds = new Set<string>();
  const seenNameDetail = new Set<string>();

  const add = (place: Place, source: SuggestionSource): boolean => {
    if (suggestions.length >= limit) {
      return false;
    }
    const key = `${normalizeString(place.name)}|${normalizeString(place.detail)}`;
    if (seenIds.has(place.id) || seenNameDetail.has(key)) {
      return false;
    }
    seenIds.add(place.id);
    seenNameDetail.add(key);
    suggestions.push({ place, source });
    return true;
  };

  for (const h of history) {
    if (suggestions.length >= limit) break;
    add(h, "history");
  }

  for (const r of results) {
    if (suggestions.length >= limit) break;
    add(r, "result");
  }

  return suggestions;
}

export interface TextSegment {
  text: string;
  match: boolean;
}

function isWordChar(ch: string): boolean {
  return /^[0-9a-zA-Z]$/.test(ch);
}

/**
 * Splits text into segments marking word-start prefix matches with query tokens.
 * Accents and case are normalized per character so indices into the original text stay 1:1.
 * Adjacent segments with the same match boolean are merged.
 */
export function highlightSegments(text: string, query: string): TextSegment[] {
  const trimmedQuery = query.trim();
  if (!text) {
    return [];
  }
  if (!trimmedQuery) {
    return [{ text, match: false }];
  }

  const tokens = trimmedQuery
    .split(/\s+/)
    .map((t) => normalizeString(t))
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return [{ text, match: false }];
  }

  // Normalized characters representation 1:1 with original characters
  const normChars: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const n = normalizeString(text[i]);
    normChars.push(n.length > 0 ? n[0] : "");
  }

  const matched = new Array<boolean>(text.length).fill(false);

  for (let i = 0; i < text.length; i++) {
    // Check if index i is the start of a word
    const isWordStart = i === 0 || !isWordChar(normChars[i - 1]);
    if (!isWordStart) {
      continue;
    }

    for (const token of tokens) {
      if (token.length === 0) continue;
      if (i + token.length > text.length) continue;

      let matches = true;
      for (let j = 0; j < token.length; j++) {
        if (normChars[i + j] !== token[j]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        for (let j = 0; j < token.length; j++) {
          matched[i + j] = true;
        }
      }
    }
  }

  // Build segments and merge adjacent identical match states
  const segments: TextSegment[] = [];
  let currentText = text[0];
  let currentMatch = matched[0];

  for (let i = 1; i < text.length; i++) {
    if (matched[i] === currentMatch) {
      currentText += text[i];
    } else {
      segments.push({ text: currentText, match: currentMatch });
      currentText = text[i];
      currentMatch = matched[i];
    }
  }
  segments.push({ text: currentText, match: currentMatch });

  return segments;
}
