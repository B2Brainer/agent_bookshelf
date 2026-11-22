# Agent Bookshelf — project instructions

Goodreads-lite teaching app: Express + TypeScript (ESM), SQLite via sql.js (WASM), EJS + HTMX views.

## Commands

- Install: `npm ci` (postinstall runs the TypeScript build)
- Test (the verification gate): `npm run test:run` — Vitest, `tests/**/*.test.ts`
- Single file: `npx vitest run tests/routes/search.test.ts`
- Guardrail hook tests: `node --test ticket-to-merge/hooks/protect.test.mjs`
- Plugin check: `claude plugin validate ./ticket-to-merge`
- Dev server: `npm run dev` (port 3000)

## Layout

- `src/models/*.ts` — data access; use the `all` / `get` / `run` helpers from `src/db/index.ts`
- `src/routes/api.ts` — JSON API under `/api`; `src/routes/books.ts` — HTML + HTMX fragments
- `src/views/**.ejs` — templates; escape user data with `<%= %>`, never `<%- %>`
- `tests/` — Vitest; each file inits its own temp DB in `/tmp` in `beforeEach` and closes it in `afterEach`
- `ticket-to-merge/` — Claude Code plugin (skills, agents, hooks, evals) for the capstone
- `SPEC.md` — current ticket (BOOK-101) with interface and verification path

## Conventions

- SQL is always parameterised: `?` placeholders + params array. Never interpolate request data into SQL.
- JSON errors are `{ "error": "<message>" }` with 400 (validation), 404 (not found), 409 (conflict).
- HTML fragment errors are `<p class="error">…</p>`.
- Routes with fixed segments (e.g. `/books/search`) must be registered before `/:id` routes.
- Imports use the `.js` extension (ESM + `moduleResolution: bundler`).
- Tests: supertest against the exported `app` for routes; call model functions directly for models.
  The seed data has 50 books ordered by title; `GET /api/books` is the reference for book shape and order.

## Hard constraints

- Never modify `bookshelf.db*`, `src/db/seed.sql` or `.env*` (enforced by `ticket-to-merge/hooks/protect.js`).
- No schema changes (`src/db/schema.sql`), no new dependencies (`package.json` / lock file).
- Acceptance tests are read-only once locked by the ship-ticket RED step.
- Do not commit, push or create branches unless the user asks.

# Development guidelines

## 1. Planning

- Analyze the request and relevant code before making changes.
- Identify the expected outcome, constraints, and affected workflows.
- Plan briefly before implementation. Prefer a concise, actionable plan over extensive upfront analysis.
- Surface material ambiguities or contradictions before proceeding. Resolve minor details using existing conventions.

## 2. Simplicity and Scope

- Choose the most direct solution that fully satisfies the requirements.
- Reuse existing code, components, and conventions.
- Avoid unnecessary abstractions, dependencies, refactoring, or unrelated changes.
- Do not add complexity for hypothetical scenarios without a concrete justification.
- When introducing a correction, remove or adjust existing logic that becomes redundant, contradictory, or obsolete.
- Keep changes within the requested scope and explain any necessary deviations.

## 3. Correctness

- Fix root causes rather than symptoms.
- Inspect the existing code and dependencies involved in the affected behavior.
- Derive the expected invariant from each identified problem.
- Verify relevant variations and interactions with existing behavior, prioritizing plausible cases that could change the outcome.
- Consider what the correction might break and how failures or recovery paths behave.
- Never treat an initiated operation as successfully completed without verifying its outcome.

## 4. Verification

- Test changes through the relevant real entry points and observable outcomes.
- Verify both the intended behavior and potential regressions.
- Use existing tests and verification mechanisms whenever possible.
- Report what was verified, what failed, and what remains unverified.
- Do not claim success without supporting evidence.

## 5. Existing Patterns and UI

- Before modifying an interface, inspect comparable screens, workflows, and components.
- Preserve established styles, formats, interaction patterns, and conventions.
- Follow provided mockups while maintaining consistency with the existing application.
- Respect intentional differences in mockups; use existing patterns to fill unspecified details.
- Explain significant deviations from established behavior or visual conventions.

## 6. Reviews and Delivery

- Evaluate review feedback critically rather than implementing every suggestion automatically.
- Validate findings against the code and requirements.
- If a finding is incorrect or its proposed solution is disproportionate, explain why using evidence and choose the simplest sufficient alternative.
- Do not create commits, branches, pull requests, or push changes unless explicitly requested.
- At completion, summarize the changes, verification results, and relevant outstanding risks.