// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/n8n-webhook.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     node:crypto
// EnumType:    Adapter
// EnumEdges:   CONSUMES /webhooks/n8n; GATES DISP-LIVINGWORLD-creator; TRIGGERS citadel.creator.*
// DAG Node:    creator.integrations.n8n
// Intent:      Authenticate bounded n8n workflow events before they can change public Creator floor state.
// ──────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { CreativeRole } from './posthog.js';

export type N8nEventType =
  | 'asset.generated'
  | 'voice_narration.complete'
  | 'book.exported'
  | 'quest.opened'
  | 'quest.closed';

export interface N8nCreativeEvent {
  readonly dispatchId: string;
  readonly eventId: string;
  readonly eventType: N8nEventType;
  readonly memberId?: string;
  readonly occurredAt: Date;
  readonly projectId: string;
  readonly questTitle?: string;
  readonly role?: CreativeRole;
}

export interface N8nEventSink {
  handleN8nEvent(event: N8nCreativeEvent): Promise<void>;
}

export interface N8nWebhookResult {
  readonly body: { readonly accepted?: true; readonly error?: string };
  readonly statusCode: number;
}

const PUBLIC_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/u;

function eventType(value: unknown): value is N8nEventType {
  return (
    value === 'asset.generated' ||
    value === 'voice_narration.complete' ||
    value === 'book.exported' ||
    value === 'quest.opened' ||
    value === 'quest.closed'
  );
}

function role(value: unknown): value is CreativeRole {
  return value === 'writer' || value === 'musician' || value === 'artist';
}

function parseEvent(rawBody: Buffer): N8nCreativeEvent | undefined {
  try {
    const value: unknown = JSON.parse(rawBody.toString('utf8'));
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    const input = value as Record<string, unknown>;
    if (
      typeof input.dispatch_id !== 'string' ||
      typeof input.event_id !== 'string' ||
      !PUBLIC_ID.test(input.event_id) ||
      !eventType(input.event_type) ||
      typeof input.occurred_at !== 'string' ||
      Number.isNaN(Date.parse(input.occurred_at)) ||
      typeof input.project_id !== 'string' ||
      !PUBLIC_ID.test(input.project_id)
    ) {
      return undefined;
    }
    if (input.member_id !== undefined && (typeof input.member_id !== 'string' || !PUBLIC_ID.test(input.member_id))) {
      return undefined;
    }
    if (input.role !== undefined && !role(input.role)) {
      return undefined;
    }
    const questTitle = typeof input.quest_title === 'string' ? input.quest_title.trim().slice(0, 120) : undefined;
    if ((input.event_type === 'quest.opened' || input.event_type === 'quest.closed') && !questTitle) {
      return undefined;
    }

    return {
      dispatchId: input.dispatch_id,
      eventId: input.event_id,
      eventType: input.event_type,
      occurredAt: new Date(input.occurred_at),
      projectId: input.project_id,
      ...(typeof input.member_id === 'string' ? { memberId: input.member_id } : {}),
      ...(questTitle === undefined ? {} : { questTitle }),
      ...(role(input.role) ? { role: input.role } : {}),
    };
  } catch {
    return undefined;
  }
}

export class N8nWebhookHandler {
  public constructor(
    private readonly activeDispatchId: string,
    private readonly secret: string,
    private readonly sink: N8nEventSink,
  ) {}

  public async handle(rawBody: Buffer, signature: string | undefined): Promise<N8nWebhookResult> {
    if (!this.validSignature(rawBody, signature)) {
      return { body: { error: 'invalid_signature' }, statusCode: 401 };
    }
    const event = parseEvent(rawBody);
    if (event === undefined) {
      return { body: { error: 'invalid_event' }, statusCode: 400 };
    }
    if (event.dispatchId !== this.activeDispatchId) {
      return { body: { error: 'unauthorized_dispatch' }, statusCode: 403 };
    }

    await this.sink.handleN8nEvent(event);
    return { body: { accepted: true }, statusCode: 202 };
  }

  private validSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (signature === undefined || this.secret.length === 0) {
      return false;
    }
    const expected = Buffer.from(createHmac('sha256', this.secret).update(rawBody).digest('hex'), 'hex');
    const supplied = Buffer.from(signature.replace(/^sha256=/u, ''), 'hex');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }
}

export function createN8nWebhookFromEnv(sink: N8nEventSink): N8nWebhookHandler | undefined {
  const activeDispatchId = process.env.ACTIVE_DISPATCH_ID;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  return activeDispatchId === undefined || activeDispatchId.length === 0 || secret === undefined || secret.length === 0
    ? undefined
    : new N8nWebhookHandler(activeDispatchId, secret, sink);
}
