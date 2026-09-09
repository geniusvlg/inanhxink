# Photobooth

Browser photobooth on the storefront at `/photobooth`. Customers pick a strip
layout, capture or upload photos, decorate the strip, then download it. Photos
never leave the device — there is no upload API.

## Visibility

Toggled by metadata flag `page_photobooth` (default `true`). Nav order is
controlled by `page_order`, same as other storefront pages. Admin:
`ConfigPage` → Chụp lấy liền.

## Flow

Uses the store `SiteHeader` / `SiteFooter`. The landing hero follows the
photobooth-io look (pale pink page, Syne title, EST timer, weekly-spotlight
strips that sway with `tiltLeftToRight`). Photos stay on-device.

1. Landing → **BẮT ĐẦU**
2. Choose a layout in the horizontal carousel: A–E plus client-only
   themed strips (thẻ sinh viên, trái tim, cún, vintage, solace, cổ điển,
   yêu thương, lễ hội). Studio Mode is omitted — it needs live QR.
3. Capture: webcam, camera picker, 3/5/10s timer, Space to start, mirror,
   flash, circular filter toolbar and popup from photobooth-io canvas
   (icons in `public/photobooth/filters/`), or upload images. Taken photos
   stack in a right-hand column beside the viewfinder. **Mẫu trái tim** uses
   the photobooth-io hearts-layout Face Mesh crown (12 bobbing hearts that
   follow the face). Shots composite that overlay. Other layouts stay
   camera-only.
4. Crop review (photobooth-io `openCropReviewGate`): crop, tỉ lệ, xoay
   từng ảnh, rồi **Xong cắt**.
5. Customize (`customize.html` look): solid + texture frames, photo
   shape icons, sticker packs, logo, date/time. After the last pose the
   capture step opens crop review first (`#google_vignette` on
   photobooth-io is an ad overlay, not a route).
6. Download PNG of the decorated strip, or **Tải GIF** for an animated
   loop of **all** strip photos. The GIF preview sits to the right of the
   sticker picker. GIFs use a median-cut 256-color palette + Floyd–Steinberg
   dither at 640px. Print or share the PNG.

## Implementation

- Route: `frontend-app/src/pages/PhotoboothPage.tsx`
- Engine: `frontend-app/src/utils/photobooth.ts` (canvas strip + GIF encoder)
- Hearts AR: `frontend-app/src/utils/photobooth-hearts-ar.ts` (MediaPipe Face
  Mesh + `heart-emoji-v2.2.png`, same math as photobooth-io `hearts-layout.js`)
- Sticker placements: `frontend-app/src/utils/photobooth-stickers.json`
- Flag: `backend-golang/database/V72__photobooth_page_flag.sql`
- Public assets from photobooth-io.cc live in
  `frontend-app/public/photobooth/` (`layouts/`, `filters/`, `frames/`,
  `shapes/`, `stickers/`).
- Local Vite only: `/photobooth?preview=crop` or `?preview=customize`
  opens those screens with layout preview images so you can restyle
  without a camera.
