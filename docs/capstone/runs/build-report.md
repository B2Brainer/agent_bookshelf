# BOOK-101 — Search books by title or author

**Outcome: DONE.** Base SHA `a6468fa5644321c2137750432f40895c3b16543e`. Changes left uncommitted in the working tree.

## Files changed

Modified (49 insertions, 12 deletions):
- `src/models/book.ts` — added `SearchValidationError`; `searchBooks` now trims, rejects >100 chars, returns all books for an empty query, and escapes `\ % _` with an `ESCAPE '\'` clause
- `src/routes/api.ts` — `GET /api/books/search`, registered before `/books/:id`
- `src/routes/books.ts` — replaced the "coming soon" stub with a real HTMX fragment

New files:
- `src/views/books/search-results.ejs` — `book-grid`/`book-card` markup reused from `index.ejs`, `<%= %>` escaping, "No books found." empty state
- `tests/models/search.test.ts`, `tests/routes/search.test.ts` — the locked acceptance tests

## RED evidence

`npm run test:run` before implementation: **Test Files 2 failed | 3 passed (5); Tests 26 failed | 25 passed (51)**. All 14 pre-existing tests passed throughout. Failures were genuine (404 for the unregistered API route, missing `SearchValidationError` export, `%`/`_` matching everything, the "coming soon" stub) — no syntax or import errors.

I sent the test-writer back once, for two real defects in the first draft:
- The AC4 source check asserted `searchBooks` must not contain `${query}` anywhere, which would have rejected the correct, safe `` `%${query}%` `` pattern value. Rewritten to assert the invariant that matters: the SQL *string* carries `?` placeholders and no interpolation.
- The empty-state test only asserted the absence of `book-card`, so it passed against the stub and gave no RED signal. A positive `/no books found/i` assertion was added.

Locked after RED: sha256 `0cbb91b5…` and `09522eaa…`.

## GREEN evidence

`GATE finish`: locked tests 2 files **unchanged**, protected files unchanged, `npm run test:run` → **PASS (51/51)**. Constraint diff against base for `package.json`, `package-lock.json`, `src/db/schema.sql` is **empty**.

## Review

One round, both reviewers read-only and in parallel: correctness **0 findings**, security **0 findings** → no candidates, so the verifier was skipped per the skill. Nothing fixed, nothing rejected.

I spot-checked the one bypass the empty reports made worth confirming myself: `?q[a]=b` makes `req.query.q` an object, which `searchBooks` treats as `''` — it returns all books rather than skipping the length check or reaching the SQL.

## Acceptance criteria → tests

| AC | Tests |
|---|---|
| AC1 title/author, partial, case-insensitive | 4 model + 5 route tests (`"pragmatic"`, `"KNUTH"`, mixed case, no-match → `[]`) |
| AC2 empty query → all books | 3 model + 4 route (`q=""`, missing, `"   "` → 50 books, order matches `/api/books`) |
| AC3 trim + >100 validation | 4 model + 4 route (`"  dune  "`, 100 → 200, 101 → 400, 100 + spaces → 200) |
| AC4 parameterised SQL | 5 model + 4 route (injection payloads → `[]`, literal `%`/`_`, SQL-string source check) |
| HTMX route | 3 route tests (`q=dune` → 200 with `book-grid`/Dune, 101 chars → 400 fragment, empty state) |
| AC5 suite green | 51/51 |

## Open notes

- The repeated-`q` 400 relies on `Array.isArray`, which is Express's default `extended` query parsing. It's correct here, but it would silently change behaviour if the app's query parser setting were ever changed.
- Per the hard rules I did not commit, push, or branch — the changes are staged nowhere and ready for your review. `CLAUDE.md`, `SPEC.md`, `docs/capstone/` and `ticket-to-merge/` were already modified/untracked before this run and were left alone.
