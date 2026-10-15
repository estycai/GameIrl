import type {
  CameraStop,
  LngLat,
  LngLatBounds,
  ViewPadding,
} from "@maplibre/maplibre-react-native";
import { routeBounds } from "../style/routeBounds";

export type CameraMode = "browse" | "preview" | "nav";

export const CAMERA_MODES: readonly CameraMode[] = [
  "browse",
  "preview",
  "nav",
] as const;

/**
 * Standard forward-azimuth formula.
 * Computes the initial bearing from start [lng, lat] to end [lng, lat] in degrees (0..360).
 */
export function computeBearing(
  start: [number, number],
  end: [number, number]
): number {
  const [lng1, lat1] = start;
  const [lng2, lat2] = end;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (toDeg(theta) + 360) % 360;
}

/**
 * Great-circle distance between two coordinates in meters.
 */
export function haversineDistanceMeters(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(coord2[1] - coord1[1]);
  const dLon = toRad(coord2[0] - coord1[0]);
  const lat1 = toRad(coord1[1]);
  const lat2 = toRad(coord2[1]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Locates the origin coordinate [lng, lat] of the route collection.
 */
export function getRouteOrigin(route: GeoJSON.FeatureCollection): [number, number] {
  for (const feature of route.features) {
    if (feature.properties?.kind === "origin" && feature.geometry.type === "Point") {
      const coords = feature.geometry.coordinates;
      return [coords[0], coords[1]];
    }
  }

  for (const feature of route.features) {
    if (feature.properties?.kind === "route" && feature.geometry.type === "LineString") {
      const first = feature.geometry.coordinates[0];
      if (first) {
        return [first[0], first[1]];
      }
    }
  }

  throw new Error("Unable to locate origin coordinate in route collection");
}

/**
 * Computes initial navigation bearing pointing roughly 100 meters along the route LineString.
 */
export function getNavBearing(
  route: GeoJSON.FeatureCollection,
  targetDistanceMeters: number = 100
): number {
  let lineCoords: [number, number][] | null = null;
  for (const feature of route.features) {
    if (feature.properties?.kind === "route" && feature.geometry.type === "LineString") {
      lineCoords = feature.geometry.coordinates as [number, number][];
      break;
    }
  }

  if (!lineCoords || lineCoords.length < 2) {
    return 0;
  }

  const start = lineCoords[0];
  let accumulated = 0;
  let targetCoord = lineCoords[1];

  for (let i = 0; i < lineCoords.length - 1; i++) {
    const p1 = lineCoords[i];
    const p2 = lineCoords[i + 1];
    const segDist = haversineDistanceMeters(p1, p2);

    if (accumulated + segDist >= targetDistanceMeters) {
      const remaining = targetDistanceMeters - accumulated;
      const fraction = segDist > 0 ? remaining / segDist : 0;
      targetCoord = [
        p1[0] + (p2[0] - p1[0]) * fraction,
        p1[1] + (p2[1] - p1[1]) * fraction,
      ];
      return computeBearing(start, targetCoord);
    }

    accumulated += segDist;
    targetCoord = p2;
  }

  return computeBearing(start, targetCoord);
}

const PREVIEW_PADDING: ViewPadding = {
  top: 90,
  bottom: 180,
  left: 40,
  right: 40,
};

/**
 * Returns the CameraStop configuration for the requested mode.
 * HARD CONSTRAINT: pitch must never exceed 60.
 * center and bounds are mutually exclusive.
 */
export function getCameraStop(
  mode: CameraMode,
  route: GeoJSON.FeatureCollection
): CameraStop {
  switch (mode) {
    case "browse":
      return {
        center: [0, 0],
        zoom: 1,
        pitch: 0,
        bearing: 0,
        duration: 800,
        easing: "ease",
      };
    case "preview": {
      let bounds: LngLatBounds;
      try {
        bounds = routeBounds(route) as LngLatBounds;
      } catch {
        return {
          center: [0, 0],
          zoom: 1,
          pitch: 0,
          bearing: 0,
          duration: 800,
          easing: "ease",
        };
      }
      return {
        bounds,
        padding: PREVIEW_PADDING,
        pitch: 0,
        bearing: 0,
        duration: 800,
        easing: "ease",
      };
    }
    case "nav": {
      const origin = getRouteOrigin(route) as LngLat;
      return {
        center: origin,
        zoom: 17,
        pitch: 60, // Maximum supported pitch in MapLibre Native
        bearing: getNavBearing(route),
        duration: 800,
        easing: "ease",
      };
    }
  }
}
