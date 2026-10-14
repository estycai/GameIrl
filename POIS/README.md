# POI Icons

One folder per icon category. Drop PNGs in manually.

## Naming

```
POIS/{FOLDER}/{template}_{folder_lowercase}.png
```

Templates are `miami`, `1899`, `los_angeles`. So `SCHOOL` holds:

```
POIS/SCHOOL/miami_school.png
POIS/SCHOOL/1899_school.png
POIS/SCHOOL/los_angeles_school.png
```

`manifest.json` maps each folder to the OpenMapTiles `poi` `class` values it
covers, and lists every expected filename. The sprite sheet builder reads it, so
keep it in sync when adding a category.

## Specs

- PNG with transparency, square, **64x64** (a 2x `@2x` set comes later)
- Must read clearly at ~24px on screen — that is the real display size
- Design on the template's own map background, never on white

## Where the categories came from

Not invented. `data/poi-scan-ramos-mejia.txt` is a real scan of 17,725 POI
features across 25 tiles at z14 over the test area: 205 distinct
`class / subclass` pairs. These 20 folders are the curated subset worth drawing.

Classes deliberately hidden rather than drawn are listed in `manifest.json` under
`hiddenClasses`. The big one is `bus` at 5,078 occurrences — drawing it would bury
the map under bus stops.

## Order of work

- **Tier 1** — FUEL HOSPITAL POLICE PARKING BANK CAR SCHOOL RESTAURANT
- **Tier 2** — FAST_FOOD CAFE BAR SHOP GROCERY PHARMACY PARK
- **Tier 3** — CLOTHING HAIRDRESSER WORSHIP SPORT TOLL_BOOTH

60 PNGs total if every slot is filled. Tier 1 alone is 24 and already makes the
map usable.

## Per-template guides

- `GUIDE-1899.md` — verified palette, backdrop range, stroke math, and what each of the 20 icons should depict in period language
