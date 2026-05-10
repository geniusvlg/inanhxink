package notify

import (
	"fmt"
	"strings"
)

// QROrderPaidDetail is passed when a QR/template order is marked paid.
type QROrderPaidDetail struct {
	OrderID       int
	QRName        string
	TemplateType  string
	CustomerName  string
	CustomerEmail string
	CustomerPhone string
	Total         float64
	Domain        string // primary site host, e.g. inanhxink.com
}

// ProductOrderPaidDetail is passed when a shop product order is marked paid.
type ProductOrderPaidDetail struct {
	OrderID         int
	InvoiceNumber   string
	CustomerName    string
	CustomerPhone   string
	CustomerEmail   string
	CustomerAddress string
	Subtotal        float64
	ShippingFee     float64
	Total           float64
	ItemsLines      string // preformatted Vietnamese lines
}

func dash(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "—"
	}
	return s
}

func vnd(v float64) string {
	return fmt.Sprintf("%s đ", formatAmount(v))
}

func formatAmount(v float64) string {
	return fmt.Sprintf("%.0f", v)
}

func buildQREmailBody(d QROrderPaidDetail) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Đây là email tự động từ hệ thống inanhxink.\n\n")
	fmt.Fprintf(&b, "ĐƠN QR / MẪU CÁ NHÂN — ĐÃ THANH TOÁN\n\n")
	fmt.Fprintf(&b, "━━ Thông tin đơn ━━\n")
	fmt.Fprintf(&b, "• Mã đơn (ID): %d\n", d.OrderID)
	fmt.Fprintf(&b, "• Tên QR (subdomain): %s\n", dash(d.QRName))
	fmt.Fprintf(&b, "• Loại mẫu: %s\n", dash(d.TemplateType))
	qn := strings.TrimSpace(d.QRName)
	dom := strings.TrimSpace(d.Domain)
	if qn == "" {
		fmt.Fprintf(&b, "• Link trang: —\n")
	} else if dom != "" {
		fmt.Fprintf(&b, "• Link trang: https://%s.%s\n", qn, dom)
	} else {
		fmt.Fprintf(&b, "• Link trang: https://%s\n", qn)
	}
	fmt.Fprintf(&b, "• Tổng thanh toán: %s\n\n", vnd(d.Total))
	fmt.Fprintf(&b, "━━ Khách hàng ━━\n")
	fmt.Fprintf(&b, "• Họ tên: %s\n", dash(d.CustomerName))
	fmt.Fprintf(&b, "• SĐT: %s\n", dash(d.CustomerPhone))
	fmt.Fprintf(&b, "• Email: %s\n\n", dash(d.CustomerEmail))
	fmt.Fprintf(&b, "──\nVui lòng kiểm tra đơn trên trang quản trị.\n")
	return b.String()
}

func buildProductEmailBody(d ProductOrderPaidDetail) string {
	items := strings.TrimSpace(d.ItemsLines)
	if items == "" {
		items = "  (Không có chi tiết sản phẩm)\n"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "Đây là email tự động từ hệ thống inanhxink.\n\n")
	fmt.Fprintf(&b, "ĐƠN HÀNG SẢN PHẨM — ĐÃ THANH TOÁN\n\n")
	fmt.Fprintf(&b, "━━ Thông tin đơn ━━\n")
	fmt.Fprintf(&b, "• Mã đơn (ID): %d\n", d.OrderID)
	fmt.Fprintf(&b, "• Mã hóa đơn / nội dung CK: %s\n", dash(d.InvoiceNumber))
	fmt.Fprintf(&b, "• Trạng thái: Đã thanh toán\n\n")
	fmt.Fprintf(&b, "━━ Sản phẩm ━━\n%s\n", items)
	fmt.Fprintf(&b, "━━ Giá trị ━━\n")
	fmt.Fprintf(&b, "• Tạm tính (hàng): %s\n", vnd(d.Subtotal))
	fmt.Fprintf(&b, "• Phí vận chuyển: %s\n", vnd(d.ShippingFee))
	fmt.Fprintf(&b, "• Tổng thanh toán: %s\n\n", vnd(d.Total))
	fmt.Fprintf(&b, "━━ Giao hàng / liên hệ ━━\n")
	fmt.Fprintf(&b, "• Họ tên: %s\n", dash(d.CustomerName))
	fmt.Fprintf(&b, "• SĐT: %s\n", dash(d.CustomerPhone))
	fmt.Fprintf(&b, "• Email: %s\n", dash(d.CustomerEmail))
	fmt.Fprintf(&b, "• Địa chỉ giao hàng: %s\n\n", dash(d.CustomerAddress))
	fmt.Fprintf(&b, "──\nVui lòng xử lý đơn trên trang quản trị (đơn sản phẩm).\n")
	return b.String()
}
