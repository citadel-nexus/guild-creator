// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/supabase.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     @supabase/supabase-js
// EnumType:    Adapter
// EnumEdges:   CONSUMES lore_entries; CONSUMES creative asset tables; CONSUMES book_sessions
// DAG Node:    creator.integrations.supabase
// Intent:      Reduce Supabase Realtime rows to public-safe observed activity identifiers and statuses.
// ──────────────────────────────────────────────────────────────

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseActivityKind = 'creative_asset_generated' | 'lore_compiled' | 'book_session_changed';

export interface SupabaseActivityEvent {
  readonly id: string;
  readonly kind: SupabaseActivityKind;
  readonly observedAt: Date;
  readonly status?: string;
}

interface SourceTable {
  readonly kind: SupabaseActivityKind;
  readonly name: string;
}

function publicRow(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function publicId(value: unknown): string | undefined {
  const id = typeof value === 'number' ? String(value) : value;
  return typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/u.test(id) ? id : undefined;
}

function publicStatus(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-z_]{1,32}$/u.test(value) ? value : undefined;
}

export function toPublicSupabaseEvent(
  kind: SupabaseActivityKind,
  rowValue: unknown,
  commitTimestamp: string,
): SupabaseActivityEvent | undefined {
  const row = publicRow(rowValue);
  const id = publicId(row?.id);
  if (id === undefined || Number.isNaN(Date.parse(commitTimestamp))) {
    return undefined;
  }
  const status = publicStatus(row?.status);
  return {
    id,
    kind,
    observedAt: new Date(commitTimestamp),
    ...(status === undefined ? {} : { status }),
  };
}

function tableName(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(value)) {
    throw new TypeError('Supabase table names must be public-safe identifiers');
  }
  return value;
}

export class SupabaseCreativeSource {
  private readonly channels: RealtimeChannel[] = [];

  public constructor(
    private readonly client: SupabaseClient,
    private readonly tables: readonly SourceTable[],
  ) {}

  public start(onActivity: (event: SupabaseActivityEvent) => Promise<void>): void {
    for (const table of this.tables) {
      const channel = this.client
        .channel(`creator-${table.name}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: table.name },
          (payload) => {
            const event = toPublicSupabaseEvent(table.kind, payload.new, payload.commit_timestamp);
            if (event !== undefined) {
              void onActivity(event).catch((error: unknown) => {
                console.warn('creator_supabase_event_rejected', {
                  error: error instanceof Error ? error.message : 'unknown_error',
                  table: table.name,
                });
              });
            }
          },
        )
        .subscribe();
      this.channels.push(channel);
    }
  }

  public async healthCheck(): Promise<boolean> {
    const result = await this.client.from('lore_entries').select('id', { count: 'exact', head: true });
    return result.error === null;
  }

  public async close(): Promise<void> {
    await Promise.all(this.channels.map((channel) => this.client.removeChannel(channel)));
    this.channels.length = 0;
  }
}

export function createSupabaseCreativeSourceFromEnv(): SupabaseCreativeSource | undefined {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (url === undefined || key === undefined || url.length === 0 || key.length === 0) {
    return undefined;
  }

  try {
    const assetTables = (process.env.SUPABASE_CREATIVE_ASSET_TABLES ?? 'creative_assets')
      .split(',')
      .map((name) => tableName(name.trim()))
      .filter((name) => name.length > 0);
    const tables: SourceTable[] = [
      { kind: 'lore_compiled', name: 'lore_entries' },
      { kind: 'book_session_changed', name: 'book_sessions' },
      ...assetTables.map((name): SourceTable => ({ kind: 'creative_asset_generated', name })),
    ];
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return new SupabaseCreativeSource(client, tables);
  } catch {
    return undefined;
  }
}
