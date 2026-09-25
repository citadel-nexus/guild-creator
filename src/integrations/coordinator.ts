// ─── CGRF Header ──────────────────────────────
// File:        src/integrations/coordinator.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/integrations/activity-aggregator.ts, src/integrations/posthog.ts, src/integrations/customerio.ts
// EnumType:    Service
// EnumEdges:   CONSUMES Supabase Realtime; CONSUMES /webhooks/n8n; PRODUCES citadel.creator.*
// DAG Node:    creator.integrations.coordinator
// Intent:      Translate authenticated observed integration events into bounded floor, analytics, and notification operations.
// ──────────────────────────────────────────────────────────────

import type { LivingWorldFloor } from '../automation/livingworld-floor.js';
import type { QuestState } from '../automation/livingworld-emitter.js';
import type { RealActivityAggregator, ObservedActivityKind } from './activity-aggregator.js';
import type { CustomerIoHooks } from './customerio.js';
import type { N8nCreativeEvent, N8nEventSink } from './n8n-webhook.js';
import type { CreatorAnalytics, GuildActivityEvent } from './posthog.js';
import type { SupabaseActivityEvent } from './supabase.js';

function closedStatus(status: string | undefined): boolean {
  return status === 'ready' || status === 'complete' || status === 'completed' || status === 'exported' || status === 'published';
}

function questState(event: SupabaseActivityEvent): QuestState {
  if (event.kind === 'lore_compiled') {
    return 'closed';
  }
  return closedStatus(event.status) ? 'closed' : 'open';
}

function activityKind(event: SupabaseActivityEvent): ObservedActivityKind {
  if (event.kind === 'book_session_changed') {
    return 'book_session_changed';
  }
  return event.kind === 'creative_asset_generated' && !closedStatus(event.status)
    ? 'creative_asset_changed'
    : event.kind;
}

function analyticsEvent(event: SupabaseActivityEvent): GuildActivityEvent | undefined {
  if (event.kind === 'lore_compiled' || (event.kind === 'creative_asset_generated' && closedStatus(event.status))) {
    return event.kind;
  }
  return undefined;
}

export class CreatorIntegrationCoordinator implements N8nEventSink {
  public constructor(
    private readonly activeDispatchId: string | undefined,
    private readonly floor: Pick<LivingWorldFloor, 'transitionQuest'>,
    private readonly activity: RealActivityAggregator,
    private readonly analytics: CreatorAnalytics,
    private readonly customerIo: CustomerIoHooks,
  ) {}

  public async handleSupabaseEvent(event: SupabaseActivityEvent): Promise<void> {
    const status = event.status ?? 'observed';
    await this.activity.recordLocalEvent({
      id: `supabase:${event.kind}:${event.id}:${status}`,
      kind: activityKind(event),
      observedAt: event.observedAt,
    });
    await this.floor.transitionQuest(
      {
        id: `supabase:${event.kind}:${event.id}`,
        state: questState(event),
        title: `${event.kind.replaceAll('_', ' ')} ${event.id}`,
      },
      event.observedAt,
    );

    const trackedEvent = analyticsEvent(event);
    if (trackedEvent !== undefined && this.activeDispatchId !== undefined) {
      this.analytics.capture(trackedEvent, {
        dispatchId: this.activeDispatchId,
        distinctId: `supabase:${event.id}`,
      });
    }
  }

  public async handleN8nEvent(event: N8nCreativeEvent): Promise<void> {
    const activityKindByEvent: Partial<Record<N8nCreativeEvent['eventType'], ObservedActivityKind>> = {
      'asset.generated': 'creative_asset_generated',
      'book.exported': 'book_exported',
      'voice_narration.complete': 'voice_narration_ready',
    };
    const kind = activityKindByEvent[event.eventType];
    if (kind !== undefined) {
      await this.activity.recordLocalEvent({ id: `n8n:${event.eventId}`, kind, observedAt: event.occurredAt });
    }

    const state = event.eventType === 'quest.opened' ? 'open' : 'closed';
    await this.floor.transitionQuest(
      {
        id: `n8n:${event.projectId}`,
        state,
        title: event.questTitle ?? `Creative project ${event.projectId}`,
      },
      event.occurredAt,
    );

    if (event.eventType === 'asset.generated') {
      this.analytics.capture('creative_asset_generated', {
        dispatchId: event.dispatchId,
        distinctId: event.memberId ?? `n8n:${event.projectId}`,
        role: event.role,
      });
    }

    if (event.memberId !== undefined && event.role !== undefined) {
      const notification =
        event.eventType === 'voice_narration.complete'
          ? 'voice_narration_ready'
          : event.eventType === 'book.exported'
            ? 'creative_project_milestone'
            : undefined;
      if (notification !== undefined) {
        await this.analytics.runFlagged(
          'creator-customerio-messaging',
          async () => {
            const member = {
              dispatchId: event.dispatchId,
              guild: 'creator',
              memberId: event.memberId as string,
              role: event.role as NonNullable<N8nCreativeEvent['role']>,
            } as const;
            await this.customerIo.segmentMember(member);
            return this.customerIo.notify(notification, {
              ...member,
              projectId: event.projectId,
            });
          },
          false,
          event.memberId,
        );
      }
    }
  }
}
