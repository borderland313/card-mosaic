# card-mosaic

Bare-bones personal tool that converts an image into a playing-card mosaic map.

## What it does
- Load an SVG/image (bundled or upload)
- Large built-in list of simple SVG presets for fast testing
- Side-by-side view: original image + card mosaic output
- Convert image to grayscale blocks
- Map brightness to card ranks (A = lightest, 10 = darkest)
- Render with real playing-card SVGs (spades set)
- Auto-fit width/height to image proportions using your current card-count budget
- Show rank inventory + total physical dimensions in inches/feet
- Export placement map as JSON or CSV

## Card assets
Playing card SVGs are sourced from:
- https://github.com/hayeah/playing-cards-assets (MIT)

## Run locally
Open `index.html` directly, or serve with any static server.

## GitHub Pages
Set Pages to deploy from:
- Branch: `main`
- Folder: `/ (root)`

Then access:
`https://<your-username>.github.io/card-mosaic/`
