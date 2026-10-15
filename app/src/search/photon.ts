import { Place } from "./places";
import { normalizeString } from "./normalize";
import { haversineDistanceMeters } from "../camera/cameraModes";

export type LngLat = [number, number];

/**
 * Fallback bias used when GPS is unavailable (origin in Ramos Mejía).
 */
export const PHOTON_BIAS = { lat: -34.6438617, lon: -58.588705 };

export interface BuildPhotonUrlOptions {
  limit?: number;
  bbox?: [number, number, number, number];
  layer?: "street";
}

/**
 * Builds the verified Photon API request URL.
 * With no options, the output stays byte-identical to previous releases.
 */
export function buildPhotonUrl(
  query: string,
  bias: { lat: number; lon: number } = PHOTON_BIAS,
  options: BuildPhotonUrlOptions = {}
): string {
  const trimmed = query.trim();
  const encodedQuery = encodeURIComponent(trimmed);
  const limit = options.limit ?? 8;
  let url = `https://photon.komoot.io/api/?q=${encodedQuery}&limit=${limit}&lat=${bias.lat}&lon=${bias.lon}&zoom=14&location_bias_scale=0.2&osm_tag=!highway:bus_stop&osm_tag=!public_transport`;

  if (options.bbox) {
    const formattedBbox = options.bbox.map((coord) => coord.toFixed(6)).join(",");
    url += `&bbox=${formattedBbox}`;
  }

  if (options.layer) {
    url += `&layer=${options.layer}`;
  }

  return url;
}

/**
 * Returns [minLon, minLat, maxLon, maxLat] bounding box around the bias point.
 */
export function localBbox(
  bias: { lat: number; lon: number },
  halfSizeDeg = 0.5
): [number, number, number, number] {
  return [
    bias.lon - halfSizeDeg,
    bias.lat - halfSizeDeg,
    bias.lon + halfSizeDeg,
    bias.lat + halfSizeDeg,
  ];
}

/**
 * Splits query into street and house number if the query ends with a house number token.
 */
export function splitHouseNumber(
  query: string
): { street: string; number: string } | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  const lastToken = tokens[tokens.length - 1];
  if (/^\d+[a-zA-Z]?$/.test(lastToken)) {
    const street = tokens.slice(0, tokens.length - 1).join(" ");
    return { street, number: lastToken };
  }

  return null;
}

/**
 * Sorts places by ascending haversine distance to the given coordinate.
 * Pure function: does not mutate its input. Stable for ties.
 */
export function sortByDistance(places: Place[], from: LngLat): Place[] {
  return places
    .map((place, index) => ({
      place,
      index,
      distance: haversineDistanceMeters(place.center, from),
    }))
    .sort((a, b) => {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.place);
}

/**
 * Ranks streets placing exact name matches before partial matches, as Google does.
 * Streets matching normalizeString(name) === normalizeString(streetQuery.trim()) come first,
 * followed by all other streets. Each group is ordered by ascending haversine distance.
 * Pure function: does not mutate its input.
 */
export function rankStreets(
  streets: Place[],
  streetQuery: string,
  from: LngLat
): Place[] {
  const normQuery = normalizeString(streetQuery.trim());
  const exact: Place[] = [];
  const others: Place[] = [];

  for (const street of streets) {
    if (normalizeString(street.name) === normQuery) {
      exact.push(street);
    } else {
      others.push(street);
    }
  }

  return [...sortByDistance(exact, from), ...sortByDistance(others, from)];
}

/**
 * Synthesizes place entries with approximate house numbers on streets.
 */
export function streetFallbackPlaces(
  streets: Place[],
  houseNumber: string
): Place[] {
  return streets.map((street) => ({
    id: `${street.id}#${houseNumber}`,
    name: `${street.name} ${houseNumber}`,
    detail: street.detail ? `Approximate · ${street.detail}` : "Approximate",
    center: street.center,
  }));
}

interface PhotonFeatureProperties {
  osm_type?: string;
  osm_id?: number;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  locality?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  postcode?: string;
  [key: string]: unknown;
}

interface PhotonFeature {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: PhotonFeatureProperties;
}

/**
 * Pure mapping from Photon GeoJSON response to Place[].
 * Defensive against invalid payloads and de-duplicates identical name|detail.
 */
export function mapPhotonResponse(json: unknown): Place[] {
  if (!json || typeof json !== "object") {
    return [];
  }

  const features = (json as { features?: unknown }).features;
  if (!Array.isArray(features)) {
    return [];
  }

  const places: Place[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < features.length; i++) {
    const feature = features[i] as PhotonFeature;
    if (!feature || typeof feature !== "object") {
      continue;
    }

    const geometry = feature.geometry;
    if (
      !geometry ||
      geometry.type !== "Point" ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 2
    ) {
      continue;
    }

    const [lon, lat] = geometry.coordinates;
    if (
      typeof lon !== "number" ||
      typeof lat !== "number" ||
      !Number.isFinite(lon) ||
      !Number.isFinite(lat)
    ) {
      continue;
    }

    const props: PhotonFeatureProperties =
      feature.properties && typeof feature.properties === "object"
        ? feature.properties
        : {};

    // ID
    let id: string;
    if (props.osm_type && props.osm_id !== undefined) {
      id = `osm:${props.osm_type}${props.osm_id}`;
    } else {
      id = `photon:${i}`;
    }

    // Name
    let name = "";
    if (typeof props.name === "string" && props.name.trim().length > 0) {
      name = props.name.trim();
    } else {
      const streetPart = typeof props.street === "string" ? props.street.trim() : "";
      const housePart = typeof props.housenumber === "string" ? props.housenumber.trim() : "";
      const streetHouse = `${streetPart} ${housePart}`.trim();
      if (streetHouse.length > 0) {
        name = streetHouse;
      }
    }

    if (!name) {
      continue;
    }

    const normalizedName = normalizeString(name);

    // Detail parts in order:
    // 1. street+housenumber (only when name exists and street is present; omit if equal to name)
    // 2. locality || district
    // 3. city
    // 4. state
    // Skip part already contained in name.
    // De-duplicated case/accent-insensitive via normalizeString.
    const rawParts: string[] = [];

    if (props.name && typeof props.street === "string" && props.street.trim().length > 0) {
      const streetPart = props.street.trim();
      const housePart = typeof props.housenumber === "string" ? props.housenumber.trim() : "";
      const streetHouse = `${streetPart} ${housePart}`.trim();
      if (normalizeString(streetHouse) !== normalizedName) {
        rawParts.push(streetHouse);
      }
    }

    const localityOrDistrict =
      (typeof props.locality === "string" && props.locality.trim()) ||
      (typeof props.district === "string" && props.district.trim()) ||
      "";
    if (localityOrDistrict) {
      rawParts.push(localityOrDistrict);
    }

    if (typeof props.city === "string" && props.city.trim()) {
      rawParts.push(props.city.trim());
    }

    if (typeof props.state === "string" && props.state.trim()) {
      rawParts.push(props.state.trim());
    }

    const detailParts: string[] = [];
    const seenPartKeys = new Set<string>();

    for (const part of rawParts) {
      const normPart = normalizeString(part);
      if (!normPart) continue;
      // Skip if already contained in name
      if (normalizedName.includes(normPart)) {
        continue;
      }
      // De-duplicate within detail
      if (seenPartKeys.has(normPart)) {
        continue;
      }
      seenPartKeys.add(normPart);
      detailParts.push(part);
    }

    const detail = detailParts.join(", ");
    const dedupeKey = `${normalizedName}|${normalizeString(detail)}`;

    if (seenKeys.has(dedupeKey)) {
      continue;
    }
    seenKeys.add(dedupeKey);

    places.push({
      id,
      name,
      detail,
      center: [lon, lat],
    });
  }

  return places;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Photon fetch failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetches places matching a query using the Photon public API with local bbox
 * and street fallback for missing house numbers.
 */
export async function fetchPhotonPlaces(
  query: string,
  bias: { lat: number; lon: number },
  signal?: AbortSignal
): Promise<Place[]> {
  // 1. local = places from buildPhotonUrl(query, bias, { bbox: localBbox(bias) })
  const localUrl = buildPhotonUrl(query, bias, { bbox: localBbox(bias) });
  const localJson = await fetchJson(localUrl, signal);
  const localPlaces = mapPhotonResponse(localJson);

  let combined = [...localPlaces];

  // 2. if local.length < 3 and splitHouseNumber(query) is not null:
  const split = splitHouseNumber(query);
  if (localPlaces.length < 3 && split !== null) {
    const streetUrl = buildPhotonUrl(split.street, bias, {
      bbox: localBbox(bias),
      layer: "street",
    });
    const streetJson = await fetchJson(streetUrl, signal);
    const streetPlaces = mapPhotonResponse(streetJson);

    const sortedStreets = rankStreets(streetPlaces, split.street, [bias.lon, bias.lat]);
    const fallbackPlaces = streetFallbackPlaces(sortedStreets, split.number);

    const existingIds = new Set(combined.map((p) => p.id));
    const existingKeys = new Set(
      combined.map((p) => `${normalizeString(p.name)}|${normalizeString(p.detail)}`)
    );

    for (const place of fallbackPlaces) {
      const key = `${normalizeString(place.name)}|${normalizeString(place.detail)}`;
      if (existingIds.has(place.id) || existingKeys.has(key)) {
        continue;
      }
      existingIds.add(place.id);
      existingKeys.add(key);
      combined.push(place);
    }
  }

  // 3. if the combined list is still EMPTY:
  if (combined.length === 0) {
    const globalUrl = buildPhotonUrl(query, bias);
    const globalJson = await fetchJson(globalUrl, signal);
    return mapPhotonResponse(globalJson);
  }

  return combined;
}
