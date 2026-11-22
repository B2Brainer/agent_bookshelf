# SPEC — BOOK-101 · Search books by title or author

Source: Capstone Brief "Ticket to Merge" (Wave 3), slide "THE TICKET".
The brief leaves the interface as a placeholder (`[endpoint and response shape]`).
The interface below is derived from the existing application and was confirmed by
the repo owner: it fills the existing HTMX stub and adds a JSON route that follows
the conventions of the existing `/api/books` routes.

## Interface

### 1. JSON API — `GET /api/books/search?q=<query>`

| Case | Status | Body |
|---|---|---|
| Valid query (after trim, length 0–100) | `200` | `Book[]`, same object shape as `GET /api/books`, ordered by `title` |
| Trimmed query longer than 100 characters | `400` | `{ "error": "<message>" }` (message mentions 100) |
| `q` missing or empty / whitespace only | `200` | all books (50 with the seed data) |
| `q` given more than once (`?q=a&q=b`) | `400` | `{ "error": "<message>" }` |

`Book` = `{ id, title, author, isbn, cover_url, description, published_year, created_at }`.
The route must be registered before `GET /api/books/:id` so `search` is not parsed as an id.

### 2. HTML (HTMX) — `GET /books/search?q=<query>`

Existing route used by the search box on `/` (`hx-get="/books/search"`, input `name="q"`,
target `#search-results`). Replace the "coming soon" stub with an HTML fragment that renders
the matching books with the same `book-grid` / `book-card` markup as `views/books/index.ejs`.
A trimmed query over 100 characters returns status `400` with a short error fragment
(`<p class="error">…</p>`, the existing error-fragment convention in `routes/books.ts`).
No matches renders an empty-state message.

### 3. Model — `searchBooks(query: string): Book[]` in `src/models/book.ts`

Keeps its exported name and signature. Both routes use it. Input validation lives in one place
(the model) so the rules cannot drift between routes: it trims, rejects > 100 characters by
throwing a `SearchValidationError`, and the routes map that error to `400`.

## Acceptance criteria → verification

| # | Criterion (brief) | Verification (Vitest, `npm run test:run`) |
|---|---|---|
| AC1 | A query matches title **or** author: partial, case-insensitive | API + model tests: title substring (`"pragmatic"` → *The Pragmatic Programmer*), author substring (`"KNUTH"` → *The Art of Computer Programming*), mixed case, no-match → `[]` |
| AC2 | An empty query returns all books | `q=""`, `q` missing, `q="   "` → 50 books, same order as `GET /api/books` |
| AC3 | Input is trimmed; over 100 characters returns a validation error | `"  dune  "` equals `"dune"`; exactly 100 chars → 200; 101 chars → 400 `{error}`; 100 chars + surrounding spaces → 200 (trim happens before the length check) |
| AC4 | SQL is parameterised: no string-built queries | Injection payloads (`' OR 1=1 --`, `%' OR '1'='1`) return `[]` and do not error; LIKE wildcards in input (`%`, `_`) match literally; source check that `searchBooks` binds the query via `?` placeholders |
| AC5 | Vitest covers each criterion; `npm run test:run` passes | Whole suite green (existing 14 tests + new BOOK-101 tests) |
| — | HTMX route renders results | `GET /books/search?q=dune` → 200 HTML containing *Dune*; 101 chars → 400 |

## Constraints (enforced, not just requested)

- No schema changes: `src/db/schema.sql` untouched (`git diff main -- src/db/schema.sql` empty).
- No new dependencies: `package.json` / `package-lock.json` untouched.
- Never touch `bookshelf.db*`, `src/db/seed.sql`, `.env`: blocked by the plugin hook
  `ticket-to-merge/hooks/protect.js` (Edit/Write/MultiEdit/NotebookEdit/Bash, exit 2).
- Keep the interface exactly as specified above.
- Acceptance tests are locked while implementing: the plugin hook blocks writes to locked test
  files, and the ship-ticket gate fails if their sha256 changed after the RED step.

## Out of scope

Pagination, ranking, searching other fields (ISBN, description), full-text search, Unicode
case folding beyond SQLite's built-in ASCII `LIKE` behaviour, UI redesign.

## Done when

1. `npm run test:run` is green and includes tests for AC1–AC4 plus the HTMX route.
2. The acceptance tests were shown failing before implementation (RED evidence recorded).
3. The independent review loop reports no verified high/medium findings.
4. Constraint checks above pass.
