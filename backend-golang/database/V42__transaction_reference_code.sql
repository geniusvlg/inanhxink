ALTER TABLE qr_transaction
ADD COLUMN IF NOT EXISTS reference_code TEXT;

ALTER TABLE product_transaction
ADD COLUMN IF NOT EXISTS reference_code TEXT;
