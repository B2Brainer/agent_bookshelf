Finding: addBookToShelf is missing a saveDb() call, inconsistent with removeBookFromShelf and clearShelf which both persist changes. This means a successful insert into shelf_books will not be written to disk, causing silent data loss on restart (since sql.js keeps the DB in memory and saveDb() is explicitly documented at the top of the file as required to persist state).

- Severity: High
- File: /private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-A7tFaV/shelf-books.ts:16-19
- Issue: `addBookToShelf` executes the INSERT but never calls `saveDb()`, unlike `removeBookFromShelf` (line 12) and `clearShelf` (line 23). Given the file's own comment that "saveDb() writes the current state to disk," any book added to a shelf will be lost if the process restarts before another mutating call happens to trigger a save.
- Recommendation: Add `saveDb();` after the `run(...)` call in `addBookToShelf`, before returning, matching the pattern used elsewhere in the file.

No other actionable findings.