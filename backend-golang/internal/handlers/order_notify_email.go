package handlers

import (
	"fmt"
	"strings"
)

// FormatProductOrderItemsVN builds a multi-line Vietnamese summary of cart lines for admin notification emails.
func FormatProductOrderItemsVN(items []OrderItem) string {
	if len(items) == 0 {
		return "  (Không có dòng sản phẩm trong đơn)\n"
	}
	var b strings.Builder
	for i, it := range items {
		name := strings.TrimSpace(it.ProductName)
		if name == "" {
			name = fmt.Sprintf("Sản phẩm #%d", it.ProductID)
		}
		lineTotal := float64(it.Quantity) * it.UnitPrice
		fmt.Fprintf(&b, "  %d) %s\n", i+1, name)
		if v := strings.TrimSpace(it.VariantName); v != "" {
			fmt.Fprintf(&b, "     • Phân loại: %s\n", v)
		}
		fmt.Fprintf(&b, "     • Số lượng: %d × %sđ  →  %sđ\n",
			it.Quantity, formatVNDNoSuffix(it.UnitPrice), formatVNDNoSuffix(lineTotal))
		if note := strings.TrimSpace(it.Note); note != "" {
			fmt.Fprintf(&b, "     • Ghi chú khách: %s\n", note)
		}
	}
	return b.String()
}

func formatVNDNoSuffix(v float64) string {
	return fmt.Sprintf("%.0f", v)
}
