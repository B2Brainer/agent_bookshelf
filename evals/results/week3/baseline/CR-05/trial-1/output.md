## Findings

### High Severity

**Missing `saveDb()` call in `addBookToShelf` — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-PNBFl9/shelf-books.ts:16-19`**

```ts
export function addBookToShelf(shelfId: number, bookId: number): boolean {
  const result = run('INSERT OR IGNORE INTO shelf_books (shelf_id, book_id) VALUES (?, ?)', [shelfId, bookId]);
  return result.changes > 0;
}
```

Every other mutating function in this file (`removeBookFromShelf`, `clearShelf`) calls `saveDb()` after `run()` to persist the in-memory sql.js state to disk, per the comment at the top of the file ("sql.js keeps the database in memory. saveDb() writes the current state to disk."). `addBookToShelf` performs an INSERT but never calls `saveDb()`, so newly added shelf/book associations will be lost on process restart or whenever the DB is reloaded from disk, even though the in-memory state (and the return value) suggest the operation succeeded. This is inconsistent with the established convention in the same file and is a likely data-loss bug.

Recommended fix: add `saveDb();` after the `run(...)` call, before the `return`, mirroring `removeBookFromShelf`/`clearShelf`.

### Low Severity / Notes

- `getBooksOnShelf` (lines 6-8) is read-only, so appropriately has no `saveDb()` call — consistent.
- No other correctness issues found: parameter binding uses parameterized queries (no SQL injection risk), and `INSERT OR IGNORE` correctly handles duplicate shelf/book pairs assuming a unique constraint exists on `(shelf_id, book_id)` (not verifiable from the files reviewed, but not a defect in this file itself).

No other issues identified in `shelf-books.ts` or `db.ts` within the reviewed scope.