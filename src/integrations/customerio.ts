// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/customerio.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     Customer.io Track API
// EnumType:    Adapter
// EnumEdges:   PRODUCES Customer.io member segments; PRODUCES Customer.io creative notifications; GATES DISP-LIVINGWORLD-creator
// DAG Node:    creator.integrations.customerio
// Intent:      Send dispatch-authorized creative notifications using opaque member identifiers and bounded role segments.
// ─────────────────────────────────────────────────────────────

import type { CreativeRole } from './posthog.js';

export type MemberGuild = 'creator' | 'writers' | 'music_studio';
export type CreativeNotification =
  | 'creative_project_milestone'
  | 'art_direction_updated'
  | 'voice_narration_ready';

export interface GuildMemberSegment {
  readonly dispatchId: string;
  readonly guild: MemberGuild;
  readonly memberId: string;
  readonly role: CreativeRole;
}

export interface CreativeNotificationInput extends GuildMemberSegment {
  readonly projectId: string;
}

export interface CustomerIoConfiguration {
  readonly activeDispatchId: string;
  readonly apiKey: string;
  readonly siteId: string;
  readonly trackUrl: string;
}

export class CustomerIoHooks {
  public constructor(
    private readonly configuration?: CustomerIoConfiguration,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  public get available(): boolean {
    return this.configuration !== undefined;
  }

  public async segmentMember(segment: GuildMemberSegment): Promise<boolean> {
    if (!this.authorized(segment.dispatchId)) {
      return false;
    }
    return this.request('PUT', `/api/v1/customers/${encodeURIComponent(segment.memberId)}`, {
      creative_role: segment.role,
      guild_membership: segment.guild,
    });
  }

  public async notify(event: CreativeNotification, input: CreativeNotificationInput): Promise<boolean> {
    if (!this.authorized(input.dispatchId)) {
      return false;
    }
    return this.request('POST', `/api/v1/customers/${encodeURIComponent(input.memberId)}/events`, {
      data: {
        creative_role: input.role,
        guild_membership: input.guild,
        project_id: input.projectId,
      },
      name: event,
    });
  }

  private authorized(dispatchId: string): boolean {
    return this.configuration !== undefined && dispatchId === this.configuration.activeDispatchId;
  }

  private async request(method: 'POST' | 'PUT', path: string, body: unknown): Promise<boolean> {
    if (this.configuration === undefined) {
      return false;
    }

    try {
      const authorization = Buffer.from(`${this.configuration.siteId}:${this.configuration.apiKey}`).toString('base64');
      const response = await this.fetcher(new URL(path, this.configuration.trackUrl), {
        body: JSON.stringify(body),
        headers: {
          authorization: `Basic ${authorization}`,
          'content-type': 'application/json',
        },
        method,
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export function createCustomerIoHooksFromEnv(): CustomerIoHooks {
  const activeDispatchId = process.env.ACTIVE_DISPATCH_ID;
  const apiKey = process.env.CUSTOMERIO_API_KEY;
  const siteId = process.env.CUSTOMERIO_SITE_ID;
  const trackUrl = process.env.CUSTOMERIO_TRACK_URL;
  if ([activeDispatchId, apiKey, siteId, trackUrl].some((value) => value === undefined || value.length === 0)) {
    return new CustomerIoHooks();
  }
  return new CustomerIoHooks({
    activeDispatchId: activeDispatchId as string,
    apiKey: apiKey as string,
    siteId: siteId as string,
    trackUrl: trackUrl as string,
  });
}
