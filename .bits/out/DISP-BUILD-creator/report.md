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

# Creator build repair continuation report

## §1 SUMMARY

Status: PARTIAL — implementation and offline static checks complete; dependency
installation and hosted verification remain blocked/pending.
Dispatch: DISP-BUILD-creator. SRS: SRS-CN-CREATOR-BUILD-001.
Seat: BITS-CODEGEN. Mode: staging. CKS Gate: B+/75; CKS/CAPS/CK: pending.
Required application checks: 0/5 passing. Static/control-flow groups: 4/4 passing.
Publication branch: dd/bits/SRS-CN-CREATOR-GOVERNANCE-001-provenance.
Logical work: bits/SRS-CN-CREATOR-BUILD-001-toolchain.
Current base: f0062863a0268040d7740dcc6fb48195c5d64bed (merged PR #19).
New change range: `git log --oneline f0062863a0268040d7740dcc6fb48195c5d64bed..HEAD`.

## §2 TASK RESULTS

| Task | Status | Result | Verify |
| --- | --- | --- | --- |
| Manual lockfile recovery | PASS (offline control flow) | Dispatch-only workflow, pinned actions, scoped registry auth, all five gates before a lockfile-only PR | Static block below |
| Provenance verification | PASS (offline control flow) | Positive identity/digest policy plus tampered-byte and wrong-signer rejection before upload | Static block below |
| Publication history | PASS | Bound branch fast-forwarded to main containing both merged PRs; no published changes replayed | git diff --stat f0062863a0268040d7740dcc6fb48195c5d64bed..HEAD |
| Application checks | BLOCKED | Registry archives absent from local cache | Table below |

The earlier build repair was already merged in PR #19. Its commit is an ancestor
of current main, so a rebase has no unpublished commits to replay. Fast-forwarding
the session-bound branch produces the requested base without rewriting published
history. The new PR contains only this continuation. No sandbox push occurred.

## §3 SMOKE TEST RESULTS

| Requested check | Command run | Result |
| --- | --- | --- |
| npm ci | npm ci --offline --no-audit --no-fund | BLOCKED: ENOTCACHED for yocto-queue |
| lint | npm run lint | BLOCKED: local ESLint module unavailable |
| typecheck | npm run typecheck | BLOCKED: tsc unavailable |
| test | npm test | BLOCKED: Vitest unavailable |
| build | npm run build | Cleanup passes; compilation BLOCKED: tsc unavailable |

No internet-dependent npm command was attempted in the sandbox. No missing
registry hash or live attestation result is fabricated. The authorized manual
workflow is the registry-enabled recovery path: it evicts incomplete lock entries,
retrieves metadata with npm, asserts registry integrity fields, performs a real
clean install and all verification gates, then proposes only the lockfile.

Static checks cover default-branch/manual gating, 40-character action pins,
permissions and registry mapping, command order, unchanged application/security
checks, and before-upload verification. Stubbed control-flow tests prove that
invalid verifier acceptance/outages, incomplete metadata, an existing refresh
branch, and unrelated tracked changes cannot produce a successful publication.
The positive publication case verifies the exact API destination, content bytes,
commit metadata, and PR branch. No stub invokes an external API. These tests do
not verify action SHA provenance, registry bytes, or cryptographic signatures.

Hosted acceptance remains pending: run the manual workflow after merge, inspect
the lockfile PR and all five checks, and inspect a successful main provenance run
with positive and expected-rejection diagnostics. Admin prerequisites and GitHub
GITHUB_TOKEN event suppression are documented in .github/BUILD.md.

### Reproduce offline static/control-flow checks

Requires Python 3/PyYAML, Node, Bash, local Git history, and gh CLI help. This
uses isolated temporary fixtures and fake npm/gh/git commands, not real writes:

```bash
python - <<'PYTHON'
from pathlib import Path
import json, os, re, subprocess, tempfile, yaml
BASE='f0062863a0268040d7740dcc6fb48195c5d64bed'
w=yaml.load(Path('.github/workflows/lockfile-refresh.yml').read_text(),Loader=yaml.BaseLoader)
assert set(w['on'])=={'workflow_dispatch'} and w['permissions']=={}
j=w['jobs']['refresh']
assert j['permissions']=={'contents':'write','pull-requests':'write','packages':'read'}
assert j['if']=="github.ref == format('refs/heads/{0}', github.event.repository.default_branch)"
for step in j['steps']:
    if 'uses' in step: assert re.fullmatch(r'[^@]+@[0-9a-f]{40}',step['uses'])
    if 'run' in step: subprocess.run(['bash','-n'],input=step['run'],text=True,check=True)
assert j['steps'][1]['with']['node-version-file']=='.nvmrc'
assert j['steps'][1]['with']['scope']=='@citadel-guilds'
assert j['steps'][3]['run']=='npm ci && npm run lint && npm run typecheck && npm test && npm run build'
publish=j['steps'][-1]['run']
assert 'ref=refs/heads/bits/lockfile-refresh' in publish
assert "branch: 'bits/lockfile-refresh'" in publish
assert '--head bits/lockfile-refresh' in publish
assert 'git push' not in publish and '--force' not in publish
assert 'contents/package-lock.json' in publish
assert 'git diff --exit-code' in publish
print('PASS: manual trigger, default-branch guard, action pins, permissions, registry auth, validation order, fixed PR destination')
p=yaml.load(Path('.github/workflows/provenance.yml').read_text(),Loader=yaml.BaseLoader)
old=yaml.load(subprocess.check_output(['git','show',BASE+':.github/workflows/provenance.yml'],text=True),Loader=yaml.BaseLoader)
assert p['jobs']['build']==old['jobs']['build']
assert p['jobs']['sign']['permissions']==old['jobs']['sign']['permissions']
assert p['jobs']['sign']['if']==old['jobs']['sign']['if']
steps=p['jobs']['sign']['steps'];verify=steps[-2]['run']
assert 'Verify provenance' in steps[-2]['name'] and steps[-1]['name']=='Upload signed archive and bundle'
subprocess.run(['bash','-n'],input=verify,text=True,check=True)
help_text=subprocess.check_output(['gh','attestation','verify','--help'],text=True)
for flag in ['--bundle','--repo','--source-ref','--source-digest','--predicate-type','--cert-oidc-issuer','--deny-self-hosted-runners','--signer-workflow']:
    assert flag in help_text and flag in verify
with tempfile.TemporaryDirectory() as temp:
    d=Path(temp);(d/'bin').mkdir();(d/'artifacts').mkdir()
    sha='0'*40
    original=d/('artifacts/creator-'+sha+'.tar.gz'); original.write_bytes(b'fixture archive')
    (d/('artifacts/creator-'+sha+'.sigstore.json')).write_text('{}')
    gh=d/'bin/gh';gh.write_text('''#!/usr/bin/env python3
import os,sys
from pathlib import Path
args=sys.argv[1:]; mode=os.environ['MODE']
if mode=='outage': sys.exit(1)
if mode=='accept_all': sys.exit(0)
if '--signer-workflow' in args and args[args.index('--signer-workflow')+1].endswith('not-provenance.yml'):
    sys.exit(0 if mode=='accept_wrong' else 1)
if Path(args[2]).name=='creator-tampered.tar.gz': sys.exit(1)
sys.exit(0)
''');gh.chmod(0o755)
    env={**os.environ,'PATH':str(d/'bin')+':'+os.environ['PATH'],'RUNNER_TEMP':temp,'GITHUB_SHA':sha,'GITHUB_REPOSITORY':'citadel-nexus/guild-creator'}
    for mode,success in [('correct',True),('accept_all',False),('accept_wrong',False),('outage',False)]:
        r=subprocess.run(['bash','-c',verify],cwd=d,env={**env,'MODE':mode},capture_output=True,text=True)
        assert (r.returncode==0)==success,(mode,r.stderr)
    assert original.read_bytes()==b'fixture archive'
    # Execute the metadata step with an explicitly fake registry response.
    npm=d/'bin/npm';npm.write_text('''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
assert sys.argv[1:]==['install','--package-lock-only','--ignore-scripts']
p=Path('package-lock.json');d=json.loads(p.read_text())
assert 'node_modules/@opentelemetry/api' not in d['packages']
if os.environ['MODE']=='complete':
    d['packages']['node_modules/@opentelemetry/api']={'version':'1.9.0','resolved':'https://registry.npmjs.org/@opentelemetry/api/-/api-1.9.0.tgz','integrity':'sha512-Zml4dHVyZQ=='}
p.write_text(json.dumps(d))
''');npm.chmod(0o755)
    for mode,success in [('complete',True),('incomplete',False)]:
        (d/'package-lock.json').write_text(json.dumps({'packages':{'node_modules/@opentelemetry/api':{'version':'1.9.0','resolved':'https://registry.npmjs.org/@opentelemetry/api/-/api-1.9.0.tgz'}}}))
        r=subprocess.run(['bash','-c',j['steps'][2]['run']],cwd=d,env={**env,'MODE':mode},capture_output=True,text=True)
        assert (r.returncode==0)==success,(mode,r.stderr)
print('PASS: verification rejects unsafe verifier behavior/outages; refresh rejects incomplete metadata (stubbed control-flow tests only)')
assert not subprocess.check_output(['git','diff',BASE,'--','src','vitest.config.ts','.eslintrc.json','.github/workflows/security-scan.yml'],text=True)
print('PASS: tests, lint rules, coverage, CodeQL and secret scans unchanged')
with tempfile.TemporaryDirectory() as temp:
    d=Path(temp);(d/'bin').mkdir();(d/'package-lock.json').write_text('{"fixture":true}\n')
    git=d/'bin/git';git.write_text('''#!/usr/bin/env python3
import os,sys
args=sys.argv[1:]
if args[:2]==['diff','--exit-code']: sys.exit(1 if os.environ['MODE']=='other_changes' else 0)
if args[:2]==['diff','--quiet']: sys.exit(0 if os.environ['MODE']=='unchanged' else 1)
assert args[0]=='rev-parse';print('a'*40)
''');git.chmod(0o755)
    gh=d/'bin/gh';gh.write_text('''#!/usr/bin/env python3
import base64,json,os,sys
from pathlib import Path
args=sys.argv[1:]
with open('calls.log','a') as log: log.write(json.dumps(args)+'\\n')
if args[0]=='api' and args[1].endswith('/git/refs'):
    assert 'ref=refs/heads/bits/lockfile-refresh' in args
    sys.exit(1 if os.environ['MODE']=='existing_branch' else 0)
elif args[0]=='api':
    assert args[1].endswith('/contents/package-lock.json')
    payload=json.loads(Path(args[args.index('--input')+1]).read_text())
    assert payload['branch']=='bits/lockfile-refresh'
    assert payload['sha']=='a'*40
    assert base64.b64decode(payload['content'])==Path('package-lock.json').read_bytes()
    assert '\\nSRS: SRS-CN-CREATOR-BUILD-001\\n' in payload['message']
else:
    assert args[:2]==['pr','create']
    assert args[args.index('--head')+1]=='bits/lockfile-refresh'
    assert args[args.index('--base')+1]=='main'
    assert Path(args[args.index('--body-file')+1]).exists()
''');gh.chmod(0o755)
    env={**os.environ,'PATH':str(d/'bin')+':'+os.environ['PATH'],'RUNNER_TEMP':temp,'GITHUB_REPOSITORY':'citadel-nexus/guild-creator','DEFAULT_BRANCH':'main'}
    for mode,success,calls in [('fresh',True,3),('existing_branch',False,1),('other_changes',False,0),('unchanged',True,0)]:
        (d/'calls.log').write_text('')
        r=subprocess.run(['bash','-c',publish],cwd=d,env={**env,'MODE':mode},capture_output=True,text=True)
        assert (r.returncode==0)==success,(mode,r.stderr)
        assert len((d/'calls.log').read_text().splitlines())==calls,mode
print('PASS: publication proposes only the lockfile on the fixed branch; existing branch and extra changes fail closed (stubbed APIs)')
PYTHON
```

## §4 MEMORY INGEST

Payload: .bits/out/DISP-BUILD-creator/memory.json.
The final summary contains current counts. Earlier SRS file records are retained;
new workflow/document records and current validation events are added. IOO is
populated and each Type A has a matching Type B relationship. No direct ingest.

## §5 CKET FILING

06_PLAN: BUILD/provenance docs. 04_HYPOTHESIZE: existing SRS updated.
11_COMMIT: workflows, registry/dispatch, report/memory and existing envelopes.
New files carry CGRF headers; edges match the memory payload.
REFLEX remains deferred to the private post-merge pipeline.

## §6 GOVERNANCE

Citadel Nexus Inc. No settings/secrets changes, production operations, main
writes, test weakening, or security-scan removal. The operator explicitly
requested the fixed automation branch and session-bound publication branch.
License unchanged. Stripe not applicable. Pending CK/CAPS/CKS remain pending.

## §7 NEXT ACTIONS

- Publish this continuation with Create or Update PR; the bound branch is based
  on current main and only new build changes remain in the comparison.
- Administrator: permit the pinned actions, package reads, and workflow-created
  PRs; ensure human review and PR checks run despite GITHUB_TOKEN event suppression.
- Maintainer: dispatch the refresh from the default branch after merge. Inspect
  and resolve an existing/partially created bits/lockfile-refresh branch before retry.
- Registry integrity, all five application checks, and live positive/negative
  attestation verification remain pending real hosted runs. No success is claimed.
- No new PR or workflow run was created from the sandbox. No labels applied.
