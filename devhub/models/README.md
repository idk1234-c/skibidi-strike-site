# Models (Dev hub)

The page at `devhub/models/` shows every model in `models.json` as a card.
Tap a card to open the 3D viewer (spin, zoom, move, backgrounds, reset, fullscreen, AR on phones that support it).
Only owners and moderators can open it (same sign-in lock as the Private roadmap).

## Add a model (one commit)

1. Put the files in `devhub/models/files/`:
   - the model as `.glb` (keep it under about 3 MB so phones load it fast)
   - a picture of it as `.jpg` (portrait, about 640 x 800) for the card
   - optional: a `.usdz` copy for iPhone AR
2. Add an entry to the `models` list in `devhub/models/models.json`:

```json
{
  "id": "titan2",
  "name": "Titan 2",
  "glb": "files/titan2.glb",
  "thumb": "files/titan2.jpg",
  "by": "Titan TV Man",
  "notes": "One line about the model.",
  "date": "2026-11-03"
}
```

   - `id`: short, lowercase, no spaces (it's also the link: `devhub/models/#titan2`)
   - `date`: YYYY-MM-DD; newest shows first
   - optional `usdz`: `"files/titan2.usdz"`
   - optional `orbit`: starting camera, e.g. `"30deg 75deg 105%"`
3. Commit both. The site updates in a minute or two.

To update a model, replace its `.glb` (same name) and bump the `date` if you want it on top.
If the model has animations, a menu to play them shows up by itself.
