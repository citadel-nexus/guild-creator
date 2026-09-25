// ─── CGRF Header ──────────────────────────────
// File:        src/routes/realm.test.ts
// Stage:       08_TEST
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/routes/realm.ts, src/automation/livingworld-floor.ts
// EnumType:    Test
// EnumEdges:   VERIFIED_BY src/routes/realm.ts; VALIDATES /realm/creator.json; VALIDATES /game/party.json
// DAG Node:    creator.realm.route.test
// Intent:      Verify the public GET contracts expose the quiet floor and Muse without accepting writes.
// ─────────────────────────────────────────────────────────────

import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { LivingWorldFloor } from '../automation/livingworld-floor.js';
import { createQuietFloorEventPublisher } from '../automation/livingworld-emitter.js';
import { createRealmRequestListener, routeCreatorRequest } from './realm.js';

describe('Creator realm routes', () => {
  const floor = new LivingWorldFloor(createQuietFloorEventPublisher());

  it('serves the quiet Creator realm contract', () => {
    const result = routeCreatorRequest('GET', '/realm/creator.json', floor);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      activity_level: 0,
      champion: 'Muse',
      guild: 'creator',
      quests: [],
      structures: [{ kind: 'hall', level: 1 }],
    });
  });

  it('binds Muse in the party contract', () => {
    const result = routeCreatorRequest('GET', '/game/party.json', floor);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      guild: 'creator',
      members: [{ name: 'Muse', role: 'guildmaster', state: 'idle' }],
    });
  });

  it('keeps the public surface read-only and explicit', () => {
    const writeResult = routeCreatorRequest('POST', '/realm/creator.json', floor);
    expect(writeResult).toMatchObject({ statusCode: 405, body: { error: 'method_not_allowed' } });

    const missingResult = routeCreatorRequest('GET', '/private', floor);
    expect(missingResult).toMatchObject({ statusCode: 404, body: { error: 'not_found' } });
  });

  it('reports service health without exposing configuration', () => {
    const result = routeCreatorRequest('GET', '/health', floor);
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      guild: 'creator',
      nats_prefix: 'citadel.creator.*',
      status: 'healthy',
    });
  });

  it('writes the routed result through the Node request listener', () => {
    const writeHead = vi.fn();
    const end = vi.fn();
    const request = { method: 'GET', url: '/realm/creator.json?mobile=true' } as IncomingMessage;
    const response = { end, writeHead } as unknown as ServerResponse;

    createRealmRequestListener(floor)(request, response);

    expect(writeHead).toHaveBeenCalledWith(200, {
      'cache-control': 'public, max-age=5, stale-if-error=30',
      'content-type': 'application/json; charset=utf-8',
    });
    expect(end).toHaveBeenCalledWith(JSON.stringify(floor.realm()));
  });
});
