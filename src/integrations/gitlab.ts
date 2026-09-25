// ─── CGRF Header ─────────────────────────────
// File:        src/integrations/gitlab.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/integrations/activity-aggregator.ts, src/automation/livingworld-floor.ts
// EnumType:    Adapter
// EnumEdges:   CONSUMES GitLab creative asset metadata; CONSUMES GitLab CI status; CONSUMES GitLab merge request activity
// DAG Node:    creator.integrations.gitlab
// Intent:      Pull only whitelisted GitLab metadata and translate real status changes into public-safe floor state.
// ────────────────────────────────────────────────────────────

import type { LivingWorldFloor, RealmQuest } from '../automation/livingworld-floor.js';
import type { RealActivityAggregator } from './activity-aggregator.js';

export interface GitLabConfiguration {
  readonly assetMetadataPath: string;
  readonly baseUrl: string;
  readonly projectId: string;
  readonly readToken: string;
  readonly ref: string;
}

export interface CreativeAssetMetadata {
  readonly id: string;
  readonly kind: 'image' | 'audio' | 'video' | 'text' | 'other';
  readonly status: 'queued' | 'working' | 'ready' | 'failed';
  readonly updatedAt: string;
}

export interface GitLabPipelineStatus {
  readonly id: number;
  readonly status: string;
  readonly updatedAt: string;
}

export interface GitLabMergeRequestActivity {
  readonly id: number;
  readonly state: 'opened' | 'closed' | 'merged';
  readonly updatedAt: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return undefined;
  }
  return new Date(value).toISOString();
}

function assetKind(value: unknown): CreativeAssetMetadata['kind'] {
  return value === 'image' || value === 'audio' || value === 'video' || value === 'text' ? value : 'other';
}

function assetStatus(value: unknown): CreativeAssetMetadata['status'] | undefined {
  return value === 'queued' || value === 'working' || value === 'ready' || value === 'failed' ? value : undefined;
}

export function sanitizeCreativeAssetMetadata(value: unknown): CreativeAssetMetadata[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const item = record(entry);
    const id = typeof item?.id === 'string' ? item.id : undefined;
    const status = assetStatus(item?.status);
    const updatedAt = isoDate(item?.updated_at);
    if (id === undefined || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/u.test(id) || status === undefined || updatedAt === undefined) {
      return [];
    }
    return [{ id, kind: assetKind(item?.kind), status, updatedAt }];
  });
}

export class GitLabReadOnlyBridge {
  public constructor(
    private readonly configuration: GitLabConfiguration,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    const baseUrl = new URL(configuration.baseUrl);
    if (baseUrl.protocol !== 'https:' || baseUrl.hostname !== 'gitlab.citadel-nexus.com') {
      throw new TypeError('GitLab bridge requires the authorized self-hosted HTTPS origin');
    }
  }

  public async creativeAssetMetadata(): Promise<CreativeAssetMetadata[]> {
    const path = encodeURIComponent(this.configuration.assetMetadataPath);
    const value = await this.getJson(
      `/api/v4/projects/${encodeURIComponent(this.configuration.projectId)}/repository/files/${path}/raw?ref=${encodeURIComponent(this.configuration.ref)}`,
    );
    return sanitizeCreativeAssetMetadata(value);
  }

  public async pipelineStatuses(): Promise<GitLabPipelineStatus[]> {
    const value = await this.getJson(`/api/v4/projects/${encodeURIComponent(this.configuration.projectId)}/pipelines?per_page=20`);
    return Array.isArray(value)
      ? value.flatMap((entry) => {
          const item = record(entry);
          const updatedAt = isoDate(item?.updated_at);
          return typeof item?.id === 'number' && typeof item.status === 'string' && updatedAt !== undefined
            ? [{ id: item.id, status: item.status, updatedAt }]
            : [];
        })
      : [];
  }

  public async mergeRequestActivity(): Promise<GitLabMergeRequestActivity[]> {
    const value = await this.getJson(
      `/api/v4/projects/${encodeURIComponent(this.configuration.projectId)}/merge_requests?scope=all&per_page=20`,
    );
    return Array.isArray(value)
      ? value.flatMap((entry) => {
          const item = record(entry);
          const state = item?.state;
          const updatedAt = isoDate(item?.updated_at);
          return typeof item?.iid === 'number' &&
            (state === 'opened' || state === 'closed' || state === 'merged') &&
            updatedAt !== undefined
            ? [{ id: item.iid, state, updatedAt }]
            : [];
        })
      : [];
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.getJson('/api/v4/version');
      return true;
    } catch {
      return false;
    }
  }

  private async getJson(path: string): Promise<unknown> {
    const response = await this.fetcher(new URL(path, this.configuration.baseUrl), {
      headers: { 'private-token': this.configuration.readToken },
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error(`GitLab read failed with status ${response.status}`);
    }
    return response.json() as Promise<unknown>;
  }
}

function pipelineQuest(status: GitLabPipelineStatus): RealmQuest {
  const closed = status.status === 'success' || status.status === 'canceled' || status.status === 'skipped';
  return { id: `gitlab-pipeline:${status.id}`, state: closed ? 'closed' : 'open', title: `Creative pipeline ${status.id}` };
}

function mergeRequestQuest(activity: GitLabMergeRequestActivity): RealmQuest {
  return {
    id: `gitlab-merge-request:${activity.id}`,
    state: activity.state === 'opened' ? 'open' : 'closed',
    title: `Creative merge request ${activity.id}`,
  };
}

export class GitLabQuestSync {
  private interval: NodeJS.Timeout | undefined;
  private readonly observed = new Set<string>();

  public constructor(
    private readonly bridge: GitLabReadOnlyBridge,
    private readonly floor: Pick<LivingWorldFloor, 'transitionQuest'>,
    private readonly activity: RealActivityAggregator,
  ) {}

  public async sync(): Promise<void> {
    const [assets, pipelines, mergeRequests] = await Promise.all([
      this.bridge.creativeAssetMetadata(),
      this.bridge.pipelineStatuses(),
      this.bridge.mergeRequestActivity(),
    ]);

    for (const asset of assets) {
      const observedAt = new Date(asset.updatedAt);
      await this.floor.transitionQuest(
        {
          id: `gitlab-asset:${asset.id}`,
          state: asset.status === 'ready' ? 'closed' : 'open',
          title: `Creative asset ${asset.id}`,
        },
        observedAt,
      );
      await this.observe(
        `asset:${asset.id}:${asset.status}`,
        asset.status === 'ready' ? 'creative_asset_generated' : 'creative_asset_changed',
        observedAt,
      );
    }
    for (const pipeline of pipelines) {
      await this.floor.transitionQuest(pipelineQuest(pipeline), new Date(pipeline.updatedAt));
      await this.observe(`pipeline:${pipeline.id}:${pipeline.status}`, 'pipeline_changed', new Date(pipeline.updatedAt));
    }
    for (const mergeRequest of mergeRequests) {
      await this.floor.transitionQuest(mergeRequestQuest(mergeRequest), new Date(mergeRequest.updatedAt));
      await this.observe(
        `merge-request:${mergeRequest.id}:${mergeRequest.state}`,
        'merge_request_changed',
        new Date(mergeRequest.updatedAt),
      );
    }
  }

  public start(intervalMs: number): void {
    if (!Number.isInteger(intervalMs) || intervalMs < 10_000) {
      throw new RangeError('GitLab sync interval must be at least ten seconds');
    }
    this.interval = setInterval(() => {
      void this.sync().catch((error: unknown) => {
        console.warn('creator_gitlab_sync_unavailable', {
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      });
    }, intervalMs);
  }

  public close(): void {
    if (this.interval !== undefined) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private async observe(
    id: string,
    kind: 'creative_asset_changed' | 'creative_asset_generated' | 'pipeline_changed' | 'merge_request_changed',
    observedAt: Date,
  ): Promise<void> {
    if (this.observed.has(id)) {
      return;
    }
    this.observed.add(id);
    await this.activity.recordLocalEvent({ id: `gitlab:${id}`, kind, observedAt });
  }
}

export function createGitLabBridgeFromEnv(): GitLabReadOnlyBridge | undefined {
  const values = {
    assetMetadataPath: process.env.GITLAB_ASSET_METADATA_PATH,
    baseUrl: process.env.GITLAB_BASE_URL,
    projectId: process.env.GITLAB_PROJECT_ID,
    readToken: process.env.GITLAB_READ_TOKEN,
    ref: process.env.GITLAB_REF,
  };
  if (Object.values(values).some((value) => value === undefined || value.length === 0)) {
    return undefined;
  }
  try {
    return new GitLabReadOnlyBridge(values as GitLabConfiguration);
  } catch {
    return undefined;
  }
}
