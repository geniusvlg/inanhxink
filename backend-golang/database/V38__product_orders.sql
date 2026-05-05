-- Physical product orders placed via the storefront cart.
-- Separate from the QR/template orders table.
-- cart_session_id is a UUID generated client-side for idempotency.
CREATE TABLE IF NOT EXISTS product_orders (
  id               SERIAL PRIMARY KEY,
  cart_session_id  VARCHAR(36) UNIQUE NOT NULL,
  invoice_number   VARCHAR(50),
  payment_status   VARCHAR(20) NOT NULL DEFAULT 'pending',

  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  customer_email   TEXT,
  customer_address TEXT NOT NULL,

  -- JSON array: [{ product_id, product_name, quantity, unit_price, image_urls: [], note: "" }]
  items            JSONB NOT NULL DEFAULT '[]',

  subtotal         DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,

  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_orders_payment_status ON product_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_product_orders_created_at     ON product_orders(created_at DESC);
