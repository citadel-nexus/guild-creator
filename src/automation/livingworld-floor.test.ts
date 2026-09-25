// ─── CGRF Header ──────────────────────────────
// File:        src/automation/livingworld-floor.test.ts
// Stage:       08_TEST
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/automation/livingworld-floor.ts, src/automation/livingworld-emitter.ts
// EnumType:    Test
// EnumEdges:   VERIFIED_BY src/automation/livingworld-floor.ts; VALIDATES citadel.creator.*
// DAG Node:    creator.floor.test
// Intent:      Verify real state transitions emit cleansed events and unavailable publishers retain a quiet floor.
// ────────────────────────────────────────────────────────────

import type { NatsConnection } from 'nats';
import { describe, expect, it, vi } from 'vitest';

import {
  CREATOR_FLOOR_SUBJECTS,
  connectFloorEventPublisher,
  createNatsFloorEventPublisher,
  type CreatorFloorEventMap,
  type CreatorFloorSubject,
  type FloorEventPublisher,
} from './livingworld-emitter.js';
import { LivingWorldFloor, type FloorTelemetry } from './livingworld-floor.js';

class RecordingPublisher implements FloorEventPublisher {
  public readonly events: Array<{ payload: unknown; subject: CreatorFloorSubject }> = [];

  public constructor(
    public readonly available = true,
    private readonly failure?: Error,
  ) {}

  public async close(): Promise<void> {}

  public async publish<Subject extends CreatorFloorSubject>(
    subject: Subject,
    payload: CreatorFloorEventMap[Subject],
  ): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.events.push({ payload, subject });
  }
}

function recordingTelemetry() {
  const telemetry: FloorTelemetry = {
    activityHeartbeat: vi.fn(),
    championTransition: vi.fn(),
    close: vi.fn(async () => undefined),
    questThroughput: vi.fn(),
    subguildCoordination: vi.fn(),
    withSpan: async <Result>(_operation: string, work: () => Promise<Result>) => work(),
  };
  return telemetry;
}

describe('LivingWorldFloor', () => {
  it('uses an unavailable no-op publisher when no NATS source is configured', async () => {
    const publisher = await connectFloorEventPublisher(undefined);
    expect(publisher.available).toBe(false);
    await expect(
      publisher.publish(CREATOR_FLOOR_SUBJECTS.activity, {
        activity_level: 0,
        guild: 'creator',
        method: 'observed_activity',
        observed_at: '2026-09-25T12:00:00.000Z',
      }),
    ).resolves.toBeUndefined();
    await expect(publisher.close()).resolves.toBeUndefined();
  });

  it('encodes events and drains an available NATS publisher', async () => {
    const connection = {
      drain: vi.fn(async () => undefined),
      flush: vi.fn(async () => undefined),
      publish: vi.fn(),
    };
    const publisher = createNatsFloorEventPublisher(connection);
    const event = {
      activity_level: 0.4,
      guild: 'creator' as const,
      method: 'observed_activity' as const,
      observed_at: '2026-09-25T12:00:00.000Z',
    };

    await publisher.publish(CREATOR_FLOOR_SUBJECTS.activity, event);
    expect(connection.publish).toHaveBeenCalledWith(CREATOR_FLOOR_SUBJECTS.activity, expect.any(Uint8Array));
    expect(connection.flush).toHaveBeenCalledOnce();
    await publisher.close();
    expect(connection.drain).toHaveBeenCalledOnce();
  });

  it('creates an available publisher from an injected NATS connection', async () => {
    const connection = {
      drain: vi.fn(async () => undefined),
      flush: vi.fn(async () => undefined),
      publish: vi.fn(),
    };
    const publisher = await connectFloorEventPublisher(
      'nats://localhost',
      async () => connection as unknown as NatsConnection,
    );

    expect(publisher.available).toBe(true);
    await publisher.close();
  });

  it('degrades a failed NATS connection to the quiet publisher', async () => {
    const publisher = await connectFloorEventPublisher('nats://localhost', async () => {
      throw new Error('connection_failed');
    });

    expect(publisher.available).toBe(false);
  });

  it('starts with an honest quiet floor and binds Muse as guildmaster', () => {
    const floor = new LivingWorldFloor(new RecordingPublisher());

    expect(floor.realm()).toEqual({
      activity_level: 0,
      champion: 'Muse',
      guild: 'creator',
      quests: [],
      structures: [{ kind: 'hall', level: 1 }],
    });
    expect(floor.party()).toEqual({
      guild: 'creator',
      members: [{ name: 'Muse', role: 'guildmaster', state: 'idle' }],
    });
  });

  it('publishes observed activity and records heartbeat telemetry', async () => {
    const publisher = new RecordingPublisher();
    const telemetry = recordingTelemetry();
    const floor = new LivingWorldFloor(publisher, telemetry);
    const observedAt = new Date('2026-09-25T12:00:00.000Z');

    await expect(floor.recordActivity(0.75, observedAt)).resolves.toEqual({ changed: true, delivered: true });
    expect(floor.realm().activity_level).toBe(0.75);
    expect(publisher.events).toEqual([
      {
        payload: {
          activity_level: 0.75,
          guild: 'creator',
          method: 'observed_activity',
          observed_at: observedAt.toISOString(),
        },
        subject: CREATOR_FLOOR_SUBJECTS.activity,
      },
    ]);
    expect(telemetry.activityHeartbeat).toHaveBeenCalledWith(0.75);
  });

  it('rejects fabricated activity values', async () => {
    const floor = new LivingWorldFloor(new RecordingPublisher());
    await expect(floor.recordActivity(1.1)).rejects.toThrow(RangeError);
    await expect(floor.recordActivity(Number.NaN)).rejects.toThrow(RangeError);
  });

  it('cleanses and emits quest transitions once per real change', async () => {
    const publisher = new RecordingPublisher();
    const telemetry = recordingTelemetry();
    const floor = new LivingWorldFloor(publisher, telemetry);
    const observedAt = new Date('2026-09-25T12:00:00.000Z');

    await expect(
      floor.transitionQuest({ id: 'quest-1', state: 'open', title: '  Realm\nSketch  ' }, observedAt),
    ).resolves.toEqual({ changed: true, delivered: true });
    await expect(
      floor.transitionQuest({ id: 'quest-1', state: 'open', title: 'Realm Sketch' }, observedAt),
    ).resolves.toEqual({ changed: false, delivered: false });

    expect(floor.realm().quests).toEqual([{ id: 'quest-1', state: 'open', title: 'Realm Sketch' }]);
    expect(publisher.events[0]?.subject).toBe(CREATOR_FLOOR_SUBJECTS.quest);
    expect(telemetry.questThroughput).toHaveBeenCalledWith('open');
  });

  it('rejects unsafe quest identifiers and empty titles', async () => {
    const floor = new LivingWorldFloor(new RecordingPublisher());
    await expect(floor.transitionQuest({ id: '../private', state: 'open', title: 'x' })).rejects.toThrow(TypeError);
    await expect(floor.transitionQuest({ id: 'safe', state: 'open', title: '\n\t' })).rejects.toThrow(TypeError);
  });

  it('emits only real Muse state transitions', async () => {
    const publisher = new RecordingPublisher();
    const telemetry = recordingTelemetry();
    const floor = new LivingWorldFloor(publisher, telemetry);

    await expect(floor.transitionChampion('idle')).resolves.toEqual({ changed: false, delivered: false });
    await expect(floor.transitionChampion('working')).resolves.toEqual({ changed: true, delivered: true });
    expect(floor.party().members[0].state).toBe('working');
    expect(publisher.events[0]?.subject).toBe(CREATOR_FLOOR_SUBJECTS.champion);
    expect(telemetry.championTransition).toHaveBeenCalledWith('idle', 'working');
  });

  it('fails soft when event delivery is unavailable and measures coordination', async () => {
    const telemetry = recordingTelemetry();
    const floor = new LivingWorldFloor(new RecordingPublisher(false, new Error('offline')), telemetry);

    await expect(floor.recordActivity(0.2)).resolves.toEqual({ changed: true, delivered: false });
    floor.recordSubguildCoordination('writers', 'unavailable');
    expect(telemetry.subguildCoordination).toHaveBeenCalledWith('writers', 'unavailable');
  });

  it('runs the default quiet telemetry lifecycle without external services', async () => {
    const floor = new LivingWorldFloor(await connectFloorEventPublisher(undefined));
    await floor.recordActivity(0.1);
    await floor.transitionQuest({ id: 'q1', state: 'open', title: 'Real quest' });
    await floor.transitionChampion('blocked');
    floor.recordSubguildCoordination('music_studio', 'accepted');
    await expect(floor.close()).resolves.toBeUndefined();
  });
});
