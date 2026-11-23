## Per run

| run | case | planted | bugs found | recall | findings | real | precision | cost USD | agents |
|---|---|---|---|---|---|---|---|---|---|
| planted-a-run1 | planted-a | 4 | B1 B2 B3 B4 | 100% | 4 | 4 | 100% | 0.5083 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| planted-a-run2 | planted-a | 4 | B1 B2 B3 B4 | 100% | 4 | 4 | 100% | 0.5557 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| planted-a-run3 | planted-a | 4 | B1 B2 B3 B4 | 100% | 4 | 4 | 100% | 0.5814 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run1 | clean-b | 0 | - | n/a | 2 | 0 | 0% | 0.6552 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run2 | clean-b | 0 | - | n/a | 0 | 0 | n/a | 0.8302 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run3 | clean-b | 0 | - | n/a | 1 | 0 | 0% | 0.5956 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |

## Aggregate (6 runs)

- Recall (mean over planted-bug runs): 100%  (4/4, 4/4, 4/4)
- Precision (pooled, all runs incl. clean controls): 80%  (12/15)
- Total measured cost: $3.7263 (mean $0.6211/run)
- Brief formula: recall points 6 × 100% = 6.00; precision points 4 × 12/15 = 3.20

## Every finding

| run | # | file:line | sev | verdict | issue | reason |
|---|---|---|---|---|---|---|
| planted-a-run1 | 0 | src/models/stats.ts:34 | high | TP:B1 | Pagination offset formula is off by one pageSize, skipping the first page | auto: file+line+keyword match |
| planted-a-run1 | 1 | src/routes/api.ts:201 | high | TP:B3 | Rating validation condition is tautologically false, so no out-of-range rating is ever rejected | auto: file+line+keyword match |
| planted-a-run1 | 2 | src/routes/api.ts:36 | high | TP:B2 | SQL injection via unvalidated `sort` query param interpolated into a raw SQL ORDER BY clause | auto: file+line+keyword match |
| planted-a-run1 | 3 | src/routes/books.ts:50 | high | TP:B4 | Stored XSS via unescaped display_name in the top-review HTML fragment | auto: file+line+keyword match |
| planted-a-run2 | 0 | src/routes/api.ts:201 | high | TP:B3 | Rating range check uses && instead of \|\|, so it never rejects out-of-range values | auto: file+line+keyword match |
| planted-a-run2 | 1 | src/models/stats.ts:46 | high | TP:B2 | SQL injection via unsanitized sort parameter interpolated into ORDER BY clause | auto: file+line+keyword match |
| planted-a-run2 | 2 | src/routes/books.ts:50 | high | TP:B4 | Stored XSS: top.display_name interpolated unescaped into HTML response | auto: file+line+keyword match |
| planted-a-run2 | 3 | src/models/stats.ts:34 | medium | TP:B1 | Pagination offset off-by-one: page 1 skips the first pageSize rows | auto: file+line+keyword match |
| planted-a-run3 | 0 | src/models/stats.ts:46 | high | TP:B2 | SQL injection via unsanitized `sort` query param interpolated directly into ORDER BY clause in getReviewsSorte | auto: file+line+keyword match |
| planted-a-run3 | 1 | src/routes/api.ts:201 | high | TP:B3 | Rating bounds check uses `&&` instead of `\|\|`, so the out-of-range branch can never be true — invalid ratings  | auto: file+line+keyword match |
| planted-a-run3 | 2 | src/models/stats.ts:34 | high | TP:B1 | Pagination off-by-one: OFFSET computed as page*pageSize while the function is documented as page starting at 1 | auto: file+line+keyword match |
| planted-a-run3 | 3 | src/routes/books.ts:48 | medium | TP:B4 | Stored XSS: top.display_name (user-controlled) is interpolated unescaped into an HTML response via res.send te | auto: file+line+keyword match |
| clean-b-run1 | 0 | src/routes/api.ts:199 | high | FP | Number() coercion in PUT /reviews/:id/rating accepts non-numeric types that coerce into integers 1-5 (e.g. boo | Number(true)/'3' coerce to valid integers 1-5 and are stored as valid ratings: lenient coercion with valid output, not a defect (counted conservatively) |
| clean-b-run1 | 1 | src/routes/api.ts:22 | medium | FP | page=0 (and pageSize=0) in GET /books/page is silently coerced to the default (1 / 10) via `\|\| 1` / `\|\| 10` be | page/pageSize 0 fall back to defaults: lenient defaulting with valid output |
| clean-b-run3 | 0 | src/routes/api.ts:34 | low | FP | GET /books/:id/reviews does not validate book existence; returns 200 [] for a non-existent or non-numeric book | returns 200 [] for an unknown book, identical to the pre-existing /api/reviews/book/:bookId contract |
