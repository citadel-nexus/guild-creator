// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/runtime.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/integrations/coordinator.ts, src/integrations/gitlab.ts, src/integrations/supabase.ts, src/integrations/guild-comms.ts
// EnumType:    Service
// EnumEdges:   GATES external integration operations; TRIGGERS citadel.creator.*; CONSUMES PostHog feature flags
// DAG Node:    creator.integrations.runtime
// Intent:      Start and stop configured integrations under active-dispatch and feature-flag circuit breakers.
// ─────────────────────────────────────────────────────────────

import type { LivingWorldFloor } from '../automation/livingworld-floor.js';
import { RealActivityAggregator } from './activity-aggregator.js';
import { CreatorIntegrationCoordinator } from './coordinator.js';
import { createCustomerIoHooksFromEnv } from './customerio.js';
import { createGitLabBridgeFromEnv, GitLabQuestSync } from './gitlab.js';
import { connectGuildCommsTransport, GuildCommsHandler } from './guild-comms.js';
import { createN8nWebhookFromEnv, type N8nWebhookHandler } from './n8n-webhook.js';
import { createCreatorAnalyticsFromEnv } from './posthog.js';
import { createSupabaseCreativeSourceFromEnv } from './supabase.js';

export interface RealmEngagementTracker {
  trackRealmFeedView(): void;
}

export interface CreatorIntegrationRuntime {
  readonly engagement: RealmEngagementTracker;
  readonly webhook?: N8nWebhookHandler;
  close(): Promise<void>;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function startCreatorIntegrations(floor: LivingWorldFloor): Promise<CreatorIntegrationRuntime> {
  const configuredDispatchId = process.env.ACTIVE_DISPATCH_ID;
  const activeDispatchId =
    configuredDispatchId === undefined || configuredDispatchId.length === 0
      ? undefined
      : configuredDispatchId;
  const analytics = createCreatorAnalyticsFromEnv();
  const activity = new RealActivityAggregator(floor, {
    eventTarget: positiveInteger(process.env.CREATOR_ACTIVITY_WINDOW_TARGET, 20),
    reportMaxAgeMs: positiveInteger(process.env.SUBGUILD_REPORT_MAX_AGE_MS, 5 * 60_000),
    windowMs: positiveInteger(process.env.CREATOR_ACTIVITY_WINDOW_MS, 15 * 60_000),
  });
  const customerIo = createCustomerIoHooksFromEnv();
  const coordinator = new CreatorIntegrationCoordinator(activeDispatchId, floor, activity, analytics, customerIo);
  const webhook = createN8nWebhookFromEnv(coordinator);

  const transport = await connectGuildCommsTransport(activeDispatchId === undefined ? undefined : process.env.NATS_URL);
  const guildComms = new GuildCommsHandler(activeDispatchId, transport, activity, analytics);
  guildComms.start();

  const supabase = createSupabaseCreativeSourceFromEnv();
  const supabaseEnabled =
    supabase !== undefined && (await analytics.featureEnabled('creator-supabase-realtime'));
  if (supabaseEnabled) {
    supabase.start((event) => coordinator.handleSupabaseEvent(event));
  }

  const gitlab = createGitLabBridgeFromEnv();
  const gitlabSync = gitlab === undefined ? undefined : new GitLabQuestSync(gitlab, floor, activity);
  const gitlabEnabled =
    gitlabSync !== undefined && (await analytics.featureEnabled('creator-gitlab-bridge'));
  if (gitlabEnabled) {
    await gitlabSync.sync().catch((error: unknown) => {
      console.warn('creator_gitlab_initial_sync_unavailable', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    });
    gitlabSync.start(Math.max(10_000, positiveInteger(process.env.GITLAB_SYNC_INTERVAL_MS, 60_000)));
  }

  const engagement: RealmEngagementTracker = {
    trackRealmFeedView(): void {
      if (activeDispatchId !== undefined) {
        analytics.capture('realm_feed_viewed', {
          dispatchId: activeDispatchId,
          distinctId: 'public-realm-feed',
        });
      }
    },
  };

  return {
    engagement,
    ...(webhook === undefined ? {} : { webhook }),
    async close(): Promise<void> {
      gitlabSync?.close();
      await Promise.all([
        guildComms.close(),
        analytics.close(),
        ...(supabaseEnabled && supabase !== undefined ? [supabase.close()] : []),
      ]);
    },
  };
}
