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

## Mission System

Creator missions reward artistic output, lore production, and cross-guild creative collaboration.

| Mission | Description | XP | Unlock |
|---------|-------------|-----|--------|
| First Lore | Compile your first RPG session into a lore entry | 150 | Default |
| Book Queue | Export a lore batch to the book pipeline | 300 | Creator rank |
| Asset Upload | Register 5 creative assets in the guild registry | 100 | Default |
| Collab Session | Complete a cross-guild creative session | 250 | Creator rank |
| Voice Narration | Produce an ElevenLabs narration for a lore piece | 200 | Creator rank |
| World Arc | Complete a full narrative arc (3+ sessions) | 600 | Loremaster rank |
| Studio Track | Produce a beat via the Music Studio pipeline | 150 | Default |

**Daily missions (reset 00:00 UTC):**
- Submit a `citadel.creator.lore.compiled` event — 25 XP
- Upload a creative asset to the registry — 25 XP

The Creator guild feeds directly into the Entertainment guild's XP economy —
lore contributions and artistic assets amplify XP multipliers for active campaigns.

---

## Guild Expectations

**Members:**
- At least 1 creative output per sprint (lore entry, asset, or track)
- Participate in at least 1 collaborative session per month
- Complete Creator onboarding (lore pipeline primer) within 7 days of placement
- Engage in `#showcase` and `#writers-room` lobby channels

**Contributors:**
- All lore submissions must pass the Writers guild editorial review before merge
- ElevenLabs voice scripts require a content review (tone + canon compliance)
- New Supabase tables (e.g., `rpg_sessions`, `lore_entries`) need RLS policies
- Code review turnaround: 48 hours

**Guild Lead (Creative Director):**
- Weekly creative output summary to `#announcements`
- Coordinate with Writers guild lead on canon consistency
- Manage the lore → book pipeline export schedule

---

## Contributing

**Branch naming:**
```
feat/<srs-code>/<short-description>
fix/<srs-code>/<short-description>
lore/<srs-code>/<short-description>
```

**PR checklist:**
- [ ] SRS code referenced (e.g., `SRS: CRE-LORE-002`)
- [ ] `npm test` passes
- [ ] Lore entries reference session IDs in `rpg_sessions`
- [ ] ElevenLabs scripts reviewed for canonical accuracy
- [ ] No PII in lore content (player names anonymized)

**Commit format:** `<type>(<srs-code>): <description>`
Example: `feat(CRE-LORE-002): compile The Siege of Vault 7 into lore canon`

**SAKE compliance:** New pipeline modules require a `.sake` file stub.
See [guild-sdk](https://github.com/citadel-nexus/guild-sdk) for the format.

---

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

```
NATS_URL=nats://<your-nats-host>:4222
SUPABASE_SERVICE_ROLE_KEY=<key>
ELEVENLABS_API_KEY=<key>
NOTION_API_TOKEN=<key>
GUILD_PORT=8000
```
