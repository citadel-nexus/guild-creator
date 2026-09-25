// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/guild-comms.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     nats, src/integrations/activity-aggregator.ts
// EnumType:    Adapter
// EnumEdges:   CONSUMES citadel.creator.subguild.writers.status; CONSUMES citadel.creator.subguild.music.status; PRODUCES citadel.guild.comms.creator→finance; PRODUCES citadel.guild.comms.creator→writers
// DAG Node:    creator.integrations.guild-comms
// Intent:      Enforce typed parent and cross-guild messages and aggregate only authorized sub-guild status reports.
// ─────────────────────────────────────────────────────────────

import { connect, StringCodec, type NatsConnection, type Subscription } from 'nats';

import type { RealActivityAggregator } from './activity-aggregator.js';
import type { CreatorAnalytics } from './posthog.js';

export const GUILD_COMMS_SUBJECTS = {
  financeAttribution: 'citadel.guild.comms.creator→finance',
  musicStatus: 'citadel.creator.subguild.music.status',
  writersAssignment: 'citadel.guild.comms.creator→writers',
  writersStatus: 'citadel.creator.subguild.writers.status',
} as const;

export interface SubguildStatusMessage {
  readonly activity_level: number;
  readonly dispatch_id: string;
  readonly guild: 'writers' | 'music_studio';
  readonly observed_at: string;
  readonly report_id: string;
  readonly schema_version: 1;
  readonly status: 'idle' | 'working' | 'blocked';
}

export interface CommissionAttributionMessage {
  readonly asset_id: string;
  readonly commission_id: string;
  readonly dispatch_id: string;
  readonly schema_version: 1;
}

export interface WritersAssignmentMessage {
  readonly assignment_id: string;
  readonly direction: string;
  readonly dispatch_id: string;
  readonly narrative_arc_id: string;
  readonly schema_version: 1;
}

export interface GuildCommsTransport {
  readonly available: boolean;
  close(): Promise<void>;
  publish(subject: string, message: unknown): Promise<void>;
  subscribe(subject: string, handler: (message: unknown) => Promise<void>): void;
}

const PUBLIC_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/u;

function subguildStatus(value: unknown, expectedGuild: SubguildStatusMessage['guild']): SubguildStatusMessage | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  if (
    input.schema_version !== 1 ||
    input.guild !== expectedGuild ||
    typeof input.dispatch_id !== 'string' ||
    typeof input.report_id !== 'string' ||
    !PUBLIC_ID.test(input.report_id) ||
    typeof input.activity_level !== 'number' ||
    input.activity_level < 0 ||
    input.activity_level > 1 ||
    typeof input.observed_at !== 'string' ||
    Number.isNaN(Date.parse(input.observed_at)) ||
    (input.status !== 'idle' && input.status !== 'working' && input.status !== 'blocked')
  ) {
    return undefined;
  }
  return input as unknown as SubguildStatusMessage;
}

class QuietGuildCommsTransport implements GuildCommsTransport {
  public readonly available = false;
  public async close(): Promise<void> {}
  public async publish(_subject: string, _message: unknown): Promise<void> {}
  public subscribe(_subject: string, _handler: (message: unknown) => Promise<void>): void {}
}

class NatsGuildCommsTransport implements GuildCommsTransport {
  public readonly available = true;
  private readonly codec = StringCodec();
  private readonly subscriptions: Subscription[] = [];

  public constructor(private readonly connection: NatsConnection) {}

  public async publish(subject: string, message: unknown): Promise<void> {
    this.connection.publish(subject, this.codec.encode(JSON.stringify(message)));
    await this.connection.flush();
  }

  public subscribe(subject: string, handler: (message: unknown) => Promise<void>): void {
    const subscription = this.connection.subscribe(subject);
    this.subscriptions.push(subscription);
    void this.consume(subscription, handler);
  }

  public async close(): Promise<void> {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    await this.connection.drain();
  }

  private async consume(subscription: Subscription, handler: (message: unknown) => Promise<void>): Promise<void> {
    for await (const message of subscription) {
      try {
        await handler(JSON.parse(this.codec.decode(message.data)) as unknown);
      } catch (error: unknown) {
        console.warn('creator_guild_message_rejected', {
          error: error instanceof Error ? error.message : 'invalid_message',
          subject: message.subject,
        });
      }
    }
  }
}

export class GuildCommsHandler {
  public constructor(
    private readonly activeDispatchId: string | undefined,
    private readonly transport: GuildCommsTransport,
    private readonly activity: RealActivityAggregator,
    private readonly analytics: CreatorAnalytics,
  ) {}

  public start(): void {
    this.transport.subscribe(GUILD_COMMS_SUBJECTS.writersStatus, (message) => this.handleStatus('writers', message));
    this.transport.subscribe(GUILD_COMMS_SUBJECTS.musicStatus, (message) => this.handleStatus('music_studio', message));
  }

  public async publishCommission(message: CommissionAttributionMessage): Promise<boolean> {
    if (!this.authorized(message.dispatch_id) || !PUBLIC_ID.test(message.asset_id) || !PUBLIC_ID.test(message.commission_id)) {
      return false;
    }
    await this.transport.publish(GUILD_COMMS_SUBJECTS.financeAttribution, message);
    return this.transport.available;
  }

  public async publishWritersAssignment(message: WritersAssignmentMessage): Promise<boolean> {
    if (
      !this.authorized(message.dispatch_id) ||
      !PUBLIC_ID.test(message.assignment_id) ||
      !PUBLIC_ID.test(message.narrative_arc_id) ||
      message.direction.trim().length === 0 ||
      message.direction.length > 240
    ) {
      return false;
    }
    await this.transport.publish(GUILD_COMMS_SUBJECTS.writersAssignment, message);
    return this.transport.available;
  }

  public async close(): Promise<void> {
    await this.transport.close();
  }

  private authorized(dispatchId: string): boolean {
    return this.activeDispatchId !== undefined && dispatchId === this.activeDispatchId;
  }

  private async handleStatus(guild: SubguildStatusMessage['guild'], value: unknown): Promise<void> {
    const message = subguildStatus(value, guild);
    if (message === undefined || !this.authorized(message.dispatch_id)) {
      return;
    }
    await this.activity.updateSubguild({
      activityLevel: message.activity_level,
      guild: guild === 'writers' ? 'writers' : 'music_studio',
      observedAt: new Date(message.observed_at),
      reportId: message.report_id,
    });
    this.analytics.capture('subguild_coordination', {
      dispatchId: message.dispatch_id,
      distinctId: message.report_id,
      guild,
    }, { status: message.status });
  }
}

export async function connectGuildCommsTransport(servers: string | undefined): Promise<GuildCommsTransport> {
  if (servers === undefined || servers.length === 0) {
    return new QuietGuildCommsTransport();
  }
  try {
    return new NatsGuildCommsTransport(await connect({ servers }));
  } catch {
    return new QuietGuildCommsTransport();
  }
}
