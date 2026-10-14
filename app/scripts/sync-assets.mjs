// Copies the platform-independent style assets from the repo root into the app
// bundle. The repo root is the single source of truth; app/assets/templates is
// generated output and is gitignored.
//
// Metro only resolves modules under the project root, and cross-root resolution
// behaves differently between the dev server and the Gradle release bundle. A
// copy keeps the bundler configuration stock.
//
// route-demo.geojson is copied as .json because Metro's JSON transformer keys
// on the .json extension; a .geojson import would be parsed as JavaScript.

import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(APP_DIR, '..');
const OUT_DIR = join(APP_DIR, 'assets', 'templates');

// [source, destination, required]. Every asset is required; the flag stays so
// a newly authored asset can be staged before it is wired up.
const ASSETS = [
  ['styles/miami-6.json', 'miami-6.json', true],
  ['styles/1899.json', '1899.json', true],
  ['styles/los-angeles.json', 'los-angeles.json', true],
  ['styles/_overlay.json', '_overlay.json', true],
  ['styles/_contract.json', '_contract.json', true],
  ['data/route-demo.geojson', 'route-demo.json', true],
  ['styles/miami-6.ui.json', 'miami-6.ui.json', true],
  ['styles/1899.ui.json', '1899.ui.json', true],
  ['styles/los-angeles.ui.json', 'los-angeles.ui.json', true],
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const [from, to, required] of ASSETS) {
    const src = join(REPO_ROOT, from);

    let raw;
    try {
      raw = await readFile(src, 'utf8');
    } catch (error) {
      if (!required && error.code === 'ENOENT') {
        console.warn(`sync-assets: ${from} not present yet, skipped`);
        continue;
      }
      throw error;
    }

    // Parsing proves the asset is at least well-formed JSON before it reaches
    // the bundle. A malformed style fails here instead of at app launch.
    try {
      JSON.parse(raw);
    } catch (error) {
      console.error(`sync-assets: ${from} is not valid JSON — ${error.message}`);
      process.exit(1);
    }

    await copyFile(src, join(OUT_DIR, to));
    console.log(`sync-assets: ${from} -> assets/templates/${to}`);
  }
}

main().catch((error) => {
  console.error(`sync-assets: ${error.message}`);
  process.exit(1);
});
