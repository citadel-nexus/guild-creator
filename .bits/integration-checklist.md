# ─── CGRF Header ──────────────────────────────
# File:        .bits/integration-checklist.md
# Stage:       11_COMMIT
# SRS:         SRS-CN-CREATOR-LIVINGWORLD-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-LIVINGWORLD-creator
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-09-25
# Depends:     .bits/context.md, src/integrations/runtime.ts
# EnumType:    ConfigDoc
# EnumEdges:   VALIDATES src/integrations/runtime.ts; GATES external integration operations
# DAG Node:    creator.integrations.checklist
# Intent:      Make every Creator external dependency, credential boundary, health signal, and quiet fallback explicit.
# ──────────────────────────────────────────────────────────────

# Creator Guild integration checklist

All credentials are runtime environment variables. They are never committed,
logged, returned by health checks, or copied into public floor events. Outbound
operations require `ACTIVE_DISPATCH_ID`; circuit-broken adapters fail closed.

| System | Status | Required environment | Health check | Quiet fallback |
|---|---|---|---|---|
| ElevenLabs | Workflow-owned; observed through n8n | `ELEVENLABS_API_KEY` in the workflow runtime, not this service | Signed `voice_narration.complete` callback | No narration event or notification is emitted |
| Supabase | Implemented; PostHog flag `creator-supabase-realtime` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`; optional `SUPABASE_CREATIVE_ASSET_TABLES` | Head-count query on `lore_entries` plus Realtime subscription state | No rows are invented; floor remains at the last observed or quiet state |
| PostHog | Implemented for server and mobile | Server: `POSTHOG_API_KEY`, optional `POSTHOG_HOST`; mobile receives public project configuration at build time | Feature flag evaluation and SDK delivery health | Flags evaluate disabled; dependent integrations do not run |
| Customer.io | Implemented; flag `creator-customerio-messaging` | `CUSTOMERIO_SITE_ID`, `CUSTOMERIO_API_KEY`, `CUSTOMERIO_TRACK_URL` | Authorized Track API response | Notification returns false without changing floor state |
| Self-hosted GitLab | Implemented read-only; flag `creator-gitlab-bridge` | `GITLAB_BASE_URL`, `GITLAB_PROJECT_ID`, `GITLAB_READ_TOKEN`, `GITLAB_ASSET_METADATA_PATH`, `GITLAB_REF`; optional `GITLAB_SYNC_INTERVAL_MS` | Read-only `/api/v4/version` request | Sync is skipped; existing quests remain unchanged |
| n8n | Implemented at `POST /webhooks/n8n` | `N8N_WEBHOOK_SECRET`, `ACTIVE_DISPATCH_ID` | HMAC-signed canary workflow using a non-production event ID | Missing integration returns 503; invalid signature returns 401 |
| NATS | Implemented | `NATS_URL`, `ACTIVE_DISPATCH_ID` | Connection/flush plus subscribed subject delivery | Publishers become unavailable no-ops and floor state remains local |

## Common runtime controls

- `ACTIVE_DISPATCH_ID`: required for notifications, analytics, webhooks, and
  guild communications.
- `CREATOR_ACTIVITY_WINDOW_TARGET`: observed local events that represent a full
  activity window; default `20`.
- `CREATOR_ACTIVITY_WINDOW_MS`: rolling local event window; default `900000`.
- `SUBGUILD_REPORT_MAX_AGE_MS`: freshness limit for sub-guild status; default
  `300000`.

## Verification rules

- GitLab configuration accepts only `https://gitlab.citadel-nexus.com` and GET
  requests. Returned records are reduced to identifiers, kinds, statuses, and
  timestamps before use.
- Supabase consumes only `id`, whitelisted `status`, and commit timestamp from
  Realtime payloads. RLS remains authoritative.
- Customer.io receives opaque member IDs, guild membership, creative role, and
  project IDs; no email address or content passes through this service.
- PostHog properties use bounded enums/counts and contain no creative content.
- n8n request bodies are capped at 64 KiB, HMAC verified over raw bytes, and
  rejected when their dispatch differs from `ACTIVE_DISPATCH_ID`.
