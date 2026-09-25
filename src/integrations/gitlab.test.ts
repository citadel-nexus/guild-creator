// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/gitlab.test.ts
// Stage:       08_TEST
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/integrations/gitlab.ts, src/integrations/activity-aggregator.ts
// EnumType:    Test
// EnumEdges:   VERIFIED_BY src/integrations/gitlab.ts; VALIDATES GitLab read-only bridge
// DAG Node:    creator.integrations.gitlab.test
// Intent:      Verify GitLab requests remain read-only and private records reduce to public-safe quest metadata.
// ─────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it, vi } from 'vitest';

import { RealActivityAggregator } from './activity-aggregator.js';
import {
  createGitLabBridgeFromEnv,
  GitLabQuestSync,
  GitLabReadOnlyBridge,
  sanitizeCreativeAssetMetadata,
} from './gitlab.js';

const configuration = {
  assetMetadataPath: 'public/creative-assets.json',
  baseUrl: 'https://gitlab.citadel-nexus.com',
  projectId: '75',
  readToken: 'test-value',
  ref: 'main',
};

afterEach(() => vi.unstubAllEnvs());

function gitlabFetch() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      input instanceof Request ? input.url : input instanceof URL ? input.href : input,
    );
    expect(init?.method).toBe('GET');
    if (url.pathname.endsWith('/raw')) {
      return new Response(
        JSON.stringify([
          { id: 'asset-1', kind: 'image', private_name: 'hidden', status: 'ready', updated_at: '2026-09-25T12:00:00Z' },
        ]),
      );
    }
    if (url.pathname.endsWith('/pipelines')) {
      return new Response(JSON.stringify([{ id: 7, status: 'success', updated_at: '2026-09-25T12:00:00Z' }]));
    }
    if (url.pathname.endsWith('/merge_requests')) {
      return new Response(JSON.stringify([{ iid: 8, state: 'opened', updated_at: '2026-09-25T12:00:00Z' }]));
    }
    return new Response(JSON.stringify({ version: 'test' }));
  });
}

describe('GitLabReadOnlyBridge', () => {
  it('rejects origins outside the authorized self-hosted GitLab', () => {
    expect(() => new GitLabReadOnlyBridge({ ...configuration, baseUrl: 'https://gitlab.com' })).toThrow(TypeError);
  });

  it('fails environment configuration closed without making a request', () => {
    vi.stubEnv('GITLAB_ASSET_METADATA_PATH', configuration.assetMetadataPath);
    vi.stubEnv('GITLAB_BASE_URL', 'https://gitlab.com');
    vi.stubEnv('GITLAB_PROJECT_ID', configuration.projectId);
    vi.stubEnv('GITLAB_READ_TOKEN', configuration.readToken);
    vi.stubEnv('GITLAB_REF', configuration.ref);
    expect(createGitLabBridgeFromEnv()).toBeUndefined();

    vi.stubEnv('GITLAB_BASE_URL', configuration.baseUrl);
    expect(createGitLabBridgeFromEnv()).toBeInstanceOf(GitLabReadOnlyBridge);
  });

  it('sanitizes asset, pipeline, and merge request reads', async () => {
    const fetcher = gitlabFetch();
    const bridge = new GitLabReadOnlyBridge(configuration, fetcher);

    await expect(bridge.creativeAssetMetadata()).resolves.toEqual([
      { id: 'asset-1', kind: 'image', status: 'ready', updatedAt: '2026-09-25T12:00:00.000Z' },
    ]);
    await expect(bridge.pipelineStatuses()).resolves.toEqual([
      { id: 7, status: 'success', updatedAt: '2026-09-25T12:00:00.000Z' },
    ]);
    await expect(bridge.mergeRequestActivity()).resolves.toEqual([
      { id: 8, state: 'opened', updatedAt: '2026-09-25T12:00:00.000Z' },
    ]);
    await expect(bridge.healthCheck()).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('drops malformed metadata rather than leaking unvalidated rows', () => {
    expect(sanitizeCreativeAssetMetadata([{ id: '../private', status: 'ready', updated_at: 'bad' }])).toEqual([]);
    expect(sanitizeCreativeAssetMetadata({ id: 'asset' })).toEqual([]);
  });
});

describe('GitLabQuestSync', () => {
  it('turns new statuses into generic quests and deduplicated activity', async () => {
    const target = {
      recordActivity: vi.fn(async () => ({ changed: true, delivered: false })),
      recordSubguildCoordination: vi.fn(),
      transitionQuest: vi.fn(async () => ({ changed: true, delivered: false })),
    };
    const activity = new RealActivityAggregator(target, { eventTarget: 10 });
    const sync = new GitLabQuestSync(new GitLabReadOnlyBridge(configuration, gitlabFetch()), target, activity);

    await sync.sync();
    await sync.sync();

    expect(target.transitionQuest).toHaveBeenCalledWith(
      { id: 'gitlab-asset:asset-1', state: 'closed', title: 'Creative asset asset-1' },
      new Date('2026-09-25T12:00:00.000Z'),
    );
    expect(target.transitionQuest).toHaveBeenCalledWith(
      { id: 'gitlab-pipeline:7', state: 'closed', title: 'Creative pipeline 7' },
      new Date('2026-09-25T12:00:00.000Z'),
    );
    expect(target.transitionQuest).toHaveBeenCalledWith(
      { id: 'gitlab-merge-request:8', state: 'open', title: 'Creative merge request 8' },
      new Date('2026-09-25T12:00:00.000Z'),
    );
    expect(target.recordActivity).toHaveBeenCalledTimes(3);
    expect(() => sync.start(1)).toThrow(RangeError);
    sync.close();
  });
});
