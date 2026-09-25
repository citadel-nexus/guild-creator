// ─── CGRF Header ───────────────────────────────
// File:        src/mobile/creator-app.test.ts
// Stage:       08_TEST
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/mobile/creator-app.ts
// EnumType:    Test
// EnumEdges:   VERIFIED_BY src/mobile/creator-app.ts; VALIDATES Datadog RUM; VALIDATES /realm/creator.json
// DAG Node:    creator.mobile.app.test
// Intent:      Verify mobile realm loading, privacy-safe RUM setup, and quiet degradation on invalid data.
// ─────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';

import {
  initializeCreatorRum,
  loadCreatorRealm,
  type CreatorRumAdapter,
} from './creator-app.js';

function rumAdapter(): CreatorRumAdapter {
  return {
    addAction: vi.fn(),
    addTiming: vi.fn(),
    init: vi.fn(),
    setGlobalContextProperty: vi.fn(),
    startView: vi.fn(),
  };
}

describe('Creator mobile app', () => {
  it('initializes privacy-safe RUM with Muse context', () => {
    const rum = rumAdapter();
    initializeCreatorRum(
      {
        applicationId: 'public-app-id',
        clientToken: 'public-client-token',
        env: 'test',
        version: '1.0.0',
      },
      rum,
    );

    expect(rum.init).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPrivacyLevel: 'mask-user-input',
        service: 'guild-mcp-creator',
        sessionReplaySampleRate: 0,
      }),
    );
    expect(rum.setGlobalContextProperty).toHaveBeenCalledWith('seat', 'muse');
    expect(rum.startView).toHaveBeenCalledWith({ name: 'creator-living-world-floor' });
  });

  it('rejects incomplete RUM credentials without initializing', () => {
    const rum = rumAdapter();
    expect(() =>
      initializeCreatorRum(
        { applicationId: '', clientToken: '', env: 'test', version: '1.0.0' },
        rum,
      ),
    ).toThrow(TypeError);
    expect(rum.init).not.toHaveBeenCalled();
  });

  it('loads a validated realm and records bounded vitals', async () => {
    const rum = rumAdapter();
    const realm = {
      activity_level: 0.5,
      champion: 'Muse',
      guild: 'creator',
      quests: [{ id: 'q1', state: 'open', title: 'Sketch the hall' }],
      structures: [{ kind: 'hall', level: 1 }],
    };

    await expect(
      loadCreatorRealm(async () => new Response(JSON.stringify(realm), { status: 200 }), rum),
    ).resolves.toEqual({ available: true, realm });
    expect(rum.addTiming).toHaveBeenCalledWith('creator_realm_loaded', expect.any(Number));
    expect(rum.addAction).toHaveBeenCalledWith('creator_realm_viewed', {
      activity_band: 'active',
      quest_count: 1,
    });
  });

  it('degrades invalid or unavailable data to the quiet floor', async () => {
    const rum = rumAdapter();
    const result = await loadCreatorRealm(
      async () => new Response(JSON.stringify({ guild: 'creator' }), { status: 503 }),
      rum,
    );

    expect(result).toEqual({
      available: false,
      realm: {
        activity_level: 0,
        champion: 'Muse',
        guild: 'creator',
        quests: [],
        structures: [{ kind: 'hall', level: 1 }],
      },
    });
    expect(rum.addAction).toHaveBeenCalledWith('creator_realm_unavailable');
  });
});
