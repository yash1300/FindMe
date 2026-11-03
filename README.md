# FindMe

**Your entire world. One link.** A link-in-bio platform for creators, built India-first.

> **Status: in development.** Accounts, the page builder, themes, public pages and QR codes work on a local stack (Phases 1–3). Analytics and payments aren't built yet, and nothing is deployed. See [PROJECT_PLAN.md](PROJECT_PLAN.md) for exact progress.

## Stack

Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Postgres, Auth, Storage), Zod, Vitest, and Playwright. Resend handles notification email, and Razorpay arrives in Phase 5.

## Getting started

Requires Node.js 22.12 or later, and Docker Desktop running for the local Supabase stack.

```bash
npm install
npx supabase start          # the first run downloads several GB of images
cp .env.example .env.local  # paste in the values printed by the command above, or see ENV_SETUP.md for a hosted project
npm run dev
```

Open http://127.0.0.1:3000. Local emails appear in Mailpit at http://127.0.0.1:54324.

Use `127.0.0.1` rather than `localhost`, so the address matches `NEXT_PUBLIC_APP_URL` and the session cookies line up.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, then runs the TypeScript compiler |
| `npm test` | Unit, component and database tests. The database tests run in-process through PGlite, so Docker isn't needed |
| `npm run test:e2e` | Playwright against a production build. Needs the local Supabase stack and a fresh `npm run build`, because `NEXT_PUBLIC_*` values are fixed at build time |
| `npm run check` | Lint, types, tests and build together |

## Documentation

| Document | Contents |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | The full product and development specification |
| [PRD.md](PRD.md) | Product requirements and open decisions |
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | Roadmap and progress checklist |
| [HANDOFF.md](HANDOFF.md) | Current state and next steps for whoever continues the work |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and key decisions |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Tables, access rules and planned schema |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Route handlers and Server Actions |
| [SECURITY.md](SECURITY.md) | Threat model, control status and known gaps |
| [ENV_SETUP.md](ENV_SETUP.md) | Step-by-step guide to getting every value for your `.env.local` |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Environment variables and setup for Supabase, Google and Vercel |
