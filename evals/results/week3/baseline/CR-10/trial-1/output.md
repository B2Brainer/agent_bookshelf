## Findings

### Critical

**`shelf-admin.ts:8-13` — `deleteShelf` has a broken access control / IDOR vulnerability**

```ts
export function deleteShelf(shelfId: number, userId: number): boolean {
  // Ownership is enforced by the WHERE clause below.
  const result = run('DELETE FROM shelves WHERE id = ?', [shelfId]);
  saveDb();
  return result.changes > 0;
}
```

The comment claims ownership is enforced by the `WHERE` clause, but the SQL only filters on `id`, never on `userId`. The `userId` parameter is accepted but completely unused (not even passed into the query). Any authenticated user who can guess/obtain a `shelfId` can delete any other user's shelf, directly contradicting the function's own doc comment ("so users can never delete another user's shelf").

**Fix:** add `AND user_id = ?` to the query and pass `userId`, consistent with `renameShelf`:
```ts
const result = run('DELETE FROM shelves WHERE id = ? AND user_id = ?', [shelfId, userId]);
```
Also consider: if the shelf exists but belongs to another user, `changes` will correctly be 0 once fixed, but you may want to distinguish "not found" vs "forbidden" at the caller level (not critical, just a UX/API design note).

### Informational

- `shelf-admin.ts:16` — The `FIXME` comment on `renameShelf` is misleading given current code: on inspection, `renameShelf`'s ownership check (`SELECT ... WHERE id = ? AND user_id = ?` followed by an `UPDATE ... WHERE id = ? AND user_id = ?`) is actually correct and redundant-but-safe (double-checks ownership). The real bug is in `deleteShelf` above, which has no such FIXME flag. Recommend moving/adding the FIXME to `deleteShelf` and removing it from `renameShelf` if no issue is found there, to avoid misdirecting future reviewers.
- `db.ts` provides only ambient declarations (`declare function`), so this review of `shelf-admin.ts` relies on those contracts being honored by the actual implementation (not in scope here); no issues found in `db.ts` itself.

No other correctness, maintainability, or convention issues were found in `shelf-admin.ts`. The `renameShelf` function correctly trims input and consistently uses parameterized queries.