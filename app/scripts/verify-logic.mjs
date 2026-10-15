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
      'src/search/normalize.ts',
      'src/search/photon.ts',
      'src/search/history.ts',
      'src/search/suggestions.ts',
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
  const { normalizeString } =
    require_(join(outDir, 'src', 'search', 'normalize.js'));
  const {
    PHOTON_BIAS,
    buildPhotonUrl,
    mapPhotonResponse,
    localBbox,
    splitHouseNumber,
    sortByDistance,
    rankStreets,
    streetFallbackPlaces,
    fetchPhotonPlaces,
  } = require_(join(outDir, 'src', 'search', 'photon.js'));
  const { HISTORY_MAX, addToHistory, matchHistory, parseHistory } =
    require_(join(outDir, 'src', 'search', 'history.js'));
  const { mergeSuggestions, highlightSegments, SUGGESTION_LIMIT } =
    require_(join(outDir, 'src', 'search', 'suggestions.js'));


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

  // --- photon -------------------------------------------------------------

  console.log('\nphoton');
  const url = buildPhotonUrl('estadio jose');
  check('buildPhotonUrl contains q=estadio%20jose', url.includes('q=estadio%20jose'));
  check('buildPhotonUrl contains both osm_tag exclusions',
    url.includes('osm_tag=!highway:bus_stop') && url.includes('osm_tag=!public_transport'));
  check('buildPhotonUrl contains lat, lon, zoom, location_bias_scale, limit',
    url.includes('lat=-34.6438617') &&
    url.includes('lon=-58.588705') &&
    url.includes('zoom=14') &&
    url.includes('location_bias_scale=0.2') &&
    url.includes('limit=8'));

  const photonEstadioRaw = readFileSync(
    join(APP_DIR, 'scripts', 'fixtures', 'photon-estadio-jose.json'),
    'utf8',
  );
  const estadioPlaces = mapPhotonResponse(JSON.parse(photonEstadioRaw));
  check('mapPhotonResponse on photon-estadio-jose: first place is Estadio José Amalfitani',
    estadioPlaces.length > 0 && estadioPlaces[0].name === 'Estadio José Amalfitani');
  check('mapPhotonResponse on photon-estadio-jose: first place detail includes Liniers',
    estadioPlaces.length > 0 && estadioPlaces[0].detail.includes('Liniers'));
  check('mapPhotonResponse on photon-estadio-jose: first place center is [-58.5206788, -34.6353382]',
    estadioPlaces.length > 0 &&
    estadioPlaces[0].center[0] === -58.5206788 &&
    estadioPlaces[0].center[1] === -34.6353382);
  check('mapPhotonResponse on photon-estadio-jose: ids unique',
    new Set(estadioPlaces.map((p) => p.id)).size === estadioPlaces.length);
  check('mapPhotonResponse on photon-estadio-jose: all centers finite',
    estadioPlaces.every((p) =>
      Array.isArray(p.center) &&
      p.center.length === 2 &&
      Number.isFinite(p.center[0]) &&
      Number.isFinite(p.center[1])));

  const photonRivadavia2197Raw = readFileSync(
    join(APP_DIR, 'scripts', 'fixtures', 'photon-rivadavia-2197.json'),
    'utf8',
  );
  const rivadavia2197Places = mapPhotonResponse(JSON.parse(photonRivadavia2197Raw));
  check('mapPhotonResponse on photon-rivadavia-2197: every place has non-empty name containing Rivadavia 2197',
    rivadavia2197Places.length > 0 &&
    rivadavia2197Places.every((p) => p.name.includes('Rivadavia 2197')));

  const photonRivadRaw = readFileSync(
    join(APP_DIR, 'scripts', 'fixtures', 'photon-rivad.json'),
    'utf8',
  );
  const rivadPlaces = mapPhotonResponse(JSON.parse(photonRivadRaw));
  const rivadKeys = rivadPlaces.map((p) => `${normalizeString(p.name)}|${normalizeString(p.detail)}`);
  check('mapPhotonResponse on photon-rivad: no two places share normalized name|detail',
    new Set(rivadKeys).size === rivadPlaces.length);
  const rawRivadParsed = JSON.parse(photonRivadRaw);
  check('photon-rivad fixture contains no osm bus_stop tag',
    rawRivadParsed.features.every((f) =>
      !(f.properties.osm_key === 'highway' && f.properties.osm_value === 'bus_stop')));

  check('mapPhotonResponse(null) returns []', Array.isArray(mapPhotonResponse(null)) && mapPhotonResponse(null).length === 0);
  check('mapPhotonResponse({}) returns []', Array.isArray(mapPhotonResponse({})) && mapPhotonResponse({}).length === 0);
  check('mapPhotonResponse({features: "x"}) returns []', Array.isArray(mapPhotonResponse({ features: 'x' })) && mapPhotonResponse({ features: 'x' }).length === 0);

  // Task 3 additions
  const expectedOldUrl = 'https://photon.komoot.io/api/?q=estadio%20jose&limit=8&lat=-34.6438617&lon=-58.588705&zoom=14&location_bias_scale=0.2&osm_tag=!highway:bus_stop&osm_tag=!public_transport';
  check('buildPhotonUrl("estadio jose") with no options equals exactly the old URL',
    buildPhotonUrl('estadio jose') === expectedOldUrl);

  const biasHaedo = { lat: -34.6438617, lon: -58.588705 };
  const bboxUrl = buildPhotonUrl('x', biasHaedo, { bbox: localBbox(biasHaedo), layer: 'street' });
  check('buildPhotonUrl with bbox and layer contains formatted bbox and layer=street',
    bboxUrl.includes('bbox=-59.088705,-35.143862,-58.088705,-34.143862') &&
    bboxUrl.includes('&layer=street'));

  check('splitHouseNumber: "edison 3580" -> {street:"edison", number:"3580"}',
    JSON.stringify(splitHouseNumber('edison 3580')) === JSON.stringify({ street: 'edison', number: '3580' }));
  check('splitHouseNumber: "3580" -> null',
    splitHouseNumber('3580') === null);
  check('splitHouseNumber: "estadio jose" -> null',
    splitHouseNumber('estadio jose') === null);
  check('splitHouseNumber: "av rivadavia 14200b" -> {street:"av rivadavia", number:"14200b"}',
    JSON.stringify(splitHouseNumber('av rivadavia 14200b')) === JSON.stringify({ street: 'av rivadavia', number: '14200b' }));

  const photonEdison3580Raw = readFileSync(
    join(APP_DIR, 'scripts', 'fixtures', 'photon-edison-3580-local.json'),
    'utf8',
  );
  const edison3580Places = mapPhotonResponse(JSON.parse(photonEdison3580Raw));
  check('mapPhotonResponse(photon-edison-3580-local.json) is []',
    Array.isArray(edison3580Places) && edison3580Places.length === 0);

  const photonEdisonStreetRaw = readFileSync(
    join(APP_DIR, 'scripts', 'fixtures', 'photon-edison-street-local.json'),
    'utf8',
  );
  const edisonStreetPlaces = mapPhotonResponse(JSON.parse(photonEdisonStreetRaw));
  const edisonRankedStreets = rankStreets(edisonStreetPlaces, 'edison', [-58.588705, -34.6438617]);
  const edisonFallbacks = streetFallbackPlaces(edisonRankedStreets, '3580');

  check('streetFallbackPlaces edison 3580: non-empty',
    edisonFallbacks.length > 0);
  check('streetFallbackPlaces edison 3580: every name ends with " 3580" and contains "Edison"',
    edisonFallbacks.every((p) => p.name.endsWith(' 3580') && p.name.includes('Edison')));
  check('streetFallbackPlaces edison 3580: every detail starts with "Approximate"',
    edisonFallbacks.every((p) => p.detail.startsWith('Approximate')));
  check('streetFallbackPlaces edison 3580: ids unique and end with "#3580"',
    new Set(edisonFallbacks.map((p) => p.id)).size === edisonFallbacks.length &&
    edisonFallbacks.every((p) => p.id.endsWith('#3580')));

  const edisonSortedStreets = sortByDistance(edisonStreetPlaces, [-58.588705, -34.6438617]);
  const dists = edisonSortedStreets.map((p) =>
    haversineDistanceMeters(p.center, [-58.588705, -34.6438617])
  );
  check('sortByDistance: distances from the bias are non-decreasing',
    dists.every((d, i) => i === 0 || d >= dists[i - 1]));
  check('streetFallbackPlaces edison 3580: first one detail includes "Isidro Casanova"',
    edisonFallbacks[0].detail.includes('Isidro Casanova'));

  const rankedEdisonIdx = edisonRankedStreets.findIndex((p) => p.name === 'Edison');
  const rankedTomasIdx = edisonRankedStreets.findIndex((p) => p.name === 'Tomás Alva Edison');
  check('rankStreets on the edison-street fixture puts a place named exactly "Edison" before "Tomás Alva Edison"',
    rankedEdisonIdx !== -1 && rankedTomasIdx !== -1 && rankedEdisonIdx < rankedTomasIdx);

  const edisonStreetPlacesCopy = JSON.stringify(edisonStreetPlaces);
  rankStreets(edisonStreetPlaces, 'edison', [-58.588705, -34.6438617]);
  check('rankStreets does not mutate its input',
    JSON.stringify(edisonStreetPlaces) === edisonStreetPlacesCopy);

  const inputForSort = [
    { id: '1', name: 'Far', detail: '', center: [-58.1, -34.1] },
    { id: '2', name: 'Near', detail: '', center: [-58.58, -34.64] },
  ];
  const inputForSortCopy = JSON.stringify(inputForSort);
  sortByDistance(inputForSort, [-58.588705, -34.6438617]);
  check('sortByDistance does not mutate its input',
    JSON.stringify(inputForSort) === inputForSortCopy);

  // fetchPhotonPlaces orchestration tests
  const originalFetch = globalThis.fetch;
  try {
    let callCount = 0;
    globalThis.fetch = async (url) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('&layer=street')) {
        return {
          ok: true,
          json: async () => JSON.parse(photonEdisonStreetRaw),
        };
      }
      if (urlStr.includes('bbox=')) {
        return {
          ok: true,
          json: async () => JSON.parse(photonEdison3580Raw),
        };
      }
      return {
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { name: 'Edison 3580 France', country: 'France' },
              geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
            },
          ],
        }),
      };
    };

    const res1 = await fetchPhotonPlaces('edison 3580', biasHaedo);
    check('fetchPhotonPlaces fallback: result non-empty',
      res1.length > 0);
    check('fetchPhotonPlaces fallback: first name is "Edison 3580"',
      res1[0].name === 'Edison 3580');
    check('fetchPhotonPlaces fallback: no result is in France',
      res1.every((p) => !p.detail.includes('France') && !p.name.includes('France')));
    check('fetchPhotonPlaces fallback: stub called exactly twice (local + street, no global)',
      callCount === 2);

    let globalCallCount = 0;
    globalThis.fetch = async (url) => {
      globalCallCount++;
      const urlStr = String(url);
      if (urlStr.includes('bbox=')) {
        return {
          ok: true,
          json: async () => ({ type: 'FeatureCollection', features: [] }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { name: 'Global Result', city: 'Paris' },
              geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
            },
          ],
        }),
      };
    };

    const res2 = await fetchPhotonPlaces('some unknown query 12345', biasHaedo);
    check('fetchPhotonPlaces fallback: global result returned when local & street empty',
      res2.length === 1 && res2[0].name === 'Global Result');
    check('fetchPhotonPlaces fallback: stub called 3 times when local empty',
      globalCallCount === 3);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // --- history ------------------------------------------------------------

  console.log('\nhistory');
  const dummyA = { id: 'a', name: 'Place A', detail: 'Detail A', center: [0, 0] };
  const dummyB = { id: 'b', name: 'Place B', detail: 'Detail B', center: [1, 1] };
  const dummyA2 = { id: 'a', name: 'Place A Updated', detail: 'Detail A Updated', center: [0, 0] };

  const initialList = [dummyB, dummyA];
  const initialCopy = JSON.parse(JSON.stringify(initialList));
  const addedList = addToHistory(initialList, dummyA2);
  check('addToHistory dedupes by id and moves to front',
    addedList.length === 2 && addedList[0].id === 'a' && addedList[0].name === 'Place A Updated' && addedList[1].id === 'b');
  check('addToHistory does not mutate input array',
    JSON.stringify(initialList) === JSON.stringify(initialCopy));

  let capList = [];
  for (let i = 0; i < 15; i++) {
    capList = addToHistory(capList, { id: `id-${i}`, name: `Place ${i}`, detail: `Detail ${i}`, center: [0, 0] });
  }
  check('addToHistory caps at HISTORY_MAX', capList.length === HISTORY_MAX && capList[0].id === 'id-14');

  const sampleHistory = [
    { id: '1', name: 'Avenida Rivadavia 14200', detail: 'Ramos Mejia', center: [-58.5, -34.6] },
    { id: '2', name: 'Plaza San Martín', detail: 'Centro', center: [-58.4, -34.5] },
  ];
  check('matchHistory empty query returns all', matchHistory(sampleHistory, '').length === 2);
  check('matchHistory whitespace query returns all', matchHistory(sampleHistory, '   ').length === 2);
  check('matchHistory is accent-insensitive (rivadávia matches Avenida Rivadavia 14200)',
    matchHistory(sampleHistory, 'rivadávia').length === 1 && matchHistory(sampleHistory, 'rivadávia')[0].id === '1');

  check('parseHistory null returns []', parseHistory(null).length === 0);
  check('parseHistory "not json" returns []', parseHistory('not json').length === 0);
  const mixedJson = JSON.stringify([
    { id: 'valid1', name: 'V1', detail: 'D1', center: [1, 2] },
    { id: 'invalid_center', name: 'V2', detail: 'D2', center: [1, '2'] },
    { id: 'missing_prop', name: 'V3', center: [1, 2] },
    'random_string',
    null,
    { id: 'valid2', name: 'V4', detail: 'D4', center: [3, 4] },
  ]);
  const parsedMixed = parseHistory(mixedJson);
  check('parseHistory mixed entries keeps only valid ones',
    parsedMixed.length === 2 && parsedMixed[0].id === 'valid1' && parsedMixed[1].id === 'valid2');

  const roundTripList = [dummyA, dummyB];
  const roundTripResult = parseHistory(JSON.stringify(roundTripList));
  check('parseHistory round-trip JSON.stringify -> parseHistory -> deep-equal',
    JSON.stringify(roundTripResult) === JSON.stringify(roundTripList));

  // --- suggestions --------------------------------------------------------

  console.log('\nsuggestions');
  const h1 = { id: 'h1', name: 'Estadio Amalfitani', detail: 'Liniers', center: [0, 0] };
  const h2 = { id: 'h2', name: 'Rivadavia 14200', detail: 'Ramos Mejia', center: [1, 1] };
  const r1 = { id: 'h1', name: 'Estadio Amalfitani', detail: 'Liniers', center: [0, 0] }; // same id
  const r2 = { id: 'r2', name: 'estadio amalfitani', detail: 'liniers', center: [0, 0] }; // same name|detail diff id
  const r3 = { id: 'r3', name: 'Unique Place 3', detail: 'Detail 3', center: [2, 2] };
  const r4 = { id: 'r4', name: 'Unique Place 4', detail: 'Detail 4', center: [3, 3] };

  const merged = mergeSuggestions([h1, h2], [r1, r2, r3, r4]);
  check('mergeSuggestions never returns more than SUGGESTION_LIMIT (3)', merged.length === 3);
  check('mergeSuggestions history first', merged[0].source === 'history' && merged[0].place.id === 'h1' &&
    merged[1].source === 'history' && merged[1].place.id === 'h2');
  check('mergeSuggestions result with same id as history entry is not duplicated',
    !merged.slice(2).some((s) => s.place.id === 'h1'));
  check('mergeSuggestions result with same normalized name|detail but diff id is not duplicated',
    !merged.slice(2).some((s) => s.place.id === 'r2'));
  check('mergeSuggestions third item is unique result r3',
    merged[2].source === 'result' && merged[2].place.id === 'r3');

  // highlightSegments checks
  const ex1 = highlightSegments('Estadio José Amalfitani', 'estadio jose');
  check('highlightSegments example 1: joins back to original text',
    ex1.map((s) => s.text).join('') === 'Estadio José Amalfitani');
  check('highlightSegments example 1: Estadio and José match true, Amalfitani match false',
    ex1.some((s) => s.text.includes('Estadio') && s.match) &&
    ex1.some((s) => s.text.includes('José') && s.match) &&
    ex1.some((s) => s.text.includes('Amalfitani') && !s.match));

  const ex2 = highlightSegments('Avenida Rivadavia', 'rivad');
  check('highlightSegments example 2: Avenida Rivadavia with rivad',
    ex2.length === 3 &&
    ex2[0].text === 'Avenida ' && !ex2[0].match &&
    ex2[1].text === 'Rivad' && ex2[1].match &&
    ex2[2].text === 'avia' && !ex2[2].match);

  const accentedOriginal = 'Estadio José María Morañós';
  const exAccents = highlightSegments(accentedOriginal, 'jose mar');
  check('highlightSegments re-joins to exact original text for accented string',
    exAccents.map((s) => s.text).join('') === accentedOriginal);

  const exEmpty = highlightSegments('Estadio José Amalfitani', '');
  check('highlightSegments empty query returns one non-match segment',
    exEmpty.length === 1 && exEmpty[0].text === 'Estadio José Amalfitani' && !exEmpty[0].match);

  const exJoseLower = highlightSegments('José', 'jose');
  const exJoseUpper = highlightSegments('José', 'JOSÉ');
  check('highlightSegments José is matched by query jose AND by query JOSÉ',
    exJoseLower.length === 1 && exJoseLower[0].match &&
    exJoseUpper.length === 1 && exJoseUpper[0].match);


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
