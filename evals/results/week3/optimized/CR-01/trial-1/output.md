No other model files exist to compare conventions, so I will not speculate about the missing `saveDb()` call.

**Findings:**

1. **Critical — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-qPfsBf/review-model.ts:20`**
   Issue: `deleteReview` builds the SQL as `DELETE FROM reviews WHERE id = ? OR user_id = ?`. Because it uses `OR` instead of `AND`, calling this with a valid `userId` deletes *every* review owned by that user, not just the review identified by `reviewId` — and it will also delete the target review even if it belongs to a different user, as long as the `id` matches. This contradicts the function's own doc comment ("only if it belongs to the given user") and is an authorization/data-loss bug: any authenticated user can wipe out all of their own reviews (or any review row whose `id` collides) in one call, and the ownership check is effectively bypassed.
   Recommendation: Use `AND` to scope the deletion to the specific review owned by the specific user:
   ```ts
   const result = run('DELETE FROM reviews WHERE id = ? AND user_id = ?', [reviewId, userId]);
   ```

No other actionable findings in the reviewed scope.