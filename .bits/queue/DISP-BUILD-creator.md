# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/queue/DISP-BUILD-creator.md
# Stage:       11_COMMIT
# SRS:         SRS-CN-CREATOR-BUILD-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-BUILD-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .bits/srs/SRS-CN-CREATOR-BUILD-001.md
# EnumType:    ConfigDoc
# EnumEdges:   GATES SRS-CN-CREATOR-BUILD-001
# DAG Node:    creator.build
# Intent:      Record the operator-authorized build repair and its validation bounds.
# ───────────────────────────────────────────────────────────────

# DISP-BUILD-creator

- srs: SRS-CN-CREATOR-BUILD-001
- status: in_progress
- seat: BITS-CODEGEN
- mode: staging
- branch: bits/SRS-CN-CREATOR-BUILD-001-toolchain
- base: cbc4e66eee2d4d1a1c6146c11901c30cc5ccc78d (merged governance PR #18)
- authorization_source: authenticated operator Dmitry Richard, Bits AI directive
- authorization_directive: "AUTHORIZED build repair"; register this SRS/dispatch,
  fix dependency installation, Node, TypeScript, ESLint, tests, CI expressions,
  and provenance output. Preserve tests, CodeQL, and secret scans.

## Tasks and gates

A. Register authorization and diagnose current failures.
B. Repair dependencies, supported Node selection, lint and TypeScript build paths.
C. Repair workflow expressions and ensure signing covers the real runtime output.
D. Run npm ci, npm run lint, npm run typecheck, npm test, and npm run build;
   record every blocker and generate report/memory with pending CK/CAPS values.

Emit PASS/FAIL for each gate. Failed validation blocks merge readiness. Never
change tests, coverage, or checks just to obtain a passing result.

## Memory Brief

Governance PR #18 merged. Muse identities are already confirmed. Its new main
provenance job and existing CI fail; prior offline npm ci reported missing
@opentelemetry/api. Vitest 5 requires Node 22.12+ or 24 but existing CI uses 20.
The declared main entrypoint is dist/index.js; current tsc emits dist/src/index.js.
This dispatch authorizes repairing those build failures in a separate PR.
