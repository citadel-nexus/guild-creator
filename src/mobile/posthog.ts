// ─── CGRF Header ──────────────────────────────
// File:        src/mobile/posthog.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     posthog-js, src/integrations/posthog.ts
// EnumType:    Adapter
// EnumEdges:   PRODUCES PostHog mobile engagement; CONSUMES PostHog mobile feature flags
// DAG Node:    creator.mobile.posthog
// Intent:      Track role-segmented mobile engagement and fail closed mobile features behind PostHog flags.
// ─────────────────────────────────────────────────────────────

import { posthog } from 'posthog-js';

import type { CreativeRole } from '../integrations/posthog.js';

export interface MobilePostHogConfiguration {
  readonly apiHost: string;
  readonly apiKey: string;
  readonly memberId: string;
  readonly role: CreativeRole;
}

export interface MobilePostHogClient {
  capture(event: string, properties?: Record<string, unknown>): void;
  identify(distinctId: string, properties?: Record<string, unknown>): void;
  init(apiKey: string, options: Record<string, unknown>): void;
  isFeatureEnabled(flag: string): boolean | undefined;
}

export class CreatorMobileAnalytics {
  public constructor(
    configuration: MobilePostHogConfiguration,
    private readonly client: MobilePostHogClient = posthog,
  ) {
    client.init(configuration.apiKey, {
      api_host: configuration.apiHost,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
    });
    client.identify(configuration.memberId, {
      creative_role: configuration.role,
      guild_membership: 'creator',
    });
  }

  public capture(event: 'realm_loaded' | 'realm_unavailable' | 'floor_interaction', properties: Record<string, unknown> = {}): void {
    this.client.capture(`creator_mobile_${event}`, { ...properties, guild: 'creator' });
  }

  public runFlagged<Result>(flag: string, operation: () => Result, fallback: Result): Result {
    return this.client.isFeatureEnabled(flag) === true ? operation() : fallback;
  }
}
