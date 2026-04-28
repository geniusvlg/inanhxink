-- Indexes to support per-type category filtering and product listing queries.

-- Covers: WHERE p.type = $1 AND p.is_active = true  (GET /api/categories?type=)
--         WHERE p.type = $1 AND p.is_active = true  (GET /api/products?type=)
CREATE INDEX IF NOT EXISTS idx_products_type_active ON products(type, is_active);

-- Covers: JOIN product_category_map m ON m.category_id = pc.id
-- The composite PK (product_id, category_id) only helps lookups by product_id first;
-- this index enables efficient reverse lookups by category_id.
CREATE INDEX IF NOT EXISTS idx_category_map_category_id ON product_category_map(category_id);
