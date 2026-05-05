import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { MqttClient } from 'mqtt';
import { Subject } from 'rxjs';
import type { AppEnv } from '../../config/env.js';
import type { VehicleUpdate } from './types.js';

/**
 * Subscribes to all `positions/+/+` topics from EMQX and re-emits each
 * incoming message as a typed VehicleUpdate via an Rx Subject.
 *
 * The gateway consumes from the Subject and routes to interested sockets.
 */
@Injectable()
export class MqttBridge implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(MqttBridge.name);
  private client: MqttClient | null = null;
  readonly updates$ = new Subject<VehicleUpdate>();

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  onApplicationBootstrap(): void {
    const url = this.config.get<string>('MQTT_URL', { infer: true } as never) as string | undefined;
    if (!url) {
      this.log.warn('MQTT_URL not set — live gateway will not receive position updates');
      return;
    }
    this.connect(url);
  }

  onApplicationShutdown(): void {
    this.client?.end();
    this.updates$.complete();
  }

  private connect(url: string): void {
    this.client = mqtt.connect(url, {
      clientId: `app-bus-api-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
      reconnectPeriod: 2000,
      clean: true,
    });

    this.client.on('connect', () => {
      this.log.log(`mqtt connected: ${url}`);
      this.client!.subscribe('positions/+/+', { qos: 0 }, (err) => {
        if (err) this.log.error(`mqtt subscribe failed: ${err.message}`);
      });
    });

    this.client.on('error', (err) => this.log.error(`mqtt error: ${err.message}`));

    this.client.on('message', (topic, payload) => {
      try {
        const json = JSON.parse(payload.toString('utf8'));
        const parts = topic.split('/');
        // positions/{city}/{route_external_id}
        const update: VehicleUpdate = {
          vehicle_id: json.vehicle_id,
          route_external_id: json.route_external_id ?? parts[2],
          city: (json.city ?? parts[1]) as 'IST' | 'ANK',
          lat: json.lat,
          lng: json.lng,
          speed_kmh: json.speed_kmh ?? 0,
          heading: json.heading ?? 0,
          recorded_at: json.recorded_at,
        };
        if (
          typeof update.lat !== 'number' ||
          typeof update.lng !== 'number' ||
          !update.vehicle_id ||
          !update.route_external_id ||
          !update.city
        ) {
          return;
        }
        this.updates$.next(update);
      } catch (err) {
        this.log.warn(`mqtt message parse failed: ${(err as Error).message}`);
      }
    });
  }
}
