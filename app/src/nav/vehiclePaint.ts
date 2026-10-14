// Paint for the moving vehicle during navigation.
//
// It is read from the template's own user-puck layers in _overlay.json rather
// than derived from the UI theme tokens. Those puck paints are already tuned
// per template, and reusing them means the moving vehicle looks exactly like
// the stationary puck instead of being a second, separately invented marker.
//
// Deriving it from the theme instead looked reasonable and rendered badly:
// `accentContrast` is the template's background colour, so a core painted with
// it punched a hole in the map, and `accent` in miami-6 is the same cyan as the
// route line, so the vehicle vanished into its own route.

import overlayConfig from "../../assets/templates/_overlay.json";
import type { TemplateKey } from "../style/buildStyle";

type CirclePaint = Record<string, unknown>;

interface OverlayLayer {
  id: string;
  paint?: CirclePaint;
}

function puckPaint(templateKey: TemplateKey, layerId: string): CirclePaint {
  const templates = overlayConfig.templates as Record<
    string,
    { layers: OverlayLayer[] }
  >;
  const layer = templates[templateKey]?.layers.find((l) => l.id === layerId);

  if (!layer?.paint) {
    throw new Error(
      `Overlay layer '${layerId}' is missing for template '${templateKey}'`,
    );
  }

  return layer.paint;
}

export function vehicleHaloPaint(templateKey: TemplateKey): CirclePaint {
  return puckPaint(templateKey, "user-puck-halo");
}

export function vehicleCorePaint(templateKey: TemplateKey): CirclePaint {
  return puckPaint(templateKey, "user-puck-core");
}
