# QR Voice Recording

## Customer flow

1. On the QR order page, the customer chooses either background music or a
   voice recording. These options are mutually exclusive.
2. Voice is recorded in the mobile/desktop browser with `MediaRecorder`, with a
   maximum duration of 30 seconds.
3. The recording remains an in-memory browser `Blob`, allowing replay,
   deletion, and re-recording without uploading anything.
4. When the customer clicks **Thanh toán**, the recording is uploaded to
   `uploads/temp/{qrName}/` and attached to the pending order.
5. After payment is confirmed (SePay webhook or admin mark-paid),
   `MigrateQRUploads` moves it to `uploads/{qrName}/` and updates the order
   and live QR template data.

The `uploads/temp/` S3 lifecycle rule expires unpaid temporary files after one
day.

## Pricing and persistence

- Admin configures the add-on through `voice_recording_price` in
  **Admin → Cấu hình → Ghi âm giọng nói cho QR**.
- `CreateOrder` calculates the price server-side. Browser totals are display
  only.
- `orders` snapshots `voice_recording_added`, `voice_recording_url`, and
  `voice_recording_price`.
- `template_data.voiceRecordingUrl` stores the raw S3 URL.
- Public template responses rewrite that URL to the CDN; the database and admin
  APIs retain the raw S3 URL.

Schema changes are in `backend-golang/database/V61__qr_voice_recording.sql`.

## Upload constraints

`POST /api/upload/voice`:

- Accepts one browser audio file.
- Allows MP4/M4A, WebM/Opus, Ogg/Opus, MP3, or WAV MIME types.
- Limits the upload to 5 MB.
- Validates the QR name and rejects an already activated name.

`CreateOrder` verifies that the submitted URL belongs to
`uploads/temp/{qrName}/` and rejects requests selecting both music and voice.

## Template playback

All QR templates receive the shared assets:

- `backend-golang/public/templates/common/voice-player.js`
- `backend-golang/public/templates/common/voice-player.css`

When `voiceRecordingUrl` or `musicUrl` exists:

- Playback is attempted automatically.
- Voice recordings loop.
- A fixed button controls mute/unmute.
- If the browser blocks sound autoplay, playback begins after the visitor's
  first tap, click, or key press anywhere on the page.

Browsers, especially mobile Safari and Chrome, may prohibit audible autoplay
before user interaction. This fallback is required and cannot be bypassed
reliably by application code.
