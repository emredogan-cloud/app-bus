package types

import (
	"encoding/json"
	"testing"
	"time"
)

func TestPosition_JSONRoundTrip(t *testing.T) {
	p := Position{
		VehicleID:       "iett:34ABC123",
		OperatorCode:    "iett",
		RouteExternalID: "500T",
		CityCode:        "IST",
		Lat:             41.036,
		Lng:             28.985,
		SpeedKmh:        42.5,
		Heading:         180,
		RecordedAt:      time.Now().UTC().Truncate(time.Second),
		SourceLagMs:     750,
	}

	buf, err := json.Marshal(p)
	if err != nil {
		t.Fatal(err)
	}
	var got Position
	if err := json.Unmarshal(buf, &got); err != nil {
		t.Fatal(err)
	}
	if got.VehicleID != p.VehicleID || got.SpeedKmh != p.SpeedKmh {
		t.Errorf("round trip lost data: %+v vs %+v", p, got)
	}
}
