# SRS-CN-CREATOR-LIVINGWORLD-001 — Creator Guild · Living-World Floor

**Guild:** creator · **Champion:** Muse · **Branch:** `bits/livingworld`

## Objective
The creator guild is the creative core (image/voice/media generation, the realm art). In the Citadel living world (the Aincrad Tower of Babel) this guild owns
**one floor**, and that floor visualises the guild's REAL activity. This system is the PUBLIC contract the floor
reads — the events this guild emits and the feed the game consumes. The in-game floor IS this guild's system.

## Public contract to build (this repo)
1. **Emit floor events** on the guild NATS namespace `citadel.creator.*` (already this repo's declared prefix):
   - `citadel.creator.activity` — a heartbeat with an `activity_level` 0..1 (drives the floor's size + glow).
   - `citadel.creator.quest` — a quest opened/closed (a real unit of guild work → an in-game quest marker).
   - `citadel.creator.champion` — the champion's (Muse) state (idle/working/blocked).
2. **Expose a public realm feed** `GET /realm/creator.json` — non-secret, non-PII shape the game reads:
   ```json
   {
     "guild": "creator",
     "champion": "Muse",
     "activity_level": 0.0,
     "quests": [{ "id": "q1", "title": "...", "state": "open" }],
     "structures": [{ "kind": "hall", "level": 1 }]
   }
   ```
3. **Bind the champion** — `Muse` is this floor's guildmaster avatar in `/game/party.json`.

## Acceptance
- The feed returns the shape above; `activity_level` moves with real guild activity (no fabricated numbers).
- The three `citadel.creator.*` events publish on real state changes; a subscriber can render the floor from them.
- Nothing private is exposed — counts/status/method only, cleansed. Fail-soft: a missing source degrades to a
  quiet floor, never a crash.

## Runbook
Build in THIS repo's TypeScript surface. Self-gate `npm run lint` + `npm test` (CI enforces). PUBLIC-SAFE only — this repo is the community funnel: NO private paths, NO IPs, NO secrets, NO tenant material (that stays on GitLab per .bits/context.md). Real data only. Conventional commit + the CGRF header. Branch `bits/livingworld`; open a PR titled after this SRS with objective, files, gate evidence.

---
© 2026 Citadel Nexus Inc.
