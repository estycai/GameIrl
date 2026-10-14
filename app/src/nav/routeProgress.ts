import {
  computeBearing,
  haversineDistanceMeters,
} from "../camera/cameraModes";

export interface RouteGeometry {
  coordinates: [number, number][];
  cumulative: number[]; // metres from the start at each coordinate
  totalMeters: number;
}

/**
 * Extracts coordinates from the route LineString and builds the cumulative distance table.
 * Pure function: testable without React or MapLibre runtime.
 */
export function buildRouteGeometry(
  route: GeoJSON.FeatureCollection
): RouteGeometry {
  let coordinates: [number, number][] = [];

  for (const feature of route.features) {
    if (
      feature.properties?.kind === "route" &&
      feature.geometry.type === "LineString"
    ) {
      coordinates = feature.geometry.coordinates as [number, number][];
      break;
    }
  }

  if (coordinates.length === 0) {
    // Fall back to any LineString in collection
    for (const feature of route.features) {
      if (feature.geometry.type === "LineString") {
        coordinates = feature.geometry.coordinates as [number, number][];
        break;
      }
    }
  }

  if (coordinates.length === 0) {
    return { coordinates: [], cumulative: [], totalMeters: 0 };
  }

  const cumulative: number[] = [0];
  let total = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const dist = haversineDistanceMeters(coordinates[i - 1], coordinates[i]);
    total += dist;
    cumulative.push(total);
  }

  return {
    coordinates,
    cumulative,
    totalMeters: total,
  };
}

/**
 * Finds the segment containing `metres`, linearly interpolates the position inside it,
 * and takes the bearing from that segment using computeBearing.
 * Clamps below 0 to the start and above totalMeters to the end.
 */
export function positionAtDistance(
  geometry: RouteGeometry,
  metres: number
): { center: [number, number]; bearing: number } {
  const { coordinates, cumulative, totalMeters } = geometry;

  if (coordinates.length === 0) {
    return { center: [0, 0], bearing: 0 };
  }

  if (coordinates.length === 1) {
    return { center: coordinates[0], bearing: 0 };
  }

  // Clamp below 0 to the start
  if (metres <= 0) {
    return {
      center: coordinates[0],
      bearing: computeBearing(coordinates[0], coordinates[1]),
    };
  }

  // Clamp above totalMeters to the end
  if (metres >= totalMeters) {
    const lastIdx = coordinates.length - 1;
    return {
      center: coordinates[lastIdx],
      bearing: computeBearing(coordinates[lastIdx - 1], coordinates[lastIdx]),
    };
  }

  // Find segment containing `metres`
  for (let i = 0; i < coordinates.length - 1; i++) {
    if (metres <= cumulative[i + 1]) {
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];
      const segDist = cumulative[i + 1] - cumulative[i];
      const ratio = segDist > 0 ? (metres - cumulative[i]) / segDist : 0;

      const center: [number, number] = [
        p1[0] + (p2[0] - p1[0]) * ratio,
        p1[1] + (p2[1] - p1[1]) * ratio,
      ];
      const bearing = computeBearing(p1, p2);

      return { center, bearing };
    }
  }

  const lastIdx = coordinates.length - 1;
  return {
    center: coordinates[lastIdx],
    bearing: computeBearing(coordinates[lastIdx - 1], coordinates[lastIdx]),
  };
}
