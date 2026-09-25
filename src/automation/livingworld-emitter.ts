// ─── CGRF Header ──────────────────────────────
// File:        src/automation/livingworld-emitter.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     nats
// EnumType:    Service
// EnumEdges:   PRODUCES citadel.creator.activity; PRODUCES citadel.creator.quest; PRODUCES citadel.creator.champion
// DAG Node:    creator.floor.emitter
// Intent:      Publish cleansed Creator floor state changes while degrading to a no-op when NATS is unavailable.
// ────────────────────────────────────────────────────────────

import { connect, StringCodec, type NatsConnection } from 'nats';

export const CREATOR_FLOOR_SUBJECTS = {
  activity: 'citadel.creator.activity',
  champion: 'citadel.creator.champion',
  quest: 'citadel.creator.quest',
} as const;

export type CreatorFloorSubject = (typeof CREATOR_FLOOR_SUBJECTS)[keyof typeof CREATOR_FLOOR_SUBJECTS];
export type ChampionState = 'idle' | 'working' | 'blocked';
export type QuestState = 'open' | 'closed';

export interface ActivityEvent {
  readonly activity_level: number;
  readonly guild: 'creator';
  readonly method: 'observed_activity';
  readonly observed_at: string;
}

export interface ChampionEvent {
  readonly champion: 'Muse';
  readonly guild: 'creator';
  readonly observed_at: string;
  readonly previous_state: ChampionState;
  readonly state: ChampionState;
}

export interface QuestEvent {
  readonly guild: 'creator';
  readonly id: string;
  readonly observed_at: string;
  readonly state: QuestState;
  readonly title: string;
}

export interface CreatorFloorEventMap {
  readonly [CREATOR_FLOOR_SUBJECTS.activity]: ActivityEvent;
  readonly [CREATOR_FLOOR_SUBJECTS.champion]: ChampionEvent;
  readonly [CREATOR_FLOOR_SUBJECTS.quest]: QuestEvent;
}

export interface FloorEventPublisher {
  readonly available: boolean;
  close(): Promise<void>;
  publish<Subject extends CreatorFloorSubject>(
    subject: Subject,
    payload: CreatorFloorEventMap[Subject],
  ): Promise<void>;
}

export type NatsPublisherConnection = Pick<NatsConnection, 'drain' | 'flush' | 'publish'>;
export type NatsConnector = (options: { readonly servers: string }) => Promise<NatsConnection>;

class NatsFloorEventPublisher implements FloorEventPublisher {
  public readonly available = true;
  private readonly codec = StringCodec();

  public constructor(private readonly connection: NatsPublisherConnection) {}

  public async publish<Subject extends CreatorFloorSubject>(
    subject: Subject,
    payload: CreatorFloorEventMap[Subject],
  ): Promise<void> {
    this.connection.publish(subject, this.codec.encode(JSON.stringify(payload)));
    await this.connection.flush();
  }

  public async close(): Promise<void> {
    await this.connection.drain();
  }
}

class QuietFloorEventPublisher implements FloorEventPublisher {
  public readonly available = false;

  public async publish<Subject extends CreatorFloorSubject>(
    _subject: Subject,
    _payload: CreatorFloorEventMap[Subject],
  ): Promise<void> {}

  public async close(): Promise<void> {}
}

export function createQuietFloorEventPublisher(): FloorEventPublisher {
  return new QuietFloorEventPublisher();
}

export function createNatsFloorEventPublisher(connection: NatsPublisherConnection): FloorEventPublisher {
  return new NatsFloorEventPublisher(connection);
}

export async function connectFloorEventPublisher(
  servers: string | undefined,
  connector: NatsConnector = connect,
): Promise<FloorEventPublisher> {
  if (servers === undefined || servers.length === 0) {
    return createQuietFloorEventPublisher();
  }

  try {
    return createNatsFloorEventPublisher(await connector({ servers }));
  } catch (error: unknown) {
    console.warn('creator_nats_unavailable', {
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return createQuietFloorEventPublisher();
  }
}
