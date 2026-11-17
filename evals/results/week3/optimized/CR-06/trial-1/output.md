**Critical — book-search.ts:10 — SQL injection.** `searchBooks` builds the query via direct string interpolation of user input (`req.query.q` from search-route.ts:7) into the SQL text, with no escaping. An attacker can inject arbitrary SQL (e.g. `q=%' OR '1'='1`, or UNION-based extraction, or `%'; DROP TABLE books;--` depending on sql.js statement execution semantics). This is especially severe since `db.ts` already exposes a parameterized `all(sql, params?)` API that `booksByAuthor` correctly uses on the very next lines — the vulnerable function is inconsistent with the established safe pattern in the same file.

Recommended fix: use a parameterized query, e.g.:
```ts
const sql = `SELECT id, title, author FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY title`;
return all(sql, [`%${query}%`, `%${query}%`]) as unknown as BookSummary[];
```

**Medium — search-route.ts:6-9 — No input validation/limits on `q`.** Any string (including empty string, which becomes `'%%'` and matches all rows) is accepted. There's no length cap or trimming, so pathologically large query strings could be used for inefficient wildcard scans or memory pressure. Not a security hole once the SQL injection is fixed, but worth bounding (e.g. reject/trim overly long `q`, or cap result count via `LIMIT` in `searchBooks`).

**Low — book-search.ts:10 — No escaping of LIKE wildcard metacharacters.** Even after parameterizing, user-supplied `%` and `_` characters in `query` are interpreted as SQL LIKE wildcards rather than literal characters, which can produce surprising/overbroad matches. Consider escaping `%`, `_`, and the escape character itself if literal matching is desired, or document that wildcard search is intentional.

No other actionable findings in `db.ts` (declarations only, consistent with usage) or in `search-route.ts` beyond the above.