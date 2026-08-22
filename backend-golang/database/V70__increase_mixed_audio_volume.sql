-- Raise every existing QR music + voice mix from the earlier 3% normalization
-- to the new 4% default so recordings stay clear without making music too soft.
UPDATE qr_codes
SET template_data = jsonb_set(template_data, '{musicVolume}', '0.04'::jsonb, true),
    updated_at = CURRENT_TIMESTAMP
WHERE NULLIF(BTRIM(template_data->>'musicUrl'), '') IS NOT NULL
  AND NULLIF(BTRIM(template_data->>'voiceRecordingUrl'), '') IS NOT NULL;

-- Keep the source order snapshot consistent with its activated QR data.
UPDATE orders
SET template_data = jsonb_set(template_data, '{musicVolume}', '0.04'::jsonb, true),
    updated_at = CURRENT_TIMESTAMP
WHERE NULLIF(BTRIM(template_data->>'musicUrl'), '') IS NOT NULL
  AND NULLIF(BTRIM(template_data->>'voiceRecordingUrl'), '') IS NOT NULL;
