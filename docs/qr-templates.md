# QR Templates

QR templates are listed on `/qr-yeu-thuong` from the `templates` table and use
`template_type` to choose the static template folder served from
`backend-golang/public/templates/<template_type>/`.

## Active Template Types

| Template type | Folder | Order form |
|---|---|---|
| `galaxy` | `galaxy` | Text lines plus up to 12 images |
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
the shared mute button. If browser autoplay policy blocks sound, playback starts
on the visitor's first tap, click, or key press anywhere on the template.

Template implementations do not need their own voice-message code. Public
template data is CDN-rewritten before it is injected into
`window.dataFromSubdomain`.

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
