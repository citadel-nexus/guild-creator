# Guild: Creator

> *"You don't make content. You build worlds."*

The Creator Guild is where ideas become assets. It houses the creative pipeline
for art, music, and multimedia — a hub for the Writers and Music Studio sub-guilds,
lore compilation, and the book pipeline. Creators are the storytellers of Citadel.

---

## Identity

| | |
|---|---|
| **Sigil** | The Painter's Brush |
| **Vibe** | Inspired chaos. Late nights. The piece that surprises even its maker. |
| **Color** | Electric Purple `#7B2FBE` |
| **NATS Prefix** | `citadel.creator.*` |
| **Port** | `8000` |
| **Parent Guild** | Entertainment |
| **Sub-guilds** | Writers, Music Studio |

---

## Purpose

- Coordinate the **Writers** and **Music Studio** sub-guilds under one creative roof
- Drive **lore compilation** — RPG sessions → lore entries → book pipeline
- Generate world-building assets: art direction, narrative arcs, campaign settings
- Feed lore output to `lore_entries` (Supabase) and the book export queue
- Integrate with ElevenLabs for AI voice narration of lore and story content

---

## Domains of Operation

### Lore Pipeline
```
RPG Session → lore-compile <session_id> → lore_entries (Supabase)
                                         → lore-export → book_sessions table
```

### Sub-guild Coordination
| Sub-guild | Scope |
|-----------|-------|
| **Writers** | Long-form narrative, lore canon, book manuscripts |
| **Music Studio** | Soundtrack, ambient, event scores |

### Creator Tiers (Brotherhood)
Creators earn XP through lore submissions, art uploads, and collaborative builds.
Rank progression: Initiate → Brother → Devotion Leader → Council → Royal Family.

---

## Services & Integrations

| Service | Role |
|---------|------|
| **Supabase** | `lore_entries`, `book_sessions`, `rpg_sessions` |
| **ElevenLabs** | Voice narration for lore + campaigns |
| **Notion** | Blueprint docs for creative projects |
| **NATS** | `citadel.creator.*`, `citadel.writer.*` |
| **Discord** | Creator channels — art drops, lore releases |

---

## NATS Event Subjects

```
citadel.creator.lore.compiled       — Session compiled into lore entry
citadel.creator.lore.exported       — Lore queued for book pipeline
citadel.creator.art.uploaded        — New creative asset registered
citadel.creator.collab.started      — Multi-creator session opened
citadel.writer.draft.submitted      — Writing draft ready for review
```

---

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

```
NATS_URL=nats://147.93.43.117:4222
SUPABASE_SERVICE_ROLE_KEY=<key>
ELEVENLABS_API_KEY=<key>
NOTION_API_TOKEN=<key>
GUILD_PORT=8000
```
