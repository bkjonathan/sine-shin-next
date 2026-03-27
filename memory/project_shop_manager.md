---
name: Shop Manager Implementation
description: Full-stack shop management system built on Next.js 16 — schema, API, hooks, components, and pages all implemented
type: project
---

Full Shop Management System implemented on Next.js 16.2.1 / React 19.2.4 / Tailwind v4.

**Why:** User requested complete backend + frontend for an internal shop management tool with Apple Liquid Glass design.

**How to apply:** All key files exist; when making changes, maintain the established patterns (glass UI, Drizzle + Postgres, TanStack Query hooks, NextAuth v5 JWT).

## Route structure
- `/` → redirects to `/dashboard`
- `/login` → auth page (NextAuth Credentials)
- `/dashboard` → stats + recent orders
- `/customers`, `/customers/[id]`
- `/orders`, `/orders/[id]`
- `/expenses`
- `/settings`
- All API routes under `/api/*`

## Key technology decisions
- **DB:** Drizzle ORM with postgres (npm) package — singleton client in `src/db/index.ts`
- **Auth:** NextAuth v5 beta (5.0.0-beta.30) — JWT strategy, Credentials provider, bcryptjs
- **IDs:** nanoid (not UUID)
- **Forms:** React Hook Form + zodResolver — schemas in `src/validations/`
- **Tables:** TanStack Table v8 via `DataTable` wrapper
- **State:** TanStack Query v5 — hooks in `src/hooks/`

## Setup commands
1. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` in `.env.local`
2. `npm run db:push` — push schema to DB (or `db:generate` + `db:migrate` for migrations)
3. `npm run db:seed` — creates admin user (admin / admin123) and default settings
4. `npm run dev`
