// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/supabase-n8n.test.ts
// Stage:       08_TEST
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/integrations/supabase.ts, src/integrations/n8n-webhook.ts, src/integrations/coordinator.ts
// EnumType:    Test
// EnumEdges:   VERIFIED_BY src/integrations/supabase.ts; VERIFIED_BY src/integrations/n8n-webhook.ts; VERIFIED_BY src/integrations/coordinator.ts
// DAG Node:    creator.integrations.ingress.test
// Intent:      Verify private rows and signed workflow events reduce to authorized public floor operations.
// ────────────────────────────────────────────────────────────

import { createHmac } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RealActivityAggregator } from './activity-aggregator.js';
import { CreatorIntegrationCoordinator } from './coordinator.js';
import { CustomerIoHooks } from './customerio.js';
import { createN8nWebhookFromEnv, N8nWebhookHandler } from './n8n-webhook.js';
import { CreatorAnalytics, type PostHogClientLike } from './posthog.js';
import {
  createSupabaseCreativeSourceFromEnv,
  SupabaseCreativeSource,
  toPublicSupabaseEvent,
} from './supabase.js';

function postHog(): PostHogClientLike {
  return {
    capture: vi.fn(),
    getFeatureFlag: vi.fn(async () => true),
    shutdown: vi.fn(async () => undefined),
  };
}

function signature(body: Buffer): string {
  return `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Supabase public event reduction', () => {
  it('keeps only id, whitelisted status, kind, and commit time', () => {
    expect(
      toPublicSupabaseEvent(
        'lore_compiled',
        { id: 'lore-1', private_content: 'not-public', status: 'published' },
        '2026-09-25T12:00:00Z',
      ),
    ).toEqual({
      id: 'lore-1',
      kind: 'lore_compiled',
      observedAt: new Date('2026-09-25T12:00:00Z'),
      status: 'published',
    });
    expect(toPublicSupabaseEvent('lore_compiled', { id: '../private' }, 'bad')).toBeUndefined();
    expect(
      toPublicSupabaseEvent('book_session_changed', { id: 42, status: 'NOT_PUBLIC' }, '2026-09-25T12:00:00Z'),
    ).toEqual({
      id: '42',
      kind: 'book_session_changed',
      observedAt: new Date('2026-09-25T12:00:00Z'),
    });
    expect(toPublicSupabaseEvent('lore_compiled', null, '2026-09-25T12:00:00Z')).toBeUndefined();
    expect(toPublicSupabaseEvent('lore_compiled', { id: 'lore-1' }, 'not-a-date')).toBeUndefined();
  });

  it('subscribes to configured tables, checks health, and removes channels', async () => {
    const callbacks: Array<(payload: { commit_timestamp: string; new: unknown }) => void> = [];
    const channel = {
      on: vi.fn(
        (
          _event: string,
          _filter: unknown,
          callback: (payload: { commit_timestamp: string; new: unknown }) => void,
        ) => {
          callbacks.push(callback);
          return channel;
        },
      ),
      subscribe: vi.fn(() => channel),
    };
    const select = vi.fn<() => Promise<{ error: Error | null }>>(async () => ({ error: null }));
    const client = {
      channel: vi.fn(() => channel),
      from: vi.fn(() => ({ select })),
      removeChannel: vi.fn(async () => 'ok'),
    };
    const source = new SupabaseCreativeSource(client as unknown as SupabaseClient, [
      { kind: 'creative_asset_generated', name: 'creative_assets' },
    ]);
    const onActivity = vi.fn(async () => undefined);

    source.start(onActivity);
    callbacks[0]?.({ commit_timestamp: '2026-09-25T12:00:00Z', new: { id: 'asset-1', status: 'ready' } });
    callbacks[0]?.({ commit_timestamp: 'bad', new: { id: '../private' } });
    await vi.waitFor(() => expect(onActivity).toHaveBeenCalledOnce());
    await expect(source.healthCheck()).resolves.toBe(true);
    await source.close();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);

    select.mockResolvedValueOnce({ error: new Error('offline') });
    await expect(source.healthCheck()).resolves.toBe(false);
  });

  it('degrades missing Supabase configuration and validates table identifiers', () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    expect(createSupabaseCreativeSourceFromEnv()).toBeUndefined();

    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-value');
    vi.stubEnv('SUPABASE_CREATIVE_ASSET_TABLES', '../private');
    expect(createSupabaseCreativeSourceFromEnv()).toBeUndefined();

    vi.stubEnv('SUPABASE_CREATIVE_ASSET_TABLES', 'creative_assets,rendered_media');
    expect(createSupabaseCreativeSourceFromEnv()).toBeInstanceOf(SupabaseCreativeSource);
  });
});

describe('N8nWebhookHandler and coordinator', () => {
  it('rejects invalid signatures and dispatches', async () => {
    const sink = { handleN8nEvent: vi.fn(async () => undefined) };
    const handler = new N8nWebhookHandler('dispatch-1', 'secret', sink);
    const body = Buffer.from(
      JSON.stringify({
        dispatch_id: 'wrong',
        event_id: 'event-1',
        event_type: 'asset.generated',
        occurred_at: '2026-09-25T12:00:00Z',
        project_id: 'project-1',
      }),
    );

    await expect(handler.handle(body, 'bad')).resolves.toMatchObject({ statusCode: 401 });
    await expect(handler.handle(body, signature(body))).resolves.toMatchObject({ statusCode: 403 });
    expect(sink.handleN8nEvent).not.toHaveBeenCalled();
  });

  it.each([
    ['primitive JSON', 'null'],
    ['missing dispatch', { event_id: 'event-1', event_type: 'asset.generated', occurred_at: '2026-09-25T12:00:00Z', project_id: 'project-1' }],
    ['unsafe event id', { dispatch_id: 'dispatch-1', event_id: '../bad', event_type: 'asset.generated', occurred_at: '2026-09-25T12:00:00Z', project_id: 'project-1' }],
    ['unknown event', { dispatch_id: 'dispatch-1', event_id: 'event-1', event_type: 'unknown', occurred_at: '2026-09-25T12:00:00Z', project_id: 'project-1' }],
    ['invalid date', { dispatch_id: 'dispatch-1', event_id: 'event-1', event_type: 'asset.generated', occurred_at: 'bad', project_id: 'project-1' }],
    ['unsafe project', { dispatch_id: 'dispatch-1', event_id: 'event-1', event_type: 'asset.generated', occurred_at: '2026-09-25T12:00:00Z', project_id: '../bad' }],
    ['unsafe member', { dispatch_id: 'dispatch-1', event_id: 'event-1', event_type: 'asset.generated', member_id: '../bad', occurred_at: '2026-09-25T12:00:00Z', project_id: 'project-1' }],
    ['unknown role', { dispatch_id: 'dispatch-1', event_id: 'event-1', event_type: 'asset.generated', occurred_at: '2026-09-25T12:00:00Z', project_id: 'project-1', role: 'director' }],
    ['untitled quest', { dispatch_id: 'dispatch-1', event_id: 'event-1', event_type: 'quest.opened', occurred_at: '2026-09-25T12:00:00Z', project_id: 'project-1', quest_title: '  ' }],
  ])('rejects malformed %s payloads', async (_name, input) => {
    const sink = { handleN8nEvent: vi.fn(async () => undefined) };
    const handler = new N8nWebhookHandler('dispatch-1', 'secret', sink);
    const body = Buffer.from(typeof input === 'string' ? input : JSON.stringify(input));

    await expect(handler.handle(body, signature(body))).resolves.toMatchObject({ statusCode: 400 });
    expect(sink.handleN8nEvent).not.toHaveBeenCalled();
  });

  it('creates handlers only when dispatch and HMAC configuration are present', () => {
    const sink = { handleN8nEvent: vi.fn(async () => undefined) };
    vi.stubEnv('ACTIVE_DISPATCH_ID', '');
    vi.stubEnv('N8N_WEBHOOK_SECRET', 'secret');
    expect(createN8nWebhookFromEnv(sink)).toBeUndefined();

    vi.stubEnv('ACTIVE_DISPATCH_ID', 'dispatch-1');
    vi.stubEnv('N8N_WEBHOOK_SECRET', 'secret');
    expect(createN8nWebhookFromEnv(sink)).toBeInstanceOf(N8nWebhookHandler);
  });

  it('accepts a signed event and drives real activity, quest, analytics, and notification hooks', async () => {
    const floor = {
      recordActivity: vi.fn(async () => ({ changed: true, delivered: false })),
      recordSubguildCoordination: vi.fn(),
      transitionQuest: vi.fn(async () => ({ changed: true, delivered: false })),
    };
    const client = postHog();
    const analytics = new CreatorAnalytics('dispatch-1', client);
    const customerFetch = vi.fn(async () => new Response(null, { status: 200 }));
    const customer = new CustomerIoHooks(
      {
        activeDispatchId: 'dispatch-1',
        apiKey: 'test-value',
        siteId: 'site',
        trackUrl: 'https://track.customer.io',
      },
      customerFetch,
    );
    const coordinator = new CreatorIntegrationCoordinator(
      'dispatch-1',
      floor,
      new RealActivityAggregator(floor, { eventTarget: 10 }),
      analytics,
      customer,
    );
    const handler = new N8nWebhookHandler('dispatch-1', 'secret', coordinator);
    const body = Buffer.from(
      JSON.stringify({
        dispatch_id: 'dispatch-1',
        event_id: 'event-1',
        event_type: 'voice_narration.complete',
        member_id: 'member-1',
        occurred_at: '2026-09-25T12:00:00Z',
        project_id: 'project-1',
        role: 'writer',
      }),
    );
    await expect(handler.handle(body, signature(body))).resolves.toEqual({ body: { accepted: true }, statusCode: 202 });
    expect(floor.recordActivity).toHaveBeenCalled();
    expect(floor.transitionQuest).toHaveBeenCalledWith(
      { id: 'n8n:project-1', state: 'closed', title: 'Creative project project-1' },
      new Date('2026-09-25T12:00:00Z'),
    );
    expect(customerFetch).toHaveBeenCalledTimes(2);
  });

  it('maps Supabase status to generic quest state and analytics', async () => {
    const floor = {
      recordActivity: vi.fn(async () => ({ changed: true, delivered: false })),
      recordSubguildCoordination: vi.fn(),
      transitionQuest: vi.fn(async () => ({ changed: true, delivered: false })),
    };
    const client = postHog();
    const coordinator = new CreatorIntegrationCoordinator(
      'dispatch-1',
      floor,
      new RealActivityAggregator(floor, { eventTarget: 10 }),
      new CreatorAnalytics('dispatch-1', client),
      new CustomerIoHooks(),
    );

    await coordinator.handleSupabaseEvent({
      id: 'lore-1',
      kind: 'lore_compiled',
      observedAt: new Date('2026-09-25T12:00:00Z'),
      status: 'published',
    });
    expect(floor.transitionQuest).toHaveBeenCalledWith(
      { id: 'supabase:lore_compiled:lore-1', state: 'closed', title: 'lore compiled lore-1' },
      new Date('2026-09-25T12:00:00Z'),
    );
    expect(client.capture).toHaveBeenCalledOnce();
  });

  it('maps book sessions and workflow quest lifecycle without inventing activity', async () => {
    const floor = {
      recordActivity: vi.fn(async () => ({ changed: true, delivered: false })),
      recordSubguildCoordination: vi.fn(),
      transitionQuest: vi.fn(async () => ({ changed: true, delivered: false })),
    };
    const client = postHog();
    const customerFetch = vi.fn(async () => new Response(null, { status: 200 }));
    const coordinator = new CreatorIntegrationCoordinator(
      'dispatch-1',
      floor,
      new RealActivityAggregator(floor, { eventTarget: 10 }),
      new CreatorAnalytics('dispatch-1', client),
      new CustomerIoHooks(
        {
          activeDispatchId: 'dispatch-1',
          apiKey: 'test-value',
          siteId: 'site',
          trackUrl: 'https://track.customer.io',
        },
        customerFetch,
      ),
    );
    const observedAt = new Date('2026-09-25T12:00:00Z');

    await coordinator.handleSupabaseEvent({ id: 'book-1', kind: 'book_session_changed', observedAt });
    await coordinator.handleSupabaseEvent({ id: 'book-2', kind: 'book_session_changed', observedAt, status: 'completed' });
    await coordinator.handleSupabaseEvent({ id: 'asset-queued', kind: 'creative_asset_generated', observedAt, status: 'queued' });
    await coordinator.handleSupabaseEvent({ id: 'asset-ready', kind: 'creative_asset_generated', observedAt, status: 'ready' });
    await coordinator.handleN8nEvent({
      dispatchId: 'dispatch-1',
      eventId: 'asset-1',
      eventType: 'asset.generated',
      occurredAt: observedAt,
      projectId: 'project-1',
    });
    await coordinator.handleN8nEvent({
      dispatchId: 'dispatch-1',
      eventId: 'quest-1',
      eventType: 'quest.opened',
      occurredAt: observedAt,
      projectId: 'project-2',
      questTitle: 'Draft the public arc',
    });
    await coordinator.handleN8nEvent({
      dispatchId: 'dispatch-1',
      eventId: 'book-export-1',
      eventType: 'book.exported',
      memberId: 'member-1',
      occurredAt: observedAt,
      projectId: 'project-3',
      role: 'writer',
    });

    expect(floor.transitionQuest).toHaveBeenCalledWith(
      { id: 'supabase:book_session_changed:book-1', state: 'open', title: 'book session changed book-1' },
      observedAt,
    );
    expect(floor.transitionQuest).toHaveBeenCalledWith(
      { id: 'supabase:book_session_changed:book-2', state: 'closed', title: 'book session changed book-2' },
      observedAt,
    );
    expect(floor.transitionQuest).toHaveBeenCalledWith(
      { id: 'supabase:creative_asset_generated:asset-queued', state: 'open', title: 'creative asset generated asset-queued' },
      observedAt,
    );
    expect(floor.transitionQuest).toHaveBeenCalledWith(
      { id: 'supabase:creative_asset_generated:asset-ready', state: 'closed', title: 'creative asset generated asset-ready' },
      observedAt,
    );
    expect(floor.transitionQuest).toHaveBeenCalledWith(
      { id: 'n8n:project-2', state: 'open', title: 'Draft the public arc' },
      observedAt,
    );
    expect(client.capture).toHaveBeenCalledTimes(2);
    expect(customerFetch).toHaveBeenCalledTimes(2);
  });
});
