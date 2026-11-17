## Findings

**Critical — shelf-admin.ts:10**
`deleteShelf` deletes a shelf using only `shelfId`, ignoring `userId` entirely. The docstring (lines 4-6) explicitly claims ownership is verified "so users can never delete another user's shelf," and the inline comment at line 9 asserts the WHERE clause enforces ownership, but the query `DELETE FROM shelves WHERE id = ?` contains no ownership check. This is a broken access control / IDOR vulnerability: any authenticated user can delete any other user's shelf by supplying its `shelfId`. The `userId` parameter is accepted but unused.

Recommended fix: match the pattern used in `renameShelf` — verify ownership before/while deleting, e.g. `DELETE FROM shelves WHERE id = ? AND user_id = ?` with params `[shelfId, userId]`, and update the misleading comment/docstring to reflect the actual enforcement, or add a check that deletion only proceeds when a row was affected (so callers can detect unauthorized attempts vs. not-found).

No other actionable findings — `renameShelf` correctly checks `user_id` in both the `SELECT` and `UPDATE` statements, consistent with safe ownership enforcement.