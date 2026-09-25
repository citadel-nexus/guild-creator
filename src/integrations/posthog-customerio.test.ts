// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/posthog-customerio.test.ts
// Stage:       08_TEST
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/integrations/posthog.ts, src/integrations/customerio.ts
// EnumType:    Test
// EnumEdges:   VERIFIED_BY src/integrations/posthog.ts; VERIFIED_BY src/integrations/customerio.ts; VALIDATES external integration operations
// DAG Node:    creator.integrations.engagement.test
// Intent:      Verify analytics and notification writes require dispatch authorization and fail-closed flags.
// ─────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CustomerIoHooks } from './customerio.js';
import { createCreatorAnalyticsFromEnv, CreatorAnalytics, type PostHogClientLike } from './posthog.js';

function postHogClient(flag: boolean | string | undefined = true): PostHogClientLike {
  return {
    capture: vi.fn(),
    getFeatureFlag: vi.fn(async () => flag),
    shutdown: vi.fn(async () => undefined),
  };
}

afterEach(() => vi.unstubAllEnvs());

describe('CreatorAnalytics', () => {
  it('captures bounded role segments only for the active dispatch', async () => {
    const client = postHogClient();
    const analytics = new CreatorAnalytics('dispatch-1', client);

    expect(
      analytics.capture('mobile_app_engaged', {
        dispatchId: 'dispatch-1',
        distinctId: 'member-1',
        guild: 'writers',
        role: 'writer',
      }),
    ).toBe(true);
    expect(analytics.capture('realm_feed_viewed', { dispatchId: 'wrong', distinctId: 'member-1' })).toBe(false);
    expect(client.capture).toHaveBeenCalledTimes(1);
    await expect(analytics.runFlagged('enabled', async () => 'ran', 'quiet')).resolves.toBe('ran');
    await analytics.close();
    expect(client.shutdown).toHaveBeenCalledOnce();
  });

  it('fails flags closed when unavailable or non-boolean', async () => {
    await expect(new CreatorAnalytics('dispatch-1').featureEnabled('missing')).resolves.toBe(false);
    await expect(new CreatorAnalytics('dispatch-1', postHogClient('variant')).featureEnabled('variant')).resolves.toBe(false);
  });

  it('does not create a PostHog client for an empty active dispatch', () => {
    vi.stubEnv('ACTIVE_DISPATCH_ID', '');
    vi.stubEnv('POSTHOG_API_KEY', 'public-test-value');
    expect(createCreatorAnalyticsFromEnv().available).toBe(false);
  });
});

describe('CustomerIoHooks', () => {
  it('segments and notifies authorized opaque members', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => new Response(null, { status: 200 }));
    const hooks = new CustomerIoHooks(
      {
        activeDispatchId: 'dispatch-1',
        apiKey: 'test-value',
        siteId: 'site',
        trackUrl: 'https://track.customer.io',
      },
      fetcher,
    );
    const segment = {
      dispatchId: 'dispatch-1',
      guild: 'creator' as const,
      memberId: 'member-1',
      role: 'artist' as const,
    };

    await expect(hooks.segmentMember(segment)).resolves.toBe(true);
    await expect(
      hooks.notify('art_direction_updated', { ...segment, projectId: 'project-1' }),
    ).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const firstRequest = fetcher.mock.calls[0]?.[0];
    const requestUrl =
      firstRequest instanceof Request
        ? firstRequest.url
        : firstRequest instanceof URL
          ? firstRequest.href
          : firstRequest;
    expect(requestUrl).toContain('/api/v1/customers/member-1');
  });

  it('rejects wrong dispatches and degrades request failures', async () => {
    const hooks = new CustomerIoHooks(
      {
        activeDispatchId: 'dispatch-1',
        apiKey: 'test-value',
        siteId: 'site',
        trackUrl: 'https://track.customer.io',
      },
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await expect(
      hooks.segmentMember({ dispatchId: 'wrong', guild: 'creator', memberId: 'member-1', role: 'artist' }),
    ).resolves.toBe(false);
    await expect(
      hooks.segmentMember({ dispatchId: 'dispatch-1', guild: 'creator', memberId: 'member-1', role: 'artist' }),
    ).resolves.toBe(false);
    expect(new CustomerIoHooks().available).toBe(false);
  });
});
