## Findings

**1. [High] `shelf-service.ts:6-7` — Off-by-one pagination bug contradicting its own comment**

```
// Pages are 1-based: page 1 is the first page.
const offset = page * PAGE_SIZE;
```

With `page=1` (the documented first page), `offset` becomes `20`, so the first 20 rows (the actual first page) are skipped and page 2's data is returned instead. The formula should be `(page - 1) * PAGE_SIZE` to match the stated 1-based contract.

**2. [High] `shelf-service.ts:15-23` — Data loss when target shelf does not exist**

`moveBook` deletes the `shelf_books` row for `fromShelfId` before verifying that `toShelfId` exists:

```
run('DELETE FROM shelf_books WHERE shelf_id = ? AND book_id = ?', [fromShelfId, bookId]);
const target = get('SELECT id FROM shelves WHERE id = ?', [toShelfId]);
if (!target) { return false; }
run('INSERT INTO shelf_books ...');
```

If `toShelfId` is invalid, the function returns `false`, but the book has already been removed from `fromShelfId` with no insertion into any shelf — the book silently disappears from the user's shelves. The target shelf should be validated before the delete runs (or the delete/insert pair should be wrapped in a transaction with rollback on failure).

**3. [Medium] `shelf-service.ts:15-23` — No transactional guarantee around delete+insert**

Even once the ordering in #2 is fixed, the delete and insert are two independent `run()` calls with no transaction. If the insert throws or the process is interrupted between the two statements, the book ends up on neither shelf. Consider wrapping both statements in a transaction (`BEGIN`/`COMMIT`/`ROLLBACK`) if the underlying `run`/db layer supports it, so the move is atomic.

**4. [Low] `shelf-service.ts:14-24` — No validation that `bookId` exists**

`moveBook` never checks that `bookId` refers to an existing book before deleting/inserting `shelf_books` rows. If `fromShelfId`/`bookId` don't correspond to an existing association, the function still proceeds to insert a `shelf_books` row for `toShelfId` as long as the target shelf exists, effectively "moving" a book that was never on the source shelf. This may be intentional, but it is not guarded or documented, and should either be validated explicitly or noted as intended behavior.