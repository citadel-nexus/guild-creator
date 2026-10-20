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
- branch: dd/bits/SRS-CN-CREATOR-GOVERNANCE-001-provenance
- logical_build_branch: bits/SRS-CN-CREATOR-BUILD-001-toolchain
- base: f0062863a0268040d7740dcc6fb48195c5d64bed (merged build PR #19)
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

## Operator-authorized continuation

The operator authorized a manual registry-backed lockfile refresh workflow,
positive/negative provenance verification, and BUILD.md admin instructions under
this same dispatch. The fixed automation PR branch is bits/lockfile-refresh.
The session publication branch is bound to the earlier governance name. Both
prior PRs (#18 and #19) are merged; fast-forwarding that local branch to current
main preserves published history and leaves only new build follow-up changes
for the next PR. No already-merged build commit is replayed or rewritten.
