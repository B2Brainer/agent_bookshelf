# ADR-001: Application Architecture for Agent Bookshelf

**Date:** 2026-09-14  
**Status:** Proposed

## Context

We are building a Goodreads-lite application that serves as a teaching playground for an AI agents course. Students install it locally and use AI agents (Claude Code, etc.) to complete homework: writing prompts for features, generating tests, reviewing agent output. The codebase must be easy to install on Windows/Mac/Linux and structured with deliberate gaps for homework assignments.

## Decision

We will build a TypeScript Node.js application using Express, SQLite via sql.js (WebAssembly), EJS templates, and HTMX. It will ship as an npx-installable CLI that starts a local web server with both HTML views and a JSON API. Data will be pre-seeded on first run.

## Rationale

Express is universally known by AI agents, making it ideal for agent-assisted development. SQLite requires zero configuration — students just run `npx agent-bookshelf` and it works. TypeScript gives agents type information to produce correct code. HTMX provides interactivity without a build step or framework complexity. The dual HTML+API surface gives homework more area to target.

## Trade-offs

**Positive:**
- Zero-config install via npx + SQLite — no database setup, no env vars
- TypeScript + Express = agents produce higher-quality code
- Deliberate test/feature gaps make homework assignments concrete

**Negative:**
- TypeScript adds a compile step (mitigated by tsx for dev, tsc for build)
- HTMX is a dependency some students won't know (mitigated: it's small and agents understand it well)
- No SPA means less "modern frontend" homework surface (acceptable: this is about agents, not frontend frameworks)

cd /Users/brainer/Documents/repositories/agent_bookshelf

# 2a — acceptance tests (RED)
git add tests/models/search.test.ts tests/routes/search.test.ts
git commit -m "test(BOOK-101): acceptance tests for book search (RED)

Written by ticket-to-merge:test-writer from SPEC.md, locked before implementation.
RED: 26 failed | 25 passed (51). Locked sha256 0cbb91b5 / 09522eaa."

# 2b — implementation + build evidence
git add src/models/book.ts src/routes/api.ts src/routes/books.ts src/views/books/search-results.ejs docs/capstone/runs/ docs/capstone/evidence/tdd-red-lock-green.txt docs/capstone/evidence/test-run-green.txt
git commit -m "feat(BOOK-101): search books by title or author

GET /api/books/search?q= (Book[] / 400 {error}) and HTMX GET /books/search.
Built by /ticket-to-merge:ship-ticket: 51/51 green, locked tests and protected files unchanged."

# 3 — eval, cost lever and README
git add ticket-to-merge/ docs/capstone/evals/ docs/capstone/evidence/plugin-validation.txt README.md
git status --short   # should come out empty
git commit -m "capstone: planted-bug eval x3, cost lever, README

Recall/precision over 3 runs, haiku reviewers (rejected, +38%) vs collect-diff lever (adopted, -30%)."