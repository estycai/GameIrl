import type { StyleSpecification, LayerSpecification } from "@maplibre/maplibre-react-native";
import miami6Base from "../../assets/templates/miami-6.json";
import style1899Base from "../../assets/templates/1899.json";
import losAngelesBase from "../../assets/templates/los-angeles.json";
import overlayConfig from "../../assets/templates/_overlay.json";
import contractConfig from "../../assets/templates/_contract.json";

export type TemplateKey = "miami-6" | "1899" | "los-angeles";

export const TEMPLATE_KEYS: readonly TemplateKey[] = [
  "miami-6",
  "1899",
  "los-angeles",
] as const;

const BASE_STYLES: Record<TemplateKey, any> = {
  "miami-6": miami6Base,
  "1899": style1899Base,
  "los-angeles": losAngelesBase,
};

/**
 * Deep-clones plain JSON data.
 *
 * Deliberately NOT structuredClone: React Native 0.86 ships the implementation
 * under src/private/webapis but never installs it as a global, so on Hermes the
 * call is a ReferenceError at first render — and the release build succeeds
 * anyway, which makes it invisible until the APK is installed.
 *
 * A JSON round-trip is also sufficient here by construction: style
 * specifications and GeoJSON are plain JSON, with no Date, Map, Set, undefined
 * or cyclic values to preserve.
 */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Builds a MapLibre style specification by merging the base style with the
 * route GeoJSON source and template-specific overlay layers.
 *
 * Pure function: never mutates imported JSON or arguments.
 */
export function buildStyle(
  templateKey: TemplateKey,
  route: GeoJSON.FeatureCollection
): StyleSpecification {
  const baseStyle = BASE_STYLES[templateKey];
  if (!baseStyle) {
    throw new Error(`Unknown template key: '${templateKey}'`);
  }

  // 1. Deep-clone the base style
  const style = cloneJson(baseStyle) as StyleSpecification;

  // 2. Add the route source under the key "route"
  const overlaySourceConfig = overlayConfig.source;
  if (!style.sources) {
    style.sources = {};
  }
  style.sources["route"] = {
    ...cloneJson(overlaySourceConfig),
    data: route,
  } as any;

  // 3. Take the overlay layers for this template
  const templateOverlay = (overlayConfig.templates as Record<string, { layers: any[] }>)[templateKey];
  if (!templateOverlay || !Array.isArray(templateOverlay.layers)) {
    throw new Error(`Missing overlay layers definition for template: '${templateKey}'`);
  }

  const overlayLayers = cloneJson(templateOverlay.layers) as LayerSpecification[];
  const anchorId = contractConfig.overlayAnchor;

  if (!style.layers || !Array.isArray(style.layers)) {
    throw new Error(`Base style for template '${templateKey}' has no layers`);
  }

  const anchorIndex = style.layers.findIndex((layer) => layer.id === anchorId);
  if (anchorIndex === -1) {
    throw new Error(`Anchor layer '${anchorId}' not found in template '${templateKey}'`);
  }

  // Insert all overlay layers immediately before the anchor layer
  style.layers.splice(anchorIndex, 0, ...overlayLayers);

  return style;
}
