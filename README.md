# PatchED Delta Brief Demo

A personalized "Pre-Class Delta Brief" generator for EMBA students. This demo showcases how **episodic memory** (weekly work deltas) and **profile memory** (goals, constraints) can be combined to generate high-leverage, compounding executive briefs.

## Features

- **Profile Memory**: Captures role, industry, constraints, and capstone topic.
- **Episodic Memory**: Logs weekly "work deltas" (what changed since last class).
- **Compounding Briefs**: Generates a 1-page brief that references prior open threads and avoids repeating previous advice.
- **Generic vs. Personalized**: Toggle to see the difference memory makes.
- **Compare View**: Side-by-side comparison of personalized vs. generic briefs.
- **Demo Mode**: "Seed Demo Data" button to instantly populate Week A and Week B history.
- **MemMachine Integration**: Optional persistent memory backend using MemMachine (vector DB + semantic/episodic storage).

## Quick Start

### Option 1: Local Storage (Demo Mode)

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

3. **Run**
   ```bash
   pnpm dev
   ```

### Option 2: With MemMachine Backend (Persistent Memory)

1. **Complete steps 1-2 above**

2. **Start MemMachine**
   ```bash
   cd MemMachine-MemMachine-f85e49d
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ./memmachine-compose.sh
   ```

3. **Configure app for MemMachine**
   In your project root `.env`:
   ```
   VITE_MEMORY_PROVIDER=memmachine
   VITE_MEMMACHINE_BASE_URL=/memmachine
   VITE_MEMMACHINE_ORG_ID=patched
   VITE_MEMMACHINE_PROJECT_ID=delta-brief-demo
   ```

4. **Run the app**
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

- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Memory Providers**:
  - `LocalMemoryProvider`: localStorage-based (default, for demo)
  - `MemMachineProvider`: Full persistence with MemMachine (PostgreSQL + Neo4j + embeddings)
- **LLM**: Client-side calls to OpenAI via `gpt-4o` / `gpt-4o-mini`.
- **Vite Proxy**: Routes `/memmachine/*` to MemMachine API at `localhost:8080`.

## MemMachine Setup Details

MemMachine runs via Docker Compose with three services:

| Service | Port | Description |
|---------|------|-------------|
| `memmachine-app` | 8080 | MemMachine REST API |
| `memmachine-postgres` | 5433 | PostgreSQL with pgvector |
| `memmachine-neo4j` | 7474/7687 | Neo4j graph database |

### Configuration Files

- `MemMachine-MemMachine-f85e49d/.env` - Environment variables (OPENAI_API_KEY, ports)
- `MemMachine-MemMachine-f85e49d/configuration.yml` - MemMachine config (models, embedders, rerankers)
- `MemMachine-MemMachine-f85e49d/docker-compose.yml` - Service definitions

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
6. Click **Compare** to see personalized vs. generic side-by-side.

## Development

```bash
# Type check
pnpm check

# Lint
pnpm lint

# Build
pnpm build
```
