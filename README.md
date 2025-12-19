# Delta Brief

> **One-page pre-class executive briefs for EMBA students** — turning weekly work realities into actionable class prep and class learnings into actionable work leverage.

[![Demo Video](https://img.shields.io/badge/Demo-YouTube-red?logo=youtube)](https://youtu.be/1Ka_ddIewlk)

## Inspiration

EMBA students are usually **part-time students and full-time workers**. Unlike traditional students, they're constantly asking: "How does this week's lesson help me make better decisions at work?" I built Delta Brief to create a **positive feedback loop** where weekly work realities sharpen in-class learning and discussion, and applied learnings from EMBA classes convert into tangible action items for the workplace.

## What it does

Delta Brief generates a **one-page pre-class executive brief** for the next EMBA class session:

- Takes a **60-second weekly check-in** ("what changed at work since last class?")
- Produces **3 ranked moves that matter**, tied to the upcoming lesson's **frameworks + learning objectives**
- Personalizes via the student's **role, constraints, and capstone goals**
- Explicitly **updates** last week's decisions via: **"Previously → Now → Update"**
- Includes **class discussion ammo** and a concrete **next action + deliverable**

## How we built it

- **Syllabus as source of truth**: each session has topic, learning objectives, frameworks (names + bullets), prompts, and an assignment hook.
- **MemMachine for persistent memory**: We integrated MemMachine as our episodic memory backend to store and retrieve student context across sessions. Profile data (role, constraints, capstone) is stored as **semantic memory**, while weekly check-ins and generated briefs are stored as **episodic memory** anchored by `session_id = class date`. This enables true "compounding" where Week B can explicitly reference and update Week A's open threads.
- **Strict brief template**: forces structure and keeps it to one page.
- **Compare view**: Week A → Week B summary that highlights resolved threads and what changed.
- **Guardrails**: "no repeats" similarity checking, framework-name gating, and validation retries to keep the demo stable.

## Challenges we ran into

- **Class-light outputs** early on (generic advice): solved by enriching syllabus context
- **Timeline confusion** (brief dates drifting from syllabus): fixed by making session dates canonical
- **Brittle parsing** when relying on markdown: mitigated by storing structured fields (moves, highlights, thread updates) alongside the markdown
- **Memory retrieval tuning**: MemMachine's filter syntax required careful handling (single-quoted strings, correct response structure parsing) to reliably fetch prior context

## Accomplishments that we're proud of

- We made "compounding" **visible, not just claimed**: Week B clearly updates Week A with explicit thread resolution.
- **Persistent memory that works**: MemMachine stores weeks of context and enables the system to "remember" prior decisions, not just the last session.
- The system stays **tight and usable**: minimal input, one-page output, actionable next step.
- The demo has **deterministic behavior** through strict constraints (framework gating + no repeats + validation).

## What we learned

- Personalization only matters when it's **obviously grounded** in constraints and context the student cares about.
- Compounding requires **explicit mechanics**; without them, models "reset" every week.
- **Episodic memory is powerful** but needs careful structuring—anchoring memories to session dates made timeline reasoning reliable.

## What's next for Delta Brief

- Upgrade the memory layer to support **longer-term use** (semester-scale sessions, smarter retrieval, decay of stale context).
- Add a **"ready for class" automated flow** that generates each delta brief as a PDF artifact and sends it to the user's email inbox.
- Expand to **multiple course scenarios** and richer capstone deliverable support.
- Build an **evaluation flywheel**: track which brief recommendations led to action, and feed this signal back into MemMachine to improve future generation.

---

## Built With

- **Frontend**: React, TypeScript, Vite, TailwindCSS, shadcn/ui
- **LLM**: OpenAI GPT-5-mini + text-embedding-3-large
- **Memory**: MemMachine (PostgreSQL + pgvector + Neo4j)
- **Icons**: Lucide React

---

## Quick Start

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd delta-brief
   pnpm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Add your OpenAI API key to .env
   ```

3. **Start MemMachine**
   ```bash
   cd MemMachine-MemMachine-f85e49d
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ./memmachine-compose.sh
   ```

4. **Configure app for MemMachine**
   In your project root `.env`:
   ```
   VITE_MEMORY_PROVIDER=memmachine
   VITE_MEMMACHINE_BASE_URL=/memmachine
   VITE_MEMMACHINE_ORG_ID=patched
   VITE_MEMMACHINE_PROJECT_ID=delta-brief-demo
   ```

5. **Run the app**
   ```bash
   pnpm dev
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_OPENAI_API_KEY` | **Required**. OpenAI API key for LLM generation. |
| `VITE_MEMORY_PROVIDER` | `local` (default, localStorage) or `memmachine` (persistent backend). |
| `VITE_MEMMACHINE_BASE_URL` | MemMachine API URL. Default: `/memmachine` (proxied via Vite). |
| `VITE_MEMMACHINE_ORG_ID` | MemMachine organization ID. Default: `patched`. |
| `VITE_MEMMACHINE_PROJECT_ID` | MemMachine project ID. Default: `delta-brief-demo`. |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Delta Brief                          │
├─────────────────────────────────────────────────────────────┤
│  React + Vite + TailwindCSS + shadcn/ui                     │
├─────────────────────────────────────────────────────────────┤
│  Memory Layer (MemMachine or LocalStorage)                  │
│  ├── Semantic Memory: Profile (role, constraints, capstone) │
│  └── Episodic Memory: Weekly check-ins, prior briefs        │
├─────────────────────────────────────────────────────────────┤
│  LLM (OpenAI GPT-5-mini) — Strict template + validation     │
└─────────────────────────────────────────────────────────────┘
```

## MemMachine Setup Details

MemMachine runs via Docker Compose with three services:

| Service | Port | Description |
|---------|------|-------------|
| `memmachine-app` | 8080 | MemMachine REST API |
| `memmachine-postgres` | 5433 | PostgreSQL with pgvector |
| `memmachine-neo4j` | 7474/7687 | Neo4j graph database |

### Useful Commands

```bash
# View logs
docker compose -f MemMachine-MemMachine-f85e49d/docker-compose.yml logs -f

# Stop services
docker compose -f MemMachine-MemMachine-f85e49d/docker-compose.yml down

# Clean restart (wipes data)
docker compose -f MemMachine-MemMachine-f85e49d/docker-compose.yml down -v
./memmachine-compose.sh
```

## Demo Script (Happy Path)

1. Go to **History** and click **Seed Demo Data**.
2. Go to **Brief**.
3. Toggle **Personalized (Memory ON)**.
4. Click **Generate Brief**.
5. Observe:
   - "Memory highlights" chips showing used context.
   - References to "Union pushback" (from Week A).
   - New moves based on "CTO resignation" (Week B delta).
6. Click **Compare** to see Week A → Week B side-by-side with thread resolution.

## Development

```bash
# Type check
pnpm check

# Lint
pnpm lint

# Build
pnpm build
```

## License

MIT
