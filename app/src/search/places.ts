import { normalizeString } from "./normalize";

/**
 * Hardcoded search fixtures for testing.
 * These fixtures are synthetic test data inside the demo route's area, not verified real-world records.
 */

export interface Place {
  id: string;
  name: string;
  detail: string;
  center: [number, number];
}

export const PLACES: Place[] = [
  {
    id: "route-destination",
    name: "Avenida Rivadavia 14200",
    detail: "Ramos Mejia, Buenos Aires",
    center: [-58.519582, -34.634945],
  },
  {
    id: "plaza",
    name: "Plaza Mayor",
    detail: "Town square, 2.1 km",
    center: [-58.5665, -34.6412],
  },
  {
    id: "hospital",
    name: "General Hospital",
    detail: "Emergency 24 h, 1.8 km",
    center: [-58.5702, -34.6395],
  },
  {
    id: "station",
    name: "Central Station",
    detail: "Rail terminal, 2.4 km",
    center: [-58.5667, -34.6392],
  },
  {
    id: "mall",
    name: "Riverside Mall",
    detail: "Shopping centre, 3.6 km",
    center: [-58.545, -34.637],
  },
  {
    id: "stadium",
    name: "Municipal Stadium",
    detail: "Sports venue, 4.9 km",
    center: [-58.532, -34.636],
  },
];

/**
 * Searches places with a pure, case-insensitive, accent-insensitive substring match
 * across place name and detail. Returns all places for an empty query.
 */
export function searchPlaces(query: string): Place[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return PLACES;
  }

  const normalizedQuery = normalizeString(trimmed);

  return PLACES.filter((place) => {
    const normalizedName = normalizeString(place.name);
    const normalizedDetail = normalizeString(place.detail);
    return (
      normalizedName.includes(normalizedQuery) ||
      normalizedDetail.includes(normalizedQuery)
    );
  });
}
