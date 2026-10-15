export interface OsrmRouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: GeoJSON.LineString;
  featureCollection: GeoJSON.FeatureCollection;
}

export interface OsrmRouteOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Builds the MapLibre/template overlay FeatureCollection from an OSRM route:
 * - Feature 0: kind "route", distance_m, duration_s, LineString geometry
 * - Feature 1: kind "origin", label "A", Point geometry at start of line
 * - Feature 2: kind "destination", label "B", Point geometry at end of line
 */
export function buildRouteFeatureCollection(
  geometry: GeoJSON.LineString,
  distanceMeters: number,
  durationSeconds: number
): GeoJSON.FeatureCollection {
  const coords = geometry.coordinates;
  if (!coords || coords.length === 0) {
    throw new Error("Cannot build route FeatureCollection from empty geometry");
  }

  const originCoord = coords[0];
  const destCoord = coords[coords.length - 1];

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          kind: "route",
          distance_m: distanceMeters,
          duration_s: durationSeconds,
        },
        geometry,
      },
      {
        type: "Feature",
        properties: {
          kind: "origin",
          label: "A",
        },
        geometry: {
          type: "Point",
          coordinates: [originCoord[0], originCoord[1]],
        },
      },
      {
        type: "Feature",
        properties: {
          kind: "destination",
          label: "B",
        },
        geometry: {
          type: "Point",
          coordinates: [destCoord[0], destCoord[1]],
        },
      },
    ],
  };
}

/**
 * Parses raw OSRM JSON response into a typed OsrmRouteResult.
 * Defensive against invalid shapes or non-Ok codes.
 */
export function parseOsrmResponse(json: unknown): OsrmRouteResult {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid OSRM response: not an object");
  }

  const res = json as {
    code?: string;
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: GeoJSON.LineString;
    }>;
  };

  if (res.code !== "Ok") {
    throw new Error(`OSRM error code: ${res.code ?? "unknown"}`);
  }

  if (!Array.isArray(res.routes) || res.routes.length === 0) {
    throw new Error("OSRM response contains no routes");
  }

  const firstRoute = res.routes[0];
  if (!firstRoute || typeof firstRoute !== "object") {
    throw new Error("Invalid route object in OSRM response");
  }

  const distanceMeters = Math.round(Number(firstRoute.distance ?? 0));
  const durationSeconds = Math.round(Number(firstRoute.duration ?? 0));

  const geometry = firstRoute.geometry;
  if (
    !geometry ||
    geometry.type !== "LineString" ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2
  ) {
    throw new Error("Invalid geometry in OSRM route: expected LineString with >= 2 coordinates");
  }

  const featureCollection = buildRouteFeatureCollection(
    geometry,
    distanceMeters,
    durationSeconds
  );

  return {
    distanceMeters,
    durationSeconds,
    geometry,
    featureCollection,
  };
}

export function buildOsrmUrl(
  from: [number, number],
  to: [number, number]
): string {
  const fromLon = from[0];
  const fromLat = from[1];
  const toLon = to[0];
  const toLat = to[1];

  return `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
}

/**
 * Fetches driving route from OSRM public demo server.
 * Implements a 10s timeout via internal AbortController.
 */
export async function fetchOsrmRoute(
  from: [number, number],
  to: [number, number],
  options: OsrmRouteOptions = {}
): Promise<OsrmRouteResult> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 10000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isTimeout = false;

  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, timeoutMs);
  }

  const onCallerAbort = () => {
    controller.abort();
  };

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", onCallerAbort, { once: true });
    }
  }

  const url = buildOsrmUrl(from, to);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`OSRM HTTP error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return parseOsrmResponse(data);
  } catch (err: any) {
    if (isTimeout) {
      throw new Error("Route calculation timed out. Please try again.");
    }
    throw err;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    if (options.signal) {
      options.signal.removeEventListener("abort", onCallerAbort);
    }
  }
}
