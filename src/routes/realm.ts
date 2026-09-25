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
// Depends:     src/automation/livingworld-floor.ts, src/routes/health.ts
// EnumType:    Route
// EnumEdges:   PRODUCES /realm/creator.json; PRODUCES /game/party.json; PRODUCES /health
// DAG Node:    creator.realm.route
// Intent:      Expose the public Creator realm and Muse party bindings as read-only JSON contracts.
// ─────────────────────────────────────────────────────────────

import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';

import type { LivingWorldFloor } from '../automation/livingworld-floor.js';
import { healthCheck } from './health.js';

export interface CreatorRouteResult {
  readonly body: unknown;
  readonly cacheable: boolean;
  readonly statusCode: number;
}

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

export function createRealmRequestListener(floor: LivingWorldFloor): RequestListener {
  return (request, response): void => {
    const result = routeCreatorRequest(request.method, requestPath(request), floor);
    writeJson(response, result.statusCode, result.body, result.cacheable);
  };
}
