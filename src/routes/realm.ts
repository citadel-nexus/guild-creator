// ─── CGRF Header ──────────────────────────────
// File:        src/routes/realm.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/automation/livingworld-floor.ts, src/routes/health.ts, src/integrations/n8n-webhook.ts
// EnumType:    Route
// EnumEdges:   PRODUCES /realm/creator.json; PRODUCES /game/party.json; PRODUCES /health; CONSUMES /webhooks/n8n
// DAG Node:    creator.realm.route
// Intent:      Expose the public Creator realm and Muse party bindings as read-only JSON contracts.
// ─────────────────────────────────────────────────────────────

import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';

import type { LivingWorldFloor } from '../automation/livingworld-floor.js';
import type { N8nWebhookHandler } from '../integrations/n8n-webhook.js';
import type { RealmEngagementTracker } from '../integrations/runtime.js';
import { healthCheck } from './health.js';

export interface CreatorRouteResult {
  readonly body: unknown;
  readonly cacheable: boolean;
  readonly statusCode: number;
}

export interface CreatorRouteOptions {
  readonly engagement?: RealmEngagementTracker;
  readonly webhook?: N8nWebhookHandler;
}

const MAX_WEBHOOK_BYTES = 64 * 1024;

function writeJson(response: ServerResponse, statusCode: number, body: unknown, cacheable = false): void {
  response.writeHead(statusCode, {
    'cache-control': cacheable ? 'public, max-age=5, stale-if-error=30' : 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

function requestPath(request: IncomingMessage): string {
  return new URL(request.url ?? '/', 'http://localhost').pathname;
}

async function requestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    length += value.length;
    if (length > MAX_WEBHOOK_BYTES) {
      throw new RangeError('Webhook body exceeds the public limit');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function handleN8nWebhook(
  request: IncomingMessage,
  response: ServerResponse,
  webhook: N8nWebhookHandler | undefined,
): Promise<void> {
  if (webhook === undefined) {
    writeJson(response, 503, { error: 'integration_unavailable' });
    return;
  }
  try {
    const signatureValue = request.headers['x-n8n-signature'];
    const signature = Array.isArray(signatureValue) ? signatureValue[0] : signatureValue;
    const result = await webhook.handle(await requestBody(request), signature);
    writeJson(response, result.statusCode, result.body);
  } catch {
    writeJson(response, 400, { error: 'invalid_request' });
  }
}

export function routeCreatorRequest(method: string | undefined, path: string, floor: LivingWorldFloor): CreatorRouteResult {
  if (method !== 'GET') {
    return { body: { error: 'method_not_allowed' }, cacheable: false, statusCode: 405 };
  }

  switch (path) {
    case '/realm/creator.json':
      return { body: floor.realm(), cacheable: true, statusCode: 200 };
    case '/game/party.json':
      return { body: floor.party(), cacheable: true, statusCode: 200 };
    case '/health':
      return { body: healthCheck(), cacheable: false, statusCode: 200 };
    default:
      return { body: { error: 'not_found' }, cacheable: false, statusCode: 404 };
  }
}

export function createRealmRequestListener(floor: LivingWorldFloor, options: CreatorRouteOptions = {}): RequestListener {
  return (request, response): void => {
    const path = requestPath(request);
    if (request.method === 'POST' && path === '/webhooks/n8n') {
      void handleN8nWebhook(request, response, options.webhook);
      return;
    }
    const result = routeCreatorRequest(request.method, path, floor);
    if (request.method === 'GET' && path === '/realm/creator.json') {
      options.engagement?.trackRealmFeedView();
    }
    writeJson(response, result.statusCode, result.body, result.cacheable);
  };
}
