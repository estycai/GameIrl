/**
 * Route progress simulation hook.
 *
 * NOTE: There is no GPS hardware tracking or location permissions in this app.
 * The simulation is an honest stand-in for real driving navigation on device,
 * advancing along the demo route's geometry over time.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  positionAtDistance,
  type RouteGeometry,
} from "./routeProgress";

// Default route speed: 6884 metres / 662 seconds ≈ 10.3988 m/s (~37.4 km/h)
const DEFAULT_ROUTE_SPEED_MPS = 6884 / 662;

export interface RouteSimulationState {
  travelledMeters: number;
  position: { center: [number, number]; bearing: number };
  bearing: number;
  remainingMeters: number;
  remainingSeconds: number;
  isFinished: boolean;
}

/**
 * Advances along the route geometry with elapsed real time when `active` is true.
 * Clears timers on unmount or when `active` becomes false, resetting travelled distance.
 */
export function useRouteSimulation(
  geometry: RouteGeometry,
  active: boolean,
  speedMultiplier: number = 6
): RouteSimulationState {
  const [travelledMeters, setTravelledMeters] = useState(0);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setTravelledMeters(0);
      lastTimeRef.current = null;
      return;
    }

    lastTimeRef.current = Date.now();
    const effectiveSpeed = DEFAULT_ROUTE_SPEED_MPS * speedMultiplier;

    // Tick at 50ms interval (~20 updates/second) computing exact dt from timestamps
    const timer = setInterval(() => {
      const now = Date.now();
      const last = lastTimeRef.current ?? now;
      const dt = Math.max(0, (now - last) / 1000);
      lastTimeRef.current = now;

      setTravelledMeters((prev) => {
        const next = prev + effectiveSpeed * dt;
        if (geometry.totalMeters > 0 && next >= geometry.totalMeters) {
          return geometry.totalMeters;
        }
        return next;
      });
    }, 50);

    return () => {
      clearInterval(timer);
    };
  }, [active, geometry.totalMeters, speedMultiplier]);

  const position = useMemo(
    () => positionAtDistance(geometry, travelledMeters),
    [geometry, travelledMeters]
  );

  const remainingMeters = Math.max(0, geometry.totalMeters - travelledMeters);
  const remainingSeconds = Math.round(remainingMeters / DEFAULT_ROUTE_SPEED_MPS);
  const isFinished =
    geometry.totalMeters > 0 && travelledMeters >= geometry.totalMeters;

  return {
    travelledMeters,
    position,
    bearing: position.bearing,
    remainingMeters,
    remainingSeconds,
    isFinished,
  };
}
