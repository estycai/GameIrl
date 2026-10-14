# GameIrl

Turn real-world navigation into a video-game map.

GameIrl is a mobile map app that re-skins the real world with themed cartography.
You see your actual city, your actual streets — rendered as if it were a map from a
game. Three templates ship first, each inspired by a different era and aesthetic:

| Template | Aesthetic |
| --- | --- |
| `miami-6` | Neon, pastel, sun-bleached coastal city |
| `1899` | Aged parchment, hand-drawn western frontier |
| `los-angeles` | Sprawling modern metropolis, satellite-era palette |

Inspired by, not copied from. No third-party names, logos, or assets are used.

## Platforms

- **Now**: iOS and Android
- **Later**: CarPlay and Android Auto

> CarPlay's navigation entitlement (`com.apple.developer.carplay-maps`) requires
> real turn-by-turn guidance and forbids showing arbitrary POIs on the car screen.
> That constraint shapes the product roadmap — see `docs/` when it is written.

## Technology

| Layer | Choice | Why |
| --- | --- | --- |
| Map renderer | **MapLibre Native** | Fully open style spec, no vendor lock-in. NOTE: Native is a separate C++ implementation from MapLibre GL JS, with a parity backlog — see `SPEC.md` 6b |
| Template format | **MapLibre Style JSON** | A template IS a style file: custom glyphs, sprites, `fill-pattern` textures |
| Tiles | **Protomaps / PMTiles** | Single-file basemap, self-hostable, no per-load billing. NOTE: PMTiles sources do NOT support offline packs or caching |
| App shell | **React Native (Expo)** + MapLibre RN v11 | One codebase for iOS and Android |
| Car screens | **react-native-carplay** | Covers CarPlay and Android Auto from one library |
| Style authoring | **Maputnik** + MapLibre GL JS | Design styles in the browser, iterate in seconds |

### Why MapLibre and not MapKit or Google Maps

Apple MapKit and the Google Maps SDK do not accept custom fonts, custom sprite
sheets, or texture fills. The themed look this app is built on is impossible with
either of them. Mapbox could do it, but bills per map load — which does not
survive a low-priced consumer app.

## Sprint 1 — the three templates

Not building an app yet. Styles are platform-independent assets: the same JSON
drops into iOS and Android unchanged, so they get built and validated first, in
the browser, where iteration takes seconds instead of a rebuild.

- [ ] Local preview harness: `index.html` with MapLibre GL JS + PMTiles and a template switcher
- [ ] Protomaps basemap tiles pinned to one test city
- [ ] `styles/miami-6.json` — palette, glyphs, sprites
- [ ] `styles/1899.json` — parchment `fill-pattern`, western glyph set
- [ ] `styles/los-angeles.json` — palette, glyphs, sprites
- [ ] Side-by-side visual review of all three at zoom 10 / 14 / 17

**Out of scope for sprint 1**: backend, accounts, subscriptions, turn-by-turn
navigation, CarPlay, Android Auto, the React Native shell.

## How this repo is built

Claude Code orchestrates — plans, specs, reviews. Google Antigravity (`agy`)
writes the code. Claude does not write feature code. Full contract in
`~/.claude/CLAUDE.md` under "Development Model".

## How to build POIs

A POI icon set is not decoration — it is the product's visual identity. Anyone can
tint roads. What makes a map read as a game map is the icon language.

### 1. Never invent the category list

Scan the real data first. `data/poi-scan-ramos-mejia.txt` is a decode of 17,725
POI features across 25 vector tiles at z14 over the test area. It found **205
distinct `class / subclass` pairs**. That number is why guessing fails in both
directions: you will invent categories the map never serves, and miss ones it
serves constantly.

To rescan a different area, decode the `poi` layer straight from the tiles —
`class`, `subclass`, `name` and `rank` are the fields that matter.

### 2. Cut hard, and cut the loudest thing first

`bus / bus_stop` was the single biggest result at **5,078 occurrences**. Drawing it
would bury the map under bus stops. Noise classes — `gate`, `waste_basket`,
`bollard`, `lift_gate`, `cycle_barrier`, `entrance`, `toilets`, `drinking_water`,
`information` — get hidden, not drawn.

205 pairs became **20 folders**. Several OSM classes collapse into one icon:
`HOSPITAL` covers `hospital`, `doctors` and `dentist`; `SCHOOL` covers `school`,
`college` and `library`. Three near-identical icons help nobody.

### 3. Structure

```
POIS/{FOLDER}/{template}_{folder_lowercase}.png
```

Templates are `miami`, `1899`, `los_angeles`. `POIS/manifest.json` maps every
folder to the OpenMapTiles `class` values it covers and lists all expected
filenames. The sprite builder reads it, so keep it in sync.

### 4. Work in tiers

- **Tier 1** (24 PNGs) — FUEL HOSPITAL POLICE PARKING BANK CAR SCHOOL RESTAURANT
- **Tier 2** (21) — FAST_FOOD CAFE BAR SHOP GROCERY PHARMACY PARK
- **Tier 3** (15) — CLOTHING HAIRDRESSER WORSHIP SPORT TOLL_BOOTH

60 PNGs if every slot is filled. Tier 1 alone makes the map usable — ship that
first and judge it before committing to the rest.

### 5. Two rules that decide whether the art works

**Design for 24px, not 64px.** Files are 64x64 PNG with transparency, but they
render at roughly 24px on a phone. Fine detail becomes a grey smudge.

**Design on the template's own background, never on white.** The 1899 parchment is
`#f2ebd9`. A sepia icon that looks beautiful on a white Figma canvas can vanish
on that cream. Open the harness, pick the template, zoom to 15, and sample the
actual color underneath.
