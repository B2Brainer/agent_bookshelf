# Capstone · Ticket to Merge — BOOK-101 with the `ticket-to-merge` plugin

| | |
|---|---|
| Repository (fork) | **`https://github.com/B2Brainer/agent_bookshelf.git`** ← fork of `github.com/abarriosBLA/agent_bookshelf` |
| Branch | `capstone/ticket-to-merge` |
| Ticket | BOOK-101 · Search books by title or author → [`SPEC.md`](SPEC.md) |
| Project instructions | [`CLAUDE.md`](CLAUDE.md) (88 lines: conventions, test command, hard constraints) |
| Plugin | [`ticket-to-merge/`](ticket-to-merge/) — `/ticket-to-merge:ship-ticket`, `/ticket-to-merge:review-pr` |
| Claude Code | 2.1.277 · Node 22 |

All numbers below come from real runs whose raw transcripts and outputs are committed under
[`docs/capstone/`](docs/capstone/). Nothing is estimated except where it says so.

## 1. Setup and how to run

```bash
npm ci                                   # installs and builds (no new dependencies were added)
npm run test:run                         # verification gate: 51 tests, all green
node --test ticket-to-merge/hooks/protect.test.mjs   # guardrail hook tests (82)
claude plugin validate ./ticket-to-merge             # ✔ Validation passed (also with --strict)
claude --plugin-dir ./ticket-to-merge                # load the plugin into a session
```

Inside that session:

| Command | What it does |
|---|---|
| `/ticket-to-merge:ship-ticket SPEC.md` | Ticket → validated spec → plan → failing acceptance tests (RED) → lock tests → implement (GREEN) → gate → read-only review → fix verified findings → loop until gates pass → completion report. Leaves changes uncommitted. |
| `/ticket-to-merge:review-pr [base-ref] [-- pathspec]` | Reviews the current branch against `base-ref` (default: merge-base with `origin/main`/`main`/`master`), including uncommitted and untracked files. Prints a summary and one JSON block: `{"base","head","findings":[{file,line,severity,issue,evidence}]}`. Works on any branch of any repo. |

Headless equivalents (what produced the evidence):

```bash
claude -p "/ticket-to-merge:ship-ticket SPEC.md" --plugin-dir ./ticket-to-merge --model opus \
  --permission-mode acceptEdits --allowedTools Bash Read Edit Write Agent Skill Grep Glob \
  --output-format stream-json --verbose --max-budget-usd 20 > docs/capstone/runs/build.jsonl
claude -p "/ticket-to-merge:review-pr" --plugin-dir ./ticket-to-merge --model sonnet \
  --allowedTools "Bash(git *)" Read Grep Glob Agent --output-format stream-json --verbose
node ticket-to-merge/scripts/cost-by-stage.mjs docs/capstone/runs/build.jsonl   # per-stage cost
ticket-to-merge/evals/run-eval.sh planted-a out/run1                            # one isolated eval run
```

### Plugin validation

[`docs/capstone/evidence/plugin-validation.txt`](docs/capstone/evidence/plugin-validation.txt): `claude plugin validate`
passes (0 errors, 0 warnings with `--strict`), and a headless session started with `--plugin-dir` lists both
slash commands and all five agents (`ticket-to-merge:test-writer`, `implementer`, `review-correctness`,
`review-security`, `review-verifier`).

```
ticket-to-merge/
├── .claude-plugin/plugin.json
├── skills/ship-ticket/SKILL.md      skills/review-pr/SKILL.md
├── agents/  test-writer · implementer · review-correctness · review-security · review-verifier
├── hooks/   hooks.json · protect.js (+ protect.test.mjs, package.json → CommonJS)
├── scripts/ tests-gate.mjs (RED lock / verify / Stop gate) · cost-by-stage.mjs
└── evals/   answer-key.json · cases/{planted-a,clean-b} · oracle.test.ts · run-eval.sh · score.mjs
```

## 2. BOOK-101 — implementation and tests

Interface (the brief left it as a placeholder; derived from the app and confirmed with the repo owner, see `SPEC.md`):
`GET /api/books/search?q=` → `200 Book[]` (same shape/order as `GET /api/books`), `400 {"error"}` when the trimmed
query exceeds 100 characters or `q` is repeated; the existing HTMX route `GET /books/search?q=` now renders the
`book-grid` fragment (400 → `<p class="error">`). `searchBooks()` trims, validates, returns all books for an empty
query, and uses a parameterised `LIKE ? ESCAPE '\'` (so `%`/`_` match literally).

Built by `/ticket-to-merge:ship-ticket` (official run: [`docs/capstone/runs/build-report.md`](docs/capstone/runs/build-report.md)):

| Step | Evidence |
|---|---|
| RED | `Tests 26 failed | 25 passed (51)` before any implementation — failures were 404s / missing export / wildcard behaviour, not syntax ([`tdd-red-lock-green.txt`](docs/capstone/evidence/tdd-red-lock-green.txt)). The orchestrator sent the test-writer back once for two weak tests. |
| Lock | `tests/models/search.test.ts` sha256 `0cbb91b5…`, `tests/routes/search.test.ts` `09522eaa…` — still identical after the run |
| GREEN | `GATE finish`: 51/51, locked tests unchanged, protected files unchanged; `package.json`/lock/`schema.sql` diff empty |
| Independent check | `npm run test:run` → **5 files, 51 tests passed** ([`test-run-green.txt`](docs/capstone/evidence/test-run-green.txt)) |

Acceptance criteria → tests (37 new tests in 2 files; mapping from the completion report): AC1 (title/author, partial, case-insensitive) 9 tests · AC2 (empty → all) 7 · AC3 (trim,
100 ok, 101 → 400, padded 100 ok) 8 · AC4 (injection payloads, literal wildcards, placeholder source check) 9 ·
HTMX route 3 · AC5 whole suite green.

## 3. Guardrails

**Hook** — `hooks/hooks.json` → `PreToolUse` matcher `Edit|Write|MultiEdit|NotebookEdit|Bash`, exec form
`node ${CLAUDE_PLUGIN_ROOT}/hooks/protect.js`, `onFailure: block`, exit 2 to block. It protects `bookshelf.db*`,
`seed.sql`, `.env*` and the locked acceptance tests, and fails closed on unparseable input. Beyond literal names it
blocks: quoting/escaping/case tricks, globs and brace expansion that could match a protected name, destructive commands
on a parent directory, `git clean -x` / `stash -u` / `reset --hard`, base64/xxd/eval/`$a$b`/`rev`/`printf %b`
indirection, and inline interpreter code (`python -c`, `node -e`, `perl -e`, …) that writes, deletes or spawns.
Edit/Write paths are resolved (relative, `..`, case-insensitive, symlinks). A backstop in `tests-gate.mjs` hashes the
protected files when a run starts and fails the gate if any changed, however it happened.

| Check | Result |
|---|---|
| Unit tests (`node --test ticket-to-merge/hooks/protect.test.mjs`) | 82/82: 55 bypass attempts blocked, 20 legitimate commands allowed, Edit/Write variants, fail-closed |
| Live round 1 (headless haiku told to attack, Bash pre-approved, disposable worktree) | 9 blocked, **1 bypass found**: `python3 -c "open(\".e\"+\"nv\",\"w\")…"` created `.env` → fixed ([round 1](docs/capstone/evidence/guardrail-live-round1.md)) |
| Live round 2 (after fix) | 8/8 blocked incl. Write `.env` and Edit `seed.sql` after a Read, `perl unlink ".e"."nv"`, `node writeFileSync("boo"+"kshelf.db")`, `ln -s`; control allowed; checksums unchanged ([round 2](docs/capstone/evidence/guardrail-live-round2.md)) |
| Reviewers can't edit | Reviewer agents have `tools: Read, Grep, Glob` only (plugin agents ignore `permissionMode`/hooks, so read-only comes from `tools`). Live: review-security asked to append to `src/server.ts` made 0 tool calls; `git diff` empty |
| Tests read-only while implementing | `GATE lock` records sha256; protect.js blocks Edit/Write/redirect/rm/sed on locked files; `GATE check/finish` fails if a hash changed; a subagent cannot run the gate (`agent_id` check) |
| Gate on done | `Stop` hook → `tests-gate.mjs stop-check`: while a ship-ticket run is armed it blocks stopping until `GATE finish` (green suite + unchanged locked/protected files) or `abort`; inert otherwise |

Two defects were found by testing and fixed: the repo's `"type": "module"` made `protect.js` crash as ESM — exit 1
is *non-blocking*, so the guardrail was silently open (fixed with `hooks/package.json` → CommonJS); and a `\brev\b`
rule blocked `git rev-parse`, which review-pr itself needs (found by the eval pilot; regression tests added).
Residual risk: lexical matching cannot stop every program that computes a path at runtime (e.g. a script file
written with an obfuscated name and run later); the gate's protected-file hash check detects that after the fact.

## 4. Review evaluation — planted bugs, 3 runs

**Dataset** ([`ticket-to-merge/evals/`](ticket-to-merge/evals/)), applied on top of `main` in a fresh worktree; each
run loads a copy of the plugin **without** `evals/`, so the answer key is never reachable by the reviewers.

- **planted-a** — a realistic "book stats" feature branch (new model + 5 routes) with 4 planted bugs: **B1** off-by-one
  `OFFSET page*pageSize` for 1-based pages · **B2** raw `?sort=` interpolated into `ORDER BY` (SQL injection) ·
  **B3** range check `rating < 1 && rating > 5` (never true → 500 instead of 400) · **B4** stored XSS, `display_name`
  in a `res.send` HTML fragment. Decoys that look risky but are correct: whitelisted `ORDER BY` column, bound
  `LIMIT`/`HAVING`, clamped limit, histogram zero-fill, pagination validation.
- **clean-b** — the same feature with every bug fixed (control: every finding is a false positive unless proven real).
- Ground truth is executable: [`oracle.test.ts`](ticket-to-merge/evals/oracle.test.ts) fails B1–B4 on planted-a and
  passes 5/5 on clean-b ([`oracle-planted-a.txt`](docs/capstone/evals/oracle-planted-a.txt), [`oracle-clean-b.txt`](docs/capstone/evals/oracle-clean-b.txt)).
- Scoring ([`score.mjs`](ticket-to-merge/evals/score.mjs)): auto-match = same file + line in range ±3 + a bug keyword;
  every other finding gets a written manual verdict (`TP:Bx`, `REAL` unplanted, or `FP`) in `adjudication.json`.
  Nothing is dropped. Debatable findings were counted as FP.

**Official results — review-pr ×3 per scenario** (orchestrator sonnet, reviewers sonnet, verifier sonnet) —
[`docs/capstone/evals/baseline/SCORE.md`](docs/capstone/evals/baseline/SCORE.md):

| Run | Planted bugs found | Findings | Real | Cost |
|---|---|---|---|---|
| planted-a run 1 | B1 B2 B3 B4 (4/4) | 4 | 4 | $0.4977 |
| planted-a run 2 | B2 B3 B4 (3/4) | 3 | 3 | $0.4372 |
| planted-a run 3 | B1 B2 B3 B4 (4/4) | 4 | 4 | $0.3759 |
| clean-b run 1 | — | 0 | 0 | $0.4558 |
| clean-b run 2 | — | 1 | 0 | $0.4568 |
| clean-b run 3 | — | 2 | 0 | $0.4710 |

- **Recall 92%** (11/12 planted-bug detections over 3 runs; B1 missed once — the correctness reviewer did not report it, the verifier rejected nothing).
- **Precision 79%** (11/14 findings real, pooled over all 6 runs). On planted-a alone 11/11; the 3 false positives
  are on clean code: "`/books/:id/reviews` doesn't 404 like its sibling" (×2; it matches the pre-existing
  `/api/reviews/book/:id` behaviour) and "`page=0` silently becomes 1" (lenient default).
- Brief formula on these runs: recall 6 × 0.92 = 5.5 · precision 4 × 11/14 = 3.1.

**History (kept, not discarded):** a pilot run found a hook false positive and background-agent polling (both fixed),
and v1 of the reviewers scored recall 100% / precision 67% (12/18; all 6 FPs on lenient defaults, NaN ids already
handled, and sibling inconsistency) — [`baseline-v1/SCORE.md`](docs/capstone/evals/baseline-v1/SCORE.md). That led to
explicit reject classes in the verifier (generic, not tied to these bugs). v2 is the official configuration above.

## 5. Cost report

Measured by Claude Code itself (`total_cost_usd` and per-model `costUSD` in the headless result event, list prices).
Stages are split by [`cost-by-stage.mjs`](ticket-to-merge/scripts/cost-by-stage.mjs) from the session transcripts:
token totals reconcile exactly with `modelUsage`, and each model's measured cost is apportioned by price-weighted tokens
(ratios 1 : 5 : 0.1 : 1.25/2 for input : output : cache read : cache write), so stages sum to the measured total.

**One ticket — BOOK-101, official run** ([`build-cost.md`](docs/capstone/runs/build-cost.md)):

| Stage | Cost | Cache hit | Models |
|---|---|---|---|
| Build (plan, RED tests, lock, implement, gate) | $1.5246 | 91.7% | opus 5 (orchestrator), sonnet 5 (test-writer, implementer) |
| Review (2 reviewers in parallel; verifier skipped: 0 candidates) | $0.3511 | 88.5% | opus 5 (orchestrator), sonnet 5 (reviewers) |
| Fix loop | $0.00 | — | not entered: review returned 0 confirmed findings |
| **Total, one ticket** | **$1.8757** | | 5.2 min, 29 turns |

Context: a first build attempt cost **$2.3817** (build $1.9332, review $0.4485) and stopped after review because of
a plugin defect (nested skill ended the run; fixed — see §7); its review confirmed 2 medium findings that were never
fixed. Including it, BOOK-101 cost $4.2574 end to end. A standalone `/review-pr` on the planted-bug branch costs
$0.38–$0.50 (mean $0.4491, 6 runs, sonnet orchestrator) before the adopted lever and $0.27–$0.39 (mean $0.3128) after it.

Cache hit = cache_read / (input + cache_read + cache_write). `/usage` in an interactive session reports the same
accounting; these runs were headless, so the figures come from their result events rather than a `/usage` screen.

### One lever (and one that failed)

Measured per-agent split of a baseline review run (`docs/capstone/evals/baseline/planted-a-run1/cost.md`):
orchestrator **$0.41**, verifier $0.05, each reviewer $0.02. The orchestrator spent ~13 turns re-reading its cached
context and ~12k output tokens, mostly retyping the diff into three agent prompts. So the cost lever has to target the
orchestrator, not the reviewers, and the first attempt shows why:

| Configuration (3 runs × planted-a + 3 × clean-b each) | Recall | Precision | Mean cost / review | Δ cost |
|---|---|---|---|---|
| Baseline v2 — sonnet reviewers, orchestrator collects the diff with git and pastes it ([SCORE](docs/capstone/evals/baseline/SCORE.md)) | 92% (11/12) | 79% (11/14) | $0.4491 | — |
| Lever tried first: **cheaper reviewer model** (reviewers → `haiku`) ([SCORE](docs/capstone/evals/lever-haiku/SCORE.md)) | 100% (12/12) | 80% (12/15) | $0.6211 | **+38%** ✗ |
| **Adopted lever: deterministic diff collection** (`scripts/collect-diff.mjs`: one command writes the diff to a file; reviewers Read it; the orchestrator never retypes it) ([SCORE](docs/capstone/evals/lever-diffscript/SCORE.md)) | 100% (12/12) | 71% (12/17) | **$0.3128** | **−30%** ✓ |

- **Why the cheaper model failed:** the `haiku` alias resolved to `claude-haiku-4-5`, which wrote 2–4× more output
  (up to 43k tokens on the clean branch) and gave the sonnet verifier more to re-check; it could only ever touch the
  ~10% of cost the reviewers represent. Not adopted.
- **Why the adopted lever works:** orchestrator turns 13 → 5, orchestrator cost $0.41 → $0.16, output 12k → 2.6k
  tokens (`lever-diffscript/planted-a-run1/cost.md`). Fewer tokens, same agents, same models.
- **Did quality hold?** Tests: re-run after the lever, 51/51 green; hook tests 82/82; plugin validates. Planted bugs:
  recall held (100% vs 92%; B1 was found in all 3 runs). Precision moved **down 8 points** (79% → 71%): 5 false positives
  instead of 3, all on clean-b and all in the same classes as before (lenient `||` defaults ×3, "no 404 like its
  sibling", a bound NaN id). With 3 runs per side this is within the run-to-run spread seen in v1/v2 (clean-b produced
  0–3 FPs per run in every configuration), so I read it as noise-level, but it is reported as measured.
  On the brief's formula the lever scores 6.0 + 2.8 = 8.8 vs 5.5 + 3.1 = 8.6 for the baseline, at 70% of the cost.
- The lever is in the shipped plugin. The official build run above predates it (its review stage used the baseline
  diff-pasting flow); ship-ticket's review step now uses the same script, which was not re-measured in a full build.

## 6. Design

**Decomposition — split by role, not by layer.** BOOK-101 touches one model function and two thin routes that share it;
splitting builders by layer would put two agents on the same validation rule and require coordination for ~50 lines.
What *does* need separation is the incentive structure:

| Agent | Why it exists | Tools | Model |
|---|---|---|---|
| Orchestrator (skill in main session) | Owns judgement: validates the ticket, plans, checks RED is the *right* red, runs gates, decides which findings to fix | all | session model (opus in the evidence run) |
| test-writer | Tests are the spec. Written in a separate context from the implementation so they can't be shaped to fit it | Read Grep Glob Write Edit Bash | sonnet |
| implementer | GREEN and FIX. Can't edit locked tests (hook + hash gate) | Read Grep Glob Write Edit Bash | sonnet |
| review-correctness | Logic, contracts, boundaries, documented-contract violations | **Read Grep Glob** | sonnet |
| review-security | Injection, validation, unsafe output, data exposure | **Read Grep Glob** | sonnet |
| review-verifier | Precision: re-opens every candidate, tries to refute it, merges duplicates | **Read Grep Glob** | sonnet |

- Two reviewer lenses run in parallel. Measured overlap is high (both usually report B2/B3/B4), but B1, the logic
  bug, came only from the correctness lens, and the security lens is the more reliable one for injection/XSS. The
  verifier exists because recall-oriented reviewers over-report: in clean-b run 1 it rejected all 3 candidates, and
  its reject classes moved pooled precision from 67% (v1) to 79% (v2).
- No parallel builders → no worktree isolation needed; parallelism is only in read-only review.
- Models: nothing in build or review needed the largest model (brief: "tests and boilerplate rarely need the biggest
  model"); the orchestrator is the only place where a stronger model buys judgement (it caught two weak RED tests).
- Gates are deterministic scripts, not prompts: test lock hashes, protected-file hashes, Stop hook.

**What I'd cut:** the cheaper-reviewer-model idea (measured: it costs more); further orchestrator turns in
ship-ticket (the build orchestrator on opus is ~70% of the ticket's cost — a sonnet orchestrator is the next lever to
measure); and the separate test-writer → implementer hand-off for tickets this small, if the hash-lock gate is kept.
The verifier is the last thing I'd cut (it is the precision lever). For a one-file ticket,
a single reviewer with both checklists would probably do; I kept two because the graders' branch is unknown.

## 7. What went wrong and what it taught (evidence kept)

| Found by | Defect | Fix |
|---|---|---|
| hook unit tests | `protect.js` crashed as ESM (repo `"type":"module"`) → exit 1 = non-blocking | `hooks/package.json` CommonJS |
| live bypass round 1 | escaped-quote string concatenation in `python3 -c` | inline-interpreter write/delete/spawn rule, concat detection, gate backstop |
| eval pilot | `\brev\b` blocked `git rev-parse`; reviewers ran in background → polling | command-only `rev` rule + tests; foreground dispatch |
| build attempt 1 | nested `review-pr` skill ended the ship-ticket run before the fix loop; Stop hook let it stop because tests were green | review steps run inline; Stop gate blocks while a run is armed but unfinished |
| baseline v1 | 6 FPs (lenient defaults, sibling inconsistency, already-handled NaN) | verifier reject classes |

## 8. Limitations

- The fork URL above must be filled in; nothing was pushed.
- The official build's review found 0 findings, so the fix loop's cost is $0 in that run; the fix path itself was
  exercised only partially (attempt 1 reached a confirmed-findings review but stopped before fixing).
- The eval uses one planted-bug branch (4 bugs) and one clean control; 3 runs each. Variance is visible (B1 was found in 2 of 3 official runs).
- Eval branches are applied as uncommitted changes (commits by the agent are blocked in this repo); review-pr uses the
  same `git diff <base>` path for committed and uncommitted changes.
- `?q[a]=b` (object-shaped `q`) returns all books with 200; SPEC does not define it.

---

# Agent Bookshelf — original application README

```
╔═════════════════════════════════════════════╗
║│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│║
╠═════════════════════════════════════════════╣
║                                             ║
║     ▄▀█ █▀▀ █▀▀ █▄░█ ▀█▀                    ║
║     █▀█ █▄█ █▄▄ █░▀█ ░█░                    ║
║                                             ║
║     █▄▄ █▀█ █▀█ █▄▀ █▀ █░█ █▀▀ █░░ █▀▀      ║
║     █▄█ █▄█ █▄█ █░█ ▄█ █▀█ █▄▄ █▄▄ █▀░      ║
║                                             ║
║  a goodreads-lite playground for AI agents  ║
║                                             ║
╠═════════════════════════════════════════════╣
║│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│║
╚═════════════════════════════════════════════╝
```

# Agent Bookshelf

A Goodreads-lite application designed as a teaching playground for AI agents courses. Students install it locally and use AI agents (Claude Code, etc.) to complete homework assignments.

## Prerequisites

**Node.js 24 LTS** is required.

| OS | Install |
|---|---|
| **macOS** | Download `.pkg` from [nodejs.org](https://nodejs.org) — Universal binary (Intel + Apple Silicon) |
| **Windows** | Download `.msi` from [nodejs.org](https://nodejs.org) — tick "Tools for Native Modules" during install |
| **Linux** | `curl -fsSL https://deb.nodesource.com/setup_24.x \| sudo -E bash - && sudo apt-get install -y nodejs` |

Verify:

```bash
node -v   # should print v24.x.x
npm -v    # should print 11.x.x
```

## Quick Start

### Using npx

```bash
corepack enable
npm install
npm run build
npx agent-bookshelf
```

That's it! The app will start at http://localhost:3000 with pre-seeded data.

## What is this?

Agent Bookshelf is a deliberately structured teaching codebase where:

- **Students** get an easy-to-install app that works immediately
- **AI agents** get a familiar, well-structured codebase to work with
- **Homework gaps** are built in for agents to fill

### Features

- Browse 50 pre-seeded books (tech and sci-fi)
- View book details with reviews and ratings
- Manage user shelves (want-to-read, currently-reading, read)
- Add reviews and ratings
- REST API for agent interaction
- HTMX-powered dynamic UI

### Pre-seeded Data

The app comes with:
- 50 books across tech and sci-fi genres
- 3 users: Alice Chen, Bob Martinez, Carol Okafor
- Sample shelves and reviews
- SQLite database (zero configuration)

## For Students

### Installation

**Prerequisites:** Node.js 20 or higher

**macOS / Linux:**
```bash
npx agent-bookshelf
```

**Windows:**
```bash
npx agent-bookshelf
```

The app will start automatically at http://localhost:3000

### Using the App

1. Browse books at http://localhost:3000
2. Click a book to see details and reviews
3. Visit /shelves to see user bookshelves
4. Add reviews and manage shelves through the UI

### For AI Agents

The app provides a REST API at `/api/*`:

```bash
# Get all books
curl http://localhost:3000/api/books

# Get a specific book
curl http://localhost:3000/api/books/1

# Add a review
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "bookId": 5, "rating": 5, "reviewText": "Excellent!"}'

# Get user shelves
curl http://localhost:3000/api/shelves/user/1
```

See the API routes in `src/routes/api.ts` for full documentation.

## For Instructors

### Homework Gaps

The codebase includes deliberate gaps for homework assignments:

1. **Search functionality** - UI exists but backend is a TODO
   - Location: `src/routes/books.ts` line 14
   - Students can implement the search backend

2. **Missing tests** - Models have no test coverage
   - Location: `tests/` directory
   - QA homework: write test suites for models

3. **Input validation** - API endpoints lack validation
   - Location: `src/routes/api.ts`
   - Students can add validation middleware

4. **UI improvements** - Functional but minimal design
   - Location: `src/public/css/style.css`
   - PM homework: redesign specific components

### Architecture

- **Backend:** Express + TypeScript
- **Database:** SQLite via sql.js (WebAssembly, zero native dependencies)
- **Frontend:** EJS templates + HTMX
- **Testing:** Vitest (setup included, tests are homework)

### Project Structure

```
agent_bookshelf/
├── src/
│   ├── server.ts          # Express app + server
│   ├── db/
│   │   ├── schema.sql     # Database schema
│   │   ├── seed.sql       # Pre-seeded data
│   │   └── index.ts       # DB connection
│   ├── models/            # Data models (no tests - homework gap)
│   ├── routes/
│   │   ├── books.ts       # HTML routes
│   │   ├── shelves.ts
│   │   ├── reviews.ts
│   │   └── api.ts         # JSON API
│   ├── views/             # EJS templates
│   └── public/            # Static assets
├── tests/                 # Vitest setup (tests are homework)
├── bin/                   # CLI entry point
└── docs/adr/              # Architecture decisions
```

### Running Tests

```bash
npm test          # Run tests in watch mode
npm run test:run  # Run tests once
```

Note: The test setup is included, but actual tests are intentionally missing (homework gap).

## License

GPL-3.0

## Contributing

This is a teaching project. Contributions should maintain the deliberate gaps that make homework assignments possible.
