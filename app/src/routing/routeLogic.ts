import type { Place } from "../search/places";

export interface RouteEndpoints {
  origin: [number, number];
  destination: [number, number];
}

export type RouteFetchState =
  | { status: "idle" }
  | { status: "waiting_location"; message: string }
  | { status: "ready"; endpoints: RouteEndpoints };

/**
 * Determines route calculation state and endpoints from user location, destination place, and swap state.
 * Returns:
 * - { status: "idle" } if destination is null
 * - { status: "waiting_location", message: "Waiting for your location" } if userLoc is null
 * - { status: "ready", endpoints: { origin, destination } } with correctly ordered coordinates
 */
export function resolveRouteState(
  destPlace: Place | null,
  isSwapped: boolean,
  userLoc: [number, number] | null
): RouteFetchState {
  if (!destPlace) {
    return { status: "idle" };
  }
  if (!userLoc) {
    return { status: "waiting_location", message: "Waiting for your location" };
  }

  const origin: [number, number] = isSwapped ? destPlace.center : userLoc;
  const destination: [number, number] = isSwapped ? userLoc : destPlace.center;

  return {
    status: "ready",
    endpoints: { origin, destination },
  };
}

/**
 * Pure check to determine if a response should be ignored based on request ID tracking.
 */
export function isRequestCurrent(
  requestId: number,
  currentRequestId: number
): boolean {
  return requestId === currentRequestId;
}
