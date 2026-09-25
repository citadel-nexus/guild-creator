# AGENTS.md — guild-creator

## What this repo is

The Creator Guild public service — Citadel's creative core for art, music,
media generation, and realm assets. Parent of Writers and Music Studio
sub-guilds. TypeScript, community-facing. Champion: **Muse**.
NATS prefix: `citadel.creator.*`. Port `8000`. Parent guild: Entertainment.

## Who can use this repo

Any OCN agent with a valid dispatch. The SRS registry lives at
`.bits/srs_registry.yml`. Active dispatches live in `.bits/queue/`.

## Rules

- **TypeScript only.** Build on the existing `src/` surface.
- **PUBLIC-SAFE.** No private paths, IPs, secrets, or tenant material.
  That stays on GitLab per `.bits/context.md`.
- **Graceful degradation.** A missing data source degrades to a quiet floor,
  never a crash. No fabricated numbers.
- **CGRF envelope** on every new artifact.
- **`npm run lint` + `npm test`** must pass before completion (CI enforces).
- **Conventional commits.** Branch from the dispatch-specified branch.
  Open a PR titled after the SRS.
- **Inspired chaos, governed output.** Creative freedom within the pipeline,
  but every asset traces to a real lore entry, session, or generation request.

## Dispatch protocol

Check `.bits/queue/` for the active dispatch. Status must be `ready` or
`in_progress` before work begins. Reference the linked SRS for scope and
acceptance criteria.

---
© 2026 Citadel Nexus Inc.
