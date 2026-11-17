## Code Review: Search Feature

### Critical

**SQL Injection — `book-search.ts:9-11`**

```ts
export function searchBooks(query: string): BookSummary[] {
  const sql = `SELECT id, title, author FROM books WHERE title LIKE '%${query}%' OR author LIKE '%${query}%' ORDER BY title`;
  return all(sql) as unknown as BookSummary[];
}
```

`query` is interpolated directly into the SQL string instead of using the parameterized `all(sql, params)` API that `db.ts` already supports (and that `booksByAuthor` correctly uses on line 15). The `query` value flows straight from the unauthenticated HTTP handler in `search-route.ts` (`req.query.q`) with no sanitization, so this is a direct SQL injection vector — e.g. `q=' OR '1'='1` or `q='; DROP TABLE books;--` (if the underlying driver allows multi-statement execution) reaches the database verbatim.

Recommended fix:
```ts
export function searchBooks(query: string): BookSummary[] {
  const sql = `SELECT id, title, author FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY title`;
  const like = `%${query}%`;
  return all(sql, [like, like]) as unknown as BookSummary[];
}
```
This is inconsistent with the project's own convention one function below (`booksByAuthor`), which already demonstrates the correct parameterized pattern — making this bug even more clearly a defect rather than a stylistic choice.

### Medium

**No input validation / unbounded query — `search-route.ts:6-9`**
`req.query.q` is coerced to a string with no length limit and passed straight to `searchBooks`. Beyond the SQL injection issue above, an empty query (`q=''`) produces `LIKE '%%'`, effectively returning the entire `books` table with no pagination — a potential performance/DoS concern on large datasets. Consider enforcing a minimum query length and/or adding `LIMIT`/pagination.

**No error handling in route handler — `search-route.ts:6-9`**
If `searchBooks`/`all` throws (e.g., malformed query causing a SQL syntax error, which is now more likely given raw string interpolation), the Express handler has no try/catch, so Express's default error handling will take over. Not necessarily wrong, but there's no explicit handling, logging, or sanitized error response here — worth confirming it matches how other routes in the project handle errors (not shown in scope).

### Low / Maintainability

**Unsafe double cast — `book-search.ts:11, 15`**
Both functions use `all(...) as unknown as BookSummary[]`, bypassing type safety entirely (the `unknown` cast suppresses any structural mismatch the compiler might otherwise catch, e.g. if a column were renamed or dropped). This is a pattern smell rather than a bug per se, but it means type errors in the mapping from `Record<string, unknown>[]` to `BookSummary[]` are invisible to the compiler. Low priority since it's consistent across both functions, but a mapping function (e.g., `rows.map(r => ({ id: r.id as number, title: r.title as string, author: r.author as string }))`) would be safer.

### No issues found in `db.ts`
The declared helper signatures (`get`, `all`, `run`, `saveDb`) are straightforward ambient declarations with no implementation in scope; nothing actionable to flag there. The parameterized-query support (`params?: unknown[]`) is present and correctly used by `booksByAuthor`, confirming the fix recommended above is consistent with existing helper capabilities.

---

**Summary:** The primary and only critical finding is the SQL injection vulnerability in `searchBooks` (`book-search.ts:10`), caused by string interpolation of unsanitized user input (`req.query.q` from `search-route.ts:7`) into a raw SQL query, while a parameterized alternative is available and used correctly elsewhere in the same file. This should be fixed before shipping. Secondary, lower-severity concerns are the lack of input validation/limits in the route handler and the unchecked type casts in `book-search.ts`.