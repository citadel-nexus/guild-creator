# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/out/DISP-BUILD-creator/report.md
# Stage:       11_COMMIT
# SRS:         SRS-CN-CREATOR-BUILD-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-BUILD-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     package.json, .github/workflows/provenance.yml
# EnumType:    Doc
# EnumEdges:   VALIDATES SRS-CN-CREATOR-BUILD-001
# DAG Node:    creator.build
# Intent:      Record actual build-repair evidence and unresolved dependency validation.
# ───────────────────────────────────────────────────────────────

# Creator build repair report

## §1 SUMMARY

- Status: PARTIAL — configuration repaired; dependency access blocks execution.
- Dispatch: DISP-BUILD-creator. Seat: BITS-CODEGEN. Mode: staging.
- SRS: SRS-CN-CREATOR-BUILD-001.
- Branch: bits/SRS-CN-CREATOR-BUILD-001-toolchain.
- Base: cbc4e66eee2d4d1a1c6146c11901c30cc5ccc78d, merged governance PR #18.
- Tasks: bootstrap and workflow/config repairs prepared; runtime validation blocked.
- Required smoke: 0/5 passing (all blocked by dependency availability).
- CKS Gate: B+/75. CKS: pending. CAPS: pending. CK: pending.
- Commits: `git log --oneline cbc4e66eee2d4d1a1c6146c11901c30cc5ccc78d..HEAD`.

## §2 TASK RESULTS

| Task | Status | Result | Verify |
| --- | --- | --- | --- |
| A — authorization | PASS | New registered SRS and in-progress staging dispatch | Read registry and dispatch |
| B — dependency/toolchain repair | PARTIAL | Missing API pinned; Node 24.13.0 selected; full typecheck separated from production emit; lint invokes the locked local binary | Commands below |
| C — CI/provenance | PASS (static) | Correct GHCR expressions; common Node pin; required typecheck; archive matches package main; scans preserved | Static block below |
| D — runtime verification | BLOCKED | Required dependency archives are absent from the sandbox cache | npm ci, lint, typecheck, test, build results below |

The build clears only generated dist output before compiling, emits production
modules and declarations to dist/index.js, and fails emission on TypeScript errors.
The full typecheck still includes all tests and vitest.config.ts. No source tests,
assertions, lint rules, coverage thresholds, or security scans were weakened.
No application source was edited without a reproducible diagnostic.

## §3 SMOKE TEST RESULTS

| Required check | Command actually run | Result |
| --- | --- | --- |
| npm ci | `npm ci --offline --no-audit --no-fund` | BLOCKED: ENOTCACHED, yocto-queue archive unavailable |
| lint | `npm run lint` | BLOCKED: local ESLint module unavailable |
| typecheck | `npm run typecheck` | BLOCKED: tsc unavailable |
| test | `npm test` | BLOCKED: Vitest unavailable |
| build | `npm run build` | BLOCKED: clean prebuild succeeds; tsc unavailable |

Before the repair, offline npm ci failed lockfile synchronization with missing
@opentelemetry/api entries. The API is now a direct pinned 1.9.0 dependency,
compatible with the locked Vitest and dd-trace ranges. Offline
`npm install --package-lock-only --ignore-scripts --no-audit --no-fund` succeeded.
`npm ci --offline --dry-run --ignore-scripts --no-audit --no-fund` also succeeded;
this validates the dependency graph, not download, extraction, or lifecycle scripts.
The actual clean install now reaches artifact retrieval and fails ENOTCACHED.
Warnings about optional WASM peers remain; none were suppressed with legacy-peer
or force flags. Existing transitive dependency entries/versions were preserved.

No outbound npm request was attempted because this sandbox cannot perform
internet-dependent shell installs. A dependency-enabled runner must execute:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The new @opentelemetry/api lock entry pins the registry artifact/version but has
no verified integrity hash: its archive/registry metadata is unavailable locally.
On the dependency-enabled runner, regenerate that entry with npm, review the
resulting integrity metadata, and rerun clean installation before merge. Do not
invent an integrity hash or treat the dry-run as successful package verification.

Additional static evidence:

- TypeScript configuration resolves correctly using the available global TS 5.7.3:
  full typecheck includes tests; production emit excludes tests/config and maps
  src/index.ts to the package's dist/index.js. Locked TS 5.9.3 is unavailable, so
  this is configuration validation, not a successful typecheck or build.
- The legacy ESLint configuration loads through the available ESLint 9.16.0
  compatibility API and TypeScript ESLint 8.18.0. Actual lint must use locked
  ESLint 8.57.1 after installation; no lint success is claimed here.
- Workflow assertions verify the Node pin, check order, GHCR expressions,
  unchanged secret scanning, CodeQL init/analyze, and unchanged main-only signing.
- Packaging tests reject missing runtime/declaration files and archive the exact
  declared entrypoint. These use explicit fixtures, not a successful app build.
- GitHub reports failing build and provenance-build on the merged base. Provider
  annotations show exit code 1 without detailed diagnostics; local evidence above
  establishes the actionable dependency/configuration issues.

### Reproduce workflow and packaging assertions

Requires Python 3, PyYAML, Bash, tar, and local Git history. Run from repo root:

```bash
python - <<'PYTHON'
from pathlib import Path
import json, os, subprocess, tarfile, tempfile, yaml
BASE='cbc4e66eee2d4d1a1c6146c11901c30cc5ccc78d'
package=json.loads(Path('package.json').read_text())
lock=json.loads(Path('package-lock.json').read_text())
assert package['dependencies']==lock['packages']['']['dependencies']
assert package['engines']==lock['packages']['']['engines']
assert lock['packages']['node_modules/@opentelemetry/api']['version']=='1.9.0'
assert Path('.nvmrc').read_text().strip()=='24.13.0'
assert package['scripts']['lint'].startswith('node ./node_modules/eslint/bin/eslint.js ')
assert package['scripts']['test']=='vitest run --coverage'
full=json.loads(Path('tsconfig.json').read_text())
build=json.loads(Path('tsconfig.build.json').read_text())
assert full['compilerOptions']['strict'] and full['compilerOptions']['noEmit']
assert full['compilerOptions']['noEmitOnError']
assert full['include']==['src/**/*.ts','vitest.config.ts']
assert build['extends']=='./tsconfig.json'
assert build['compilerOptions']=={'noEmit':False,'rootDir':'src','outDir':'dist'}
assert build['exclude']==['src/**/*.test.ts']
assert package['main']=='dist/index.js'
for name in ['ci','release','provenance','security-scan']:
    w=yaml.load(Path(f'.github/workflows/{name}.yml').read_text(),Loader=yaml.BaseLoader)
    setups=[s for j in w['jobs'].values() for s in j.get('steps',[]) if s.get('uses','').startswith('actions/setup-node@')]
    assert setups and all(s['with'].get('node-version-file')=='.nvmrc' and 'node-version' not in s['with'] for s in setups)
    if name in ['ci','release','provenance']:
        job=w['jobs']['release' if name=='release' else 'build']
        commands=[s['run'] for s in job['steps'] if 'run' in s]
        assert commands[:5]==['npm ci','npm run lint','npm run typecheck','npm test','npm run build']
ci=yaml.load(Path('.github/workflows/ci.yml').read_text(),Loader=yaml.BaseLoader)
login=next(s for s in ci['jobs']['docker']['steps'] if s.get('uses','').startswith('docker/login-action@'))
assert login['with']['username']=='${{ github.actor }}'
assert login['with']['password']=='${{ secrets.GITHUB_TOKEN }}'
security=yaml.load(Path('.github/workflows/security-scan.yml').read_text(),Loader=yaml.BaseLoader)
old_security=yaml.load(subprocess.check_output(['git','show',BASE+':.github/workflows/security-scan.yml'],text=True),Loader=yaml.BaseLoader)
assert security['jobs']['secret-scan']==old_security['jobs']['secret-scan']
assert any(s.get('uses')=='github/codeql-action/init@v3' for s in security['jobs']['codeql']['steps'])
assert any(s.get('uses')=='github/codeql-action/analyze@v3' for s in security['jobs']['codeql']['steps'])
assert not subprocess.check_output(['git','diff',BASE,'--','src','vitest.config.ts','.eslintrc.json'],text=True)
print('PASS: Node/lockfile/config/workflow consistency; tests, lint rules, coverage, and scans preserved')
w=yaml.load(Path('.github/workflows/provenance.yml').read_text(),Loader=yaml.BaseLoader)
old=yaml.load(subprocess.check_output(['git','show',BASE+':.github/workflows/provenance.yml'],text=True),Loader=yaml.BaseLoader)
assert w['jobs']['sign']==old['jobs']['sign']
assert w['permissions']=={'contents':'read'}
script=next(s['run'] for s in w['jobs']['build']['steps'] if s.get('name')=='Package compiled build')
subprocess.run(['bash','-n'],input=script,text=True,check=True)
with tempfile.TemporaryDirectory() as tmp:
    p=Path(tmp); env={**os.environ,'GITHUB_SHA':'0'*40}
    assert subprocess.run(['bash','-c',script],cwd=p,env=env).returncode!=0
    (p/'dist').mkdir()
    (p/'dist/index.js').write_text('// explicit packaging fixture\n')
    assert subprocess.run(['bash','-c',script],cwd=p,env=env).returncode!=0
    (p/'dist/index.d.ts').write_text('// explicit packaging fixture\n')
    for name in ['package.json','package-lock.json']:
        (p/name).write_text(Path(name).read_text())
    subprocess.run(['bash','-c',script],cwd=p,env=env,check=True)
    with tarfile.open(p/('artifacts/creator-'+'0'*40+'.tar.gz')) as archive:
        assert {package['main'],'dist/index.d.ts','package.json','package-lock.json'}<=set(archive.getnames())
print('PASS: packaging rejects absent runtime/declarations and archives the declared entrypoint; signing unchanged')
PYTHON
```

## §4 MEMORY INGEST

Counts and the complete changed-file inventory are in memory.json's final summary.
Every Type A entry has populated IOO fields and a declared Type B relationship.
Type C events describe real validation observations; no synthetic commit IDs.
Payload: .bits/out/DISP-BUILD-creator/memory.json. No direct service ingestion.

## §5 CKET FILING

04_HYPOTHESIZE: SRS document. 06_PLAN: provenance documentation.
11_COMMIT: dependency/toolchain configs, workflows, dispatch, registry, evidence.
JSON and the version-only .nvmrc use sibling CGRF envelopes to preserve parser
compatibility. Existing CGRF records retain prior SRS references and add this SRS.
REFLEX validation remains deferred to the private post-merge pipeline.

## §6 GOVERNANCE

Entity: Citadel Nexus Inc. No settings/secrets changes or production operations.
CodeQL and secret scanning remain enabled; no tests or checks were removed.
Existing release/publishing behavior is unchanged; nothing was published here.
License posture unchanged. Stripe not applicable. CK/CAPS/CKS remain pending.

## §7 NEXT ACTIONS

- Blockers: uncached npm dependencies; unverified new registry integrity metadata;
  actual lint/typecheck/test/build results; live provenance verification.
- Obtain npm dependency access for this workspace/runner and validate the locked
  Node 24.13.0 toolchain without suppressing any failures.
- No unrelated source repair or claim of passing tests without runnable tools.
- After merge, verify a real signed main-build archive using .github/PROVENANCE.md.
- One separate build-repair PR; no updates to the merged governance PR.
- Suggested labels: bits:codegen, srs:srs-cn-creator-build-001,
  dispatch:disp-build-creator, verified:manual-review. Labels not applied.
