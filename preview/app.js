const ROUTE_DATA_URL = '../data/route-demo.geojson';

const INITIAL_CENTER = [-58.5887050, -34.6438617];
const INITIAL_ZOOM = 13;

const readoutZoom = document.getElementById('readout-zoom');
const readoutLng = document.getElementById('readout-lng');
const readoutLat = document.getElementById('readout-lat');
const templateButtons = document.querySelectorAll('.theme-btn');
const camButtons = document.querySelectorAll('.cam-btn');
const btnScanPoi = document.getElementById('btn-scan-poi');
const poiResults = document.getElementById('poi-results');

let currentCameraMode = 'browse';
let currentTemplateKey = 'miami-6';
let routeGeoJson = null;
let overlayConfig = null;
let contractConfig = null;
// Incremented on every switchTheme call so slow fetches from superseded switches
// cannot apply their overlay on top of a newer template.
let switchToken = 0;

const map = new maplibregl.Map({
  container: 'map',
  center: INITIAL_CENTER,
  zoom: INITIAL_ZOOM,
  attributionControl: true
});

function calculateBearing(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const deltaLambda = (lon2 - lon1) * rad;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (theta * 180 / Math.PI + 360) % 360;
}

function getRouteBoundsAndCoords() {
  if (!routeGeoJson) return null;
  const routeFeature = routeGeoJson.features.find(f => f.properties && f.properties.kind === 'route');
  const originFeature = routeGeoJson.features.find(f => f.properties && f.properties.kind === 'origin');
  if (!routeFeature || !routeFeature.geometry) return null;

  const coords = routeFeature.geometry.coordinates;
  const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
  coords.forEach(coord => bounds.extend(coord));

  return {
    coords,
    bounds,
    originCoord: originFeature ? originFeature.geometry.coordinates : coords[0]
  };
}

function applyCameraMode(mode, animate = true) {
  currentCameraMode = mode;
  camButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const routeData = getRouteBoundsAndCoords();

  if (mode === 'browse') {
    const target = {
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      pitch: 0,
      bearing: 0
    };
    if (animate) map.easeTo(target);
    else map.jumpTo(target);
  } else if (mode === 'preview') {
    if (routeData && routeData.bounds) {
      map.fitBounds(routeData.bounds, {
        padding: { top: 80, bottom: 40, left: 40, right: 40 },
        pitch: 0,
        bearing: 0,
        animate: animate
      });
    }
  } else if (mode === 'nav') {
    if (routeData && routeData.coords && routeData.coords.length >= 2) {
      const p1 = routeData.coords[0];
      const p2 = routeData.coords[1];
      const bearing = calculateBearing(p1, p2);
      const target = {
        center: routeData.originCoord,
        zoom: 17,
        pitch: 60,
        bearing: bearing
      };
      if (animate) map.easeTo(target);
      else map.jumpTo(target);
    }
  }
}

function updateReadout() {
  const center = map.getCenter();
  const zoom = map.getZoom();
  readoutZoom.textContent = zoom.toFixed(2);
  readoutLng.textContent = center.lng.toFixed(4);
  readoutLat.textContent = center.lat.toFixed(4);
}

map.on('move', updateReadout);
updateReadout();

function applyOverlay(templateKey) {
  if (!overlayConfig || !overlayConfig.templates) {
    console.error('Cannot apply overlay: overlay config not loaded');
    return;
  }

  const templateOverlay = overlayConfig.templates[templateKey];
  if (!templateOverlay || !templateOverlay.layers) {
    console.error(`Cannot apply overlay: template "${templateKey}" not found in overlay config`);
    return;
  }

  // 1. Add route source if missing
  if (!map.getSource('route')) {
    map.addSource('route', {
      type: 'geojson',
      data: ROUTE_DATA_URL
    });
  }

  // 2. Determine anchor layer
  const anchorId = contractConfig && contractConfig.overlayAnchor ? contractConfig.overlayAnchor : 'poi-circle';
  const beforeId = map.getLayer(anchorId) ? anchorId : undefined;

  // 3. Add that template's overlay layers
  templateOverlay.layers.forEach(layerDef => {
    if (map.getLayer(layerDef.id)) {
      map.removeLayer(layerDef.id);
    }
    map.addLayer(layerDef, beforeId);
  });
}

function switchTheme(styleKey) {
  currentTemplateKey = styleKey;
  const token = ++switchToken;
  const stylePath = `../styles/${styleKey}.json`;

  fetch(stylePath)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error status ${res.status}`);
      return res.json();
    })
    .then(styleJson => {
      // A newer switch started while this style was being fetched — abandon this one.
      if (token !== switchToken) return;

      const camera = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      };

      const onStyleLoad = () => {
        if (token !== switchToken) return;
        applyOverlay(styleKey);
        map.jumpTo(camera);
        updateReadout();
      };

      // Register BEFORE setStyle. Given an already-parsed style object MapLibre can
      // emit style.load synchronously, so a listener attached afterwards misses the
      // event and fires on the NEXT switch instead — applying the previous
      // template's overlay over the new basemap.
      map.once('style.load', onStyleLoad);
      map.setStyle(styleJson);
    })
    .catch(err => {
      console.error('Failed to load style:', err);
    });
}

// Startup: load configs, route data, then set initial style through the exact same path
Promise.all([
  fetch('../styles/_contract.json').then(res => res.json()),
  fetch('../styles/_overlay.json').then(res => res.json()),
  fetch(ROUTE_DATA_URL).then(res => res.json())
])
  .then(([contractData, overlayData, routeData]) => {
    contractConfig = contractData;
    overlayConfig = overlayData;
    routeGeoJson = routeData;

    // Load initial map style
    switchTheme(currentTemplateKey);
  })
  .catch(err => {
    console.error('Failed to initialize preview harness configs:', err);
  });

templateButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const styleKey = btn.dataset.style;
    templateButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    switchTheme(styleKey);
  });
});

camButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    applyCameraMode(btn.dataset.mode, true);
  });
});

function scanPois() {
  if (map.getZoom() < 11) {
    poiResults.innerHTML = '<div style="color:#f59e0b;">No POIs loaded - zoom to 11 or higher</div>';
    return;
  }

  const features = map.querySourceFeatures('openmaptiles', { sourceLayer: 'poi' });

  if (!features || features.length === 0) {
    poiResults.innerHTML = '<div style="color:#f59e0b;">No POIs loaded - zoom to 11 or higher</div>';
    return;
  }

  const counts = {};
  features.forEach(f => {
    const p = f.properties || {};
    const cls = p.class || 'unknown';
    const subcls = p.subclass || 'none';
    const key = `${cls} / ${subcls}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  let html = '';
  sorted.forEach(([key, count]) => {
    html += `
      <div class="poi-item">
        <span class="poi-key" title="${key}">${key}</span>
        <span class="poi-count">${count}</span>
      </div>
    `;
  });

  poiResults.innerHTML = html;
}

btnScanPoi.addEventListener('click', scanPois);
map.on('idle', () => {
  // Can be refreshed when user interacts or clicks scan
});
