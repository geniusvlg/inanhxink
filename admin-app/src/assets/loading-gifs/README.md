# Loading GIFs

Drop any `.gif`, `.webp`, `.png`, `.jpg`, or `.jpeg` files into this folder.
The admin app will randomly pick one to show while images are uploading
(e.g. when creating/editing products in `ProductItemsPage`).

## How it works

`src/components/LoadingGif.tsx` uses Vite's `import.meta.glob(..., { eager: true })`
to discover every file in this folder at build time — no manifest, no list to maintain.
Just drop a file in and rebuild.

## Tips

- Keep files small (< 500 KB ideally) so the upload UI feels snappy.
- Square or 1:1 aspect ratio works best — it's rendered inside a 72×72px slot.
- Transparent backgrounds (GIF/WEBP/PNG) blend nicely with the admin theme.

## Fallback

If this folder is empty, the upload UI falls back to a plain "Đang tải..." text.
