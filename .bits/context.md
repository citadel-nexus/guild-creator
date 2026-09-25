# ─── CGRF Header ──────────────────────────────
# File:        .bits/context.md
# Stage:       11_COMMIT
# SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-LIVINGWORLD-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-09-25
# Depends:     AGENTS.md, CLAUDE.md, .bits/srs_registry.yml
# EnumType:    ConfigDoc
# EnumEdges:   GATES SRS-CN-CREATOR-LIVINGWORLD-001; DEPENDS_ON CLAUDE.md; VALIDATES .bits/queue/DISP-LIVINGWORLD-creator.md; GATES .bits/integration-checklist.md; GATES .bits/progression.md
# DAG Node:    creator.sprint.context
# Intent:      Bound the Living-World Floor build to its authorized public TypeScript surfaces and deterministic pre-flight.
# ───────────────────────────────────────────────────────────────

# Creator Guild sprint context

- Sprint: Living-World Floor
- Phase: INTEGRATE
- Dispatch: `DISP-LIVINGWORLD-creator`
- SRS: `SRS-CN-CREATOR-LIVINGWORLD-001`
- Branch: `bits/livingworld`
- Champion: Muse

## Do

- Build on the existing TypeScript `src/` surface.
- Emit authorized `citadel.creator.*` floor events.
- Expose the public-safe Creator realm feed.
- Bind champion state to Muse.
- Build the mobile app experience and RUM vitals configuration.
- Add deterministic tests for behavior, degradation, and authorization edges.
- Instrument floor operations with Datadog tracing and custom metrics.
- Define bounded Muse, Writers, and Music Studio seat coordination.
- Connect external systems through public-safe, fail-soft adapters.
- Require active-dispatch authorization for outbound notifications and HMAC
  authentication for automation webhooks.
- Aggregate only observed local and sub-guild activity into the floor.
- Maintain an integration checklist, progression policy, and CycloneDX SBOM.

## Don't

- Do not modify `.github/workflows/`.
- Do not modify `docker/`.
- Do not import private CNWB packages or expose private infrastructure.
- Do not create activity when an upstream source is absent.
- Do not write outside the dispatch scope or directly to `main`.

## Pre-flight order

1. Read `AGENTS.md`.
2. Read `CLAUDE.md`.
3. Read `.bits/context.md`.
4. Confirm the SRS in `.bits/srs_registry.yml`.
5. Read `.bits/srs/SRS-CN-CREATOR-LIVINGWORLD-001.md`.
6. Confirm `.bits/queue/DISP-LIVINGWORLD-creator.md` is `ready` or
   `in_progress` and the active branch matches the dispatch.
7. Inspect existing `src/`, package scripts, tests, and public conventions.

Any missing or contradictory pre-flight input fails closed and escalates to the
operator before product code changes.

## Conventions

- TypeScript only; use explicit public types and deterministic pure transforms.
- NATS subjects remain under `citadel.creator.*` and are centralized in code.
- Missing inputs return an honest quiet-floor representation, never invented
  counts or activity.
- Use structured telemetry with bounded tag cardinality and no personal data.
- Use Electric Purple `#7B2FBE` as the Creator accent; do not introduce an
  alternative Creator identity.
- Every new artifact starts with a CGRF envelope and maps to the active SRS.
- Use conventional commits with the SRS and dispatch metadata.
- Completion requires `npm run lint` and `npm test`.

## Authorization and escalation

Muse coordinates but does not acquire ownership of sub-guild repositories.
Writers and Music Studio coordination is message-based, bounded to each seat's
declared subjects, and read-only unless the dispatch grants a named operation.
Unrecognized seats, subjects, actions, or delegation payloads are rejected
without side effects and escalated first to Muse, then to the operator for an
authorization decision.
