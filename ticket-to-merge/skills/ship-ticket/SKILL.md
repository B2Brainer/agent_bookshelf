---
name: ship-ticket
description: Ship one ticket from spec to merge-ready - validate the ticket, plan, write failing acceptance tests, lock them, implement until green, review with read-only agents, fix verified findings, and gate on a passing suite. Use when asked to implement or ship a ticket.
argument-hint: "[ticket file or ticket text] (default: SPEC.md)"
disable-model-invocation: true
---

# /ticket-to-merge:ship-ticket

You are the orchestrator. You plan, dispatch subagents, run gates and decide; the subagents write code.
Ticket: `$ARGUMENTS` (if empty, use `SPEC.md` at the repository root).

Gate script (run with Bash, from the repository root): `node "${CLAUDE_PLUGIN_ROOT}/scripts/tests-gate.mjs" <cmd>`
— referred to below as `GATE`. If `${CLAUDE_PLUGIN_ROOT}` was not substituted, locate it with
`ls ~/.claude/plugins/*/ticket-to-merge*/scripts/tests-gate.mjs` or the `--plugin-dir` path.

Hard rules for the whole run:
- The run ends only after step 9. A Stop hook blocks stopping while the gate is armed; finish with `GATE finish`
  (or `GATE abort` when the loop limit is reached) before writing the report.
- Never modify database files, seed data, `.env*`, the schema, or `package.json`/lock files. A hook enforces part of this.
- Never edit a locked acceptance test, and never ask a subagent to.
- Never claim a step passed without running its command and reading the output.
- Do not commit, push, or create branches; leave the changes in the working tree for the human.

## 1. Read and validate the ticket

Read the ticket and `CLAUDE.md`. Extract: acceptance criteria, interface (endpoint/function, inputs,
status codes, response shape), constraints, and the test command (default `npm run test:run`).
If the interface or any criterion is ambiguous or missing, STOP and report exactly what is missing.
Do not guess an interface. Then run `git status --short` and save the list of files that were already modified or
untracked before this run (PRE_EXISTING); record `BASE=$(git rev-parse HEAD)`. Run `GATE start --test-cmd "<test command>"`.

## 2. Inspect and plan

Read the code the ticket touches (routes, models, views, existing tests and their setup patterns).
Write a short plan: files to change, the function/route signatures, where validation lives, and the
test file path(s) to create (new files only, e.g. `tests/routes/<feature>.test.ts`). Keep it minimal;
reuse existing helpers and conventions.

## 3. RED: acceptance tests first

Dispatch `ticket-to-merge:test-writer` with the ticket path, the interface, the test command, the test
file path(s), and the existing test files to imitate. When it returns, run the test command yourself and
confirm: the new tests fail because the feature is missing (not syntax/import errors in the tests), and
all pre-existing tests still pass. If not, send it back once with the exact problem.
Check that every acceptance criterion has at least one test. Then lock the tests:
`GATE lock <test files...>` and save the RED output summary for the report.

## 4. GREEN: implement

Dispatch `ticket-to-merge:implementer` with the ticket path, your plan, the locked test paths and the
test command. Tests are read-only for it.

## 5. Verify

Run `GATE check` (locked tests unchanged + full suite). Also run
`git diff --stat $BASE -- package.json package-lock.json src/db/schema.sql` (must be empty).
If anything fails, send the implementer the failing output and repeat steps 4-5 (max 3 attempts).

## 6. Independent review

Do NOT invoke the review-pr skill (a nested skill's output step ends this run). Instead Read
`${CLAUDE_PLUGIN_ROOT}/skills/review-pr/SKILL.md` and perform its steps 1-3 yourself (resolve the diff,
dispatch the two read-only reviewers in parallel in the foreground, merge, dispatch the verifier) with the
arguments `$BASE -- <files this run created or changed>` (current `git status --short` files minus
PRE_EXISTING, i.e. the ticket's source and test files). Keep the confirmed findings as JSON in your notes,
print a one-line round summary, and continue straight to step 7. This is not the end of the run.

## 7. Fix verified findings

Evaluate each confirmed finding against the ticket yourself: a finding that contradicts the spec
or is out of scope is recorded as "won't fix" with the reason. Send the rest (all high and medium,
and low ones that are cheap and in scope) to `ticket-to-merge:implementer` in FIX mode.
If a valid finding exposes a missing acceptance case, dispatch `ticket-to-merge:test-writer` to add it in
a NEW test file, confirm it fails, `GATE lock` it, then fix.

## 8. Loop until the gates pass

Repeat steps 5-7 (max 3 review rounds). Done means ALL of:
- `GATE check` passes (suite green, locked tests unchanged);
- constraint diff from step 5 is empty;
- the latest review has no confirmed high or medium findings that you accepted as valid.
Then run `GATE finish`. If the limit is reached first, run `GATE abort` and report the run as NOT done.

## 9. Completion report

Reply with a concise report:
- Ticket and outcome (DONE / NOT DONE) and the base SHA.
- Files changed (`git diff --stat $BASE` plus new untracked files).
- RED evidence: command and failing counts before implementation, per criterion.
- GREEN evidence: final `GATE finish` output (pass counts, locked tests unchanged).
- Review rounds: findings per round, what was fixed, what was rejected and why.
- Acceptance criteria → test names mapping.
- Open risks or follow-ups, if any.
