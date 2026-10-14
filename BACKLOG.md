# Harness Backlog

Work that belongs in the web harness **before** the React Native shell exists.
Everything here is cheap in a browser and expensive to discover on a device.

Ranked by (cost of discovering late) x (likelihood of being overlooked).
Source: planning audit, 2026-10-13.

---

## 0. `sdk-support` lint — the missing gate

`gl-style-validate` checks the GL JS spec. It does not check whether MapLibre
**Native** can render the style. There are 209 properties today where GL JS has
support and Android/iOS have an open issue instead.

Build `scripts/check-sdk-support.mjs`: fetch `src/reference/v8.json` from
`maplibre-style-spec` (pin the revision), walk every property and expression in
each style, and fail when `sdk-support` gives an issue URL instead of a version
for `android` or `ios`, in the row that applies (basic vs data-driven).

The tables lag the code in **both** directions, so print live issue state too — a
closed issue should read "probably fine now, verify". Run it beside
`gl-style-validate`. ~150 of the 209 entries are `global-state` variants; collapse
them to one.

This turns the portability assumption into a checked invariant. Do this first.

---

## 1. ~~No style-to-runtime contract~~ — DONE 2026-10-13

Shipped. `styles/_contract.json` (19 required layers, anchor `poi-circle`),
`styles/_overlay.json` (6 route/puck layers per template), and
`scripts/check-contract.mjs` as the gate. `preview/app.js` injects the overlay via
`applyOverlay()` after every `style.load`, with `ROUTE_DATA_URL` as the single
place the data path appears. The RN shell ports `applyOverlay()` as-is.

One bug surfaced and was fixed during this work, worth remembering because the RN
port can reintroduce it: **`map.once('style.load', …)` must be registered BEFORE
`map.setStyle()`.** Given an already-parsed style object MapLibre can emit
`style.load` synchronously, so a listener attached afterwards misses the event and
fires on the next switch instead — applying the previous template's overlay over
the new basemap. A `switchToken` counter also guards against a slow fetch from a
superseded switch landing on top of a newer template.

<details>
<summary>Original problem statement</summary>

All three styles embed `"data": "../data/route-demo.geojson"` — a relative
filesystem path that cannot resolve on a device, holding demo data. The three
styles also expose different layer-id sets (`miami-6` has `poi-fuel-halo`,
`los-angeles` has six `*-casing` layers, `1899` has only `tunnel-casing`). There is
no shared contract, so every RN call site that touches the map would need a
per-template special case, and template #4 re-breaks the app.

`setStyle()` destroys runtime-added sources and layers. The harness never notices
because the route lives inside the style — on device, switching template
mid-navigation would wipe the live route.

- `styles/_contract.json` listing the sources and layer ids every template MUST
  expose, plus a validator
- Move the route source and layers into `styles/_overlay.json`; make
  `switchTheme()` re-add them after `style.load`, so the harness performs the exact
  dance RN will have to and the ordering bugs surface now
- Prove insertion order: the overlay must land under `poi-label` and over `road-*`,
  which needs a stable anchor layer id in the contract

</details>

## 2. Internationalization, and the custom-glyph plan that quietly breaks it

Every label is `"text-field": "{name}"` — legacy token, raw OSM name, no fallback.
It works today only because OpenFreeMap's Noto stack is comprehensive. Both styles
carry a TODO to replace Noto with a custom display face, which will have Latin and
nothing else — and **Native has no automatic system-font fallback**, so the device
failure mode is blank labels while the browser papers over CJK locally.

RTL is an open iOS bug (reversed glyph order), and CJK rasterization is only now
converging. This is an active parity defect, not just an asset gap.

- `["coalesce", ["get","name:es"], ["get","name:latin"], ["get","name"]]` plus a
  locale toggle
- Camera presets for Tokyo, Athens, Cairo, Moscow, Tel Aviv
- `localIdeographFontFamily: false` so the browser stops lying about CJK
- Decide and write down the fallback stack now:
  `["GameIrl 1899", "Noto Sans Regular"]`, and verify it resolves on both

## 3. The sprite and `fill-pattern` pipeline is not prototyped at all

**No style has a `sprite` key. No `icon-image`. No `fill-pattern` anywhere** — so
1899's aged parchment, a founding reason for choosing MapLibre, is currently three
flat hex fills. Meanwhile 60 hand-drawn PNGs are about to be produced against
specs nothing has validated.

The harness runs at the dev laptop's DPR; an iPhone is DPR 3. "Judged at real phone
dimensions" is half true — right CSS size, wrong pixel density. The dp-vs-CSS-px
divergence compounds it.

- Sprite builder: `POIS/manifest.json` → `sprite.png` / `sprite.json` / `@2x`, and
  a `sprite` key in all three styles even with placeholder art
- A real `fill-pattern` parchment layer in `1899.json`, with a seam check at
  fractional zoom (13.4, 15.7) and pitch 60
- A **DPR selector (1x / 2x / 3x)** that re-creates the map with a forced
  `pixelRatio` — one dropdown makes the frame honest
- SDF for icons yes (one set recolored per template via `icon-color`), SDF for
  patterns no (colorized SDF patterns are unsupported on Native)
- **Unverified, test on device before finalizing art specs**: whether Native
  requests `@3x` at all or caps at `@2x`

## 4. POI density and collision — the manifest has no rendering consequence

`poi-circle` has `minzoom: 11` and **no filter** in any style. `manifest.json`
declares `hiddenClasses` headed by `bus` — 5,069 of 17,725 features, 29% of
everything — and it is currently being drawn. The three tiers affect nothing. And
`bakery` (239), `butcher` (248) and `town_hall` (105) are in neither a category nor
`hiddenClasses`, falling through to a default dot.

- Generate the `poi-circle` / `poi-label` filters from `manifest.json`, with a third
  bucket so uncovered classes are visible instead of silently defaulted
- `symbol-sort-key` driven by the manifest tier (supported on Native)
- A rendered-vs-collided-out symbol count per zoom in the existing inspector panel
- Test at z13/15/17 **and at pitch 60**, where collision behaves differently
- Use `*-allow-overlap` only. `icon-overlap`/`text-overlap` are unsupported on
  Native, and GL JS 6.x will tempt someone to "modernize" it

## 5. Failure states — tiles, glyphs, offline, coverage edges

The harness always has network and always sits on dense Buenos Aires data.
`switchTheme()` and the route `fetch()` both end in `console.error`, which on a
phone is nothing. Worse, the failure state is invisible by design: when tiles fail
what shows is `background-color`, and 1899's blank parchment is indistinguishable
from a successfully loaded rural area.

- An offline / slow-3G / 404 toggle covering **tiles and the glyph endpoint
  separately** (a glyph 404 is invisible in the browser and fatal on device)
- Camera presets over open ocean and sparse rural terrain, so "no data" and "no
  network" are deliberately distinguishable
- A `background-pattern` or watermark for the un-loaded state, per template
- **Settle the offline architecture now**: `maplibre-react-native`'s `createPack`
  silently accepts a non-URL `mapStyle`, persists a bad pack, and crashes the app on
  every later launch. The whole workflow is local style JSON files. Styles must be
  served from a URL for packs to work — and PMTiles sources do not support packs at
  all

## 6. Nav mode is not pitch-aware, and camera padding does not exist

`applyCameraMode('nav')` sets `pitch: 60, zoom: 17` and nothing else. No `padding`,
so the puck sits dead-centre — on device, behind the ETA card. No
`text-pitch-alignment`, no distance fade, so labels near the horizon pile into
mush. `building` is a flat fill; at pitch 60 a themed city with no `fill-extrusion`
looks like a flat map tilted, not like game cartography.

**60 is the Native hard ceiling.** There is no headroom above it.

- `padding: {bottom: 300}` on the nav `easeTo`, with a dummy block where the ETA
  card goes, so framing is judged correctly
- Safe-area insets on `.phone-frame` (notch + home indicator) — it has neither
- A `fill-extrusion` experiment per template; `fill-extrusion-vertical-gradient` is
  supported on Native
- A label-fade-with-distance test and a pitch slider capped at 60

## 7. Contrast, glare, and the day/night decision

Measured: miami-6 `road-minor` on background is **1.34:1**. `building` fill is
**1.11:1**, and `fill-opacity` drops to 0.2 at z13, making it worse. 1899
`landcover-sand` on parchment is **1.15:1**. Labels are fine — the **geometry** is
the problem. On a windscreen-mounted phone in noon sun, miami-6's minor road
network is simply not there.

There is no day/night variant at all: a near-black neon theme at midday, a bright
parchment theme at 2 a.m.

- A contrast readout computing WCAG ratios per declared layer-pair — a static pass
  over the JSON
- A simulated-sunlight scrim toggle (~30% white)
- A day/night toggle to force the 3-files-or-6 decision **before** the custom art is
  drawn. `global-state` is not in a tagged Native release, so the variant must be
  separate style files or runtime paint calls — decide which here

## 8. Performance budget

No FPS counter, no frame-time, no symbol count. `los-angeles.json` carries six
casing layers (heavy overdraw). miami-6 uses `line-blur` and `circle-blur` across
route, puck and `poi-fuel-halo`, plus halo blur, on top of 17k unfiltered POI
circles. A dev laptop hides all of it; a mid-tier Android at pitch 60 while panning
will not.

- FPS, frame-time and rendered-symbol count in the existing panel
- CPU throttling and a scripted pan-along-route benchmark at nav camera per template
- Write the budget down (e.g. 55fps sustained at nav) and treat a violating style as
  broken
