// ─── CGRF Header ──────────────────────────────
// File:        src/automation/cml-bridge.ts
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
// EnumEdges:   CONSUMES citadel.creator.cml.task; PRODUCES citadel.creator.cml.result; GATES DISP-LIVINGWORLD-creator
// DAG Node:    creator.cml.bridge
// Intent:      Require explicit dispatch authorization and an injected handler before processing Creator tasks.
// ────────────────────────────────────────────────────────────

import { connect, StringCodec } from 'nats';

const CML_SUBJECTS = {
  result: 'citadel.creator.cml.result',
  task: 'citadel.creator.cml.task',
} as const;

interface CmlTask {
  readonly dispatch_id: string;
  readonly task_id: string;
}

interface CmlResult {
  readonly error?: string;
  readonly output?: unknown;
  readonly status: 'done' | 'failed';
  readonly task_id: string;
}

export interface CmlBridgeOptions {
  readonly activeDispatchId: string;
  readonly handle: (task: CmlTask) => Promise<unknown>;
  readonly servers?: string;
}

function parseTask(value: string): CmlTask | undefined {
  try {
    const candidate: unknown = JSON.parse(value);
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      'dispatch_id' in candidate &&
      typeof candidate.dispatch_id === 'string' &&
      'task_id' in candidate &&
      typeof candidate.task_id === 'string'
    ) {
      return { dispatch_id: candidate.dispatch_id, task_id: candidate.task_id };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function startCmlBridge(options: CmlBridgeOptions): Promise<void> {
  if (options.servers === undefined || options.servers.length === 0) {
    return;
  }

  const connection = await connect({ servers: options.servers });
  const codec = StringCodec();
  const subscription = connection.subscribe(CML_SUBJECTS.task);

  try {
    for await (const message of subscription) {
      const task = parseTask(codec.decode(message.data));
      let result: CmlResult;

      if (task === undefined || task.dispatch_id !== options.activeDispatchId) {
        result = { error: 'unauthorized_dispatch', status: 'failed', task_id: task?.task_id ?? 'unknown' };
      } else {
        try {
          result = { output: await options.handle(task), status: 'done', task_id: task.task_id };
        } catch {
          result = { error: 'handler_failed', status: 'failed', task_id: task.task_id };
        }
      }

      connection.publish(CML_SUBJECTS.result, codec.encode(JSON.stringify(result)));
    }
  } finally {
    await connection.drain();
  }
}
