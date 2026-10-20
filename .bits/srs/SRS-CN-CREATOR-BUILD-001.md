# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/srs/SRS-CN-CREATOR-BUILD-001.md
# Stage:       04_HYPOTHESIZE
# SRS:         SRS-CN-CREATOR-BUILD-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-BUILD-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .bits/srs_registry.yml
# EnumType:    ConfigDoc
# EnumEdges:   GATES package.json; GATES .github/workflows/provenance.yml
# DAG Node:    creator.build
# Intent:      Specify bounded Creator toolchain repair without weakening verification.
# ───────────────────────────────────────────────────────────────

# SRS-CN-CREATOR-BUILD-001 — Creator build repair

## Authorization

Authenticated operator Dmitry Richard authorized this new SRS and dispatch
through Bits AI, seat BITS-CODEGEN, mode staging. This explicitly extends scope
to existing build/configuration/source/workflow files despite earlier dispatch
restrictions. Governance PR #18 is merged and is the base, not part of this PR.

## Acceptance

- Add the missing @opentelemetry/api dependency and synchronize the lockfile.
- Pin a supported Node version >=22.12 in .nvmrc and CI; declare compatible engines.
- Separate full source/test typechecking from production output where needed.
- Fix ESLint configuration and diagnosed source/test issues without deleting,
  skipping, or weakening tests, lint rules, or coverage thresholds.
- Preserve CodeQL and secret scanning. Repair GitHub expressions in GHCR login.
- Attest the actual compiled runtime entrypoint and package contents with the
  existing main-only signing permissions and identity constraints.
- Report npm ci, lint, typecheck, test, and build results with remaining blockers.

## Bounds

Logical build work: bits/SRS-CN-CREATOR-BUILD-001-toolchain.
The operator-authorized continuation uses the session-bound publication branch
dd/bits/SRS-CN-CREATOR-GOVERNANCE-001-provenance, based on merged PR #19.
No production/deployment operations, main push, settings or secrets changes.
Existing release/publishing workflows may receive build repairs but must not be
executed during this session. No guessed success when dependencies cannot be
installed; retain exact failed commands and scope the remaining validation.

## Continuation acceptance

- Manual-only lockfile refresh on the default branch, pinned actions, scoped
  registry auth, no main writes, and a lockfile-only PR on bits/lockfile-refresh
  only after all five gates pass. Never overwrite an existing refresh branch.
- Verify real provenance before artifact publication; tampered bytes and an
  incorrect signer workflow must be rejected. Keep existing signing boundaries.
- Document registry/GitHub administration prerequisites without changing settings
  or secrets, and rerun offline checks with explicit blocked results as needed.
