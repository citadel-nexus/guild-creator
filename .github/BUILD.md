# ─── CGRF Header ───────────────────────────────────────────────
# File:        .github/BUILD.md
# Stage:       06_PLAN
# SRS:         SRS-CN-CREATOR-BUILD-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-BUILD-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .github/workflows/lockfile-refresh.yml, .github/PROVENANCE.md
# EnumType:    Doc
# EnumEdges:   VALIDATES .github/workflows/lockfile-refresh.yml; DEPENDS_ON .github/PROVENANCE.md
# DAG Node:    creator.build
# Intent:      Document safe registry-backed lockfile recovery, verification, and administrator prerequisites.
# ───────────────────────────────────────────────────────────────

# Creator build and lockfile recovery

## Normal build

Use the Node version in .nvmrc. Run npm ci, npm run lint, npm run typecheck,
npm test, and npm run build. Typechecking includes tests; production emission
excludes tests/config and produces dist/index.js plus declarations. Preserve the
existing coverage thresholds and checks when resolving any failures.

## Manual registry-backed recovery

After this workflow is merged to the default branch, an authorized maintainer
may run **Refresh Creator lockfile** from Actions, selecting the default branch.
There is no push, PR, schedule, or workflow-completion trigger. Runs for other
refs are skipped. Checkout is frozen to that dispatch's source SHA.

The workflow uses SHA-pinned checkout/setup-node actions and .nvmrc. It removes
only incomplete registry entries lacking integrity, then runs
`npm install --package-lock-only --ignore-scripts` to obtain real metadata.
It requires a pinned OpenTelemetry API 1.9.0 entry and integrity metadata for
all resolved registry archives. `npm ci` then downloads and validates the archives
against those integrity values; lint, typecheck, tests, and build must all pass.
The install refresh does not run lifecycle scripts; the subsequent normal clean
install does. Therefore run only reviewed default-branch code/dependencies.

Only package-lock.json may differ before publication. If it has no diff, the
workflow exits without a PR. Otherwise, the GitHub API creates the fixed branch
bits/lockfile-refresh from the verified source revision, writes only the lockfile,
and opens a PR to the default branch. It never writes main/default, force-updates
refs, merges the PR, or deploys. GitHub supplies the authenticated workflow commit
identity; no signing keys or configured committer overrides are needed.

The fixed branch must be absent. An existing branch causes failure rather than
an overwrite. Review/close any prior PR and delete its branch after merge before
running another refresh. If ref creation succeeds but the later API/PR step
fails, a maintainer must inspect that partial branch and complete or clean up the
attempt; retries do not overwrite it. Concurrency serializes refresh runs.

The refresh PR intentionally contains only the regenerated lockfile; its
operator-specified branch name is an exception to the usual SRS branch naming.
SRS/dispatch and passed gate results are recorded in its commit and PR body.
Review registry versions/integrities and the successful Actions run before merge.

## Registry and admin prerequisites

- Allow the pinned official checkout/setup-node actions and GitHub-hosted runner
  access to registry.npmjs.org, npm.pkg.github.com, and api.github.com.
- The default public registry remains npmjs.org. Only @citadel-guilds resolves
  through GitHub Packages. setup-node configures registry auth, and
  NODE_AUTH_TOKEN receives the ephemeral GITHUB_TOKEN during npm steps.
- Grant this repository Actions access to any needed GitHub Packages. The job
  requests packages: read, contents: write, and pull-requests: write only.
  No persistent npm secret is created or required for the current registry setup.
- Enable **Allow GitHub Actions to create and approve pull requests** where
  repository/organization policy permits it. The workflow creates PRs but does
  not approve them. Permit writes to bits/lockfile-refresh; do not grant a bypass
  for main protection, required reviews, signed commits, or status checks.
- GitHub normally suppresses new workflow runs for events caused by GITHUB_TOKEN.
  Consequently the generated PR may not automatically run required PR checks.
  A maintainer must arrange legitimate PR validation before merge (for example,
  closing/reopening the PR as a human to emit a PR event, subject to org policy).
  The refresh run itself does not satisfy PR-specific required check contexts.
- Retain existing CodeQL/secret scanning. No registry, GitHub settings, package
  access, or secret changes are performed by this coding session.

## Provenance verification

The main-only provenance signing job now verifies the preserved bundle against
the actual archive, repository, expected workflow, main ref, source SHA, predicate,
OIDC issuer, and hosted-runner policy. Tampered bytes and a wrong signer workflow
must fail; a final valid control must pass before the signed artifact is uploaded.
See .github/PROVENANCE.md. This workflow is not a deployment or package release.

## Local limitations and publication

The sandbox has no cached npm dependency archives; offline installation and the
five application checks remain blocked. A successful dry-run is not a successful
install. No real registry integrity or signed-artifact result is fabricated here.
Evidence: .bits/out/DISP-BUILD-creator/report.md.

PRs #18 and #19 are already merged. The session-bound branch was fast-forwarded
to current main before this follow-up, so the next UI-created PR contains only
new build-repair work. Published history was not rewritten. Use Create or Update
PR to publish; no ref was pushed from the sandbox.
