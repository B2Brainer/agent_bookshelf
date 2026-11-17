## Code Review: review-validation.ts

Scope reviewed: `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-y8clVQ/review-validation.ts`, with `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-y8clVQ/db.ts` consulted for the `run()` contract. Only these two files exist in the project, so no caller code was available to cross-check conventions.

### High

**Missing validation of `userId` / `bookId` (review-validation.ts:3, 28)**
`createReview` and `importReview` accept `userId` and `bookId` and pass them straight into the SQL parameters without any validation (no integer check, no positivity check, no NaN check). Given that this file's entire purpose is input validation (it validates `rating` and `text` rigorously), the omission of the two other user-controlled inputs is inconsistent and a likely gap — a caller passing `NaN`, a float, zero, or a negative id will silently be persisted to the `reviews` table.
- Recommendation: add the same style of guard used for `rating`, e.g. `if (!Number.isInteger(userId) || userId <= 0) throw new Error('userId must be a positive integer');` (and similarly for `bookId`) in all three functions.

### Medium

**`INSERT OR REPLACE` in `importReview` can silently discard data (review-validation.ts:36)**
`INSERT OR REPLACE` only triggers its replace behavior when a UNIQUE/PRIMARY KEY constraint is violated. If there is a uniqueness constraint on `(user_id, book_id)` (plausible given the function's purpose of "importing" a review per user/book), SQLite will delete the conflicting row and insert a new one. Because the INSERT statement only specifies `user_id, book_id, rating, review_text`, any other columns not listed (e.g. `created_at`, `id` sequencing, or any audit/metadata column) will revert to their column defaults rather than being preserved — effectively losing data like the original creation timestamp.
- This is somewhat speculative since the `reviews` table schema isn't visible in the reviewed scope, but it's a known SQLite footgun with `INSERT OR REPLACE` worth flagging/confirming.
- Recommendation: if the intent is "update on conflict," prefer an explicit `INSERT ... ON CONFLICT(user_id, book_id) DO UPDATE SET rating = excluded.rating, review_text = excluded.review_text` to avoid resetting unlisted columns.

### Low / Maintainability

**Duplicated validation logic across all three functions (review-validation.ts:4-9, 18-23, 29-34)**
The rating range check and the text length check are copy-pasted verbatim in `createReview`, `updateReview`, and `importReview`. Any future change to validation rules (e.g., widening the text limit, adding trimming) requires editing three places and risks drift.
- Recommendation: extract a shared `function validateReviewInput(rating: number, text: string | null): void` and call it from all three functions.

**No runtime type/shape guard on `text` beyond length (review-validation.ts:7, 21, 32)**
Only the upper bound (`> 2000`) is checked; there's no trimming or empty-string handling. This may be intentional (empty string is a legitimately valid review), but combined with the lack of a lower bound or whitespace-only check, it's worth confirming whether that's the desired behavior. Flagged as low-confidence/informational, not a confirmed defect.

### No issues found with
- Parameterization of SQL (`run(sql, params)` is used consistently; no injection risk).
- The `rating` validation logic itself (`Number.isInteger` combined with range check correctly rejects `NaN`, floats, and out-of-range values).
- `updateReview`'s return semantics (`result.changes > 0`) are consistent with the `RunResult` interface declared in `db.ts`.