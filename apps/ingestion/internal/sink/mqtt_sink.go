package sink

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	"github.com/app-bus/ingestion/internal/types"
)

// MqttSink publishes each Position to:
//   positions/{city}/{route_external_id}
// with QoS 0 (best-effort, latest-wins) and retained=false.
type MqttSink struct {
	client mqtt.Client
	logger *slog.Logger
}

func NewMqttSink(url, clientID string, logger *slog.Logger) (*MqttSink, error) {
	opts := mqtt.NewClientOptions().
		AddBroker(url).
		SetClientID(clientID).
		SetAutoReconnect(true).
		SetConnectRetry(true).
		SetConnectRetryInterval(2 * time.Second).
		SetCleanSession(true)

	c := mqtt.NewClient(opts)
	if t := c.Connect(); t.WaitTimeout(5*time.Second) && t.Error() != nil {
		return nil, t.Error()
	}
	return &MqttSink{client: c, logger: logger}, nil
}

func (*MqttSink) Name() string { return "mqtt" }

func (s *MqttSink) Send(_ context.Context, p types.Position) {
	if p.RouteExternalID == "" {
		return
	}
	body, err := json.Marshal(p)
	if err != nil {
		s.logger.Warn("mqtt marshal failed", "err", err)
		return
	}
	topic := "positions/" + p.CityCode + "/" + p.RouteExternalID
	tok := s.client.Publish(topic, 0, false, body)
	// QoS 0: don't WaitTimeout — we accept best-effort
	go func() {
		_ = tok.Wait()
	}()
}

func (s *MqttSink) Close(_ context.Context) error {
	s.client.Disconnect(250)
	return nil
}
