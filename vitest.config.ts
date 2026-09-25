// ─── CGRF Header ──────────────────────────────
// File:        vitest.config.ts
// Stage:       08_TEST
// SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-LIVINGWORLD-creator
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-09-25
// Depends:     src/automation/livingworld-floor.test.ts, src/routes/realm.test.ts, src/mobile/creator-app.test.ts
// EnumType:    ConfigDoc
// EnumEdges:   GATES src/; VALIDATES SRS-CN-CREATOR-LIVINGWORLD-001
// DAG Node:    creator.test.config
// Intent:      Enforce deterministic tests and at least eighty percent coverage on the new floor contract.
// ─────────────────────────────────────────────────────────────

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['**/*.test.ts'],
      include: [
        'src/automation/livingworld-emitter.ts',
        'src/automation/livingworld-floor.ts',
        'src/integrations/*.ts',
        'src/mobile/creator-app.ts',
        'src/mobile/posthog.ts',
        'src/routes/realm.ts',
      ],
      provider: 'v8',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    include: ['src/**/*.test.ts'],
  },
});
