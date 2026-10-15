/**
 * Route progress simulation hook.
 *
 * Advances along the active route's geometry over time using its real average speed
 * derived from distance and duration.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  positionAtDistance,
  type RouteGeometry,
} from "./routeProgress";

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
 * Speed is derived from the active route's distanceMeters and durationSeconds.
 */
export function useRouteSimulation(
  geometry: RouteGeometry,
  active: boolean,
  distanceMeters: number,
  durationSeconds: number,
  speedMultiplier: number = 6
): RouteSimulationState {
  const [travelledMeters, setTravelledMeters] = useState(0);
  const lastTimeRef = useRef<number | null>(null);

  // Derive route speed in m/s: fallback to ~30 km/h (8.33 m/s) if duration is 0
  const routeSpeedMps =
    durationSeconds > 0 && distanceMeters > 0
      ? distanceMeters / durationSeconds
      : 8.33;

  useEffect(() => {
    if (!active) {
      setTravelledMeters(0);
      lastTimeRef.current = null;
      return;
    }

    lastTimeRef.current = Date.now();
    const effectiveSpeed = routeSpeedMps * speedMultiplier;

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
  }, [active, geometry.totalMeters, routeSpeedMps, speedMultiplier]);

  const position = useMemo(
    () => positionAtDistance(geometry, travelledMeters),
    [geometry, travelledMeters]
  );

  const remainingMeters = Math.max(0, geometry.totalMeters - travelledMeters);
  const remainingSeconds = Math.round(remainingMeters / routeSpeedMps);
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
