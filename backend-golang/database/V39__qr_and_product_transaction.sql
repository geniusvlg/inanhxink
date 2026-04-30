-- Rename existing transactions table to qr_transaction
ALTER TABLE transactions RENAME TO qr_transaction;

-- Rename associated indexes and constraints
ALTER INDEX IF EXISTS idx_transactions_order_id RENAME TO idx_qr_transaction_order_id;
ALTER INDEX IF EXISTS transactions_pkey RENAME TO qr_transaction_pkey;

-- Create new product_transaction table for product order payments
CREATE TABLE IF NOT EXISTS product_transaction (
    id                   SERIAL PRIMARY KEY,
    product_order_id     INTEGER NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    amount               NUMERIC(12, 2) NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
    payment_qr_url       TEXT,
    sepay_transaction_id INTEGER,
    webhook_payload      TEXT,
    paid_at              TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_transaction_product_order_id ON product_transaction(product_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_transaction_sepay_id ON product_transaction(sepay_transaction_id) WHERE sepay_transaction_id IS NOT NULL;

-- Fulfillment pipeline for paid product orders.
-- NULL  = newly paid, not yet picked up by staff
-- preparing = Đang chuẩn bị
-- packing   = Đóng gói
-- shipped   = Đã giao cho đơn vị vận chuyển
ALTER TABLE product_orders
  ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(20)
    CHECK (fulfillment_status IN ('preparing', 'packing', 'shipped'));

ALTER TABLE product_orders
  ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_product_orders_fulfillment ON product_orders(fulfillment_status);
