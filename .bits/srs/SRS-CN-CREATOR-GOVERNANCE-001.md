# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/srs/SRS-CN-CREATOR-GOVERNANCE-001.md
# Stage:       04_HYPOTHESIZE
# SRS:         SRS-CN-CREATOR-GOVERNANCE-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-GOVERNANCE-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .bits/srs_registry.yml
# EnumType:    ConfigDoc
# EnumEdges:   GATES .github/CODEOWNERS; GATES GOVERNANCE.md; GATES .github/workflows/provenance.yml; GATES .github/PROVENANCE.md
# DAG Node:    creator.governance
# Intent:      Specify accountable Creator ownership and verifiable signed build archives.
# ───────────────────────────────────────────────────────────────

# SRS-CN-CREATOR-GOVERNANCE-001

Creator Guild ownership governance and signed build provenance.

- Guildmaster: Muse (GitLab user `muse`).
- Datadog team: `guild-creator`.
- Dispatch: `DISP-GOVERNANCE-creator`.
- Mode: staging. Seat: BITS-CODEGEN.
- Owner: Citadel Nexus Inc.
- CKS gate: B+/75; CKS, CAPS, and CK: pending.

## Authorization and scope

The authenticated operator Dmitry Richard (`mr.nobody@citadel-nexus.com`)
authorized "create those" through Bits AI on 2026-10-20 and explicitly named
this SRS and dispatch. This is the repository bootstrap exception for missing
governance records. The directive authorizes this governance workflow despite
the older Living-World sprint's workflow restriction; it grants no deployment,
GitHub settings, secrets, signing-key, or direct-main-write authority.

## Acceptance criteria

1. CODEOWNERS retains a GitHub-valid ownership mechanism and names Muse as the
   accountable guildmaster. A GitLab username must not be assumed to identify
   the same person on GitHub. Document any identity/team validation admin work.
2. GOVERNANCE.md defines the Creator tools, media, and Creator Floor charter,
   decision and approval rules, and escalation to the guildmasters group.
3. Document default-branch code-owner review, signed commits, required checks,
   stale approval dismissal, force-push/deletion prevention, and admin actions.
   Use documentation when no settings-as-code integration exists.
4. Build the existing TypeScript project, package the actual dist output, and
   create signed SLSA v1 provenance with GitHub artifact attestations/Sigstore
   keyless identity. Only trusted main pushes may request signing permissions.
   Pull requests validate the build with read-only permissions.
5. Preserve the exact signed archive and its bundle; document verification
   bound to repository, workflow, ref, and expected source commit, including
   rejection of altered bytes. Do not claim a certified SLSA level.
6. Run lint, tests, build, and static workflow validation. Report existing
   dependency or CI failures without altering unrelated product/dependency files.
7. Emit CGRF metadata and the three-type memory payload for this dispatch.

## Boundaries and rollback

One SRS, one feature branch and PR. No deployment, changes to GitHub settings,
production or secrets access, direct main writes, or modifications to existing
release/CI/security workflows. Existing package/container releases are outside
the attested archive's scope. Revert this change to remove the added workflow;
admin-applied protections require a separate authorized rollback.
