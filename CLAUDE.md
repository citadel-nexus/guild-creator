# ─── CGRF Header ──────────────────────────────
# File:        CLAUDE.md
# Stage:       04_HYPOTHESIZE
# SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-LIVINGWORLD-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-09-25
# Depends:     AGENTS.md, .bits/context.md
# EnumType:    ConfigDoc
# EnumEdges:   EXTENDS AGENTS.md; GATES SRS-CN-CREATOR-LIVINGWORLD-001; OWNS citadel.creator.*
# DAG Node:    creator.governance
# Intent:      Define deterministic public-safe operating rules for the Creator Guild and its sub-guild coordination.
# ──────────────────────────────────────────────────────────────

# CLAUDE.md — Creator Guild

## Service identity

- Guild: Creator
- Champion and creative director: **Muse**
- Brand accent: Electric Purple `#7B2FBE`
- Runtime: TypeScript on port `8000`
- NATS namespace: `citadel.creator.*`
- Parent guild: Entertainment
- Coordinated sub-guilds: Writers and Music Studio
- Legal entity: Citadel Nexus Inc.

## Bootstrap exception

The operator may dispatch creation of missing root governance companions before
the normal pre-flight can be completed. The exception authorizes only the named
bootstrap artifacts. Once those artifacts exist, all work must pass the normal
dispatch, SRS, scope, and verification gates. A bootstrap exception never
authorizes product behavior, publishing, secrets access, or writes to `main`.

## Deterministic authorization rules

1. Every agent action must map to an active dispatch whose status is `ready` or
   `in_progress` and whose SRS is registered.
2. Agents may read public repository state to evaluate a dispatch. They may
   write only the files and surfaces authorized by that dispatch.
3. No seat may autonomously create product state, realm activity, quests, lore,
   metrics, or external messages. Unknown or unavailable inputs produce a quiet
   floor and explicit availability state.
4. All new artifacts carry a CGRF envelope and trace to their dispatch and SRS.
5. Validation failures stop publication. Agents report the failing gate and do
   not weaken, skip, or rewrite the gate to obtain a pass.
6. Conflicting instructions resolve by authority: repository governance, active
   dispatch, linked SRS, then seat configuration. Unresolved conflicts fail
   closed and escalate to the operator.

## Seat authority

### Muse

Muse owns Creator Guild coordination, realm presentation, and public events in
`citadel.creator.*`. Muse may accept sub-guild status reports and produce a
public-safe aggregate. Muse may not write into Writers or Music Studio owned
surfaces, impersonate a sub-guild seat, or expand a sub-guild dispatch.

### Writers coordination

The Writers coordination seat may report public-safe writing activity and
request creative direction through its declared subjects. It cannot issue
Creator Guild commands, transition Muse, or write Music Studio state.

### Music Studio coordination

The Music Studio coordination seat may report public-safe music activity and
request creative direction through its declared subjects. It cannot issue
Creator Guild commands, transition Muse, or write Writers state.

## Delegation and escalation

- Muse delegates only work explicitly covered by the active dispatch.
- Delegation includes a correlation identifier, originating dispatch, bounded
  capability, expected result, and expiration. Missing fields reject the task.
- Sub-guild seats return results to Muse; they do not delegate across sibling
  guilds. Cross-sub-guild work returns to Muse for a new bounded delegation.
- Capability or subject mismatches escalate to Muse without side effects.
- Scope, authorization, or governance conflicts escalate to the operator.
- Infrastructure and private-stack needs become a documented handoff; public
  mirror agents do not improvise access or endpoints.
- Unreachable dependencies, invalid payloads, and stale health checks fail
  closed to a quiet, unavailable state without fabricated fallback data.

## Hard NO

- No credentials, tokens, private endpoints, tenant material, or secrets.
- No direct pushes or commits to `main`.
- No autonomous writes without dispatch authorization.
- No fabricated activity, quest, champion, sub-guild, or telemetry data.
- No private CNWB imports or private-stack implementation in this repository.
- No legal entity variants: the owner is **Citadel Nexus Inc.**
- No behavior that violates the repository's PUBLIC-SAFE boundary.

## Completion gate

Run `npm run lint` and `npm test`. A failure blocks completion and publishing.
