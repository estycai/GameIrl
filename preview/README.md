# Style Preview Harness

Throwaway dev tool for designing the three GameIrl map templates at real phone dimensions (390x844px).

## Run

From the repo root:

```bash
npx serve . -l 4173
```

Then open <http://localhost:4173/preview/>.

Must be served over HTTP. Opening `index.html` from `file://` fails — the browser blocks the `fetch()` of `../styles/*.json` and `../data/*.geojson`.

## Controls & Features

- **Templates**: Swap live between Miami 6 (neon synthwave), 1899 (aged parchment), and Los Angeles (modern sprawl). Camera orientation is preserved across transitions.
- **Camera Modes**:
  - `Browse`: Default top-down view centered on Buenos Aires (`[-58.5887, -34.6439]`, zoom 13, pitch 0).
  - `Preview`: A-to-B route overview fitting the entire driving route bounding box with comfortable padding inside the 390px frame.
  - `Nav`: 3D driving view (pitch 60, zoom 17) at the origin facing down the route's initial trajectory.
- **Route & Puck**: The demo driving route, origin/destination pins, and user pucks are styled natively inside each template JSON.
- **POI Inspector**: Click "Scan POIs" to query loaded OpenMapTiles features in the viewport (`poi` layer, zoom >= 11) grouped by `class / subclass` frequency.
- **Telemetry Readout**: Real-time zoom level, longitude, and latitude updates during camera movement.

## Validate styles before trusting them

```bash
npx -p @maplibre/maplibre-gl-style-spec gl-style-validate styles/miami-6.json
```

Run it on all three after any style edit. Silence means valid HERE — this is a
MapLibre GL JS linter, NOT a device-portability gate. A style can validate, render
in the browser, and drop the layer entirely on MapLibre Native. See `SPEC.md` 6b.

Known trap: MapLibre allows only ONE zoom-based `interpolate`/`step` per
expression. Put the zoom curve on the OUTSIDE and the per-feature `case` inside
each stop, never the reverse.
