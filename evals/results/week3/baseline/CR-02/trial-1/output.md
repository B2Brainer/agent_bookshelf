## Review of shelf-service.ts (against db.ts helpers)

### High Severity

**1. Off-by-one pagination bug — `listShelfBooks` (shelf-service.ts:5-12)**
```ts
// Pages are 1-based: page 1 is the first page.
const offset = page * PAGE_SIZE;
```
The comment states page 1 is the first page, but the offset calculation does not subtract 1. With `page = 1`, `offset` evaluates to `20` (PAGE_SIZE), which skips the actual first 20 rows — the "first page" returned is really page 2's data. The first page of results is never reachable.

Fix: `const offset = (page - 1) * PAGE_SIZE;`

**2. Data loss on invalid target shelf — `moveBook` (shelf-service.ts:14-24)**
```ts
run('DELETE FROM shelf_books WHERE shelf_id = ? AND book_id = ?', [fromShelfId, bookId]);

const target = get('SELECT id FROM shelves WHERE id = ?', [toShelfId]);
if (!target) {
  return false;
}

run('INSERT INTO shelf_books (shelf_id, book_id) VALUES (?, ?)', [toShelfId, bookId]);
```
The book is unconditionally deleted from `fromShelfId` before the existence of `toShelfId` is validated. If `toShelfId` does not correspond to a real shelf, the function returns `false`, but the book has already been removed from its original shelf and is now orphaned (on no shelf at all). The caller has no way to tell from the `false` return value that a mutation already happened.

Fix: validate `toShelfId` with `get(...)` first, return `false` early if missing, and only then perform the delete + insert. Ideally wrap both `run()` calls in a transaction (if `db.ts`/the underlying sql.js wrapper supports one) so a failure between delete and insert cannot leave the book un-shelved.

### Medium Severity

**3. Mutations never call `saveDb()`**
`db.ts` exports `saveDb()` as a separate function from `run()`, implying persistence to disk is not automatic per `run()` call (sql.js keeps the DB in memory until explicitly saved). `moveBook` performs two `run()` calls but never calls `saveDb()`, so the change may not survive process restarts if that is the intended persistence model. I could not confirm the project convention since no other call sites exist in the reviewed scope — flagging as worth verifying against how other services in the codebase use `run`/`saveDb` together.

**4. No input validation**
- `listShelfBooks`: no guard against `page <= 0`; combined with finding #1, a `page` of 0 or negative produces a negative `OFFSET`, which is likely invalid SQL/undefined behavior for sql.js.
- `moveBook`: `fromShelfId` is never validated to exist (a no-op `DELETE` is arguably fine, but it means callers can "move" a book that was never on `fromShelfId`, silently succeeding). `bookId` is not validated to exist either, so a non-existent book can be "inserted" into `toShelfId` without error.

### Low Severity / Style

**5. Non-descriptive variable name — `shelfLabel` (shelf-service.ts:26-29)**
```ts
const tmp = name.trim();
return `${tmp} (${count})`;
```
`tmp` is uninformative; rename to something like `trimmedName` for readability/maintainability. Minor, no functional impact.

### Summary
No issues found in `db.ts` itself — it is a pure type-declaration file and is internally consistent (`get`/`all`/`run`/`saveDb` signatures are reasonable and match usage in `shelf-service.ts`). The substantive defects are in `shelf-service.ts`: the pagination off-by-one (#1) and the delete-before-validate ordering in `moveBook` (#2) are the two confirmed correctness bugs; items #3 and #4 are worth confirming against broader project conventions since they weren't fully observable within the given scope.