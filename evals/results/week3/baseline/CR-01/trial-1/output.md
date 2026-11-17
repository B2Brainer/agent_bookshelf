## Findings

### Critical

**review-model.ts:20 — `deleteReview` uses `OR` instead of `AND`, causing deletion of unrelated reviews/data loss and an authorization bypass.**

```ts
const result = run('DELETE FROM reviews WHERE id = ? OR user_id = ?', [reviewId, userId]);
```

The docstring above it explicitly states the intended behavior: "Deletes a single review, but only if it belongs to the given user." With `OR`, this statement does two dangerous things:

1. **Authorization bypass**: Any authenticated user can delete a review they don't own by passing an arbitrary `reviewId` — the `user_id = ?` clause alone (via `OR`) will never block it because the `id = ?` clause matches independently.
2. **Unintended mass deletion**: Calling `deleteReview(someReviewId, userId)` deletes *all* reviews written by `userId`, not just the single targeted review — a one-call data-loss bug. For example, `deleteReview(999999, 42)` (a non-existent review id) will still delete every review belonging to user 42.

**Fix:**
```ts
const result = run('DELETE FROM reviews WHERE id = ? AND user_id = ?', [reviewId, userId]);
```

This is a correctness/security defect with concrete, severe impact (unauthorized deletion + unintended bulk data loss), not speculative — it directly contradicts the function's own documented contract.

### Minor / Maintainability

**review-model.ts:12 — double type assertion (`as unknown as Review | undefined`) bypasses type safety.**

`get()` in db.ts returns `Record<string, unknown> | undefined`. Casting through `unknown` silently suppresses any mismatch between the SQL row shape and the `Review` interface (e.g., if a column is renamed or `review_text` comes back as something unexpected from sql.js). This is a common pattern for DB layers lacking a validation/mapping layer, but it means type errors here are not caught by the compiler. Not blocking, but worth noting as a maintainability trade-off if this pattern is repeated across other model files — consider a small runtime mapping/validation helper if correctness here matters.

No other issues (e.g., SQL injection, missing null checks beyond what's shown, `saveDb()` usage) were found in the reviewed scope — `getReviewById` correctly uses parameterized queries and returns `undefined` naturally via `get`'s signature.