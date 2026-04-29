-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id                   SERIAL PRIMARY KEY,
  order_id             INTEGER NOT NULL REFERENCES orders(id),
  amount               DECIMAL(10, 2) NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | paid | failed
  payment_qr_url       TEXT,
  sepay_transaction_id BIGINT,
  paid_at              TIMESTAMP,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status   ON transactions(status);

-- Add payment-related columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS template_type VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS template_data JSONB;
