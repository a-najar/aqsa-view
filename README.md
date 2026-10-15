# Al-Aqsa Through Time · المسجد الأقصى

A walkable 3D model of **al-Masjid al-Aqsa**, the whole 144-dunam sanctuary,
with a timeline that runs from Caliph Umar’s entry into Jerusalem (638 CE / 16 AH)
to today. Pick any year and the buildings of that period appear; walk or fly
anywhere, inside the Dome of the Rock, through al-Qibli Mosque, down into
al-Musalla al-Marwani, and out through the gates.

## Run it

- **Single file:** open `dist/index.html` in a browser (needs internet for
  three.js and fonts from the CDN).
- **From source:** `npm run serve`, then open <http://localhost:8080>.
  ES modules don't load from `file://`, so use a local server.
- After editing `src/`, rebuild the single file with `npm run build`.

## Controls

| Input | Action |
| --- | --- |
| Click the view | Capture the mouse to look around (Esc releases it) |
| `W A S D` / arrows | Move; hold `Shift` to run |
| `Space` | Jump (walking) / rise (flying) |
| `F` | Toggle walking ↔ free flight |
| `E` / `Q` | Fly up / down |
| `[` / `]` | Previous / next era |
| `M` | Show / hide the site plan |
| Phone | Left stick moves, drag anywhere to look, ▲▼ to fly |

Use **Go to…** for preset viewpoints, or tap the site plan to jump to a spot.

## What changes on the timeline

| Year | Change in the model |
| --- | --- |
| 638 | Umar’s timber prayer house at the south of the enclosure |
| 691 | Dome of the Rock (glass-mosaic exterior, gilded dome), Dome of the Chain |
| 705 | Umayyad/Abbasid al-Aqsa with 15 aisles replaces the timber house |
| 1022 | Dome of the Rock’s dome rebuilt and covered in lead |
| 1035 | Fatimid al-Aqsa with 7 aisles, the plan kept today |
| 1099–1187 | Crusader occupation: cross on the domes |
| 1187+ | Salah al-Din’s minbar; Ayyubid domes, porch (1217), al-Kas |
| 1278–1367 | Mamluk minarets, riwaqs and arcades |
| 1482 | Madrasa al-Ashrafiyya, Sabil Qaitbay |
| 1545 | Ottoman tiles with the Surah Ya-Sin frieze replace the mosaics |
| 1964 | Gold-anodised aluminium dome; aluminium on al-Qibli until 1983 |
| 1967 | Mughrabi Quarter demolished, plaza before al-Buraq Wall |
| 1969 | Arson: burned south-east of al-Qibli, minbar lost |
| 1994 | Dome gilded with gold leaf |
| 1996 | Al-Musalla al-Marwani opens (stairway down to the vaults) |
| 2005 | Wooden bridge to Bab al-Magharibah replaces the earthen ramp |
| 2007 | Replica minbar of Salah al-Din installed |

## Accuracy

Wall lengths (west 491 m, east 462 m, north 310 m, south 281 m), the Dome of the
Rock’s geometry (20.6 m octagon sides, two inner arcades, drum and dome to about
35 m), and the placement of the main buildings follow published surveys and
plans. The model is a simplified massing, not a measured survey.
Earlier phases (Umar’s mosque, the Umayyad and Abbasid mosques) are interpretive
reconstructions from historical descriptions. The Quranic frieze text
(Surah Ya-Sin 36:1–4) was taken from verified quran.com data.

## Code

```
index.html          page shell and HUD
src/site.js         site coordinates, terrain, shared registry
src/textures.js     procedural textures (stone, tiles, mosaic, carpet…)
src/geom.js         geometry helpers (walls with arches, arcades, domes…)
src/buildings.js    every building and its date range
src/timeline.js     timeline stops and their texts
src/main.js         renderer, walk/fly controls, collision, UI
scripts/build.mjs   bundles everything into dist/index.html
```

Built with [three.js](https://threejs.org) r160; no other dependencies.
