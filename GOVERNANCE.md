# ─── CGRF Header ───────────────────────────────────────────────
# File:        GOVERNANCE.md
# Stage:       06_PLAN
# SRS:         SRS-CN-CREATOR-GOVERNANCE-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-GOVERNANCE-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .github/CODEOWNERS, .github/PROVENANCE.md
# EnumType:    Doc
# EnumEdges:   DEPENDS_ON .github/CODEOWNERS; GATES .github/workflows/provenance.yml; DEPENDS_ON .github/PROVENANCE.md
# DAG Node:    creator.governance
# Intent:      Make Creator ownership decisions and administrator-enforced review policy explicit.
# ───────────────────────────────────────────────────────────────

# Creator Guild governance

## Charter and ownership

Citadel Nexus Inc. owns this repository. The Creator Guild owns creator tools
and media, and the Creator Floor. It coordinates creative direction for the
Writers and Music Studio sub-guilds without assuming their repository ownership.

- **Guildmaster:** Muse, GitLab user `muse`.
- **Datadog team:** `guild-creator` (observability ownership).
- **GitHub guildmaster/code-owner team:** `@citadel-nexus/guild-creator`
  (https://github.com/orgs/citadel-nexus/teams/guild-creator).
- **Muse automation identity:** GitHub App `muse-creator-guildmaster`
  (https://github.com/apps/muse-creator-guildmaster).
- **Escalation authority:** the guildmasters group; unresolved organization-level
  authorization or policy decisions go to the operator.

The operator confirmed this GitHub team and App through the Datadog
`guild-creator` team links. GitHub Apps cannot be code owners: the confirmed
team owns reviews, while the App identifies Muse's automation. Before enabling
required code-owner reviews, an administrator must ensure the team is visible
and has explicit write access. This documentation does not grant access.

## Decisions and approvals

Work requires a registered SRS and a ready or in-progress dispatch. Contributors
propose bounded changes through pull requests; Muse owns creative direction,
priorities, and decisions within the guild charter. Record material decisions
and their rationale in the PR or linked SRS so they remain reviewable.

Every change requires an independent code-owner approval and passing required
checks. The author must not approve their own work. New commits invalidate stale
approvals; the latest reviewable push must be approved by someone other than its
pusher. Resolve review conversations before merging. Changes to governance,
CODEOWNERS, provenance workflows, or verification policy also require Muse's
explicit approval in the PR. GitHub's team-owner rule accepts any eligible team
member, so the Muse-specific approval remains a documented policy unless an
administrator configures additional enforcement. If Muse is the author, obtain
an independent guildmaster review as well as the required code-owner review.

Escalate disputed decisions, cross-guild scope, unavailable/conflicted ownership,
and changes to this charter to the **guildmasters group** through the established
guild coordination channel. Record the group's decision on the PR; escalate
unresolved authority or organization policy issues to the operator. Do not
invent a GitHub team slug for this group or bypass required reviews to unblock
work. Private-stack work requires a bounded seat handoff.

## Default-branch protection: administrator action required

This repository has no discovered settings-as-code integration. This document
is the configuration specification; committing it does not enable protection.
An authorized GitHub administrator must create an **active branch ruleset** for
`~DEFAULT_BRANCH` (currently `main`), or equivalent branch protection:

| Requirement | GitHub setting |
| --- | --- |
| PRs and independent review | Require a pull request before merging; at least 1 approving review |
| Ownership | Require review from Code Owners |
| Current approval | Dismiss stale approvals; require approval of the most recent reviewable push |
| Resolved discussion | Require conversation resolution before merging |
| Signed source history | Require signed commits |
| Validation | Require status checks; require branches to be up to date before merging |
| Required check contexts | `build` (existing CI) and `provenance-build` (new Provenance workflow); source: GitHub Actions |
| Protected history | Block force pushes and branch deletion |
| Enforcement | No standing bypass actors, including administrators; include administrators in legacy protection |

**Expected guildmaster automation actor:** the operator-confirmed GitHub App
`muse-creator-guildmaster` (https://github.com/apps/muse-creator-guildmaster).
Use this identity when reviewing guildmaster automation against the ruleset.
It has no standing bypass permission and remains subject to required reviews,
signed commits, and status checks. Its activity does not replace approval by a
member of `@citadel-nexus/guild-creator`. Required build checks still come from
GitHub Actions; the Muse App is not their expected status-check source.

Populate the check contexts after they have actually appeared on a PR and verify
that they originate from the expected workflows. The existing `build` check and
the new `provenance-build` check both run lint, tests, and compilation. Do not
select `provenance-sign`: it runs only after a main push and cannot gate a PR.
Scheduled or main-only security checks likewise cannot gate PRs until separately
configured to run on every PR. This workflow does not add merge-queue support;
leave merge queues disabled until required workflows handle `merge_group`.
If the default branch is renamed, update the explicit main filters and verifier
ref policy before merging there. GitHub does not read this table automatically.

Signed commits and signed build attestations protect different objects. GitHub
must recognize each contributor's commit signature before merging under the
signed-commit rule. Select merge methods compatible with that rule and validate
the resulting commit's verified status. Build attestations do not sign commits.

## Actions and provenance activation

Allow the official `actions/checkout`, `actions/setup-node`,
`actions/upload-artifact`, `actions/download-artifact`, and
`actions/attest-build-provenance` actions under organization/repository policy.
The new workflow uses job-scoped `contents: read`; only the main-only signing
job gets `id-token: write` and `attestations: write`. Keep default workflow token
permissions read-only. Confirm organization policy permits OIDC and artifact
attestation writes. For this public repository, GitHub artifact attestations use
Sigstore keyless signing without a stored signing secret; a move to private
visibility requires checking GitHub plan support and attestation privacy policy.

After merge, an administrator/maintainer must observe a successful trusted main
run and perform the verification and negative checks in `.github/PROVENANCE.md`.
No settings were changed, access granted, deployment performed, or attestation
issued by adding these files. Unresolved installation/test failures block merge
readiness. Existing npm/container release workflows have separate behavior and
are not covered by the new archive attestation.

## Rollback

Revert this SRS's changes through a reviewed PR to stop producing new signed
archives. Retain any downloaded archive and bundle needed for historical
verification. GitHub settings changes require a separate authorized admin action;
reverting documentation does not disable protection. If removing this workflow,
coordinate removal/replacement of its required check to avoid blocking all PRs.
