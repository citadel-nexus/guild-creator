# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/out/DISP-GOVERNANCE-creator/report.md
# Stage:       11_COMMIT
# SRS:         SRS-CN-CREATOR-GOVERNANCE-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-GOVERNANCE-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .github/workflows/provenance.yml, .github/PROVENANCE.md
# EnumType:    Doc
# EnumEdges:   VALIDATES SRS-CN-CREATOR-GOVERNANCE-001
# DAG Node:    creator.governance
# Intent:      Preserve reproducible governance validation evidence and unresolved merge gates.
# ───────────────────────────────────────────────────────────────

# Creator governance staging report

## §1 SUMMARY

- Status: PARTIAL — implementation prepared; merge readiness blocked by validation.
- Dispatch: DISP-GOVERNANCE-creator. Seat: BITS-CODEGEN.
- SRS: SRS-CN-CREATOR-GOVERNANCE-001.
- Branch: bits/SRS-CN-CREATOR-GOVERNANCE-001-provenance.
- Tasks: 3/4 complete. Smoke: 4/8 passing; live signing is pending, excluded.
- CKS Gate: B+/75. CKS: pending. CAPS: pending. CK: pending.
- Commits: resolve the final session commit with
  `git log --format='%h %s' 5bc0fa8b5d3e2e0607642029db6b0b83b6541f9c..HEAD`.

## §2 TASK RESULTS

| Task | Status | Output | Verify | CKET |
| --- | --- | --- | --- | --- |
| A — bootstrap | PASS | Registered operator-authorized SRS and in-progress dispatch | Static smoke block below | 04_HYPOTHESIZE, 11_COMMIT |
| B — ownership | PASS | Muse accountability, retained GitHub owner team, admin protection specification | Static smoke and GOVERNANCE.md review | 06_PLAN |
| C — provenance | PASS (static) | Main-only signing, PR build validation, digest/identity verification guide | Static smoke block below | 11_COMMIT, 06_PLAN |
| D — validation | PARTIAL | Static checks pass; install/lint/test/build fail locally; live signing pending | Commands and evidence below | 11_COMMIT |

All touched paths are enumerated in memory.json Type A entries. No application
module was created or edited; SAKE module stubs and new-code coverage do not
apply to these configuration/documentation changes. Existing coverage tests
could not execute. No tests or checks were weakened.

## §3 SMOKE TEST RESULTS

| Check | Command / procedure | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| 1 | Workflow assertions in static smoke below | Trusted-main signing only; same-run archive | Passed, including rejection of unsafe trigger and cross-run mutations | PASS |
| 2 | Shell syntax and CLI flags in static smoke | Valid Bash and supported verify flags | Passed | PASS |
| 3 | Fixture archive checks in static smoke | Missing build rejected; expected files archived; tamper changes digest | Passed | PASS |
| 4 | Authorization/CGRF/memory checks in static smoke | Registered dispatch, matching metadata, no orphan edges | Passed | PASS |
| 5 | `npm ci --offline --ignore-scripts` | Install locked dependencies | Existing dependency resolution reports missing @opentelemetry/api lockfile entries | FAIL |
| 6 | `npm run lint` | Exit 0 | Local dependencies unavailable; fallback ESLint rejects --ext with flat config | FAIL |
| 7 | `npm test` | Tests and coverage pass | vitest: not found | FAIL |
| 8 | `npm run build` | Compile dist successfully | tsc: not found | FAIL |

Checks 5–8 share the dependency installation blocker. No dependency fix was
applied because package/lockfile changes are outside this dispatch. The sandbox
cannot fetch missing npm dependencies; no outbound npm request was attempted.
The failure establishes a local validation blocker, not proof that an online
clean install fails identically. On a provisioned Node 24 runner, verify with
`npm ci && npm run lint && npm test && npm run build` before merge. If installation
still fails there, request a dependency-repair dispatch and rerun all four checks.
The existing CI uses Node 20 while locked Vitest 5.0.2 requires Node 22.12+ or 24;
request a separate CI repair rather than bypassing its required check. The new
workflow selects Node 24. Existing workflows are unchanged.

The archive test uses an explicitly synthetic fixture in a temporary directory.
It validates packaging behavior and digest sensitivity, not successful app
compilation, an issued attestation, or cryptographic verification. The real
GitHub OIDC/signing and positive/negative verifier acceptance remain pending a
successful trusted main run after merge, per .github/PROVENANCE.md.

### Reproduce static checks

Requires Python 3 with PyYAML, Bash, tar, and a current GitHub CLI. Run from the
repository root. This block is read-only except for isolated temporary fixtures:

```bash
python - <<'PYTHON'
from pathlib import Path
import copy
import hashlib
import json
import os
import subprocess
import tarfile
import tempfile
import yaml

root = Path.cwd()
srs = 'SRS-CN-CREATOR-GOVERNANCE-001'
dispatch = 'DISP-GOVERNANCE-creator'
workflow = yaml.load(Path('.github/workflows/provenance.yml').read_text(), Loader=yaml.BaseLoader)

def validate_workflow(w):
    assert set(w['on']) == {'pull_request', 'push'}
    assert all(t['branches'] == ['main'] for t in w['on'].values())
    assert w['permissions'] == {'contents': 'read'}
    assert set(w['jobs']) == {'build', 'sign'}
    build, sign = w['jobs']['build'], w['jobs']['sign']
    assert build['name'] == 'provenance-build' and 'permissions' not in build
    assert sign['needs'] == 'build'
    assert sign['if'] == "github.event_name == 'push' && github.ref == 'refs/heads/main'"
    assert sign['permissions'] == {'contents': 'read', 'id-token': 'write', 'attestations': 'write'}
    assert build['runs-on'] == sign['runs-on'] == 'ubuntu-latest'
    assert [s['run'] for s in build['steps'] if 'run' in s][:4] == ['npm ci', 'npm run lint', 'npm test', 'npm run build']
    assert build['steps'][0]['with']['persist-credentials'] == 'false'
    assert build['steps'][1]['with']['node-version'] == '24'
    upload = build['steps'][-1]
    assert sign['steps'][0]['with']['name'] == upload['with']['name']
    assert set(sign['steps'][0]['with']) == {'name', 'path'}
    assert sign['steps'][1]['with']['subject-path'] == upload['with']['path']
    assert sign['steps'][1]['uses'] == 'actions/attest-build-provenance@v3'
    assert not any('checkout' in s.get('uses', '') or 'npm' in s.get('run', '') for s in sign['steps'])
    assert 'steps.attest.outputs.bundle-path' in sign['steps'][2]['env']['BUNDLE_PATH']
    assert sign['steps'][-1]['with']['if-no-files-found'] == 'error'
    assert '.sigstore.json' in sign['steps'][-1]['with']['path']

validate_workflow(workflow)
# Red/green policy checks: reject PR signing and cross-run artifact selection.
unsafe = copy.deepcopy(workflow)
unsafe['jobs']['sign']['if'] = 'always()'
try:
    validate_workflow(unsafe)
except AssertionError:
    pass
else:
    raise AssertionError('unsafe signing trigger accepted')
unsafe = copy.deepcopy(workflow)
unsafe['jobs']['sign']['steps'][0]['with']['run-id'] = '123'
try:
    validate_workflow(unsafe)
except AssertionError:
    pass
else:
    raise AssertionError('cross-run artifact selection accepted')
print('PASS: workflow trust and artifact boundaries, including negative mutations')

for job in workflow['jobs'].values():
    for step in job['steps']:
        if 'run' in step:
            subprocess.run(['bash', '-n'], input=step['run'], text=True, check=True)
help_text = subprocess.check_output(['gh', 'attestation', 'verify', '--help'], text=True)
for flag in ('--bundle', '--repo', '--signer-workflow', '--source-ref', '--source-digest', '--predicate-type', '--deny-self-hosted-runners'):
    assert flag in help_text
for chunk in Path('.github/PROVENANCE.md').read_text().split('```bash\n')[1:]:
    subprocess.run(['bash', '-n'], input=chunk.split('```')[0], text=True, check=True)
print('PASS: workflow/doc shell syntax and installed verifier flag support')

# Fixture-only packaging: this does not claim that the application compiled.
package_script = next(s['run'] for s in workflow['jobs']['build']['steps'] if s.get('name') == 'Package compiled build')
with tempfile.TemporaryDirectory() as tmp:
    fixture = Path(tmp)
    env = {**os.environ, 'GITHUB_SHA': '0' * 40}
    missing = subprocess.run(['bash', '-c', package_script], cwd=fixture, env=env, capture_output=True)
    assert missing.returncode != 0
    (fixture / 'dist/src').mkdir(parents=True)
    (fixture / 'dist/src/index.js').write_text('// packaging fixture only\n')
    for name in ('package.json', 'package-lock.json'):
        (fixture / name).write_text('{}\n')
    subprocess.run(['bash', '-c', package_script], cwd=fixture, env=env, check=True)
    archive = fixture / ('artifacts/creator-' + '0' * 40 + '.tar.gz')
    with tarfile.open(archive) as tar:
        assert {'dist/src/index.js', 'package.json', 'package-lock.json'} <= set(tar.getnames())
    before = hashlib.sha256(archive.read_bytes()).hexdigest()
    with archive.open('ab') as out:
        out.write(b'tampered\n')
    assert hashlib.sha256(archive.read_bytes()).hexdigest() != before
print('PASS: packaging rejects missing build, includes expected files, and binds changed bytes to a different digest')

registry = yaml.safe_load(Path('.bits/srs_registry.yml').read_text())
assert registry[srs]['dispatch'] == dispatch
assert '- status: in_progress' in Path(f'.bits/queue/{dispatch}.md').read_text()
assert 'authorization_source: authenticated operator Dmitry Richard' in Path(f'.bits/queue/{dispatch}.md').read_text()
assert '* @citadel-nexus/creator-guild' in Path('.github/CODEOWNERS').read_text()
assert 'Guildmaster:** Muse' in Path('GOVERNANCE.md').read_text()
memory = json.loads(Path(f'.bits/out/{dispatch}/memory.json').read_text())
entries = memory['entries']
a = [e for e in entries if e['type'] == 'A']
b = [e for e in entries if e['type'] == 'B']
c = [e for e in entries if e['type'] == 'C']
assert memory['summary']['type_a_count'] == len(a)
assert memory['summary']['type_b_count'] == len(b)
assert memory['summary']['type_c_count'] == len(c)
assert list(memory)[-1] == 'summary'
assert len({e['file_path'] for e in a}) == len(a)
header_edges = set()
for e in a:
    path = Path(e['file_path'])
    assert path.exists() and e['lines'] == len(path.read_text().splitlines())
    assert e['intent_statement'] and e['objective_id'] == dispatch
    assert e['outcome'] in {'stored', 'success', 'partial', 'failure', 'blocked'}
    assert e['supersedes'] is False
    assert e['caps_grade'] == e['ck_stamp'] == 'pending'
    header_path = path.with_suffix('.cgrf.yaml') if path.suffix == '.json' else path
    header = header_path.read_text()
    assert f'# SRS:         {srs}' in header
    assert f'# Stage:       {e["cket_stage"]}' in header
    assert '# Owner:       Citadel Nexus Inc.' in header
    assert f'# Intent:      {e["intent_statement"]}' in header or path.suffix == '.json'
    assert any(edge['source'] == e['file_path'] or edge['target'] == e['file_path'] for edge in b)
    if path.suffix != '.json':
        line = next(line for line in header.splitlines() if line.startswith('# EnumEdges:'))
        for edge in line.split(':', 1)[1].strip().split('; '):
            verb, target = edge.split(' ', 1)
            header_edges.add((e['file_path'], verb, target))
assert header_edges == {(e['source'], e['edge_type'], e['target']) for e in b}
assert len(c) > 0 and all(e['timestamp'] for e in c)
assert memory['summary']['dkg_orphans'] == 0
assert memory['summary']['ioo_compliance'] is True
print('PASS: dispatch, ownership, CGRF metadata, memory counts, and exact DKG edges')
PYTHON
```

## §4 MEMORY INGEST

- Type A count: 10 (one per touched file).
- Type B count: 19 (exactly the CGRF-declared relationships).
- Type C count: 3 (real timestamped validation observations; no invented commit).
- IOO compliance: true. DKG orphans: 0.
- Payload: .bits/out/DISP-GOVERNANCE-creator/memory.json.
- No direct memory service writes. Post-merge ingestion remains external.

## §5 CKET FILING

Repository conventions use logical stage headers at existing root/config paths:

- 06_PLAN: GOVERNANCE.md, .github/CODEOWNERS, .github/PROVENANCE.md.
- 04_HYPOTHESIZE: .bits/srs/SRS-CN-CREATOR-GOVERNANCE-001.md.
- 11_COMMIT: registry, dispatch, provenance workflow, report, memory and companion.
- 13_SAVE: none.
- CGRF headers: 8/8 new files covered, including the JSON sibling envelope.
  Both modified files also have envelopes for this SRS.
- REFLEX check: deferred to private post-merge validation; not executed locally.

## §6 GOVERNANCE

- Entity: Citadel Nexus Inc. (Delaware C-Corp).
- License posture: unchanged; this dispatch does not audit or modify licensing.
- Hard-NO scan: changed paths restricted to the authorized registry scope;
  no existing notification, service, migration, or signing-key implementation edited.
- Secret scan: changed content checked for prohibited credential prefixes;
  no credentials introduced. Verification uses Actions OIDC, not stored keys.
- Stripe mode: not applicable; no checkout/payment logic touched.
- GitHub settings/access: unchanged; activation and Muse identity mapping need an admin.

## §7 NEXT ACTIONS

- Blockers: dependency install and lint/test/build validation; existing Node 20 CI
  compatibility; unconfirmed Muse GitHub identity/team eligibility.
- After merge: verify a real main-run archive and reject tampered bytes, wrong
  workflow, and wrong source commit. Preserve the bundle before artifact expiry.
- Handoffs: GitHub admin enables GOVERNANCE.md protections and validates ownership;
  no private-stack handoff file needed.
- Suggested next dispatch: operator-issued CI/dependency repair, then trusted-run
  provenance acceptance. No dispatch authorization is invented here.
- Bugs filed: none. Existing CI/dependency concerns are recorded here for the
  operator; this session cannot write provider issue comments.
- Proposed labels (not applied): bits:codegen,
  srs:srs-cn-creator-governance-001, dispatch:disp-governance-creator,
  verified:manual-review. No tests-pass label.
