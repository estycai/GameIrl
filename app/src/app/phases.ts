import type { CameraMode } from "../camera/cameraModes";

export type AppPhase = "browse" | "preview" | "nav";

/**
 * Maps the high-level application user phase to the low-level camera viewport mode.
 * Keep the two types distinct: a phase represents user intent; a camera mode represents camera positioning.
 */
export function cameraModeForPhase(phase: AppPhase): CameraMode {
  switch (phase) {
    case "browse":
      return "browse";
    case "preview":
      return "preview";
    case "nav":
      return "nav";
  }
}
