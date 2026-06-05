package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const spxTrackingAPI = "https://spx.vn/shipment/order/open/order/get_order_info"

var spxStatusVI = map[string]string{
	"Delivered":         "Đã giao hàng",
	"Out For Delivery":  "Đang giao hàng",
	"Out for delivery":  "Đang giao hàng",
	"In transit":        "Đang vận chuyển",
	"Preparing to ship": "Chờ lấy hàng",
	"Manifested":        "Chờ lấy hàng",
	"Picked up":         "Đã lấy hàng",
}

var spxMilestones = []struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Code  int    `json:"code"`
}{
	{Key: "pickup", Label: "Chờ lấy hàng", Code: 1},
	{Key: "transit", Label: "Đang vận chuyển", Code: 5},
	{Key: "out_for_delivery", Label: "Đang giao hàng", Code: 6},
	{Key: "delivered", Label: "Đã giao hàng", Code: 8},
}

type spxAPIResponse struct {
	Retcode int    `json:"retcode"`
	Message string `json:"message"`
	Data    struct {
		OrderInfo struct {
			SpxTN                   string `json:"spx_tn"`
			TrackingCodeGroupName   string `json:"tracking_code_group_name"`
			TrackingCodeSubgroupName string `json:"tracking_code_subgroup_name"`
		} `json:"order_info"`
		SlsTrackingInfo struct {
			Records []struct {
				TrackingName      string `json:"tracking_name"`
				Description       string `json:"description"`
				BuyerDescription  string `json:"buyer_description"`
				DisplayFlag       int    `json:"display_flag"`
				ActualTime        int64  `json:"actual_time"`
				MilestoneCode     int    `json:"milestone_code"`
				MilestoneName     string `json:"milestone_name"`
			} `json:"records"`
		} `json:"sls_tracking_info"`
	} `json:"data"`
}

// GET /api/orders/spx-tracking?spx_tn=SPXVN...
func SpxTracking(w http.ResponseWriter, r *http.Request) {
	spxTN := strings.TrimSpace(r.URL.Query().Get("spx_tn"))
	if spxTN == "" {
		BadRequest(w, "spx_tn is required")
		return
	}

	url := fmt.Sprintf("%s?spx_tn=%s&language_code=vi", spxTrackingAPI, spxTN)
	resp, err := http.Get(url) //nolint:noctx
	if err != nil {
		InternalError(w, fmt.Errorf("spx api request failed: %w", err))
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		InternalError(w, fmt.Errorf("spx api read failed: %w", err))
		return
	}

	var raw spxAPIResponse
	if err := json.Unmarshal(body, &raw); err != nil {
		InternalError(w, fmt.Errorf("spx api parse failed: %w", err))
		return
	}
	if raw.Retcode != 0 {
		OK(w, map[string]any{"success": false})
		return
	}

	// Verify the returned spx_tn matches what was submitted.
	// The SPX API can return data for an unrelated order when given a bare
	// numeric ID, so we reject any response where the tracking numbers differ.
	if !strings.EqualFold(raw.Data.OrderInfo.SpxTN, spxTN) {
		OK(w, map[string]any{"success": false})
		return
	}

	records := raw.Data.SlsTrackingInfo.Records
	currentMilestone := 0
	var deliveryTime int64
	for _, rec := range records {
		if rec.MilestoneCode > currentMilestone {
			currentMilestone = rec.MilestoneCode
		}
		if rec.MilestoneCode == 8 && rec.ActualTime > deliveryTime {
			deliveryTime = rec.ActualTime
		}
	}

	statusGroup := raw.Data.OrderInfo.TrackingCodeGroupName
	statusLabel := spxStatusVI[statusGroup]
	if statusLabel == "" {
		statusLabel = spxStatusVI[raw.Data.OrderInfo.TrackingCodeSubgroupName]
	}
	if statusLabel == "" {
		statusLabel = statusGroup
	}

	milestones := make([]map[string]any, len(spxMilestones))
	for i, m := range spxMilestones {
		milestones[i] = map[string]any{
			"key":   m.Key,
			"label": m.Label,
			"done":  currentMilestone >= m.Code,
		}
	}

	events := make([]map[string]any, 0)
	for _, rec := range records {
		if rec.DisplayFlag != 1 {
			continue
		}
		desc := strings.TrimSpace(rec.BuyerDescription)
		if desc == "" {
			desc = strings.TrimSpace(rec.Description)
		}
		t := time.Unix(rec.ActualTime, 0)
		events = append(events, map[string]any{
			"time":        t.Format("15:04:05"),
			"date":        t.Format("02 Jan 2006"),
			"description": desc,
			"milestone":   rec.MilestoneCode,
		})
	}

	var deliveryDate any
	if deliveryTime > 0 {
		deliveryDate = time.Unix(deliveryTime, 0).Format("02 Jan")
	}

	OK(w, map[string]any{
		"success": true,
		"tracking": map[string]any{
			"spx_tn":        raw.Data.OrderInfo.SpxTN,
			"status":        statusLabel,
			"status_group":  statusGroup,
			"delivery_date": deliveryDate,
			"milestones":    milestones,
			"events":        events,
		},
	})
}
