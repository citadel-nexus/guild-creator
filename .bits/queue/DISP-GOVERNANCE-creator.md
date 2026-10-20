# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/queue/DISP-GOVERNANCE-creator.md
# Stage:       11_COMMIT
# SRS:         SRS-CN-CREATOR-GOVERNANCE-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-GOVERNANCE-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .bits/srs/SRS-CN-CREATOR-GOVERNANCE-001.md
# EnumType:    ConfigDoc
# EnumEdges:   GATES SRS-CN-CREATOR-GOVERNANCE-001
# DAG Node:    creator.governance
# Intent:      Record the operator authorization and bounded staging tasks for Creator governance.
# ───────────────────────────────────────────────────────────────

# DISP-GOVERNANCE-creator

- srs: SRS-CN-CREATOR-GOVERNANCE-001
- guild: creator
- guildmaster: Muse (GitLab `muse`)
- seat: BITS-CODEGEN
- mode: staging
- branch: bits/SRS-CN-CREATOR-GOVERNANCE-001-provenance
- status: in_progress
- authorization_source: authenticated operator Dmitry Richard
  (`mr.nobody@citadel-nexus.com`), Bits AI session directive, 2026-10-20.
- authorization_directive: "create those"; create this SRS registry entry,
  SRS document, and dispatch, then implement the originally requested governance
  and signed provenance scope using the repository bootstrap exception.

## Task table

| Phase | Task | Gate |
| --- | --- | --- |
| A | Create registered SRS and this dispatch | Registry resolves this SRS and dispatch status is in_progress |
| B | Define ownership, charter, and default-branch protections | Owner mapping and review/check/signature requirements documented |
| C | Add build provenance workflow and verification guide | YAML parses; PR build is read-only; only main push signing gets OIDC |
| D | Validate and report with three-type memory | Smoke results and unresolved failures recorded accurately |

## Scope and exceptions

Only paths listed under this SRS in `.bits/srs_registry.yml` are authorized.
The operator directive supersedes the older sprint's workflow prohibition for
`.github/workflows/provenance.yml` only. It permits scoped edits to prior CGRF
records where required by this bootstrap. Preserve existing SRS entries, CI,
release workflow, protected notification workflow, and unrelated work.
Existing repository root/`.github`/`.bits` conventions map files to logical
CKET stages in their CGRF headers; no service code or private-stage work.
No production/deployment, settings writes, secrets, or main writes. An inability
to execute checks blocks readiness for merge, not preparation of a reviewable
staging change. The operator must resolve unrelated failures before merge.

## Memory Brief

The source conversation requested governance and provenance for guildmasters.
The operator's session follow-up supplies the missing bootstrap authorization.
Existing Creator ownership uses `@citadel-nexus/creator-guild`; `guild-creator`
is the Datadog team handle and `muse` is a GitLab identity, not a verified GitHub
identity. Existing TypeScript build artifacts are emitted under `dist/`.

## Smoke commands

```bash
npm ci
npm run lint
npm test
npm run build
```

Additionally parse the workflow and assert event/permission/artifact boundaries,
exercise archive packaging, validate CGRF/memory references, and check documented
verification flags against `gh attestation verify --help`. Live signing and
cryptographic verification require a GitHub Actions main run after merge; local
validation cannot replace that gate. Emit PASS/FAIL for each phase; record
failures and block publication/merge readiness without weakening the checks.
