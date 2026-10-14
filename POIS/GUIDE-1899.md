# 1899 — Icon Guide

Everything here is read from `styles/1899.json`, not assumed. If the style
changes, re-derive these values.

## Backgrounds your icon will actually sit on

The page color is `#f2ebd9`, but an icon is rarely on it. It sits on whatever
polygon is underneath. Design against the whole range, not one swatch.

| Where | Color | How often |
| --- | --- | --- |
| Bare background | `#f2ebd9` | Common |
| Residential land | `#e8dfcb` ~ `#e9dfcb` | Most common in a city |
| Buildings | `#dbd0ba` | Very common — POIs sit on buildings |
| Woodland | `#ded6c0` | Occasional |
| Park | `#d9ceb4` | Occasional, and the darkest realistic backdrop |
| Water | `#abb8ba` | Rare for POIs, but possible near the river |

**Test your icon on `#d9ceb4` (park), not on `#f2ebd9`.** If it survives the
darkest backdrop it survives everywhere. If you only check it on the light
parchment you will ship icons that vanish over parks and buildings.

## The ink palette — use these, do not introduce new colors

The whole template is built on dark sepia ink over parchment. An icon with its
own color language will look pasted on.

| Use | Color | Where it already appears |
| --- | --- | --- |
| **Primary ink** | `#3d2614` | Route line, user puck core, endpoint stroke |
| Darkest ink | `#332415` | City labels |
| Secondary ink | `#4a3928` | Motorway, road name text |
| Mid brown | `#63503b` | Primary roads |
| **Accent** | `#702b1e` | Fuel POI labels — the ONLY accent in the style |
| **Knockout / halo** | `#f2ebd9` | Every text halo in the style |

Default: draw in `#3d2614`. Use `#702b1e` only for categories that must pop
(FUEL, HOSPITAL, POLICE). No other colors.

## Separation — the part people skip

Every label in this style carries a 2px `#f2ebd9` halo. That is how marks stay
readable over park and building fills. **Your icons must do the same**, or they
will be the only elements on the map without separation.

Bake a `#f2ebd9` outline into the PNG itself, 3–4px wide on the 64px canvas,
following the icon silhouette. Not a drop shadow. A knockout outline.

## Geometry — the numbers that decide if it reads

Canvas is **64×64 px**, but it renders at roughly **24px** on a phone. That is a
0.375 scale. Everything you draw gets shrunk to just over a third.

| Property | Value at 64px | Becomes at 24px |
| --- | --- | --- |
| Stroke weight | **5–6 px** | ~2 px — legible |
| Stroke weight (wrong) | 2 px | 0.75 px — disappears |
| Padding from edge | 4 px | ~1.5 px |
| Smallest meaningful detail | **8 px** | 3 px — the floor |

Anything thinner than 5px at 64 will not survive. This is the single most common
reason hand-drawn map icons fail.

Also: **flat only**. No gradients, no soft shadows, no anti-aliased glow. The
style is flat ink on paper, and soft edges smear into mud at 24px.

## Draw monochrome on transparency

Solid single-color art on a transparent background, not full-color illustration.
Two reasons: it matches the template, and it keeps the door open to converting
the set to SDF icons later, which would let the style recolor them at runtime
instead of needing a redraw per variant. Full-color art closes that door.

## What each icon should depict

This is a map from 1899. Do not draw modern pictograms in sepia — translate the
category into its period equivalent. This is what makes the template feel like a
place rather than a filter.

### Tier 1

| Folder | Draw | Not |
| --- | --- | --- |
| FUEL | Oil can, or a fuel canister with a spout | A modern gas pump |
| HOSPITAL | Apothecary mortar and pestle, or a field tent with a cross | A modern H or hospital bed |
| POLICE | Sheriff's star badge | A modern police shield |
| PARKING | Hitching post, or a horseshoe | A letter P in a square |
| BANK | Heavy safe door, or a strongbox with bands | A classical column facade |
| CAR | Wagon wheel, or an anvil and hammer for the repair shop | A car silhouette |
| SCHOOL | Schoolhouse bell, or a slate board | A graduation cap |
| RESTAURANT | Saloon swing doors, or crossed fork and knife in engraved style | A modern plate icon |

### Tier 2

| Folder | Draw |
| --- | --- |
| FAST_FOOD | Chuck wagon, or a tin plate |
| CAFE | Enamel coffee pot over a flame |
| BAR | Whiskey bottle and glass, or a beer stein |
| SHOP | Striped awning, or a hanging trade sign |
| GROCERY | Sack of grain, or a crate of produce |
| PHARMACY | Apothecary bottle with a cork and label |
| PARK | Single broad tree, engraved style |

### Tier 3

| Folder | Draw |
| --- | --- |
| CLOTHING | Tailor's dress form, or a hat and coat on a stand |
| HAIRDRESSER | Straight razor, or a barber pole |
| WORSHIP | Small chapel with a steeple |
| SPORT | Boxing glove, or crossed horseshoes |
| TOLL_BOOTH | Wooden toll gate arm across a road |

## Before you commit a file

1. Place it on `#d9ceb4` and squint. Does the silhouette still read?
2. Scale it to 24px. Does any stroke disappear?
3. Put it next to `1899_restaurant.png` and `1899_fuel.png`. Does it look like the
   same hand drew all three?

That third one matters most. A set of twenty icons that share a line weight and a
drawing language beats twenty individually beautiful icons that do not.
