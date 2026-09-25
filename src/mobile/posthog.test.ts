// ─── CGRF Header ──────────────────────────────
// File:        src/mobile/posthog.test.ts
// Stage:       08_TEST
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/mobile/posthog.ts
// EnumType:    Test
// EnumEdges:   VERIFIED_BY src/mobile/posthog.ts; VALIDATES PostHog mobile engagement
// DAG Node:    creator.mobile.posthog.test
// Intent:      Verify mobile analytics segments opaque members and gates optional experiences with PostHog flags.
// ─────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';

import { CreatorMobileAnalytics, type MobilePostHogClient } from './posthog.js';

function client(enabled: boolean): MobilePostHogClient {
  return {
    capture: vi.fn(),
    identify: vi.fn(),
    init: vi.fn(),
    isFeatureEnabled: vi.fn(() => enabled),
  };
}

describe('CreatorMobileAnalytics', () => {
  it('initializes privacy-bounded tracking and role segmentation', () => {
    const postHog = client(true);
    const analytics = new CreatorMobileAnalytics(
      { apiHost: 'https://app.posthog.com', apiKey: 'public-value', memberId: 'member-1', role: 'musician' },
      postHog,
    );
    analytics.capture('realm_loaded', { quest_count: 2 });

    expect(postHog.init).toHaveBeenCalledWith('public-value', expect.objectContaining({ autocapture: false }));
    expect(postHog.identify).toHaveBeenCalledWith('member-1', {
      creative_role: 'musician',
      guild_membership: 'creator',
    });
    expect(postHog.capture).toHaveBeenCalledWith('creator_mobile_realm_loaded', {
      guild: 'creator',
      quest_count: 2,
    });
    expect(analytics.runFlagged('mobile-floor', () => 'enabled', 'quiet')).toBe('enabled');
  });

  it('returns the quiet fallback when a mobile flag is disabled', () => {
    const analytics = new CreatorMobileAnalytics(
      { apiHost: 'https://app.posthog.com', apiKey: 'public-value', memberId: 'member-1', role: 'artist' },
      client(false),
    );
    expect(analytics.runFlagged('mobile-floor', () => 'enabled', 'quiet')).toBe('quiet');
  });
});
