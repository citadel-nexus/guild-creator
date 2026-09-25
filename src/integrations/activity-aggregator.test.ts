// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/activity-aggregator.test.ts
// Stage:       08_TEST
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/integrations/activity-aggregator.ts
// EnumType:    Test
// EnumEdges:   VERIFIED_BY src/integrations/activity-aggregator.ts; VALIDATES citadel.creator.activity
// DAG Node:    creator.integrations.activity.test
// Intent:      Verify activity derives only from deduplicated events and fresh bounded sub-guild reports.
// ────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';

import { RealActivityAggregator } from './activity-aggregator.js';

function floor() {
  return {
    recordActivity: vi.fn(async () => ({ changed: true, delivered: false })),
    recordSubguildCoordination: vi.fn(),
  };
}

describe('RealActivityAggregator', () => {
  it('normalizes deduplicated observed events within the configured window', async () => {
    const target = floor();
    const aggregator = new RealActivityAggregator(target, { eventTarget: 2, windowMs: 60_000 });
    const now = new Date('2026-09-25T12:00:00.000Z');

    await expect(
      aggregator.recordLocalEvent({ id: 'asset-1', kind: 'creative_asset_generated', observedAt: now }),
    ).resolves.toBe(0.5);
    await expect(
      aggregator.recordLocalEvent({ id: 'asset-1', kind: 'creative_asset_generated', observedAt: now }),
    ).resolves.toBe(0.5);
    await expect(
      aggregator.recordLocalEvent({ id: 'lore-1', kind: 'lore_compiled', observedAt: now }),
    ).resolves.toBe(1);

    expect(target.recordActivity).toHaveBeenCalledTimes(2);
    expect(target.recordActivity).toHaveBeenLastCalledWith(1, now);
  });

  it('averages fresh sub-guild reports and rejects out-of-range data', async () => {
    const target = floor();
    const aggregator = new RealActivityAggregator(target, { reportMaxAgeMs: 1_000 });
    const now = new Date('2026-09-25T12:00:00.000Z');

    await expect(
      aggregator.updateSubguild({ activityLevel: 0.8, guild: 'writers', observedAt: now, reportId: 'w1' }),
    ).resolves.toBe(0.8);
    await expect(
      aggregator.updateSubguild({ activityLevel: 0.4, guild: 'music_studio', observedAt: now, reportId: 'm1' }),
    ).resolves.toBe(0.6);
    expect(target.recordSubguildCoordination).toHaveBeenCalledWith('writers', 'accepted');
    await expect(
      aggregator.updateSubguild({ activityLevel: 2, guild: 'writers', observedAt: now, reportId: 'bad' }),
    ).rejects.toThrow(RangeError);
  });

  it('removes stale inputs instead of fabricating continuity', async () => {
    const target = floor();
    const aggregator = new RealActivityAggregator(target, { reportMaxAgeMs: 1_000, windowMs: 1_000 });
    const now = new Date('2026-09-25T12:00:00.000Z');

    await aggregator.updateSubguild({ activityLevel: 0.9, guild: 'writers', observedAt: now, reportId: 'w1' });
    expect(aggregator.currentLevel(new Date(now.getTime() + 2_000))).toBe(0);
    expect(target.recordSubguildCoordination).toHaveBeenCalledWith('writers', 'unavailable');
  });
});
