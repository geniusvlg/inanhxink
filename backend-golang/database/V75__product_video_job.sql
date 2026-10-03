CREATE TABLE IF NOT EXISTS product_video_job (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    source_url TEXT,
    output_url TEXT,
    error TEXT,
    apply_on_success BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_video_job_product_id_idx
    ON product_video_job (product_id, id DESC);
