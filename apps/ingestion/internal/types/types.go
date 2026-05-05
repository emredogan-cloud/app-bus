// Package types defines the canonical data shapes for the ingestion pipeline.
package types

import "time"

// Position is the canonical, source-agnostic vehicle position record that
// flows through the pipeline.
type Position struct {
	// Operator-prefixed vehicle id, e.g. "iett:34ABC123"
	VehicleID string `json:"vehicle_id"`
	// Operator code matching DB.Operator.code (e.g. "iett", "ego")
	OperatorCode string `json:"operator_code"`
	// Stable id of the route in the API DB, resolved at the source
	RouteExternalID string `json:"route_external_id"`
	// Resolved Route.id (UUID) — populated by the route-resolver stage
	RouteID string `json:"route_id,omitempty"`
	// City code: "IST" or "ANK"
	CityCode string `json:"city"`
	// Geographic coordinates (WGS84)
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
	// Speed in km/h; some sources only provide 0 — caller may interpolate
	SpeedKmh float32 `json:"speed_kmh"`
	// Heading in degrees, 0–360
	Heading float32 `json:"heading"`
	// When the source captured this fix; falls back to time.Now() if absent
	RecordedAt time.Time `json:"recorded_at"`
	// Lag from source-recorded-at to ingestion timestamp, in milliseconds
	SourceLagMs int64 `json:"source_lag_ms"`
}
