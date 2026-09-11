# Working rules for this repository

## Context
This is a production system for shop owners: sales records, inventory, and
invoicing. Real businesses depend on the numbers being correct. The maintainer
is a single engineer. Correctness and safety outrank speed.

This is a Next.js App Router application. There is NO separate backend service.
Route handlers, server actions, and server components ARE the backend. Every one
of them is a public entry point that an attacker can call directly.

## Non-negotiable rules
1. NEVER rewrite a file from scratch. Make the smallest change that fixes the issue.
2. NEVER run destructive commands (db push, migrate reset, drop, force-push,
   rm -rf) without asking first and showing exactly what will be destroyed.
3. NEVER commit or push. Leave changes in the working tree for review.
4. Before changing any file, show me the current code and explain what it does.
5. If you are not certain, say "I am not certain" and ask. Do not guess.
6. Every server action and route handler must authenticate and authorise the
   caller itself. Never rely on the UI not rendering a button, or on middleware
   alone, as the access control.
7. Any database read or write for a shop-scoped entity must be filtered by the
   caller's shop/owner id. Flag any query that is not.
8. Money is stored as integer minor units or NUMERIC. Never introduce a float
   for a monetary value.
9. Do not add a new dependency without asking.

## Explain-first mode
After any non-trivial change, write a 3-5 sentence plain-English explanation of
what changed and why. I need to be able to explain this code in an interview.

## Stack
- Next.js (App Router) — fullstack, frontend and backend in one application
- TypeScript, React
- PostgreSQL
- Self-hosted on Coolify behind Traefik
