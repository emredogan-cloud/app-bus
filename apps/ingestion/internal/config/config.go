// Package config loads worker configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
)

// Config is the runtime configuration for the ingestion worker.
type Config struct {
	Env            string
	LogLevel       string
	ServiceVersion string
	HealthAddr     string
	MetricsAddr    string

	// Sources
	IettURL         string
	IettIntervalSec int
	EgoURL          string
	EgoIntervalSec  int

	// Sinks
	RedisURL     string
	MQTTURL      string
	MQTTClientID string
	TimescaleDSN string

	SentryDSN string
}

// Load reads configuration from the environment. Required values fail fast
// when missing; optional values fall through to safe defaults.
func Load() (Config, error) {
	cfg := Config{
		Env:            getOrDefault("APP_ENV", "development"),
		LogLevel:       getOrDefault("LOG_LEVEL", "info"),
		ServiceVersion: getOrDefault("SERVICE_VERSION", "0.0.0"),
		HealthAddr:     getOrDefault("HEALTH_ADDR", ":8080"),
		MetricsAddr:    getOrDefault("METRICS_ADDR", ":9090"),

		IettURL:         os.Getenv("SOURCE_IETT_URL"),
		IettIntervalSec: getInt("SOURCE_IETT_INTERVAL_S", 15),
		EgoURL:          os.Getenv("SOURCE_EGO_URL"),
		EgoIntervalSec:  getInt("SOURCE_EGO_INTERVAL_S", 20),

		RedisURL:     os.Getenv("REDIS_URL"),
		MQTTURL:      os.Getenv("MQTT_URL"),
		MQTTClientID: getOrDefault("MQTT_CLIENT_ID", "app-bus-ingestion"),
		TimescaleDSN: os.Getenv("TIMESCALE_DSN"),

		SentryDSN: os.Getenv("SENTRY_DSN"),
	}

	if cfg.HealthAddr == "" {
		return cfg, errors.New("HEALTH_ADDR cannot be empty")
	}

	if cfg.Env == "production" {
		var missing []string
		if cfg.RedisURL == "" {
			missing = append(missing, "REDIS_URL")
		}
		if cfg.MQTTURL == "" {
			missing = append(missing, "MQTT_URL")
		}
		if cfg.TimescaleDSN == "" {
			missing = append(missing, "TIMESCALE_DSN")
		}
		if len(missing) > 0 {
			return cfg, fmt.Errorf("missing required env in production: %v", missing)
		}
	}

	return cfg, nil
}

func getOrDefault(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func getInt(key string, def int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

// String produces a redacted, log-safe representation.
func (c Config) String() string {
	return fmt.Sprintf(
		"Config{env=%s log=%s ver=%s health=%s metrics=%s iett=%t ego=%t redis=%t mqtt=%t timescale=%t sentry=%t}",
		c.Env, c.LogLevel, c.ServiceVersion, c.HealthAddr, c.MetricsAddr,
		c.IettURL != "", c.EgoURL != "",
		c.RedisURL != "", c.MQTTURL != "", c.TimescaleDSN != "", c.SentryDSN != "",
	)
}
