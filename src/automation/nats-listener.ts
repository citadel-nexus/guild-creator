// ─── CGRF Header ──────────────────────────────
// File:        src/automation/nats-listener.ts
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
// EnumEdges:   CONSUMES citadel.creator.>
// DAG Node:    creator.nats.listener
// Intent:      Provide an explicit read-only Creator event listener without autonomous side effects.
// ────────────────────────────────────────────────────────────

import { connect, StringCodec } from 'nats';

export const CREATOR_EVENT_WILDCARD = 'citadel.creator.>';

export interface CreatorMessage {
  readonly subject: string;
  readonly data: string;
}

export async function startListener(
  servers: string | undefined,
  onMessage: (message: CreatorMessage) => Promise<void>,
): Promise<void> {
  if (servers === undefined || servers.length === 0) {
    return;
  }

  const connection = await connect({ servers });
  const codec = StringCodec();
  const subscription = connection.subscribe(CREATOR_EVENT_WILDCARD);

  try {
    for await (const message of subscription) {
      await onMessage({ subject: message.subject, data: codec.decode(message.data) });
    }
  } finally {
    await connection.drain();
  }
}
