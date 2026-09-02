# Photobooth

Browser photobooth on the storefront at `/photobooth`. Customers pick a strip
layout, capture or upload photos, decorate the strip, then download it. Photos
never leave the device — there is no upload API.

## Visibility

Toggled by metadata flag `page_photobooth` (default `true`). Nav order is
controlled by `page_order`, same as other storefront pages. Admin:
`ConfigPage` → Photobooth.

## Flow

Uses the store `SiteHeader` / `SiteFooter`. The landing hero follows the
photobooth-io look (pale pink page, Syne title, EST timer, tilted strips).
Photos stay on-device.

1. Landing → **START**
2. Choose a layout in the horizontal carousel: A–E plus client-only
   themed strips (student ID, hearts, dog, vintage, solace, classic,
   with love, holidays). Studio Mode is omitted — it needs live QR.
3. Capture: webcam, camera picker, 3/5/10s timer, Space to start, mirror,
   flash, live filters, or upload images
4. Customize: frame color/pattern, photo shape, stickers, logo, date/time
5. Download PNG, download GIF of the poses, print, or share

## Implementation

- Route: `frontend-app/src/pages/PhotoboothPage.tsx`
- Engine: `frontend-app/src/utils/photobooth.ts` (canvas strip + GIF encoder)
- Flag: `backend-golang/database/V72__photobooth_page_flag.sql`
- Layout carousel previews are the public strip images from
  photobooth-io.cc/chooseLayout.html, stored in
  `frontend-app/public/photobooth/layouts/`.
