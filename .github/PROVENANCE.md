# ─── CGRF Header ───────────────────────────────────────────────
# File:        .github/PROVENANCE.md
# Stage:       06_PLAN
# SRS:         SRS-CN-CREATOR-GOVERNANCE-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-GOVERNANCE-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .github/workflows/provenance.yml, GOVERNANCE.md
# EnumType:    Doc
# EnumEdges:   VALIDATES .github/workflows/provenance.yml; CONSUMES creator-signed build archive
# DAG Node:    creator.governance
# Intent:      Give consumers an identity-bound verification policy for the exact signed Creator build bytes.
# ───────────────────────────────────────────────────────────────

# Verify Creator Guild signed build provenance

## What is signed

`provenance.yml` runs lint, tests, and the existing TypeScript build on PRs to
`main` and pushes to `main`, using Node 24 to match the locked Vitest engine.
It packages the compiled `dist/` tree (including compiler-emitted test/config
files), `package.json`, and `package-lock.json` into
`creator-<full-commit-sha>.tar.gz`. This is a build archive, not an npm package,
container image, or deployment. Runtime dependencies are not bundled.

On a successful main push, a separate job downloads the same run's archive and
uses `actions/attest-build-provenance` to produce a signed in-toto statement with
predicate type `https://slsa.dev/provenance/v1`. GitHub Actions OIDC binds the
short-lived Sigstore signing identity to the workflow and source revision. The
signed subject digest authenticates the archive's exact bytes. GitHub artifact
attestations provide both SLSA provenance and keyless artifact signing through
that digest-bound statement; no persistent signing key or second signature
scheme is needed. This is not a claim of a certified SLSA build level.

PRs, including forks, never run the signing job and receive no OIDC/attestation
write permissions. The signing job checks out no source, installs no project
dependencies, and executes no archive contents. It signs only the artifact from
its own successful build job. No `pull_request_target` or `workflow_run` handoff
is involved. Dependency installation/build scripts still execute in the build
job; provenance proves origin and integrity, not that source or dependencies are
safe. Review policy protects changes to that source and workflow.

The signed archive and `creator-<sha>.sigstore.json` bundle are retained together
as Actions artifact `creator-signed-<sha>` for 30 days (subject to organization
retention limits). Intermediate `creator-build-<sha>` artifacts are retained
for 7 days and are not the verified distribution surface. Preserve both signed
files externally under your retention policy before Actions artifacts expire.
The workflow does not upload releases, publish packages/images, or deploy.

## Download and verify

Use a current GitHub CLI with `gh attestation verify` and the flags below. Obtain
a full expected commit SHA independently from an approved, merged PR, then select
a successful **Provenance — guild-creator** main-push run for that exact SHA in
GitHub Actions. Do not trust a filename or an unverified bundle to choose the
expected commit. Replace both placeholders before running this Bash example:

```bash
set -euo pipefail
REPO=citadel-nexus/guild-creator
COMMIT_SHA='<expected-full-40-character-main-commit-sha>'
RUN_ID='<successful-main-provenance-run-id>'
[[ "$COMMIT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$RUN_ID" =~ ^[0-9]+$ ]]
VERIFY_DIR="$(mktemp -d)"

gh run view "$RUN_ID" --repo "$REPO" \
  --json headSha,event,conclusion,workflowName
# Confirm headSha equals COMMIT_SHA, event is push, conclusion is success,
# and workflowName is Provenance — guild-creator.
gh run download "$RUN_ID" --repo "$REPO" \
  --name "creator-signed-${COMMIT_SHA}" --dir "$VERIFY_DIR"
ARCHIVE="$VERIFY_DIR/creator-${COMMIT_SHA}.tar.gz"
BUNDLE="$VERIFY_DIR/creator-${COMMIT_SHA}.sigstore.json"

gh attestation verify "$ARCHIVE" \
  --bundle "$BUNDLE" \
  --repo "$REPO" \
  --signer-workflow "$REPO/.github/workflows/provenance.yml" \
  --source-ref refs/heads/main \
  --source-digest "$COMMIT_SHA" \
  --predicate-type https://slsa.dev/provenance/v1 \
  --deny-self-hosted-runners
```

A zero exit status is required before inspecting/extracting/using the archive.
For server-side attestation lookup, run the same verification command with only
`--bundle "$BUNDLE"` omitted. The bundle preserves the signed statement but does
not by itself guarantee fully offline verification; Sigstore trust-root material
may need to be cached or explicitly supplied. Do not disable identity, source,
or trust checks to work around unavailable dependencies. Verification must fail
closed if the archive, bundle, trust roots, or policy cannot be validated.

## Negative verification and first-run acceptance

After a successful verification, keep the same shell variables and run:

```bash
cp "$ARCHIVE" "$VERIFY_DIR/tampered.tar.gz"
printf 'tampered\n' >> "$VERIFY_DIR/tampered.tar.gz"
if gh attestation verify "$VERIFY_DIR/tampered.tar.gz" \
  --bundle "$BUNDLE" --repo "$REPO" \
  --signer-workflow "$REPO/.github/workflows/provenance.yml" \
  --source-ref refs/heads/main --source-digest "$COMMIT_SHA" \
  --predicate-type https://slsa.dev/provenance/v1 \
  --deny-self-hosted-runners; then
  echo 'FAIL: modified archive was accepted' >&2
  exit 1
else
  echo 'PASS: modified archive was rejected'
fi
```

Also repeat the original command with an incorrect workflow path, then with a
different expected source SHA; both must fail. Inspect the diagnostic to confirm
the intended identity/digest mismatch caused rejection rather than an unrelated
network or authentication error. Record the successful run URL, expected SHA,
and positive/negative verification results on the PR or the follow-up dispatch.
Local YAML/archive checks cannot demonstrate OIDC signing or cryptographic
verification; that acceptance gate remains pending until the main workflow runs.
See `GOVERNANCE.md` for the required administrator setup and review checks.
