-- Store raw SePay webhook payload for auditing / debugging
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS webhook_payload JSONB;
