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
| Android APK | **Local Gradle `assembleRelease`** on this Windows machine, sideload it. See section 7 for the working configuration. No cloud build — the project owner ruled EAS out. | Free |
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
```

The `route` source and its layers are NOT inside the style files. They live in
`styles/_overlay.json`, per template, and are applied on top of whichever
template is active — `applyOverlay()` in the harness, `buildStyle()` in the RN
shell. `styles/_contract.json` names the layer ids every template must expose
and the anchor the overlay is inserted before.

Each template still defines its own route appearance; what changed is where that
definition lives. The relative path `"data": "../data/route-demo.geojson"` is
gone — it could never resolve on a device. The overlay file stores `"data": null`
and the real GeoJSON is supplied at runtime.

Route-source layers, defined per template in `_overlay.json`:
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

### React Native shell traps — all three found during the first build

**There is no global `structuredClone` in React Native 0.86.** The implementation
ships at `react-native/src/private/webapis/structuredClone/` but nothing in
`setUpDefaultReactNativeEnvironment` or `src/private/setup/` installs it as a
global, so on Hermes the call is a `ReferenceError` at first render. The release
build succeeds regardless, which makes it invisible until the APK is installed.
Use a JSON round-trip — style specifications and GeoJSON are plain JSON anyway.

**`@maplibre/maplibre-react-native` v11 exports a component named `Map`, which
shadows the JavaScript `Map` constructor.** `import { Map } from
"@maplibre/maplibre-react-native"` followed by `new Map()` constructs a React
component, not a hash map. Import it aliased. `tsc --noEmit` catches this; the
Metro bundler does not.

**v11 renamed `MapView` to `Map`.** There is no `MapLibreGL` default export
either. Any agent writing from memory will produce the v10 API. Read
`node_modules/@maplibre/maplibre-react-native/src/index.ts` and pass the real
names in the prompt.

**`Map` accepts `mapStyle` as a `StyleSpecification` OBJECT.** That is why the RN
shell merges the overlay into the style before handing it over, instead of
porting the harness's post-`style.load` injection. There is no listener to order
and no `setStyle` teardown to survive, so the whole class of ordering bug the
harness hit cannot occur on device. Do not "port it faithfully" back.

### Local Android build — the working configuration

Build on this machine, not in the cloud. What it needs:

| Setting | Value | Why |
| --- | --- | --- |
| `JAVA_HOME` | Android Studio's bundled JBR 21 | The JDK on PATH is Java 20 |
| `ANDROID_HOME` | `%LOCALAPPDATA%\Android\Sdk` | Not set in the environment |
| `reactNativeArchitectures` | `arm64-v8a,x86_64` | All four ABIs exhaust the disk; `x86_64` is what the emulators run |
| `org.gradle.jvmargs` | `-Xmx4096m` | The 2048m default is tight for RN 0.86 |

Build it with `npm run apk` from `app/`. That syncs the assets, then runs the
Gradle wrapper through `scripts/build-apk.mjs`, which spawns it with an explicit
cwd and a quoted path — npm runs scripts through cmd on Windows, where the
current directory is not on PATH and this repo's path contains spaces. The SDK
and JDK locations come from `android/local.properties` and
`android/gradle.properties`, so no environment setup is needed. The script fails
loudly if Gradle reports success without producing the APK.

`assembleRelease` signs with the debug keystore, so the APK sideloads with no
keystore setup. `reactNativeArchitectures` is mirrored in `app/app.json` under
`expo-build-properties.android.buildArchs` so `expo prebuild` does not revert it
— but the `jvmargs` bump lives only in `android/gradle.properties` and IS lost on
`prebuild --clean`. Re-apply it.

**Disk is the binding constraint on this machine.** A four-ABI release build ran
it to zero and failed with `Espacio en disco insuficiente`, surfacing as four
unrelated-looking Gradle errors including `Error while dexing`. If a build fails
in several places at once, check free space before reading the stack traces.

**Memory is the second constraint.** Running the Gradle build and the Android
emulator at the same time exhausted system memory and both were killed. Do them
one at a time.

### Verifying on the emulator

Every AVD and system image on this machine is **x86_64**, so the APK is built
for `arm64-v8a,x86_64` — the first for a real phone, the second so the same
artifact installs on an emulator. An arm64-only APK will not install on any of
them. Keep `reactNativeArchitectures` and `buildArchs` in step with each other
and with whatever was actually verified; if they diverge, a later `npm run apk`
silently produces a different artifact than the one that was validated.

Run the emulator and the Gradle build one at a time — together they exhausted
system memory and both were killed.

**Rendering is confirmed on the emulator** (AVD `New_Hard`, API 36, x86_64).
All three templates draw with live OpenFreeMap tiles over the Ramos Mejia test
area, the overlay route and puck appear in every template, Preview fits the
whole 6.9 km route, and Nav applies zoom 17, the computed bearing and pitch 60 —
visible as perspective convergence and as POI circles scaling with distance,
since `circle-pitch-scale` defaults to `map`.

Still unverified: rendering on real phone hardware, and iOS entirely.

## 8. Out of scope right now

Backend, user accounts, subscriptions, real GPS and location permissions,
background location, turn-by-turn voice, route recalculation, the routing engine
choice, CarPlay, and Android Auto.

The React Native shell left this list on 2026-10-13, on the project owner's
instruction, and now lives in `app/`. Phase 1 has started. Everything else above
is still out of scope — in particular the shell draws the user puck from the
demo route's origin point and requests no location permission.

Scaling scope up is the user's call, not an agent's.

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

Conversation id for the React Native shell: `59dcd6c1-2efe-4034-9f96-d30463f77549`.

That dispatch took about 3 minutes, not hours — because the prompt carried the
verified v11 API read out of `node_modules`, the exact asset filenames, the
overlay and contract shapes, and the route's feature properties. `agy` had
nothing to look up. The cost of a dispatch tracks how much the orchestrator
supplies, not how big the feature is.

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

For anything touching `app/`, add from inside it:

```bash
npx tsc --noEmit        # catches the shadowed-Map class of bug; Metro does not
npm run verify          # compiles and exercises the real buildStyle and camera code
```

`npm run verify` is the device-free half of the gate. It builds all three styles
through the real `buildStyle`, asserts the overlay lands immediately before the
contract anchor, proves the function is pure against the shared JSON modules,
and checks the bearing, bounds and camera presets — all things that compile,
build a working APK, and still cannot be judged from a screenshot. A bearing
180 degrees wrong renders a perfectly plausible map. It prints the merged styles'
paths so `gl-style-validate` can be run on what the device actually renders,
rather than on the pre-merge source.

Bugs caught this way so far: `maplibre.Map` instead of `maplibregl.Map` (blank
page), two zoom-based `interpolate`s in one expression in all three styles (black
map), and `style.load` registered after `setStyle` (overlays applied one template
behind). None of them were visible from the delivery report.

Bugs caught in the React Native shell delivery: `structuredClone` on a runtime
that has no such global, and `new Map()` against the shadowed MapLibre `Map`
component. Both compile. Both crash at first render. Neither appeared in the
delivery report, which listed them under "what now works".

## 11. The React Native shell

Lives in `app/`. Expo SDK 57, React Native 0.86, MapLibre RN v11.

### Assets are copied, not cross-imported

`app/scripts/sync-assets.mjs` copies the styles, the overlay, the contract, the
UI token files and the demo route from the repo root into
`app/assets/templates/`. That folder is generated and gitignored; the repo root
stays the single source of truth.

Metro only resolves modules under its project root, and cross-root resolution
behaves differently between the dev server and the Gradle release bundle, so a
copy is deliberate — it keeps the bundler configuration stock. The route is
copied to `route-demo.json` because Metro's JSON transformer keys on the `.json`
extension; a `.geojson` import is parsed as JavaScript and throws.

Every npm script that builds or starts runs the sync first. A missing asset
fails the sync rather than bundling a half-built template.

### A template is still two files

`styles/{key}.ui.json` now exists for all three templates and holds the UI
chrome tokens. `app/src/theme/themes.ts` IMPORTS those files — it does not
restate the values. Retune a palette in one place.

### The overlay merge

`app/src/style/buildStyle.ts` is a pure function: clone the base style, add the
`route` source with the real GeoJSON in place of the overlay file's `null`
placeholder, splice the six overlay layers in immediately before the contract's
`overlayAnchor`, and throw if the anchor is missing rather than appending
silently.

It is verified without a device by compiling it, building all three styles, and
running `gl-style-validate` on the MERGED output — which is what the device
actually renders. The checks also assert purity (building twice does not
accumulate layers, and mutating a result does not leak into the shared module),
overlay position, source resolution, and the absence of duplicate layer ids.

### Camera

Browse (pitch 0, z13), Preview (fits the route bounds), Nav (pitch 60, z17,
bearing down the route). `pitch` 60 is MapLibre Native's ceiling — it is not a
starting point to tune upward.
