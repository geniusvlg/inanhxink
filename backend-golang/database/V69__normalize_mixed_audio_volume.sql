-- Normalize existing QR music + voice mixes so recordings remain audible.
UPDATE qr_codes
SET template_data = jsonb_set(template_data, '{musicVolume}', '0.03'::jsonb, true),
    updated_at = CURRENT_TIMESTAMP
WHERE NULLIF(BTRIM(template_data->>'musicUrl'), '') IS NOT NULL
  AND NULLIF(BTRIM(template_data->>'voiceRecordingUrl'), '') IS NOT NULL;

-- Keep the source order snapshot consistent with its activated QR data.
UPDATE orders
SET template_data = jsonb_set(template_data, '{musicVolume}', '0.03'::jsonb, true),
    updated_at = CURRENT_TIMESTAMP
WHERE NULLIF(BTRIM(template_data->>'musicUrl'), '') IS NOT NULL
  AND NULLIF(BTRIM(template_data->>'voiceRecordingUrl'), '') IS NOT NULL;
