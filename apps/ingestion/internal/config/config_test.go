package config

import (
	"testing"
)

func TestLoad_DefaultsWhenEmpty(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("LOG_LEVEL", "")
	t.Setenv("HEALTH_ADDR", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Env != "development" {
		t.Errorf("Env default = %q, want development", cfg.Env)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("LogLevel default = %q, want info", cfg.LogLevel)
	}
	if cfg.HealthAddr != ":8080" {
		t.Errorf("HealthAddr default = %q, want :8080", cfg.HealthAddr)
	}
	if cfg.MetricsAddr != ":9090" {
		t.Errorf("MetricsAddr default = %q, want :9090", cfg.MetricsAddr)
	}
}

func TestLoad_ProductionRequiresSinks(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("REDIS_URL", "")
	t.Setenv("MQTT_URL", "")
	t.Setenv("TIMESCALE_DSN", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error: prod requires REDIS_URL/MQTT_URL/TIMESCALE_DSN")
	}
}

func TestLoad_PicksUpEnv(t *testing.T) {
	t.Setenv("APP_ENV", "staging")
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("HEALTH_ADDR", ":9100")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Env != "staging" {
		t.Errorf("Env = %q, want staging", cfg.Env)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("LogLevel = %q, want debug", cfg.LogLevel)
	}
	if cfg.HealthAddr != ":9100" {
		t.Errorf("HealthAddr = %q, want :9100", cfg.HealthAddr)
	}
}

func TestString_DoesNotLeakSecrets(t *testing.T) {
	c := Config{
		RedisURL:     "redis://user:pass@host:6379",
		MQTTURL:      "mqtt://creds@host",
		TimescaleDSN: "postgres://creds@host",
		SentryDSN:    "https://key@sentry.io/123",
	}
	s := c.String()
	for _, secret := range []string{"pass", "creds", "key"} {
		if contains(s, secret) {
			t.Errorf("String() leaked %q: %s", secret, s)
		}
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
