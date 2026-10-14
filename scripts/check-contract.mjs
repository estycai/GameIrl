import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const contractPath = resolve(rootDir, 'styles/_contract.json');
const overlayPath = resolve(rootDir, 'styles/_overlay.json');

if (!existsSync(contractPath)) {
  console.error(`Contract file not found at: ${contractPath}`);
  process.exit(1);
}

if (!existsSync(overlayPath)) {
  console.error(`Overlay file not found at: ${overlayPath}`);
  process.exit(1);
}

const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));

const stylesToCheck = ['miami-6', '1899', 'los-angeles'];
let totalFailures = 0;

// Verify _overlay.json defines all six layers for all three templates
const overlayTemplates = overlay.templates || {};
for (const styleKey of stylesToCheck) {
  const templateConfig = overlayTemplates[styleKey];
  if (!templateConfig || !Array.isArray(templateConfig.layers)) {
    console.error(`_overlay.json: Missing template configuration for "${styleKey}"`);
    totalFailures++;
    continue;
  }
  const definedLayerIds = new Set(templateConfig.layers.map(l => l.id));
  for (const expectedLayer of contract.overlayLayers) {
    if (!definedLayerIds.has(expectedLayer)) {
      console.error(`_overlay.json: Template "${styleKey}" is missing overlay layer "${expectedLayer}"`);
      totalFailures++;
    }
  }
}

// Verify each of the three style files
for (const styleKey of stylesToCheck) {
  const styleFilePath = resolve(rootDir, `styles/${styleKey}.json`);
  if (!existsSync(styleFilePath)) {
    console.error(`${styleKey}: File not found: ${styleFilePath}`);
    totalFailures++;
    continue;
  }

  const style = JSON.parse(readFileSync(styleFilePath, 'utf8'));
  const styleSources = style.sources || {};
  const styleLayers = style.layers || [];
  const layerIds = new Set(styleLayers.map(l => l.id));
  const styleFailures = [];

  // 1. Every requiredSources entry exists
  for (const src of contract.requiredSources) {
    if (!styleSources[src]) {
      styleFailures.push(`missing required source: "${src}"`);
    }
  }

  // 2. Every requiredLayers id exists
  for (const reqLayer of contract.requiredLayers) {
    if (!layerIds.has(reqLayer)) {
      styleFailures.push(`missing required layer: "${reqLayer}"`);
    }
  }

  // 3. overlayAnchor exists
  if (!layerIds.has(contract.overlayAnchor)) {
    styleFailures.push(`missing overlayAnchor layer: "${contract.overlayAnchor}"`);
  }

  // 4. None of the overlayLayers are still baked into the style file
  for (const overlayLayer of contract.overlayLayers) {
    if (layerIds.has(overlayLayer)) {
      styleFailures.push(`unexpectedly contains overlay layer: "${overlayLayer}"`);
    }
  }

  // Also verify route source is not present in the style
  if (styleSources.route) {
    styleFailures.push(`unexpectedly contains "route" source`);
  }

  if (styleFailures.length === 0) {
    console.log(`${styleKey}: OK (all required sources, layers, and anchor verified; 0 overlay leaks)`);
  } else {
    totalFailures += styleFailures.length;
    console.error(`${styleKey}: FAILED - ${styleFailures.join('; ')}`);
  }
}

if (totalFailures > 0) {
  console.error(`Contract check failed with ${totalFailures} error(s).`);
  process.exit(1);
} else {
  console.log(`Contract check passed cleanly for all templates.`);
  process.exit(0);
}
