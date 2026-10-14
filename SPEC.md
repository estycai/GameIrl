# GameIrl — Global Specification

Authoritative context for any agent working on this project. Read this before
writing code, especially before building the mobile app or producing APKs.

Decisions here are settled. Do not relitigate them. If a decision looks wrong,
say so and stop — do not quietly substitute an alternative.

---

## 1. Product

GameIrl re-skins real-world navigation as video-game cartography. The user sees
their actual city and actual streets, rendered as if it were a map from a game.

Three templates ship first:

| Key | Folder prefix | Aesthetic |
| --- | --- | --- |
| `miami-6` | `miami` | Neon and pastel over a dark base |
| `1899` | `1899` | Aged parchment, western, sepia ink, zero saturated color |
| `los-angeles` | `los_angeles` | Muted modern sprawl, warm greys, olive parks |

**Inspired by, not copied from.** No third-party names, logos, trade dress, or
assets. This is a hard product constraint, not a preference — App Store review
and DMCA risk both ride on it.

## 2. Platforms

**Strict order. Do not reorder, and do not start a car-screen task early.**

1. **Phase 1 — iOS and Android phone apps.** Both shipped and working.
2. **Phase 2 — CarPlay and Android Auto.** Starts only once Phase 1 is finished.

This sequencing is a direct instruction from the project owner, not a suggestion.
Any proposal that pulls car-screen work into Phase 1 is out of scope.

### Build and signing requirements

| Target | Path | Cost |
| --- | --- | --- |
| Android APK | EAS Build produces an installable APK, sideload it | Free |
| iOS on a physical device, from Windows | EAS Build compiles in the cloud | **USD 99/yr Apple Developer** |
| iOS on a physical device, with a Mac | Xcode + free Personal Team | Free, but the profile **expires every 7 days** and max 3 apps per device |
| iOS Simulator | Requires a Mac | Free |

MapLibre is native code, so **Expo Go does not work**. A development build with the
`@maplibre/maplibre-react-native` config plugin is required from day one.

**CarPlay requires a paid Apple Developer membership.** The free Personal Team
explicitly excludes it, alongside HealthKit and DeviceCheck. Phase 2 cannot begin
on a free account — but by then the phone apps exist to justify the spend.

### CarPlay constraint — read before planning any car feature

Apple's CarPlay navigation entitlement is `com.apple.developer.carplay-maps`. It
is requested manually and granted on review against fixed criteria:

- The app MUST provide real turn-by-turn route guidance
- The app MUST immediately terminate guidance when the vehicle's built-in
  navigation takes over
- On the car screen, the app MUST NOT display locations other than parking

Consequence: **a themed map viewer can never get CarPlay.** Only a real navigator
can. Any roadmap that treats CarPlay as a later add-on to a viewer is wrong.

## 3. Technology

| Layer | Choice | Why — do not re-evaluate |
| --- | --- | --- |
| Renderer | MapLibre Native | Fork of Mapbox GL JS v1, same rendering core, fully open style spec |
| Template format | MapLibre Style JSON | A template IS a style file — custom glyphs, sprites, `fill-pattern` |
| Tiles (now) | OpenFreeMap, OpenMapTiles schema | Keyless, free, works today |
| Tiles (later) | Protomaps / PMTiles, self-hosted | Single file, offline, no per-load billing |
| App shell | React Native (Expo) + MapLibre RN v11 | One codebase, iOS + Android |
| Car screens | `react-native-carplay` | Covers CarPlay and Android Auto |
| Style authoring | Maputnik + MapLibre GL JS | Browser iteration in seconds |

**Why not MapKit or Google Maps**: neither accepts custom fonts, custom sprite
sheets, or texture fills. The themed look this product exists for is impossible
with either. **Why not Mapbox**: same visual ceiling, but bills per map load,
which does not survive a low-priced consumer app.

**Tile cost is a business decision, not a technical one.** A navigation app keeps
the map open for the whole drive. Per-load pricing destroys the margin.
Self-hosted PMTiles on object storage with free egress makes marginal cost per
user approximately zero.

## 4. Map architecture

### A template is two files

```
styles/{key}.json       how the MAP looks       (MapLibre style)
styles/{key}.ui.json    how the UI ON TOP looks (fonts, cards, buttons, colors)
```

UI chrome — ETA card, locate button, route preview panel — is **not** map style.
It is app UI. But it must be themed per template: a white Helvetica card floating
over the 1899 parchment destroys the template. The RN shell loads both files.

### Sources inside every style

```json
"openmaptiles": { "type": "vector", "url": "https://tiles.openfreemap.org/planet" }
"route":        { "type": "geojson", "data": "../data/route-demo.geojson" }
```

Route, endpoints and user puck are layers **inside each style JSON**, not added
from app code. Each template defines its own route appearance, and the layers
survive `setStyle()` with no re-adding logic.

Route-source layers present in all three styles:
`route-casing`, `route-line`, `route-endpoint-circle`, `route-endpoint-label`,
`user-puck-halo`, `user-puck-core`.

### Tile schema — OpenMapTiles

Valid `source-layer` values only: `water`, `waterway`, `landcover`, `landuse`,
`park`, `building`, `transportation`, `transportation_name`, `place`,
`water_name`, `boundary`, `aeroway`, `housenumber`, `poi`, `mountain_peak`,
`aerodrome_label`. Never invent layer names.

Source `maxzoom` is 14 — rely on overzoom above that. The `poi` layer has
`minzoom: 11`, so POIs are a close-up concern only.

Glyphs: `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`. Available
stacks are `Noto Sans Regular`, `Noto Sans Bold`, `Noto Sans Italic` — these are
placeholders until custom SDF fonts are built.

### Camera modes

| Mode | Camera | What it validates |
| --- | --- | --- |
| Browse | pitch 0, z13 | Exploring the map |
| Preview | pitch 0, `fitBounds` on route | Whole A-to-B route fits the frame; thin route line contrast |
| Nav | pitch 60, z17, bearing down the route | The real driving screen |

Styles must be judged in **Nav**, not Browse. A nav app is used pitched and zoomed
in. A style approved flat at z13 is a style approved in the view nobody uses.

## 5. POI system

See `README.md` section "How to build POIs" for the full method. Summary:

- Category list is derived from real tile data, never invented. See
  `data/poi-scan-ramos-mejia.txt`: 17,725 features, 205 distinct `class/subclass`
  pairs in the test area.
- 205 pairs curated down to **20 folders**, tiered. Several OSM classes collapse
  into one icon.
- Noise classes are hidden, not drawn. `bus` alone was 5,078 occurrences.
- Path: `POIS/{FOLDER}/{template}_{folder_lowercase}.png`
- `POIS/manifest.json` is the machine-readable mapping. Keep it in sync.
- Icons are 64x64 PNG but render at roughly 24px. Design for 24.

## 6. Test fixtures

- Test area: Ramos Mejia, Buenos Aires — `[-58.5887050, -34.6438617]`
- `data/route-demo.geojson` — a real 6.88 km / 11 min driving route, 191 points,
  with `origin` and `destination` point features
- Routing came from the public OSRM demo server. It supports `alternatives=true`
  (returns 2 routes) but **not** `exclude=toll`.
- **Toll pricing data does not exist** in OSM reliably. Toll cost is hardcoded in
  the harness. Real toll routing needs a self-hosted engine (Valhalla,
  GraphHopper) or a commercial provider. Do not promise it as working.

## 6b. GL JS vs Native parity — read before authoring any style

**MapLibre Native is a separate C++ implementation of the style spec, not the same
engine as MapLibre GL JS.** It has an open parity backlog. A style that renders
correctly in the browser harness can render differently, or drop a layer entirely,
on device. The harness is a design tool, not a correctness oracle.

`gl-style-validate` is a GL-JS-spec linter. It does NOT prove device portability.
There are documented cases of styles that validate, render in GL JS, and drop the
layer on Native.

The authoritative source is the per-property `sdk-support` table in the style spec
(separate rows for basic vs data-driven, separate columns for GL JS / Android /
iOS). Machine-readable at `src/reference/v8.json` in `maplibre-style-spec`. These
tables lag the code in BOTH directions — cross-check against live issue state
before designing around a gap.

### Confirmed constraints for this project

- **`pitch` > 60 is unsupported on Native.** Nav mode uses exactly 60, which is the
  ceiling. Do not design toward more.
- **"Pixels" means CSS px in GL JS and device-independent px on Native.** This
  affects every sized value in every style: `text-size`, `icon-size`, `line-width`,
  `text-offset`, `text-halo-width`, `circle-radius`, `*-padding`. Silent and
  universal. The harness cannot show it without a forced-DPR control.
- **Pin `maplibre-gl@5` in the harness deliberately.** Current GL JS is 6.x; Native
  tracks roughly 5.x. Authoring on 6 lets the harness render features the app
  cannot. Gaps cluster in 5.20+ and 6.x.
- **Use the deprecated `*-allow-overlap`, never `icon-overlap`/`text-overlap`.** The
  new names are unsupported on Native. Do not "modernize" this.
- `line-dasharray` with expressions is broken on Native; constants are fine. All
  current uses are constants.
- No data-driven support on Native for `fill-pattern`, `line-dasharray`,
  `line-blur`, `circle-blur`, `line-gradient`, `icon-padding`, `line-cap`.
  Constant values work.
- Unsupported on Native: `sky` layers, 3D terrain, globe projection, `addProtocol`,
  `interpolate-hcl`/`interpolate-lab` and `global-state` (merged but unreleased).
- **Supported on Native, do not assume otherwise**: `fill-pattern` and
  `background-pattern` (so the 1899 parchment plan is safe), `symbol-sort-key`,
  `text-variable-anchor`, `icon-text-fit`, multi-sprite arrays, `format` with
  per-section colors, `within`, `distance`, `let`/`var`, and `feature-state`
  (smoke-test minimum versions before relying on it).
- **RTL is an active parity bug**, not just an asset problem — Arabic renders in
  reversed glyph order on iOS. Relevant the moment labels go beyond Latin.
- A style with no `glyphs` URL renders in GL JS via system-font fallback and loses
  text on Native. Once glyphs are self-hosted, a 404 is invisible in the browser
  and fatal on device.
- **`maplibre-react-native` offline packs reject an inline style object** — it
  persists a bad pack and crashes on every launch. Packs require the style to be
  served from a URL. PMTiles sources do not support offline packs at all.

### Required gate

A `sdk-support` lint belongs next to `gl-style-validate`: walk each style's
properties, fail when the support table gives an issue URL instead of a version for
`android` or `ios` in the applicable row, and print live issue state so a closed
issue reads as "probably fine now, verify". This converts the portability
assumption into a checked invariant.

## 7. Known traps

**Only ONE zoom-based `interpolate` or `step` per expression.** Put the zoom curve
on the OUTSIDE and the per-feature `case` inside each stop. The reverse throws and
renders a black map. This bug already shipped once in all three styles.

**A style can be valid JSON and an invalid style.** Parsing proves nothing. Always
run the official validator:

```bash
npx -p @maplibre/maplibre-gl-style-spec gl-style-validate styles/1899.json
```

Silence means valid. Run it on all three after any style edit, and before handing
anything back as done.

**The harness needs HTTP.** Opening `preview/index.html` from `file://` fails —
the browser blocks the `fetch()` of the style JSONs. Serve with
`npx serve . -l 4173`.

**The MapLibre GL JS global is `maplibregl`, not `maplibre`.**

## 8. Out of scope right now

Backend, user accounts, subscriptions, real GPS and location permissions,
background location, turn-by-turn voice, route recalculation, the routing engine
choice, CarPlay, Android Auto, and the React Native shell itself.

Current work is the web harness and the three templates. Scaling scope up is the
user's call, not an agent's.

## 9. Conventions

- All code, identifiers, comments, UI copy, and documentation in **English**
- Styles are authored and validated in the browser before touching app code
- Style files are platform-independent assets — the same JSON ships to iOS and
  Android unchanged

## 10. How this repo is built

Claude Code orchestrates: plans, writes specs and prompts, reviews every diff.
Google Antigravity (`agy`) writes the code. Claude does not write feature code.

Agent work is reviewed before it is accepted. Report honestly what you could not
verify rather than claiming it works.

### Operating `agy`

```bash
agy -p "<prompt>" --output-format json --mode accept-edits
agy -p "<prompt>" --conversation <id> --output-format json --mode accept-edits
```

Requires `"Bash(agy *)"` in `.claude/settings.local.json` under
`permissions.allow`, otherwise Claude Code's classifier denies it.

**`agy` cannot run shell commands in headless mode.** Its own permission system
auto-denies `RunCommand` and there is no reachable settings file to grant it.
Every prompt must say **"no shell commands, write files only"**, and the
orchestrator must supply anything `agy` would otherwise have to look up or fetch —
verified URLs, schema field names, tile endpoints, file contents.

Long conversation id for the harness work: `d959f1fa-51ec-48fb-a060-816f74dcbe9b`.
Continuing it preserves everything `agy` already knows about the harness.

**Cost of a dispatch is measured in hours, not minutes.** The v1 harness took 2
minutes; the v2 feature jump took 51; the contract refactor took 3.5 hours. Use
`agy` for feature-sized work. Tuning a hex value or fixing a one-line bug is
faster done inline — a mechanical single-file fix is the orchestrator's to make.

### Review gate — this has caught real bugs every time

Before accepting any `agy` delivery, run all three and read the diff:

```bash
node scripts/check-contract.mjs
npx -p @maplibre/maplibre-gl-style-spec gl-style-validate styles/<name>.json
node --check preview/app.js
```

Bugs caught this way so far: `maplibre.Map` instead of `maplibregl.Map` (blank
page), two zoom-based `interpolate`s in one expression in all three styles (black
map), and `style.load` registered after `setStyle` (overlays applied one template
behind). None of them were visible from the delivery report.
