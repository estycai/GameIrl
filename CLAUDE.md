# GameIrl

**Read `SPEC.md` before doing anything in this repo.** It holds the settled
product definition, the technology decisions and why they were made, the map and
POI architecture, the test fixtures, and the known traps that have already cost
time once.

Then read `README.md` for the product overview and the POI construction method.

## Non-negotiables

- Validate every style edit: `npx -p @maplibre/maplibre-gl-style-spec gl-style-validate styles/<name>.json`. Silence means valid. Valid JSON is not a valid style.
- Only ONE zoom-based `interpolate`/`step` per expression. Zoom curve outside, `case` inside each stop.
- `source-layer` values come from the OpenMapTiles list in `SPEC.md`. Never invent one.
- All code, comments, identifiers, UI copy and docs in English.
- Claude orchestrates and reviews; `agy` writes feature code. See `SPEC.md` section 10.
- Every feature passes Android QA by an independent Tester before any push. See `AGENTS.md` and `docs/QA-PROTOCOL.md`.
- Report what you could not verify. Do not claim something works when you did not run it.
