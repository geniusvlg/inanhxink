package handlers

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgconn"
)

type execTx interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

// IncrementProductSoldCounts adds order line quantities to products.sold_count (by product_id).
func IncrementProductSoldCounts(ctx context.Context, tx execTx, items []OrderItem) error {
	counts := map[int]int{}
	for _, it := range items {
		if it.ProductID <= 0 {
			continue
		}
		counts[it.ProductID] += it.Quantity
	}
	for pid, qty := range counts {
		if qty <= 0 {
			continue
		}
		tag, err := tx.Exec(ctx,
			`UPDATE products SET sold_count = sold_count + $1 WHERE id = $2`,
			qty, pid)
		if err != nil {
			return fmt.Errorf("increment sold_count product_id=%d: %w", pid, err)
		}
		if tag.RowsAffected() == 0 {
			log.Printf("[sold_count] skip missing product_id=%d qty=%d", pid, qty)
		}
	}
	return nil
}
