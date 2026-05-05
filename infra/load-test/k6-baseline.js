// k6 baseline load test — Phase 7 hardening.
//
// Targets:
//   • 5000 concurrent WS connections each subscribing to one route in IST.
//   • 500 RPS mixed REST: stops/nearby (60%) + stops/:id/etas (30%) + search (10%).
//   • p95 < 400ms across REST.
//
// Run: k6 run -e BASE_URL=https://staging-api.app-bus.tr infra/load-test/k6-baseline.js
//
// CI does NOT run this — staging deployment + paid k6 cloud tier required.

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const wsLatency = new Trend('ws_message_latency', true);
const wsConnectErrors = new Rate('ws_connect_errors');

export const options = {
  scenarios: {
    rest_load: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      stages: [
        { target: 100, duration: '30s' },
        { target: 500, duration: '2m' },
        { target: 500, duration: '5m' },
        { target: 0, duration: '30s' },
      ],
      exec: 'rest',
    },
    ws_connections: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { target: 1000, duration: '1m' },
        { target: 5000, duration: '3m' },
        { target: 5000, duration: '5m' },
        { target: 0, duration: '1m' },
      ],
      exec: 'live',
    },
  },
  thresholds: {
    'http_req_duration{type:rest}': ['p(95)<400'],
    ws_connect_errors: ['rate<0.01'],
  },
};

export function rest() {
  const route = Math.random();
  let res;
  if (route < 0.6) {
    res = http.get(`${BASE}/v1/stops/nearby?lat=41.04&lng=28.99&radius_m=500`, {
      tags: { type: 'rest', endpoint: 'nearby' },
    });
  } else if (route < 0.9) {
    res = http.get(`${BASE}/v1/stops/EXAMPLE_STOP_ID/etas`, {
      tags: { type: 'rest', endpoint: 'etas' },
    });
  } else {
    res = http.get(`${BASE}/v1/search?q=taksim&city=IST`, {
      tags: { type: 'rest', endpoint: 'search' },
    });
  }
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.2);
}

export function live() {
  const url = BASE.replace('http', 'ws') + '/live';
  const r = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      socket.send(
        JSON.stringify(['subscribe', { kind: 'route', city: 'IST', route_external_id: '500T' }]),
      );
    });
    socket.on('message', (data) => {
      const t0 = Date.now();
      // server emits 'update' messages; we just mark received-time
      wsLatency.add(Date.now() - t0);
    });
    socket.setTimeout(() => socket.close(), 30 * 60 * 1000);
  });
  check(r, { 'ws 101': (r) => r && r.status === 101 });
  if (!r || r.status !== 101) wsConnectErrors.add(1);
}
