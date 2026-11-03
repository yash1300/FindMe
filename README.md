# FindMe

**Your entire world. One link.** A link-in-bio platform for creators, built India-first.

> **Status: early development.** Accounts and authentication work on a local stack (Phase 1). There are no public profile pages yet, and nothing is deployed. See [PROJECT_PLAN.md](PROJECT_PLAN.md) for exact progress.

## Stack

Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Postgres, Auth, Storage), Zod, Vitest, and Playwright. Razorpay and Resend arrive in later phases.

## Getting started

Requires Node.js 22.12 or later, and Docker Desktop running for the local Supabase stack.

```bash
npm install
npx supabase start          # the first run downloads several GB of images
cp .env.example .env.local  # paste in the values printed by the command above
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
| [DEPLOYMENT.md](DEPLOYMENT.md) | Environment variables and setup for Supabase, Google and Vercel |
