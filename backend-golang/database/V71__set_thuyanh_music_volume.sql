-- Raise the background music for the thuyanh QR to 10%.
UPDATE qr_codes
SET template_data = jsonb_set(template_data, '{musicVolume}', '0.10'::jsonb, true),
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(qr_name) = 'thuyanh'
  AND NULLIF(BTRIM(template_data->>'musicUrl'), '') IS NOT NULL;

-- Keep the source order snapshot consistent with the activated QR.
UPDATE orders
SET template_data = jsonb_set(template_data, '{musicVolume}', '0.10'::jsonb, true),
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(qr_name) = 'thuyanh'
  AND NULLIF(BTRIM(template_data->>'musicUrl'), '') IS NOT NULL;
