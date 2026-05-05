import { Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.js';
import { JwtService, TokenError } from '../jwt/jwt.service.js';
import { MqttBridge } from './mqtt.bridge.js';
import { SubscriptionRegistry } from './subscription.registry.js';
import { SubscribeRequestSchema, bboxDiagonalKm } from './types.js';
import type { VehicleUpdate } from './types.js';

/**
 * Live position WebSocket gateway at namespace `/live` (under the global `/v1`
 * prefix this becomes `/v1/live` because Socket.IO mounts on the bare server
 * path).
 *
 * Wire protocol (client → server):
 *   - "subscribe"   { kind: "route" | "bbox", … }   → ack { sub_id } | { error }
 *   - "unsubscribe" { sub_id }                      → ack ok
 *   - "ping"                                        → emits "pong"
 *
 * Wire protocol (server → client):
 *   - "snapshot"     — initial { sub_id, vehicles: [] }
 *   - "update"       — { sub_id, vehicle: VehicleUpdate }
 *   - "error"        — { code, message }
 *
 * Phase 4 ships JSON encoding for simplicity. Switching to msgpack is a single
 * gateway option flip and is documented in PROJECT_STATE for a Phase 4.5
 * follow-up alongside delta-encoding.
 */
@WebSocketGateway({
  namespace: '/live',
  cors: { origin: '*' }, // CORS allow-list applies via the shared CorsOrigins config
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly log = new Logger(LiveGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly registry: SubscriptionRegistry,
    private readonly jwt: JwtService,
    private readonly bridge: MqttBridge,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  onModuleInit(): void {
    this.bridge.updates$.subscribe((u) => this.dispatch(u));
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────
  async handleConnection(@ConnectedSocket() socket: Socket): Promise<void> {
    this.registry.attach(socket.id);
    // Optional JWT on handshake — anonymous is allowed but with stricter limits.
    const token = (socket.handshake.auth?.token as string | undefined) ?? null;
    if (token) {
      try {
        const claims = await this.jwt.verifyAccessToken(token);
        socket.data.userId = claims.sub;
        socket.data.tier = claims.tier;
      } catch (err) {
        if (err instanceof TokenError) {
          socket.emit('error', { code: err.code, message: err.message });
        }
      }
    }
    this.log.log(
      `socket connected: ${socket.id} userId=${socket.data.userId ?? 'anon'} total=${this.registry.size()}`,
    );
  }

  handleDisconnect(@ConnectedSocket() socket: Socket): void {
    this.registry.detach(socket.id);
    this.log.log(`socket disconnected: ${socket.id} total=${this.registry.size()}`);
  }

  // ── Handlers ───────────────────────────────────────────────────────────
  @SubscribeMessage('subscribe')
  onSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): { sub_id?: string; error?: string } {
    const parsed = SubscribeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return { error: 'invalid_subscription' };
    }
    if (parsed.data.kind === 'bbox') {
      const max = this.config.get('WS_BBOX_MAX_DIAGONAL_KM', { infer: true });
      if (bboxDiagonalKm(parsed.data.bbox) > max) {
        return { error: 'bbox_too_large' };
      }
    }

    // Anonymous connections are restricted to 1 subscription.
    const isAnon = !socket.data.userId;
    const max = isAnon ? 1 : this.config.get('WS_MAX_SUBS_PER_CONN', { infer: true });

    const result = this.registry.add(socket.id, parsed.data, max);
    if ('error' in result) return { error: result.error };
    return { sub_id: result.sub_id };
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { sub_id: string },
  ): { ok: boolean } {
    if (!body?.sub_id || typeof body.sub_id !== 'string') return { ok: false };
    return { ok: this.registry.remove(socket.id, body.sub_id) };
  }

  @SubscribeMessage('ping')
  onPing(@ConnectedSocket() socket: Socket): void {
    socket.emit('pong', { t: Date.now() });
  }

  // ── Fan-out ────────────────────────────────────────────────────────────
  private dispatch(update: VehicleUpdate): void {
    const matches = this.registry.match(update);
    for (const m of matches) {
      // server.to(socketId) routes within this namespace and works seamlessly
      // when the @socket.io/redis-adapter is wired (Phase 7).
      this.server.to(m.socketId).emit('update', { sub_id: m.sub_id, vehicle: update });
    }
  }
}
