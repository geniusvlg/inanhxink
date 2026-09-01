# QR Templates

QR templates are listed on `/qr-yeu-thuong` from the `templates` table and use
`template_type` to choose the static template folder served from
`backend-golang/public/templates/<template_type>/`.

## Active Template Types

| Template type | Folder | Order form |
|---|---|---|
| `galaxy` | `galaxy` | Optional envelope message (max 150 characters, responsive display of up to 7 lines); opens automatically after a 3D post-load countdown shown above the planet and stays visible; plus up to 15 images |
| `letterinspace` | `letterinspace` | Up to 20 separately managed falling sentences, 40 characters each |
| `loveletter` | `loveletter` | Letter title, hint, signoff, sender, receiver, content, up to 12 images |
| `lovedays` | `lovedays` | Date, names, secret message, timeline, 2 avatars, up to 10 gallery images |
| `birthday` | `birthday` | Birthday fields, no image uploader |
| `birthdaycake` | `birthdaycake` | Letter title/body, cake inscription, and up to 15 photos |
| `specialgift` | `specialgift` | Start date, left/right names, day label, popup title/content, 2 avatars, and up to 12 gallery images |
| `farewell` | `farewell` | Friend name, origin city, free-text destination, date, farewell letter (max 400 words), up to 12 photos, and up to 12 board messages written separately |
| `loveburst` | `loveburst` | Four separate particle-message inputs (blank inputs are omitted), popup title/letter, and up to 12 gallery images |
| `snowheart` | `snowheart` | Up to five short messages, an optional letter, and up to 15 orbiting photos |

Love Letter reads the server-injected `window.dataFromSubdomain.data` directly
and loads its blocking `app.js` at the end of the body. Do not defer that script
behind another `/api/site-data` request: on a slow iPhone connection the shared
audio player can otherwise receive the first tap before the envelope click
handler exists, forcing the visitor to tap twice.

Letter in Space keeps Three.js and `app.js` out of Cloudflare Rocket Loader and
handles its start button in capture phase on `pointerdown`/`touchstart`. This
ensures its visual transition starts before shared audio playback can suppress
Safari's later synthetic `click`.

Its order form presents each falling sentence as a separate input with
add/remove controls (up to 20 sentences, 40 characters each). The controlled
form still serializes the rows into the existing newline-delimited `content`;
the backend continues deriving `texts`, so existing orders and template
playback remain compatible.

### Farewell / Bon Voyage

A boarding pass opens the page, framed by an airline header ("Inanhxink
Airlines" brand row plus a flight/seat/status strip derived from the gate hash)
and a footer flight-path
strip with the baggage note. Pressing it first hands the screen to a
full-viewport copy of Love Burst's photo sphere, set against `background.jpeg`
that eases into a deep navy night (full moon with halo and a dense painted
star field; reduced motion keeps the day image).
The sphere is a dedicated
interactive stage: tapping or keyboard-activating it transitions to the flight
sequence, where up to 12 photos play one by one under the altitude/distance
progress HUD while an airport-style departure board below them lists every
message (written separately, up to 12) with a different country flag on the
far left of each row. The page then lands on the arrival facts
and a sealed airmail
envelope. A skip button jumps straight there, and the replay button reseals the
envelope and shows the sphere again.

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
then folds up, the paper slides out of the envelope, and the paper zooms to
readable size while the page smooth-scrolls to keep the letter centered.
The letter text and signature use Love Letter's `SVN-ComicSansMS` face, loaded
from `/templates/loveletter/SVN-ComicSansMS.ttf`, so both letters read in the
same hand. There is no book-fold open. Reduced-motion mode reveals the
expanded paper immediately. The flap is a
`clip-path` triangle, so
its fold shadow is a `drop-shadow` filter rather than a `box-shadow`, which
would be clipped away, and it keeps its backface visible so it stays on screen
while rotating past 90°.

The photo sphere uses Love Burst's full three.js implementation: `CSS3DRenderer`,
Tween-based random-to-sphere assembly, `TrackballControls`, a 40-degree camera at
`z = 3000`, 200px image tiles, 540/800 mobile/desktop radii, and continuous
automatic rotation. Customer photos are square-cropped in-browser at 92% JPEG
quality, then repeat across Love Burst's latitude-ring layout. Preprocessing
fetches each CDN image as a blob and decodes a local object URL; this avoids
direct CDN `<img>` loads remaining pending and blocking the entire sphere.
Mobile and in-app browsers use fewer rings. A tap with no more than 12px pointer
travel starts the same inward camera transition as Love Burst, then starts the
Farewell memory sequence instead of Love Burst's rising-photo and envelope
sequence.

New orders store photos and board messages independently: `imageUrls` holds
up to 12 photos, `farewellCaptions` holds up to 12 messages (36 characters)
each; longer rows use compact board text beside the flag, carrier code, and status;
empty rows dropped). A compact `farewellStages` zip is still written so
older template builds keep a paired fallback. After the sphere is tapped, the
photos play as their own slideshow while the departure board lists every
message; the tour lasts as long as the longer of the two lists. Extra photos
after the last message mark every row `ĐÃ QUA`; extra messages after the last
photo keep showing that last frame.

For backward compatibility, `app.js` reads `imageUrls` first and otherwise
collects photos from `farewellStages[].imageUrl` (or the short-lived
per-stage `imageUrls` array, first URL only). Messages prefer
`farewellCaptions` when that list is at least as long as the non-empty stage
messages, so older paired stages do not lose a line that never sat on a
photo. Image URLs remain raw S3 values in JSONB; `rewriteTemplateDataCDN`
rewrites both top-level `imageUrls` and nested `farewellStages[].imageUrl`
when serving public data. Payment migration already walks nested JSON.

The destination is free text from the order form. Arrival shows the typed city
and a stamp code from its first letters. Distance, flight time, time-zone
offset, and live clocks are hidden — those need known coordinates/timezones
that a typed destination does not provide. The in-flight HUD shows progress as
a percent instead of kilometres.

Legacy destination keys such as `australia` still map to their old labels on
the boarding pass. Vietnamese origin cities still map to airport codes.

- **Flight telemetry** — altitude plus a percent progress bar, visible only
  while airborne.
- **Flight status** — climbing, cruising, half way, descending, under the caption.
- **Stage photo panel** — a full-bleed photo with no caption on it, just an
  `Ảnh 02 / 12` counter pill in the corner and progress dots along the bottom.
  The slideshow uses `imageUrls` (up to 12) and is not tied 1:1 to the board.
  An empty photo list falls back to the placeholder.
- **Departure board** — every written message is listed at once under the photo,
  styled like an airport flight-information display: a two-letter carrier
  code paired with the row flag, the
  message, and a status of `ĐÃ QUA` / `ĐANG BAY` / `CHỜ`. The active row is
  highlighted amber, its status cell flips split-flap style on hand-over, and
  the row scrolls itself into view when the list overflows. The board header
  carries the live flight status (climbing, cruising, half way, descending).
- **Countdown** — days until `farewellDepartureDate`, on the boarding pass.
- **Arrival section** — a passport stamp that thuds down on entry, plus the
  destination name. No distance, duration, offset, or clocks.
- **Recap grid** — every photo again with its caption, below the letter.

There are no third-party dependencies. `prefers-reduced-motion` drops the stamp
and the drifting clouds, and skips the flight entirely — the start button goes
straight to the arrival and the letter, where the recap grid still carries every
uploaded stage image and its optional message. Legacy orders with no stages take
that same shortcut. The template row is seeded by
`V64__seed_farewell_template.sql`.

## Love Burst

The boot overlay is a circular heart-ring loader (not the original linear bar).
A tap on the start ring launches a WebGL
particle cloud that gathers into each order line in turn, then explodes into a
CSS3D photo globe that auto-rotates (tap a photo to go inside). Clicking a photo goes inside, then lifts a column of
photos and reveals a sealed envelope; opening it types the letter beside a
slider of every uploaded photo. Gallery images start downloading as soon as the page
boots (not when the globe appears). `musicUrl` is bound to `#bg-audio` and
starts on the start-screen tap; the shared voice player still owns mute/unmute.

Order JSON stores `messages` (1–4 short strings), `titleMessage`, `content` /
`popupMessage`, `imageUrls`, and `musicUrl`. Background particle counts match the source
site (80k mobile / 120k desktop, lower in in-app browsers). The starfield,
galaxy disk, and shooting stars stay behind the globe after the text sequence.
`prefers-reduced-motion` skips the particle-text sequence and goes straight to the globe.
Seeded by `V66__seed_loveburst_template.sql`.

## Snow Heart

A full-screen Three.js winter scene opens on falling snow and photo flakes.
Soft shooting stars periodically cross the deep-blue background.
An animated heart invitation, matching Love Burst's tap affordance, makes the
required interaction explicit. Tapping it starts the original reveal sequence:
the camera descends, snow spirals upward into a beating heart, and the configured
`candyTexts` wrap around it as rotating text rings. Orbit controls remain
enabled after reveal.

Order JSON stores `candyTexts`, up to 15 optional raw-S3 `imageUrls`, and the
shared optional `musicUrl` and voice fields. All five message inputs initialize
empty, and each message is limited to 60 characters. Sentence one starts on
the innermost ring, with each following sentence placed farther outward and
revealed in that order. Uploaded photos are downscaled client-side for GPU
efficiency and orbit outside the rotating text rings after the reveal; public
responses rewrite their URLs to the CDN. The authorized template source and its
four PNG particle assets are kept locally; Three.js 0.157 and its
controls/post-processing modules load from jsDelivr. Seeded by
`V68__seed_snowheart_template.sql`.

The heart scene is composited after the main photo scene with a cleared depth
buffer, so snowflakes forming the heart always remain visually above orbiting
photos.

Snow Heart also accepts an optional `content` letter of up to 400 characters
and an optional `letterTitle` of up to 50 characters. When present, the formed
snow heart becomes clickable after the reveal. Clicking or tapping the heart
displays a text-only Love Burst-style letter dialog; Snow Heart does not include
the image slider. Its title and paper use the Snow Heart blue palette with Love
Letter's `SVN-ComicSansMS` face (loaded from
`/templates/loveletter/SVN-ComicSansMS.ttf`), and the
letter content types in one character at a time (reduced-motion mode shows it
immediately). Keyboard users can focus the canvas and press Enter or Space.
Voice playback continues to start from the initial invitation tap, not from the
letter action. Snow Heart binds music to the shared `#bg-audio` element and
starts it through `window.__inxkPlayBackgroundMusic`, so simultaneous music and
voice use the same saved-volume Web Audio mix as the other QR templates.

## Shared Voice Player

See `docs/qr-voice-recording.md` for the complete recording, pricing, storage,
and playback flow.

Every active template receives the shared
`public/templates/common/voice-player.js` and `.css` assets through
`handlers/templateserve.go`. When `template_data.voiceRecordingUrl` or
`musicUrl` is present, the shared player starts audio and shows controls: a
music mute button when background music exists, and a replay button after a
voice recording has been revealed. Voice plays once at the template's reveal
moment (not on loop); music loops at `template_data.musicVolume` (0–1, default
0.04 with voice and 1 for music-only) and keeps that level while the voice
plays. Existing template background-audio elements remain template-owned but
follow the shared mute/volume when they
use a known music element id. Letter cues such as birthday cake `#letterSound`
are left alone. Galaxy's
`#bg-audio` element also loops its selected background music continuously. If
browser autoplay policy blocks sound, playback starts on the visitor's first
tap, click, or key press anywhere on the template.

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

Click-only start controls that share an element with the voice player use
idempotent, capture-phase `pointerdown`/`touchstart` handlers so their visual
action begins before iOS Safari starts audio. Galaxy, Love Letter, Letter in
Space, Farewell, Love Burst, Special Gift, and Snow Heart follow this pattern.
Special Gift remains non-interactive until its eight-second intro finishes;
Snow Heart queues an early tap until its module has installed the canvas reveal
listener.

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
