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
| `farewell` | `farewell` | Friend name, origin city, destination/date, farewell letter, and 1–8 stages each with an optional image and message |
| `loveburst` | `loveburst` | Four separate particle-message inputs (blank inputs are omitted), popup title/letter, and up to 12 gallery images |

### Farewell / Bon Voyage

A boarding pass opens the page. Pressing it hands the screen to a full-viewport
globe: a sphere built from the order's photos, with the plane flying laps around
it. The sphere turns to bring each memory to the front in turn while its caption
reads out below, then the page lands on the arrival facts and a sealed airmail
envelope. A skip button jumps straight there, and the replay button reseals the
envelope and flies the whole thing again.

The page is gated before and during the flight. The initial
`body.is-gated` class limits the document to `100svh`, locks scrolling, and
force-hides the landing content, so only the boarding pass is reachable before
Start. During the tour `body.is-flying` keeps scrolling locked and everything
after the globe stays `hidden`; landing removes both gates and adds
`body.is-landed`, which removes the boarding pass from layout so the visitor
cannot scroll backward into the initial stage. Tour length is one leg per
configured stage — a 1s turn plus a hold.

After arriving, the sealed envelope waits for the visitor to click or tap it;
landing, skipping, and reduced-motion mode never open it automatically. The flap
then folds up, the envelope fades, and the letter rises in its place. Both share
one CSS grid cell, so opening never shifts the page. The flap is a
`clip-path` triangle, so
its fold shadow is a `drop-shadow` filter rather than a `box-shadow`, which
would be clipped away, and it keeps its backface visible so it stays on screen
while rotating past 90°.

The photo sphere is rendered with three.js `CSS3DRenderer`, the same
technique as the Special Gift gallery globe. Customer photos (1–8 stages)
are repeated across ~170 square tiles on mobile and ~199 on desktop —
Special Gift's counts — and spread with the same Fibonacci-sphere formula
so the ball reads as a dense globe rather than a handful of large cards.
Tiles are single-faced (the far side is a mirror, as in Special Gift).
The tour still visits each stage once: it turns toward a well-spaced
repeat of that stage's photo, not the first N Fibonacci points (which
would cluster at the south pole on a 199-tile ball). Stages without an
image use a travel-themed placeholder.

The plane orbits on its own tilted ring. It is counter-rotated out of both the
ring's spin and its tilt so it always faces the viewer, then turned in 2D to
point along its screen-space tangent. Its lap is clamped to the scene width, so
on a narrow phone the orbit tightens rather than flying off the edge. Radius and
tile size are recomputed on resize.

`.globe-scene` must set `transform-style: preserve-3d` so the sphere and the
orbit share one depth sort — without it the plane always paints on top. Even
with that, the ball is a hollow shell of semi-transparent cards, so CSS cannot
fully hide the plane through gaps; `spinPlane` fades `opacity` from the orbit's
`cos(angle)` and sets `visibility: hidden` on the far half.

New orders store `farewellStages` as an ordered array of 1–8
`{ imageUrl, message }` objects. The image and the message are each optional
and empty stages remain in the array; the template gives a fully empty stage a
travel-themed visual and default message. Each active stage is also rendered in
a dedicated memory panel below the sphere, showing its single image alongside
the message. The message swaps in partway through each turn, not at the end,
so it never describes the visual that has just left the front.

For backward compatibility, `app.js` zips legacy `imageUrls` and
`farewellCaptions` when `farewellStages` is absent, and also accepts the
short-lived multi-image `imageUrls` array per stage from an earlier iteration
(only the first URL is kept). New submissions still keep compact
`imageUrls`/`farewellCaptions` alongside the stage objects for older readers
and the final recap. Stage image URLs remain raw S3 values in JSONB;
`rewriteTemplateDataCDN` rewrites nested `farewellStages[].imageUrl` values
only when serving public data. Payment migration already walks nested JSON.

Everything else on the page is derived from the two cities rather than asked for
in the order form:

- **Flight telemetry** — a fixed chip showing altitude and distance covered,
  visible only while airborne. Altitude ramps over the first and last 12% of the
  tour and cruises at 10.600 m in between.
- **Flight status** — climbing, cruising, half way, descending, under the caption.
- **Stage memory panel** — the current stage's image plus its message; empty
  stages use the placeholder, while image-only or message-only stages preserve
  the supplied content.
- **Countdown** — days until `farewellDepartureDate`, on the boarding pass.
- **Arrival section** — a passport stamp that thuds down on entry, great-circle
  distance (haversine), estimated flight time (distance ÷ 850 km/h plus 36
  minutes), and the time difference.
- **Live dual clocks** — origin and destination time, refreshed every 20s. Offsets
  come from the browser's IANA timezone data via `Intl.DateTimeFormat`, so
  daylight saving stays correct without a lookup table. Destinations with no
  timezone (`other`) hide the clocks and the distance facts.
- **Recap grid** — every photo again with its caption, below the letter.

There are no third-party dependencies. `prefers-reduced-motion` drops the stamp
and the drifting clouds, and skips the flight entirely — the start button goes
straight to the arrival and the letter, where the recap grid still carries every
uploaded stage image and its optional message. Legacy orders with no stages take
that same shortcut.

Supported destination keys, each with an airport code, city, IANA timezone, and
coordinates, are defined in `public/templates/farewell/app.js`; unknown values
fall back to the generic `other` destination. Vietnamese origin cities map to
real airport codes and coordinates for the boarding pass, defaulting to `VN` and
Hanoi's position. The template row is seeded by
`V64__seed_farewell_template.sql`.

## Love Burst

A tap on the start ring launches a WebGL
particle cloud that gathers into each order line in turn, then explodes into a
CSS3D photo globe. Clicking the globe goes inside, then lifts a column of
photos and reveals a sealed envelope; opening it types the letter beside the
first gallery image. Gallery images start downloading as soon as the page
boots (not when the globe appears). `musicUrl` is bound to `#bg-audio` and
starts on the start-screen tap; the shared voice player still owns mute/unmute.

Order JSON stores `messages` (1–4 short strings), `titleMessage`, `content` /
`popupMessage`, `imageUrls`, and `musicUrl`. Background particle counts match the source
site (80k mobile / 120k desktop, lower in in-app browsers). The starfield,
galaxy disk, and shooting stars stay behind the globe after the text sequence.
`prefers-reduced-motion` skips the particle-text sequence and goes straight to the globe.
Seeded by `V66__seed_loveburst_template.sql`.

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
