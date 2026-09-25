// ─── CGRF Header ─────────────────────────────
// File:        src/integrations/activity-aggregator.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/automation/livingworld-floor.ts
// EnumType:    Service
// EnumEdges:   CONSUMES citadel.creator.subguild.writers.status; CONSUMES citadel.creator.subguild.music.status; PRODUCES citadel.creator.activity
// DAG Node:    creator.integrations.activity
// Intent:      Derive floor activity only from deduplicated observed work and fresh sub-guild reports.
// ─────────────────────────────────────────────────────────────

import type { LivingWorldFloor, Subguild } from '../automation/livingworld-floor.js';

export type ObservedActivityKind =
  | 'creative_asset_generated'
  | 'creative_asset_changed'
  | 'lore_compiled'
  | 'voice_narration_ready'
  | 'book_exported'
  | 'book_session_changed'
  | 'merge_request_changed'
  | 'pipeline_changed';

export interface ObservedActivity {
  readonly id: string;
  readonly kind: ObservedActivityKind;
  readonly observedAt: Date;
}

export interface SubguildActivityReport {
  readonly activityLevel: number;
  readonly guild: Subguild;
  readonly observedAt: Date;
  readonly reportId: string;
}

export interface ActivityAggregatorOptions {
  readonly eventTarget?: number;
  readonly reportMaxAgeMs?: number;
  readonly windowMs?: number;
}

const DEFAULT_EVENT_TARGET = 20;
const DEFAULT_REPORT_MAX_AGE_MS = 5 * 60_000;
const DEFAULT_WINDOW_MS = 15 * 60_000;

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback;
}

function activityLevel(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('Sub-guild activity level must be between 0 and 1');
  }
  return value;
}

export class RealActivityAggregator {
  private readonly eventTarget: number;
  private readonly localEvents = new Map<string, ObservedActivity>();
  private readonly reportMaxAgeMs: number;
  private readonly reports = new Map<Subguild, SubguildActivityReport>();
  private readonly windowMs: number;

  public constructor(
    private readonly floor: Pick<LivingWorldFloor, 'recordActivity' | 'recordSubguildCoordination'>,
    options: ActivityAggregatorOptions = {},
  ) {
    this.eventTarget = positiveInteger(options.eventTarget, DEFAULT_EVENT_TARGET);
    this.reportMaxAgeMs = positiveInteger(options.reportMaxAgeMs, DEFAULT_REPORT_MAX_AGE_MS);
    this.windowMs = positiveInteger(options.windowMs, DEFAULT_WINDOW_MS);
  }

  public async recordLocalEvent(event: ObservedActivity): Promise<number> {
    if (this.localEvents.has(event.id)) {
      return this.currentLevel(event.observedAt);
    }

    this.localEvents.set(event.id, event);
    return this.publishLevel(event.observedAt);
  }

  public async updateSubguild(report: SubguildActivityReport): Promise<number> {
    activityLevel(report.activityLevel);
    if (this.reports.get(report.guild)?.reportId === report.reportId) {
      return this.currentLevel(report.observedAt);
    }

    this.reports.set(report.guild, report);
    this.floor.recordSubguildCoordination(report.guild, 'accepted');
    return this.publishLevel(report.observedAt);
  }

  public currentLevel(at = new Date()): number {
    this.prune(at);
    const localLevel = Math.min(1, this.localEvents.size / this.eventTarget);
    const sources = localLevel > 0 ? [localLevel] : [];

    for (const report of this.reports.values()) {
      if (at.getTime() - report.observedAt.getTime() <= this.reportMaxAgeMs) {
        sources.push(report.activityLevel);
      }
    }

    if (sources.length === 0) {
      return 0;
    }
    return Number((sources.reduce((total, value) => total + value, 0) / sources.length).toFixed(4));
  }

  private async publishLevel(observedAt: Date): Promise<number> {
    const level = this.currentLevel(observedAt);
    await this.floor.recordActivity(level, observedAt);
    return level;
  }

  private prune(at: Date): void {
    const oldest = at.getTime() - this.windowMs;
    for (const [id, event] of this.localEvents) {
      if (event.observedAt.getTime() < oldest) {
        this.localEvents.delete(id);
      }
    }
    for (const [guild, report] of this.reports) {
      if (at.getTime() - report.observedAt.getTime() > this.reportMaxAgeMs) {
        this.reports.delete(guild);
        this.floor.recordSubguildCoordination(guild, 'unavailable');
      }
    }
  }
}
