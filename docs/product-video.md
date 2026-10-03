# Product videos

Products can have one optional video, shown before the product images on
the public product-detail page.

## Storage and API

- `products.video_url` stores the raw VNG vStorage URL of the converted MP4.
  Admin APIs return that raw URL; `GET /api/products/:id` rewrites it to the CDN.
- The original file is uploaded with a presigned PUT. Conversion starts only
  when the admin saves the product. Admin routes are protected by admin JWT
  middleware:
  - `POST /api/admin/products/:id/video/presign` checks the file type and size,
    creates a `product_video_job` row, and returns a five-minute PUT URL.
  - The browser PUTs the original file directly to VNG. The form then shows
    that the upload finished and waits.
  - `POST .../commit` starts conversion if it has not started, and tells the
    worker to write `video_url` when the MP4 is ready. `POST .../process` can
    start conversion on its own. `POST .../cancel` drops an upload the admin
    did not keep.
  - `GET /api/admin/products/:id/video/jobs/:jobId` reports job status. The
    conversion percent is kept in memory on this backend process and included
    while the job is `processing`.
- Accepted inputs are MP4, WebM, and QuickTime/MOV (including iPhone video), up
  to 100 MB. There is no duration limit.
- The backend uses `ffmpeg` to produce an H.264/AAC MP4 with `faststart`. The
  longer side is capped at 1920 pixels. Video is encoded at CRF 26 and audio
  at 96 kbps.
- Originals are stored under `products/{type}/product-{id}/video/source/` and
  deleted after conversion. The MP4 is stored under
  `products/{type}/product-{id}/video/`.

The VNG bucket CORS rule must allow browser `PUT` from the admin origin
(`https://admin.inanhxink.com`, `http://localhost:5174`, and the current ngrok
admin host when testing from a phone) with the `Content-Type` and `x-amz-acl`
headers. See `docs/golang-backend.md`.

The Docker backend image includes ffmpeg. Local development needs ffmpeg
installed and available on `PATH`. A server restart marks an in-flight job as
failed and leaves the previously saved video in place.

## Admin flow

The product must be an existing product or a reserved draft. Selecting a video
uploads it directly to VNG. The form then shows that the upload finished. The
rest of the form stays editable, and conversion does not start yet.

- The direct upload is the only part that must finish before the file is safe.
  Saving during that upload asks whether to save the other fields without the
  new video.
- **Lưu** after the upload finishes saves the product immediately and starts
  conversion. The product list and the product form then show that a video was
  uploaded and the conversion percent. The MP4 is attached when it is ready.
  The previous video stays until that MP4 exists. Closing the form without
  saving cancels an upload that was not saved. Closing it after **Lưu** keeps
  the converted video.
- Conversion failure shows the server error. A saved product keeps its previous
  video. Reopening the product shows the error if a committed job failed.
- Replacing or clearing a saved video deletes the previous object only after
  the replacement is saved or the committed job finishes. Cancelling the form
  cancels an uncommitted job and deletes its objects.

## Public playback

When `video_url` is present, the product-detail gallery puts its video thumbnail
before all image thumbnails. The main player starts muted, with `playsinline`
and `loop`, because phones block autoplay when sound is on. A sound button
unmutes after a tap.
