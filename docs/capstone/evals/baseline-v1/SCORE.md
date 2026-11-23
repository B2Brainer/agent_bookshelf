## Per run

| run | case | planted | bugs found | recall | findings | real | precision | cost USD | agents |
|---|---|---|---|---|---|---|---|---|---|
| planted-a-run1 | planted-a | 4 | B1 B2 B3 B4 | 100% | 5 | 4 | 80% | 0.4804 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| planted-a-run2 | planted-a | 4 | B1 B2 B3 B4 | 100% | 4 | 4 | 100% | 0.5393 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| planted-a-run3 | planted-a | 4 | B1 B2 B3 B4 | 100% | 4 | 4 | 100% | 0.5491 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run1 | clean-b | 0 | - | n/a | 1 | 0 | 0% | 0.4798 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run2 | clean-b | 0 | - | n/a | 2 | 0 | 0% | 0.6094 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run3 | clean-b | 0 | - | n/a | 2 | 0 | 0% | 0.5127 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |

## Aggregate (6 runs)

- Recall (mean over planted-bug runs): 100%  (4/4, 4/4, 4/4)
- Precision (pooled, all runs incl. clean controls): 67%  (12/18)
- Total measured cost: $3.1707 (mean $0.5285/run)
- Brief formula: recall points 6 × 100% = 6.00; precision points 4 × 12/18 = 2.67

## Every finding

| run | # | file:line | sev | verdict | issue | reason |
|---|---|---|---|---|---|---|
| planted-a-run1 | 0 | src/models/stats.ts:46 | high | TP:B2 | getReviewsSorted interpolates caller-supplied `sort` directly into SQL ORDER BY with no whitelist, unlike getB | auto: file+line+keyword match |
| planted-a-run1 | 1 | src/routes/api.ts:201 | high | TP:B3 | Rating validation uses `&&` instead of `\|\|`, so the out-of-range check can never be true, allowing any integer | auto: file+line+keyword match |
| planted-a-run1 | 2 | src/routes/books.ts:48 | high | TP:B4 | User-controlled display_name interpolated into a raw HTML response without escaping — stored XSS. | auto: file+line+keyword match |
| planted-a-run1 | 3 | src/models/stats.ts:34 | medium | TP:B1 | getBooksPage computes offset as `page * pageSize` instead of `(page - 1) * pageSize`, skipping the first page' | auto: file+line+keyword match |
| planted-a-run1 | 4 | src/routes/api.ts:215 | low | FP | reviewId/bookId from parseInt are not checked for NaN before being passed to model calls. | NaN id reaches the model, which returns undefined -> existing 404 path; no wrong outcome |
| planted-a-run2 | 0 | src/models/stats.ts:46 | high | TP:B2 | ORDER BY clause built from unvalidated user-supplied sort string, enabling SQL injection | auto: file+line+keyword match |
| planted-a-run2 | 1 | src/routes/books.ts:46 | high | TP:B4 | Stored XSS: display_name and rating interpolated unescaped into raw HTML sent via res.send | auto: file+line+keyword match |
| planted-a-run2 | 2 | src/routes/api.ts:210 | high | TP:B3 | Broken rating validation due to impossible AND condition, allowing out-of-range ratings to be persisted | manual: same defect as B3 (impossible && range check); cited line 210 is inside the same PUT /reviews/:id/rating handler, 5 lines past the auto-match window |
| planted-a-run2 | 3 | src/models/stats.ts:34 | medium | TP:B1 | Off-by-one pagination offset skips the first page of results | auto: file+line+keyword match |
| planted-a-run3 | 0 | src/models/stats.ts:46 | high | TP:B2 | SQL injection via unvalidated sort parameter interpolated directly into ORDER BY | auto: file+line+keyword match |
| planted-a-run3 | 1 | src/routes/books.ts:50 | high | TP:B4 | Stored XSS: unescaped display_name interpolated into HTML response | auto: file+line+keyword match |
| planted-a-run3 | 2 | src/routes/api.ts:201 | high | TP:B3 | Broken rating validation: impossible boolean condition never rejects out-of-range ratings | auto: file+line+keyword match |
| planted-a-run3 | 3 | src/models/stats.ts:34 | medium | TP:B1 | Off-by-one pagination: 1-indexed page numbers computed with wrong OFFSET formula | auto: file+line+keyword match |
| clean-b-run1 | 0 | src/routes/api.ts:34 | medium | FP | GET /books/:id/reviews does not check that the book exists, unlike the sibling /books/:id/histogram route adde | returns 200 [] for an unknown book, identical to the pre-existing /api/reviews/book/:bookId contract; no spec requires 404 |
| clean-b-run2 | 0 | src/routes/api.ts:17 | low | FP | `?limit=0` or `?minReviews=0` is silently replaced by the default (10 / 1) instead of being validated or rejec | limit=0 falls back to the default 10: lenient defaulting with valid output, not a defect (counted conservatively) |
| clean-b-run2 | 1 | src/routes/api.ts:23 | low | FP | `?page=0` is coerced to 1 via `\|\| 1` before the `page < 1` check runs, so the validation can never catch an ex | page=0 treated as page 1: lenient defaulting with valid output, not a defect (counted conservatively) |
| clean-b-run3 | 0 | src/routes/api.ts:34 | medium | FP | GET /books/:id/reviews never validates the book exists, unlike the sibling /books/:id/histogram route added in | same as clean-b-run1#0 |
| clean-b-run3 | 1 | src/routes/api.ts:17 | low | FP | GET /books/top silently overrides an explicit limit=0 to the default of 10 instead of clamping it to the minim | same as clean-b-run2#0 |
