# ─── CGRF Header ──────────────────────────────
# File:        .bits/progression.md
# Stage:       11_COMMIT
# SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-LIVINGWORLD-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-09-25
# Depends:     .bits/integration-checklist.md, src/integrations/activity-aggregator.ts
# EnumType:    ConfigDoc
# EnumEdges:   CONSUMES creative asset metrics; CONSUMES lore compilation metrics; CONSUMES voice narration metrics; CONSUMES sub-guild coordination metrics
# DAG Node:    creator.floor.progression
# Intent:      Define deterministic structure levels from cumulative verified creative output without fabricated progress.
# ───────────────────────────────────────────────────────────

# Creator floor progression

Structure level is a cumulative achievement tier. It is independent from the
15-minute `activity_level` heartbeat and never decreases. Every threshold uses
deduplicated real records from the systems named below. A level advances only
when **all four** thresholds for the next level have been met.

| Advance | Creative assets produced | Lore entries compiled | Voice narrations ready | Sub-guild coordination events |
|---|---:|---:|---:|---:|
| Level 1 → 2 | 10 | 5 | 3 | 5 |
| Level 2 → 3 | 50 | 25 | 15 | 25 |
| Level 3 → 4 | 200 | 100 | 60 | 100 |
| Level 4 → 5 | 500 | 250 | 150 | 250 |

## Source-of-truth requirements

- Creative assets: distinct ready/generated asset IDs from configured Supabase
  tables, signed n8n callbacks, or the sanitized GitLab metadata artifact.
- Lore entries: distinct inserted `lore_entries` IDs from Supabase.
- Voice narrations: distinct HMAC-authenticated `voice_narration.complete` n8n
  event IDs originating from the ElevenLabs workflow.
- Sub-guild coordination: distinct authorized report IDs received on Writers or
  Music Studio status subjects.

The same identifier cannot increment a metric twice, regardless of delivery or
polling retries. Missing sources contribute zero. Deleted records do not create
negative progress and do not silently downgrade a structure; corrections
require a dispatched audit with evidence.

## Structure presentation

- Level 1 — Creator Hall: baseline public floor and Muse guildmaster avatar.
- Level 2 — Atelier Wing: verified recurring asset and lore production.
- Level 3 — Story Forge: sustained Writers and Music Studio coordination.
- Level 4 — Resonance Gallery: mature visual, narrative, and narration output.
- Level 5 — World Foundry: portfolio-scale verified creative production.

Until a durable aggregate source exposes all four counters, the public realm
must remain at level 1. The service must not infer lifetime progression from a
rolling activity window or fabricate counters from missing integrations.
