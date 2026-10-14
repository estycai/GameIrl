// Verifies the shell's pure logic without a device.
//
// Everything checked here compiles cleanly and builds a working APK even when
// it is wrong, and most of it cannot be judged from a screenshot either: a
// bearing that is 180 degrees off still renders a plausible-looking map, and an
// overlay spliced at the wrong index still draws.
//
// The real TypeScript is compiled and executed — nothing is reimplemented here,
// because a reimplementation tests itself rather than the shipped code.
//
// Run with `npm run verify`. Pair it with the style validator:
//   npx -p @maplibre/maplibre-gl-style-spec gl-style-validate <merged style>
// The merged styles are written to the temp dir this script reports.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(APP_DIR, '..');

let failures = 0;
const check = (name, ok, detail) => {
  const line = `  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`;
  if (ok) console.log(line);
  else {
    console.error(line);
    failures++;
  }
};

// --- Compile the real sources ---------------------------------------------

const outDir = mkdtempSync(join(tmpdir(), 'gameirl-verify-'));

// The TypeScript compiler is invoked through node with its own entry point
// rather than through npx: npx resolves to a .cmd on Windows, which Node 22
// refuses to spawn without a shell, and adding a shell reintroduces quoting
// problems on a repo path that contains spaces.
const TSC = join(APP_DIR, 'node_modules', 'typescript', 'bin', 'tsc');

function compile(...entries) {
  execFileSync(
    process.execPath,
    [
      TSC, '--ignoreConfig', ...entries,
      '--outDir', outDir, '--rootDir', '.',
      '--module', 'commonjs', '--target', 'es2022',
      '--moduleResolution', 'node', '--resolveJsonModule',
      '--esModuleInterop', '--skipLibCheck',
    ],
    { cwd: APP_DIR, stdio: 'pipe' },
  );
}

try {
  // tsc exits non-zero on the moduleResolution deprecation notice while still
  // emitting, so a throw here is only fatal if the output is missing.
  try {
    compile(
      'src/style/buildStyle.ts',
      'src/camera/cameraModes.ts',
      'src/nav/routeProgress.ts',
      'src/search/places.ts',
    );
  } catch (error) {
    const text = String(error.stdout ?? '') + String(error.stderr ?? '');
    if (!/TS5107/.test(text)) throw error;
  }

  const require_ = createRequire(import.meta.url);
  const { buildStyle, TEMPLATE_KEYS } =
    require_(join(outDir, 'src', 'style', 'buildStyle.js'));
  const {
    getCameraStop, getNavBearing, getRouteOrigin, computeBearing,
    haversineDistanceMeters, CAMERA_MODES,
  } = require_(join(outDir, 'src', 'camera', 'cameraModes.js'));
  const { routeBounds } = require_(join(outDir, 'src', 'style', 'routeBounds.js'));
  const { buildRouteGeometry, positionAtDistance } =
    require_(join(outDir, 'src', 'nav', 'routeProgress.js'));
  const { PLACES, searchPlaces } =
    require_(join(outDir, 'src', 'search', 'places.js'));

  const route = JSON.parse(
    readFileSync(join(REPO_ROOT, 'data', 'route-demo.geojson'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(REPO_ROOT, 'styles', '_contract.json'), 'utf8'),
  );

  const line = route.features.find((f) => f.properties.kind === 'route');
  const origin = route.features.find((f) => f.properties.kind === 'origin');
  const dest = route.features.find((f) => f.properties.kind === 'destination');

  // --- buildStyle ---------------------------------------------------------

  console.log('buildStyle');
  for (const key of TEMPLATE_KEYS) {
    const style = buildStyle(key, route);
    const ids = style.layers.map((l) => l.id);
    const anchorIndex = ids.indexOf(contract.overlayAnchor);

    check(`${key}: route source carries the real data`,
      style.sources.route?.data?.features?.length === route.features.length);

    check(`${key}: anchor '${contract.overlayAnchor}' present`, anchorIndex !== -1);

    const expected = contract.overlayLayers;
    check(`${key}: overlay sits immediately before the anchor`,
      ids.slice(anchorIndex - expected.length, anchorIndex).join(',') ===
        expected.join(','));

    check(`${key}: every layer resolves to a declared source`,
      style.layers.every((l) => !l.source || style.sources[l.source]));

    check(`${key}: no duplicate layer ids`,
      new Set(ids).size === ids.length);

    // Purity: the imported JSON module is shared across calls, so a mutation
    // would corrupt every later build.
    check(`${key}: building twice does not accumulate layers`,
      buildStyle(key, route).layers.length === style.layers.length);
    style.layers.push({ id: 'mutation-probe', type: 'background' });
    check(`${key}: mutating a result does not leak into the base module`,
      !buildStyle(key, route).layers.some((l) => l.id === 'mutation-probe'));
    style.layers.pop();

    const merged = join(outDir, `${key}.merged.json`);
    writeFileSync(merged, JSON.stringify(style, null, 2));
  }

  check('a missing anchor throws rather than appending silently', (() => {
    try {
      buildStyle('no-such-template', route);
      return false;
    } catch {
      return true;
    }
  })());

  // --- routeBounds --------------------------------------------------------

  console.log('\nrouteBounds');
  const [w, s, e, n] = routeBounds(route);
  check('west <= east and south <= north', w <= e && s <= n,
    `[${w}, ${s}, ${e}, ${n}]`);
  check('contains both endpoints',
    [origin, dest].every(({ geometry: { coordinates: [lng, lat] } }) =>
      lng >= w && lng <= e && lat >= s && lat <= n));
  check('contains every line coordinate',
    line.geometry.coordinates.every(([lng, lat]) =>
      lng >= w && lng <= e && lat >= s && lat <= n));

  // --- bearing ------------------------------------------------------------

  console.log('\ncomputeBearing');
  check('due north is 0', Math.abs(computeBearing([0, 0], [0, 1])) < 1e-9);
  check('due east is 90', Math.abs(computeBearing([0, 0], [1, 0]) - 90) < 1e-9);
  check('due south is 180', Math.abs(computeBearing([0, 0], [0, -1]) - 180) < 1e-9);
  check('due west is 270', Math.abs(computeBearing([0, 0], [-1, 0]) - 270) < 1e-9);

  console.log('\nhaversineDistanceMeters');
  const summed = line.geometry.coordinates.reduce(
    (acc, c, i, arr) => (i === 0 ? 0 : acc + haversineDistanceMeters(arr[i - 1], c)),
    0,
  );
  check('summed segments are within 2% of the declared distance',
    Math.abs(summed - line.properties.distance_m) / line.properties.distance_m < 0.02,
    `${Math.round(summed)} m vs ${line.properties.distance_m} m declared`);

  console.log('\ngetNavBearing');
  const bearing = getNavBearing(route);
  check('is finite and within [0, 360)',
    Number.isFinite(bearing) && bearing >= 0 && bearing < 360,
    `${bearing.toFixed(1)} deg`);
  const eastbound = dest.geometry.coordinates[0] > origin.geometry.coordinates[0];
  check('heads the same way the route runs',
    eastbound ? bearing > 0 && bearing < 180 : bearing > 180 && bearing < 360,
    `${bearing.toFixed(1)} deg`);
  check('is a local heading, not the straight line between endpoints',
    Math.abs(bearing -
      computeBearing(origin.geometry.coordinates, dest.geometry.coordinates)) > 1e-9);

  console.log('\ngetRouteOrigin');
  const o = getRouteOrigin(route);
  check('matches the origin feature',
    o[0] === origin.geometry.coordinates[0] &&
    o[1] === origin.geometry.coordinates[1], `[${o}]`);

  // --- camera modes -------------------------------------------------------

  console.log('\ngetCameraStop');
  for (const mode of CAMERA_MODES) {
    const stop = getCameraStop(mode, route);
    // 60 is MapLibre Native's ceiling, not a value to tune upward.
    check(`${mode}: 0 <= pitch <= 60`,
      stop.pitch >= 0 && stop.pitch <= 60, `pitch ${stop.pitch}`);
    check(`${mode}: center and bounds are mutually exclusive`,
      (stop.center !== undefined) !== (stop.bounds !== undefined));
  }
  const browse = getCameraStop('browse', route);
  const preview = getCameraStop('preview', route);
  const nav = getCameraStop('nav', route);
  check('browse is flat at zoom 13', browse.pitch === 0 && browse.zoom === 13);
  check('preview fits bounds with padding',
    preview.bounds !== undefined && preview.padding !== undefined);
  check('nav is pitch 60, zoom 17, bearing down the route',
    nav.pitch === 60 && nav.zoom === 17 && nav.bearing === bearing);

  // --- route progress -----------------------------------------------------

  console.log('\nbuildRouteGeometry');
  const geom = buildRouteGeometry(route);
  check('one cumulative entry per coordinate',
    geom.cumulative.length === geom.coordinates.length,
    `${geom.cumulative.length} vs ${geom.coordinates.length}`);
  check('cumulative starts at zero', geom.cumulative[0] === 0);
  check('cumulative is monotonically non-decreasing',
    geom.cumulative.every((v, i) => i === 0 || v >= geom.cumulative[i - 1]));
  check('totalMeters equals the last cumulative entry',
    geom.totalMeters === geom.cumulative[geom.cumulative.length - 1]);
  check('totalMeters is within 2% of the declared distance',
    Math.abs(geom.totalMeters - line.properties.distance_m) /
      line.properties.distance_m < 0.02,
    `${Math.round(geom.totalMeters)} m vs ${line.properties.distance_m} m`);

  console.log('\npositionAtDistance');
  const atStart = positionAtDistance(geom, 0);
  const atEnd = positionAtDistance(geom, geom.totalMeters);
  const first = geom.coordinates[0];
  const last = geom.coordinates[geom.coordinates.length - 1];
  check('distance 0 is the first coordinate',
    atStart.center[0] === first[0] && atStart.center[1] === first[1]);
  check('the full distance is the last coordinate',
    atEnd.center[0] === last[0] && atEnd.center[1] === last[1]);

  const clampLow = positionAtDistance(geom, -5000);
  const clampHigh = positionAtDistance(geom, geom.totalMeters * 10);
  check('negative distance clamps to the start',
    clampLow.center[0] === first[0] && clampLow.center[1] === first[1]);
  check('overshooting clamps to the end',
    clampHigh.center[0] === last[0] && clampHigh.center[1] === last[1]);

  // Walking the route must move forward monotonically and stay on the map.
  let previous = 0;
  let monotonic = true;
  let insideBbox = true;
  let bearingsFinite = true;
  for (let m = 0; m <= geom.totalMeters; m += geom.totalMeters / 60) {
    const p = positionAtDistance(geom, m);
    const travelled = haversineDistanceMeters(first, p.center);
    if (travelled + 1e-6 < previous - 500) monotonic = false;
    previous = travelled;
    const [lng, lat] = p.center;
    if (lng < w || lng > e || lat < s || lat > n) insideBbox = false;
    if (!Number.isFinite(p.bearing) || p.bearing < 0 || p.bearing >= 360) {
      bearingsFinite = false;
    }
  }
  check('sampling the whole route never jumps backwards', monotonic);
  check('every sampled position stays inside the route bbox', insideBbox);
  check('every sampled bearing is finite and within [0, 360)', bearingsFinite);

  // Interpolation must actually interpolate, not snap to vertices.
  const mid = positionAtDistance(geom, geom.totalMeters / 2);
  check('the midpoint is strictly between the endpoints',
    (mid.center[0] !== first[0] || mid.center[1] !== first[1]) &&
    (mid.center[0] !== last[0] || mid.center[1] !== last[1]));

  // --- search -------------------------------------------------------------

  console.log('\nsearchPlaces');
  check('an empty query returns every fixture',
    searchPlaces('').length === PLACES.length);
  check('whitespace is treated as empty',
    searchPlaces('   ').length === PLACES.length);
  check('matching is case-insensitive',
    searchPlaces('HOSPITAL').length === searchPlaces('hospital').length &&
    searchPlaces('HOSPITAL').length > 0);
  check('matching is accent-insensitive',
    searchPlaces('Rivadávia').some((p) => p.id === 'route-destination'));
  check('the detail line is searched too',
    searchPlaces('terminal').some((p) => p.id === 'station'));
  check('a query that matches nothing returns nothing',
    searchPlaces('zzzzzzzz').length === 0);
  check('fixture ids are unique',
    new Set(PLACES.map((p) => p.id)).size === PLACES.length);
  check('every fixture sits inside the route bbox',
    PLACES.every(({ center: [lng, lat] }) =>
      lng >= w && lng <= e && lat >= s && lat <= n));
  check('the first fixture is the demo route\'s real destination',
    PLACES[0].center[0] === dest.geometry.coordinates[0] &&
    PLACES[0].center[1] === dest.geometry.coordinates[1]);

  console.log(`\nMerged styles written to ${outDir}`);
  console.log('Validate them with:');
  for (const key of TEMPLATE_KEYS) {
    console.log(`  npx -p @maplibre/maplibre-gl-style-spec gl-style-validate "${join(outDir, `${key}.merged.json`)}"`);
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll logic checks passed.');
} catch (error) {
  console.error(`verify-logic: ${error.message}`);
  rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}
