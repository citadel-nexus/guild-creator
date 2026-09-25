// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/posthog.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     posthog-node
// EnumType:    Adapter
// EnumEdges:   PRODUCES PostHog guild activity; CONSUMES PostHog feature flags; GATES external integration operations
// DAG Node:    creator.integrations.posthog
// Intent:      Track public-safe guild engagement and fail closed external operations behind PostHog flags.
// ─────────────────────────────────────────────────────────────

import { PostHog } from 'posthog-node';

export type CreativeRole = 'writer' | 'musician' | 'artist';
export type GuildActivityEvent =
  | 'creative_asset_generated'
  | 'subguild_coordination'
  | 'lore_compiled'
  | 'realm_feed_viewed'
  | 'mobile_app_engaged';

export interface AnalyticsContext {
  readonly dispatchId: string;
  readonly distinctId: string;
  readonly guild?: 'creator' | 'writers' | 'music_studio';
  readonly role?: CreativeRole;
}

export interface PostHogClientLike {
  capture(message: {
    readonly distinctId: string;
    readonly event: string;
    readonly properties?: Record<string, unknown>;
  }): void;
  getFeatureFlag(key: string, distinctId: string): Promise<boolean | string | undefined>;
  shutdown(): Promise<void>;
}

export class CreatorAnalytics {
  public constructor(
    private readonly activeDispatchId: string | undefined,
    private readonly client?: PostHogClientLike,
  ) {}

  public get available(): boolean {
    return this.client !== undefined && this.activeDispatchId !== undefined;
  }

  public capture(event: GuildActivityEvent, context: AnalyticsContext, properties: Record<string, unknown> = {}): boolean {
    if (!this.authorized(context.dispatchId)) {
      return false;
    }

    this.client?.capture({
      distinctId: context.distinctId,
      event: `creator_${event}`,
      properties: {
        ...properties,
        dispatch_id: context.dispatchId,
        guild: context.guild ?? 'creator',
        role: context.role,
        seat: 'muse',
      },
    });
    return true;
  }

  public async featureEnabled(flag: string, distinctId = 'guild-mcp-creator'): Promise<boolean> {
    if (!this.available) {
      return false;
    }

    try {
      return (await this.client?.getFeatureFlag(flag, distinctId)) === true;
    } catch {
      return false;
    }
  }

  public async runFlagged<Result>(
    flag: string,
    operation: () => Promise<Result>,
    fallback: Result,
    distinctId = 'guild-mcp-creator',
  ): Promise<Result> {
    return (await this.featureEnabled(flag, distinctId)) ? operation() : fallback;
  }

  public async close(): Promise<void> {
    await this.client?.shutdown();
  }

  private authorized(dispatchId: string): boolean {
    return this.client !== undefined && this.activeDispatchId !== undefined && dispatchId === this.activeDispatchId;
  }
}

export function createCreatorAnalyticsFromEnv(): CreatorAnalytics {
  const apiKey = process.env.POSTHOG_API_KEY;
  const activeDispatchId = process.env.ACTIVE_DISPATCH_ID;
  if (apiKey === undefined || apiKey.length === 0 || activeDispatchId === undefined || activeDispatchId.length === 0) {
    return new CreatorAnalytics(activeDispatchId);
  }

  const options = process.env.POSTHOG_HOST === undefined ? undefined : { host: process.env.POSTHOG_HOST };
  return new CreatorAnalytics(activeDispatchId, new PostHog(apiKey, options));
}
