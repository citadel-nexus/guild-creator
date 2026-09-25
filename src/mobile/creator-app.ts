// ─── CGRF Header ──────────────────────────────
// File:        src/mobile/creator-app.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     @datadog/browser-rum, src/automation/livingworld-floor.ts
// EnumType:    Widget
// EnumEdges:   CONSUMES /realm/creator.json; PRODUCES Datadog RUM; USES_TEMPLATE src/automation/livingworld-floor.ts
// DAG Node:    creator.mobile.app
// Intent:      Load the public Creator floor for mobile clients with quiet fallback and privacy-safe RUM vitals.
// ────────────────────────────────────────────────────────────

import {
  datadogRum,
  type DatadogRum,
} from '@datadog/browser-rum';

import {
  createQuietCreatorRealm,
  type CreatorRealm,
  type RealmQuest,
} from '../automation/livingworld-floor.js';

export interface CreatorRumConfiguration {
  readonly applicationId: string;
  readonly clientToken: string;
  readonly env: string;
  readonly site?: 'datadoghq.com' | 'datadoghq.eu' | 'us3.datadoghq.com' | 'us5.datadoghq.com';
  readonly version: string;
}

export type CreatorRumAdapter = Pick<
  DatadogRum,
  'addAction' | 'addTiming' | 'init' | 'setGlobalContextProperty' | 'startView'
>;

export interface MobileRealmState {
  readonly available: boolean;
  readonly realm: CreatorRealm;
}

function isQuest(value: unknown): value is RealmQuest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'title' in value &&
    typeof value.title === 'string' &&
    'state' in value &&
    (value.state === 'open' || value.state === 'closed')
  );
}

function isCreatorRealm(value: unknown): value is CreatorRealm {
  return (
    typeof value === 'object' &&
    value !== null &&
    'guild' in value &&
    value.guild === 'creator' &&
    'champion' in value &&
    value.champion === 'Muse' &&
    'activity_level' in value &&
    typeof value.activity_level === 'number' &&
    value.activity_level >= 0 &&
    value.activity_level <= 1 &&
    'quests' in value &&
    Array.isArray(value.quests) &&
    value.quests.every(isQuest) &&
    'structures' in value &&
    Array.isArray(value.structures)
  );
}

export function initializeCreatorRum(
  configuration: CreatorRumConfiguration,
  rum: CreatorRumAdapter = datadogRum,
): void {
  if (configuration.applicationId.length === 0 || configuration.clientToken.length === 0) {
    throw new TypeError('Datadog RUM application id and client token are required');
  }

  rum.init({
    applicationId: configuration.applicationId,
    clientToken: configuration.clientToken,
    defaultPrivacyLevel: 'mask-user-input',
    env: configuration.env,
    service: 'guild-mcp-creator',
    sessionReplaySampleRate: 0,
    sessionSampleRate: 20,
    site: configuration.site ?? 'datadoghq.com',
    trackLongTasks: true,
    trackResources: true,
    trackUserInteractions: true,
    version: configuration.version,
  });
  rum.setGlobalContextProperty('seat', 'muse');
  rum.startView({ name: 'creator-living-world-floor' });
}

export async function loadCreatorRealm(
  fetchRealm: () => Promise<Response> = () => fetch('/realm/creator.json'),
  rum: CreatorRumAdapter = datadogRum,
): Promise<MobileRealmState> {
  const startedAt = Date.now();
  try {
    const response = await fetchRealm();
    const candidate: unknown = await response.json();
    if (!response.ok || !isCreatorRealm(candidate)) {
      throw new TypeError('Creator realm feed is unavailable or invalid');
    }

    rum.addTiming('creator_realm_loaded', Date.now() - startedAt);
    rum.addAction('creator_realm_viewed', {
      activity_band: candidate.activity_level === 0 ? 'quiet' : 'active',
      quest_count: candidate.quests.length,
    });
    return { available: true, realm: candidate };
  } catch {
    rum.addAction('creator_realm_unavailable');
    return { available: false, realm: createQuietCreatorRealm() };
  }
}
