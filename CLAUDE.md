# Playsets — Claude Context

## Reference Screenshots

UI and design references live in:
`docs/Previous App UI Screenshots/`

Files:
- `Existing UI.png` — the old Unity app's game view (2D isometric sprites, characters, trees)
- `Existing UI - Commentary.png` — annotated sidebar tool labels from old app
- `Structure Builder.png` — old room builder with tile palette at the bottom
- `Structure Builder - Commentary.png` — annotated version
- `Builder Props - Palette.png` — old prop palette: circular sidebar buttons + prop art
- `Builder Props - Add prop to palette.png` — props placed on the map (2D isometric sprites on tiles)
- `Token Selection UI.png` — token picker

**Key design principle from screenshots:** Props (doors, windows, rugs, paintings, furniture) are 2D sprite overlays placed ON tiles. They do NOT replace the tile underneath. A window sprite sits on a wall tile — the wall tile is fully visible behind it. This is the correct architecture for future art integration.

## Project Notes

- Solo dev/founder: Anthony Maitz (anthony@forevrgames.com)
- Stack: React + BabylonJS + Zustand + WebRTC
- Art style: 2D isometric sprites (existing Unity app assets to be ported)
- Builder props taxonomy: punch-through (door — hides wall) vs wall-decor (window/painting — wall stays) vs floor-decor (rug) vs floor-object (bartop)
