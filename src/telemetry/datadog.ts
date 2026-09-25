// ─── CGRF Header ──────────────────────────────
// File:        src/telemetry/datadog.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     dd-trace, hot-shots, src/automation/livingworld-floor.ts
// EnumType:    Service
// EnumEdges:   CONSUMES creator.floor.*; PRODUCES Datadog APM; PRODUCES Datadog custom metrics
// DAG Node:    creator.telemetry
// Intent:      Trace Creator floor operations and report bounded operational metrics without exposing content.
// ───────────────────────────────────────────────────────────

import ddTrace from 'dd-trace';
import { StatsD } from 'hot-shots';

import type {
  CoordinationOutcome,
  FloorTelemetry,
  Subguild,
} from '../automation/livingworld-floor.js';
import type { ChampionState, QuestState } from '../automation/livingworld-emitter.js';

const SERVICE = 'guild-mcp-creator';

function dogstatsdPort(): number {
  const parsed = Number.parseInt(process.env.DD_DOGSTATSD_PORT ?? '8125', 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : 8125;
}

export function createDatadogFloorTelemetry(): FloorTelemetry {
  const tracer = ddTrace.init({
    env: process.env.DD_ENV ?? 'development',
    logInjection: true,
    runtimeMetrics: true,
    service: SERVICE,
    version: process.env.npm_package_version,
  });
  const metrics = new StatsD({
    errorHandler(error: Error): void {
      console.warn('creator_metrics_error', { error: error.message });
    },
    globalTags: ['service:guild-mcp-creator', 'seat:muse'],
    host: process.env.DD_AGENT_HOST ?? 'localhost',
    mock: process.env.DD_AGENT_HOST === undefined,
    port: dogstatsdPort(),
    prefix: 'citadel.creator.',
  });

  return {
    activityHeartbeat(level: number): void {
      metrics.increment('floor.activity.heartbeat');
      metrics.gauge('floor.activity.level', level);
    },
    championTransition(previousState: ChampionState, state: ChampionState): void {
      metrics.increment('floor.champion.state_transition', [`from:${previousState}`, `to:${state}`]);
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) =>
        metrics.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    },
    questThroughput(state: QuestState): void {
      metrics.increment('floor.quest.throughput', [`state:${state}`]);
    },
    subguildCoordination(subguild: Subguild, outcome: CoordinationOutcome): void {
      metrics.increment('floor.subguild.coordination', [`subguild:${subguild}`, `outcome:${outcome}`]);
    },
    withSpan<Result>(operation: string, work: () => Promise<Result>): Promise<Result> {
      return tracer.trace(`creator.floor.${operation}`, { resource: operation, service: SERVICE }, work);
    },
  };
}
