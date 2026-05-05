// Package config loads worker configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
)

// Config is the runtime configuration for the ingestion worker.
type Config struct {
	Env            string
	LogLevel       string
	ServiceVersion string
	HealthAddr     string
	// Phase 3+ wiring (left blank in Phase 0):
	RedisURL      string
	MQTTURL       string
	TimescaleDSN  string
	SentryDSN     string
}

// Load reads configuration from the environment. Required values fail fast
// when missing; optional values fall through to safe defaults.
func Load() (Config, error) {
	cfg := Config{
		Env:            getOrDefault("APP_ENV", "development"),
		LogLevel:       getOrDefault("LOG_LEVEL", "info"),
		ServiceVersion: getOrDefault("SERVICE_VERSION", "0.0.0"),
		HealthAddr:     getOrDefault("HEALTH_ADDR", ":8080"),
		RedisURL:       os.Getenv("REDIS_URL"),
		MQTTURL:        os.Getenv("MQTT_URL"),
		TimescaleDSN:   os.Getenv("TIMESCALE_DSN"),
		SentryDSN:      os.Getenv("SENTRY_DSN"),
	}

	if cfg.Env == "production" {
		var missing []string
		// In Phase 3 we'll add: REDIS_URL, MQTT_URL, TIMESCALE_DSN.
		// Phase 0 has no required prod-only values yet.
		_ = missing
	}

	if cfg.HealthAddr == "" {
		return cfg, errors.New("HEALTH_ADDR cannot be empty")
	}

	return cfg, nil
}

func getOrDefault(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

// String produces a redacted, log-safe representation.
func (c Config) String() string {
	return fmt.Sprintf("Config{env=%s log=%s ver=%s health=%s redis=%t mqtt=%t timescale=%t sentry=%t}",
		c.Env, c.LogLevel, c.ServiceVersion, c.HealthAddr,
		c.RedisURL != "", c.MQTTURL != "", c.TimescaleDSN != "", c.SentryDSN != "")
}
