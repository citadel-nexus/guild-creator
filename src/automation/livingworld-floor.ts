// ─── CGRF Header ──────────────────────────────
// File:        src/automation/livingworld-floor.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/automation/livingworld-emitter.ts
// EnumType:    Service
// EnumEdges:   PRODUCES /realm/creator.json; PRODUCES /game/party.json; USES_TEMPLATE citadel.creator.*
// DAG Node:    creator.floor.state
// Intent:      Derive the public Creator floor only from observed state and preserve an honest quiet-floor fallback.
// ─────────────────────────────────────────────────────────────

import {
  CREATOR_FLOOR_SUBJECTS,
  type ChampionState,
  type CreatorFloorEventMap,
  type FloorEventPublisher,
  type QuestState,
} from './livingworld-emitter.js';

export interface RealmQuest {
  readonly id: string;
  readonly state: QuestState;
  readonly title: string;
}

export interface RealmStructure {
  readonly kind: 'hall';
  readonly level: 1;
}

export interface CreatorRealm {
  readonly activity_level: number;
  readonly champion: 'Muse';
  readonly guild: 'creator';
  readonly quests: readonly RealmQuest[];
  readonly structures: readonly RealmStructure[];
}

export interface CreatorParty {
  readonly guild: 'creator';
  readonly members: readonly [
    {
      readonly name: 'Muse';
      readonly role: 'guildmaster';
      readonly state: ChampionState;
    },
  ];
}

export interface FloorOperationResult {
  readonly changed: boolean;
  readonly delivered: boolean;
}

export type Subguild = 'writers' | 'music_studio';
export type CoordinationOutcome = 'accepted' | 'rejected' | 'unavailable';

export interface FloorTelemetry {
  activityHeartbeat(level: number): void;
  championTransition(previousState: ChampionState, state: ChampionState): void;
  close(): Promise<void>;
  questThroughput(state: QuestState): void;
  subguildCoordination(subguild: Subguild, outcome: CoordinationOutcome): void;
  withSpan<Result>(operation: string, work: () => Promise<Result>): Promise<Result>;
}

const NOOP_TELEMETRY: FloorTelemetry = {
  activityHeartbeat: () => undefined,
  championTransition: () => undefined,
  close: async () => undefined,
  questThroughput: () => undefined,
  subguildCoordination: () => undefined,
  withSpan: async <Result>(_operation: string, work: () => Promise<Result>) => work(),
};

const STRUCTURES: readonly RealmStructure[] = Object.freeze([{ kind: 'hall', level: 1 }]);
const QUEST_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;

export function createQuietCreatorRealm(): CreatorRealm {
  return {
    activity_level: 0,
    champion: 'Muse',
    guild: 'creator',
    quests: [],
    structures: STRUCTURES,
  };
}

function publicQuest(input: RealmQuest): RealmQuest {
  if (!QUEST_ID_PATTERN.test(input.id)) {
    throw new TypeError('Quest id must be a public-safe identifier');
  }

  const title = [...input.title]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127 ? ' ' : character;
    })
    .join('')
    .trim()
    .slice(0, 120);
  if (title.length === 0) {
    throw new TypeError('Quest title must contain public-safe text');
  }

  return { id: input.id, state: input.state, title };
}

export class LivingWorldFloor {
  private activityLevel = 0;
  private championState: ChampionState = 'idle';
  private readonly quests = new Map<string, RealmQuest>();

  public constructor(
    private readonly publisher: FloorEventPublisher,
    private readonly telemetry: FloorTelemetry = NOOP_TELEMETRY,
  ) {}

  public realm(): CreatorRealm {
    return {
      activity_level: this.activityLevel,
      champion: 'Muse',
      guild: 'creator',
      quests: [...this.quests.values()].map((quest) => ({ ...quest })),
      structures: STRUCTURES,
    };
  }

  public party(): CreatorParty {
    return {
      guild: 'creator',
      members: [{ name: 'Muse', role: 'guildmaster', state: this.championState }],
    };
  }

  public async close(): Promise<void> {
    await Promise.all([this.publisher.close(), this.telemetry.close()]);
  }

  public async recordActivity(activityLevel: number, observedAt = new Date()): Promise<FloorOperationResult> {
    return this.telemetry.withSpan('activity', async () => {
      if (!Number.isFinite(activityLevel) || activityLevel < 0 || activityLevel > 1) {
        throw new RangeError('Activity level must be a finite number from 0 to 1');
      }

      const changed = activityLevel !== this.activityLevel;
      this.activityLevel = activityLevel;
      this.telemetry.activityHeartbeat(activityLevel);
      const delivered = await this.publishSafely(CREATOR_FLOOR_SUBJECTS.activity, {
        activity_level: activityLevel,
        guild: 'creator',
        method: 'observed_activity',
        observed_at: observedAt.toISOString(),
      });
      return { changed, delivered };
    });
  }

  public async transitionQuest(quest: RealmQuest, observedAt = new Date()): Promise<FloorOperationResult> {
    return this.telemetry.withSpan('quest', async () => {
      const cleansed = publicQuest(quest);
      const previous = this.quests.get(cleansed.id);
      if (previous?.state === cleansed.state && previous.title === cleansed.title) {
        return { changed: false, delivered: false };
      }

      this.quests.set(cleansed.id, cleansed);
      this.telemetry.questThroughput(cleansed.state);
      const delivered = await this.publishSafely(CREATOR_FLOOR_SUBJECTS.quest, {
        guild: 'creator',
        id: cleansed.id,
        observed_at: observedAt.toISOString(),
        state: cleansed.state,
        title: cleansed.title,
      });
      return { changed: true, delivered };
    });
  }

  public async transitionChampion(
    state: ChampionState,
    observedAt = new Date(),
  ): Promise<FloorOperationResult> {
    return this.telemetry.withSpan('champion', async () => {
      if (state === this.championState) {
        return { changed: false, delivered: false };
      }

      const previousState = this.championState;
      this.championState = state;
      this.telemetry.championTransition(previousState, state);
      const delivered = await this.publishSafely(CREATOR_FLOOR_SUBJECTS.champion, {
        champion: 'Muse',
        guild: 'creator',
        observed_at: observedAt.toISOString(),
        previous_state: previousState,
        state,
      });
      return { changed: true, delivered };
    });
  }

  public recordSubguildCoordination(subguild: Subguild, outcome: CoordinationOutcome): void {
    this.telemetry.subguildCoordination(subguild, outcome);
  }

  private async publishSafely<Subject extends keyof CreatorFloorEventMap>(
    subject: Subject,
    payload: CreatorFloorEventMap[Subject],
  ): Promise<boolean> {
    try {
      await this.publisher.publish(subject, payload);
      return this.publisher.available;
    } catch (error: unknown) {
      console.warn('creator_floor_event_not_delivered', {
        error: error instanceof Error ? error.message : 'unknown_error',
        subject,
      });
      return false;
    }
  }
}
