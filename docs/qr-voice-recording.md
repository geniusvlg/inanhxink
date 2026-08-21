# QR Voice Recording

## Customer flow

1. On the QR order page, the customer can add background music, a voice
   recording, or both.
2. Voice is recorded in the mobile/desktop browser with `MediaRecorder`, with a
   maximum duration of 30 seconds.
3. The recording remains an in-memory browser `Blob`, allowing replay,
   deletion, and re-recording without uploading anything.
4. When music is ready, the order page shows **Nghe thử** plus an **Âm lượng
   nhạc nền** slider. If a recording exists too, preview plays both: music
   loops at the chosen volume. Voice plays once at full volume. The same mix
   is stored for the live QR page.
5. When the customer clicks **Thanh toán**, the recording is uploaded to
   `uploads/temp/{qrName}/` and attached to the pending order.
6. After payment is confirmed (SePay webhook or admin mark-paid),
   `MigrateQRUploads` moves it to `uploads/{qrName}/` and updates the order
   and live QR template data.

The `uploads/temp/` S3 lifecycle rule expires unpaid temporary files after one
day.

## Pricing and persistence

- Admin configures the add-on through `voice_recording_price` in
  **Admin → Cấu hình → Ghi âm giọng nói cho QR**. Music remains a separate
  add-on (`music_price`). Selecting both charges both.
- `CreateOrder` calculates the price server-side. Browser totals are display
  only.
- `orders` snapshots `voice_recording_added`, `voice_recording_url`, and
  `voice_recording_price`.
- `template_data.voiceRecordingUrl` stores the raw S3 URL.
- `template_data.musicVolume` stores the chosen background volume as a 0–1
  number (default `1` when omitted). It is not an asset URL and is not CDN
  rewritten.
- Public template responses rewrite audio URLs to the CDN; the database and
  admin APIs retain raw S3 URLs.

Schema changes are in `backend-golang/database/V61__qr_voice_recording.sql`.

## Upload constraints

`POST /api/upload/voice`:

- Accepts one browser audio file.
- Allows MP4/M4A, WebM/Opus, Ogg/Opus, MP3, or WAV MIME types.
- Limits the upload to 5 MB.
- Validates the QR name and rejects an already activated name.

`CreateOrder` verifies that the submitted voice URL belongs to
`uploads/temp/{qrName}/`. Music and voice may both be present.

## Template playback

All QR templates receive the shared assets:

- `backend-golang/public/templates/common/voice-player.js`
- `backend-golang/public/templates/common/voice-player.css`

When `voiceRecordingUrl` and/or `musicUrl` exists:

- Background music loops at `musicVolume` (0–1). A mute button controls music
  only (hidden on templates that already have `#musicBtn`: Love Letter, Love
  Days).
- The shared player preloads music and voice into one Web Audio graph and
  mixes them to a single output: music through a GainNode at `musicVolume`,
  voice at full level. That avoids iOS Safari fighting two `<audio>` tags
  (which ignored the saved music volume). If decode/CORS fails, it falls back
  to the HTML audio elements.
- The shared player only touches known background HTML elements as fallback:
  `#bg-audio`, `#inxk-bg-audio`, `#audios`, `#bgMusic`, `#audio`. Birthday cake
  `#letterSound` is left at full volume.
- Voice recordings play once at the template reveal moment (open letter, gift
  box, tap-to-start, …), at full volume. A **Nghe lại lời nhắn** button
  replays afterwards.
- Music keeps playing at `musicVolume` while the voice plays; there is no
  automatic ducking.
- If the browser blocks sound autoplay, playback begins after the visitor's
  first tap, click, or key press anywhere on the page.

Browsers, especially mobile Safari and Chrome, may prohibit audible autoplay
before user interaction. This fallback is required and cannot be bypassed
reliably by application code.
