# QR Templates

QR templates are listed on `/qr-yeu-thuong` from the `templates` table and use
`template_type` to choose the static template folder served from
`backend-golang/public/templates/<template_type>/`.

## Active Template Types

| Template type | Folder | Order form |
|---|---|---|
| `galaxy` | `galaxy` | Optional envelope message (max 150 characters, responsive display of up to 7 lines); opens automatically after a 3D post-load countdown shown above the planet and stays visible; plus up to 15 images |
| `letterinspace` | `letterinspace` | Letter-in-space text form |
| `loveletter` | `loveletter` | Letter title, hint, signoff, sender, receiver, content, up to 12 images |
| `lovedays` | `lovedays` | Date, names, secret message, timeline, 2 avatars, up to 10 gallery images |
| `birthday` | `birthday` | Birthday fields, no image uploader |
| `birthdaycake` | `birthdaycake` | Letter title/body, cake inscription, and up to 24 photos |
| `specialgift` | `specialgift` | Start date, left/right names, day label, popup title/content, 2 avatars, and up to 12 gallery images |

## Shared Voice Player

See `docs/qr-voice-recording.md` for the complete recording, pricing, storage,
and playback flow.

Every active template receives the shared
`public/templates/common/voice-player.js` and `.css` assets through
`handlers/templateserve.go`. When `template_data.voiceRecordingUrl` or
`musicUrl` is present, audio starts automatically and the page shows a fixed
mute/unmute button. Voice recordings loop through the shared player; existing
template background-audio elements remain template-owned but are controlled by
the shared mute button. Galaxy's `#bg-audio` element also loops its selected
background music continuously. If browser autoplay policy blocks sound, playback starts
on the visitor's first tap, click, or key press anywhere on the template.

Template implementations do not need their own voice-message code. Public
template data is CDN-rewritten before it is injected into
`window.dataFromSubdomain`.

## Cloudflare Rocket Loader Must Not Touch Template Scripts

Rocket Loader defers every `<script>` on the page and only replays a synthetic
`DOMContentLoaded` afterwards. Any template code that registers a
`DOMContentLoaded` listener at execution time can therefore miss the event
entirely and never bootstrap — this silently broke the `galaxy` template, which
hung forever on the "Đang tải thiên hà..." overlay because the handler that
fetches `/api/site-data` never ran. Large bundles lose this race the most often,
so the failure can look intermittent.

Three independent protections are in place; keep all of them when editing templates:

1. Every script tag on a template page carries `data-cfasync="false"`, which
   makes Rocket Loader skip it and preserve normal document order. This applies
   to the tags in each template's `index.html` **and** to the tags injected by
   `injectScripts` in `backend-golang/internal/handlers/templateserve.go`.
2. Template bootstraps are `readyState`-aware: run the work immediately (via
   `setTimeout(cb, 0)`, so post-init state such as `flowerRing` exists) when
   `document.readyState !== 'loading'`, and only fall back to a
   `DOMContentLoaded` listener while the document is still parsing. See
   `whenDomReady` in `public/templates/galaxy/js/sphere.js`.
3. The Galaxy `initApp()` entry point is idempotent via
   `window.__GALAXY_APP_INITIALIZED__`. Rocket Loader can replay a synthetic
   `DOMContentLoaded` even after the native event; without this guard, Galaxy
   creates a second WebGL renderer with placeholder textures over the correctly
   configured renderer.

The `galaxy` bootstrap also reads `window.__GALAXY_ID__` as a fallback for the
`#id=` hash, because `index.html` strips that hash on `load` and a late-running
bundle would otherwise see an empty hash.

Note that `public/templates/galaxy/bundle.js` is a committed build artifact with
its own copy of `sphere.js` logic — fixes must be applied to both files. Galaxy
references `styles.css` and `bundle.js` with a version query because Cloudflare
caches them for four hours; bump the version whenever either asset changes.

## Galaxy Cold-Load Performance

Galaxy downsizes uploaded images before creating WebGL textures (maximum edge:
256px low-tier, 384px medium-tier, 512px high-tier) and uses adaptive photo
sprite counts (72/120/180). Do not restore full-resolution canvas processing or
the old 400/800 sprite counts: cold loads can otherwise block the main thread
for more than 10 seconds and cover the scene with duplicated photos. The loading
overlay remains visible until images, 3D text, and the heart model are ready and
the textured scene has rendered for two animation frames. An 8-second fail-safe
reveals the best available scene if an asset or readiness event fails and shows
a `Thử tải lại` button; successful late completion removes that button. On
all devices, the gift button is visibly labeled `Ảnh bay`; it starts the
flying-photo effect but does not pause or resume an effect already in progress.
The old automatic mobile/desktop quick
help modal has been removed; the question-mark help remains user-invoked.

## Adding A Template

1. Add the static template folder under `backend-golang/public/templates/`.
2. Add or activate a `templates` table row with the matching `template_type`.
   Upload the thumbnail from Admin → QR Templates; uploaded thumbnails are
   stored in S3 under `templates/{template_type}/` and saved as raw S3 URLs.
3. Add the type to `validTemplateTypes` and `templateFolderMap` in
   `backend-golang/internal/handlers/orders.go`.
4. If the order form needs custom fields, add them in
   `frontend-app/src/pages/OrderPage.tsx`; otherwise it will use the generic
   content editor and image uploader.

## Customer QR Download Page

After payment, customers can create and download a printable QR image at
`/qr/<qr_name>`. The discoverable entry point is `/tao-ma-qr`, where they enter
their QR name (subdomain prefix).

- Feature flag: `page_tao_ma_qr` (Admin → Cấu hình → Hiển thị trang)
- Lookup page: `frontend-app/src/pages/QrLookupPage.tsx`
- Generator page: `frontend-app/src/pages/QrGeneratePage.tsx`
- Post-payment redirect still goes directly to `/qr/<qr_name>` even if the menu
  entry is hidden.
