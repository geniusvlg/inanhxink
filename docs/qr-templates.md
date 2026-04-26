# QR Templates

QR templates are listed on `/qr-yeu-thuong` from the `templates` table and use
`template_type` to choose the static template folder served from
`backend/public/templates/<template_type>/`.

## Active Template Types

| Template type | Folder | Order form |
|---|---|---|
| `galaxy` | `galaxy` | Text lines plus up to 12 images |
| `letterinspace` | `letterinspace` | Letter-in-space text form |
| `loveletter` | `loveletter` | Letter title, hint, signoff, sender, receiver, content, up to 12 images |
| `lovedays` | `lovedays` | Date, names, secret message, timeline, 2 avatars, up to 10 gallery images |
| `birthday` | `birthday` | Birthday fields, no image uploader |
| `specialgift` | `specialgift` | Start date, left/right names, day label, popup title/content, 2 avatars, and up to 12 gallery images |

## Adding A Template

1. Add the static template folder under `backend/public/templates/`.
2. Add or activate a `templates` table row with the matching `template_type`.
   Upload the thumbnail from Admin → QR Templates; uploaded thumbnails are
   stored in S3 under `templates/{template_type}/` and saved as raw S3 URLs.
3. Add the type to `VALID_TEMPLATE_TYPES` and `TEMPLATE_FOLDER_MAP` in
   `backend/routes/orders.ts`.
4. If the order form needs custom fields, add them in
   `frontend-app/src/pages/OrderPage.tsx`; otherwise it will use the generic
   content editor and image uploader.
