# PatchED Delta Brief Demo

A personalized "Pre-Class Delta Brief" generator for EMBA students. This demo showcases how **episodic memory** (weekly work deltas) and **profile memory** (goals, constraints) can be combined to generate high-leverage, compounding executive briefs.

## Features

- **Profile Memory**: Captures role, industry, constraints, and capstone topic.
- **Episodic Memory**: Logs weekly "work deltas" (what changed since last class).
- **Compounding Briefs**: Generates a 1-page brief that references prior open threads and avoids repeating previous advice.
- **Generic vs. Personalized**: Toggle to see the difference memory makes.
- **Demo Mode**: "Seed Demo Data" button to instantly populate Week A and Week B history.

## Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd patched-delta-brief
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure Environment**
   Copy `.env.example` to `.env` and add your OpenAI API key.
   ```bash
   cp .env.example .env
   ```

4. **Run Development Server**
   ```bash
   pnpm dev
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_OPENAI_API_KEY` | **Required**. OpenAI API key for LLM generation. |
| `VITE_MEMORY_PROVIDER` | Optional. `local` (default) or `memmachine`. |
| `VITE_MEMMACHINE_URL` | Optional. Base URL for MemMachine API. |

## Architecture

- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Memory**: `LocalMemoryProvider` (localStorage) with `MemoryProvider` interface for easy swap to backend/vector DB.
- **LLM**: Client-side calls to OpenAI (demo-only pattern) via `gpt-4o-mini`.

## Demo Script (Happy Path)

1. Go to **History** and click **Seed Demo Data**.
2. Go to **Brief**.
3. Toggle **Personalized (Memory ON)**.
4. Click **Generate Brief**.
5. Observe:
   - "Memory highlights" chips showing used context.
   - References to "Union pushback" (from Week A).
   - New moves based on "CTO resignation" (Week B delta).
