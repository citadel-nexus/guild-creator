// ─── CGRF Header ──────────────────────────────
// File:        src/index.ts
// Stage:       07_BUILD
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/routes/realm.ts, src/automation/livingworld-emitter.ts, src/telemetry/datadog.ts, src/integrations/runtime.ts
// EnumType:    Service
// EnumEdges:   CONSUMES citadel.creator.*; PRODUCES /realm/creator.json; PRODUCES /game/party.json; CONSUMES /webhooks/n8n
// DAG Node:    creator.service
// Intent:      Start the public Creator realm service with quiet-floor degradation when NATS is unavailable.
// ─────────────────────────────────────────────────────────────

import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';

import { LivingWorldFloor } from './automation/livingworld-floor.js';
import { connectFloorEventPublisher } from './automation/livingworld-emitter.js';
import { startCreatorIntegrations } from './integrations/runtime.js';
import { createRealmRequestListener } from './routes/realm.js';
import { createDatadogFloorTelemetry } from './telemetry/datadog.js';

export interface CreatorServiceHandle {
  readonly floor: LivingWorldFloor;
  readonly port: number;
  close(): Promise<void>;
}

function configuredPort(): number {
  const parsed = Number.parseInt(process.env.GUILD_PORT ?? '8000', 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 65_535 ? parsed : 8000;
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      const address = server.address();
      resolve(typeof address === 'object' && address !== null ? address.port : port);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function startCreatorService(port = configuredPort()): Promise<CreatorServiceHandle> {
  const telemetry = createDatadogFloorTelemetry();
  const publisher = await connectFloorEventPublisher(process.env.NATS_URL);
  const floor = new LivingWorldFloor(publisher, telemetry);
  const integrations = await startCreatorIntegrations(floor);
  const server = createServer(
    createRealmRequestListener(floor, {
      engagement: integrations.engagement,
      webhook: integrations.webhook,
    }),
  );
  const listeningPort = await listen(server, port);

  console.info('creator_service_started', {
    nats_available: publisher.available,
    port: listeningPort,
    service: 'guild-mcp-creator',
  });

  return {
    floor,
    port: listeningPort,
    async close(): Promise<void> {
      await Promise.all([closeServer(server), floor.close(), integrations.close()]);
    },
  };
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href) {
  startCreatorService().catch((error: unknown) => {
    console.error('creator_service_start_failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    process.exitCode = 1;
  });
}
