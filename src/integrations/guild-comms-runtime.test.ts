// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/guild-comms-runtime.test.ts
// Stage:       08_TEST
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/integrations/guild-comms.ts, src/integrations/runtime.ts
// EnumType:    Test
// EnumEdges:   VERIFIED_BY src/integrations/guild-comms.ts; VERIFIED_BY src/integrations/runtime.ts; VALIDATES citadel.guild.comms.creator→finance
// DAG Node:    creator.integrations.comms.test
// Intent:      Verify typed guild messages require dispatch authority and the integration runtime closes quietly without configuration.
// ────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it, vi } from 'vitest';

import { LivingWorldFloor } from '../automation/livingworld-floor.js';
import { createQuietFloorEventPublisher } from '../automation/livingworld-emitter.js';
import { RealActivityAggregator } from './activity-aggregator.js';
import {
  GUILD_COMMS_SUBJECTS,
  GuildCommsHandler,
  type GuildCommsTransport,
} from './guild-comms.js';
import { CreatorAnalytics, type PostHogClientLike } from './posthog.js';
import { startCreatorIntegrations } from './runtime.js';

class RecordingTransport implements GuildCommsTransport {
  public readonly available = true;
  public readonly handlers = new Map<string, (message: unknown) => Promise<void>>();
  public readonly published: Array<{ message: unknown; subject: string }> = [];

  public async close(): Promise<void> {}
  public async publish(subject: string, message: unknown): Promise<void> {
    this.published.push({ message, subject });
  }
  public subscribe(subject: string, handler: (message: unknown) => Promise<void>): void {
    this.handlers.set(subject, handler);
  }
}

function analytics(): CreatorAnalytics {
  const client: PostHogClientLike = {
    capture: vi.fn(),
    getFeatureFlag: vi.fn(async () => false),
    shutdown: vi.fn(async () => undefined),
  };
  return new CreatorAnalytics('dispatch-1', client);
}

afterEach(() => vi.unstubAllEnvs());

describe('GuildCommsHandler', () => {
  it('aggregates authorized status and publishes bounded cross-guild messages', async () => {
    const floor = {
      recordActivity: vi.fn(async () => ({ changed: true, delivered: false })),
      recordSubguildCoordination: vi.fn(),
    };
    const transport = new RecordingTransport();
    const handler = new GuildCommsHandler(
      'dispatch-1',
      transport,
      new RealActivityAggregator(floor),
      analytics(),
    );
    handler.start();
    await transport.handlers.get(GUILD_COMMS_SUBJECTS.writersStatus)?.({
      activity_level: 0.7,
      dispatch_id: 'dispatch-1',
      guild: 'writers',
      observed_at: '2026-09-25T12:00:00Z',
      report_id: 'report-1',
      schema_version: 1,
      status: 'working',
    });
    expect(floor.recordActivity).toHaveBeenCalledWith(0.7, new Date('2026-09-25T12:00:00Z'));

    await expect(
      handler.publishCommission({
        asset_id: 'asset-1',
        commission_id: 'commission-1',
        dispatch_id: 'dispatch-1',
        schema_version: 1,
      }),
    ).resolves.toBe(true);
    await expect(
      handler.publishWritersAssignment({
        assignment_id: 'assignment-1',
        direction: 'Align the public arc with the approved visual language.',
        dispatch_id: 'dispatch-1',
        narrative_arc_id: 'arc-1',
        schema_version: 1,
      }),
    ).resolves.toBe(true);
    expect(transport.published.map(({ subject }) => subject)).toEqual([
      GUILD_COMMS_SUBJECTS.financeAttribution,
      GUILD_COMMS_SUBJECTS.writersAssignment,
    ]);
    await handler.close();
  });

  it('rejects unauthorized and malformed outbound messages', async () => {
    const transport = new RecordingTransport();
    const floor = { recordActivity: vi.fn(), recordSubguildCoordination: vi.fn() };
    const handler = new GuildCommsHandler('dispatch-1', transport, new RealActivityAggregator(floor), analytics());
    await expect(
      handler.publishCommission({ asset_id: '../bad', commission_id: 'c1', dispatch_id: 'wrong', schema_version: 1 }),
    ).resolves.toBe(false);
    expect(transport.published).toEqual([]);
  });
});

describe('integration runtime', () => {
  it('starts and closes with a quiet floor when all external configuration is absent', async () => {
    for (const name of [
      'ACTIVE_DISPATCH_ID',
      'POSTHOG_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'GITLAB_BASE_URL',
      'N8N_WEBHOOK_SECRET',
      'NATS_URL',
    ]) {
      vi.stubEnv(name, '');
    }
    const runtime = await startCreatorIntegrations(new LivingWorldFloor(createQuietFloorEventPublisher()));
    expect(runtime.webhook).toBeUndefined();
    expect(() => runtime.engagement.trackRealmFeedView()).not.toThrow();
    await expect(runtime.close()).resolves.toBeUndefined();
  });
});
