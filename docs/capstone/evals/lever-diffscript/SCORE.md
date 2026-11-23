## Per run

| run | case | planted | bugs found | recall | findings | real | precision | cost USD | agents |
|---|---|---|---|---|---|---|---|---|---|
| planted-a-run1 | planted-a | 4 | B1 B2 B3 B4 | 100% | 4 | 4 | 100% | 0.2921 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| planted-a-run2 | planted-a | 4 | B1 B2 B3 B4 | 100% | 4 | 4 | 100% | 0.2747 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| planted-a-run3 | planted-a | 4 | B1 B2 B3 B4 | 100% | 4 | 4 | 100% | 0.3121 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run1 | clean-b | 0 | - | n/a | 1 | 0 | 0% | 0.3870 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run2 | clean-b | 0 | - | n/a | 3 | 0 | 0% | 0.3240 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run3 | clean-b | 0 | - | n/a | 1 | 0 | 0% | 0.2871 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |

## Aggregate (6 runs)

- Recall (mean over planted-bug runs): 100%  (4/4, 4/4, 4/4)
- Precision (pooled, all runs incl. clean controls): 71%  (12/17)
- Total measured cost: $1.8770 (mean $0.3128/run)
- Brief formula: recall points 6 × 100% = 6.00; precision points 4 × 12/17 = 2.82

## Every finding

| run | # | file:line | sev | verdict | issue | reason |
|---|---|---|---|---|---|---|
| planted-a-run1 | 0 | src/routes/api.ts:201 | high | TP:B3 | Rating validation condition uses && instead of \|\|, so the range check is always false and never rejects out-of | auto: file+line+keyword match |
| planted-a-run1 | 1 | src/models/stats.ts:34 | high | TP:B1 | Pagination offset computed as page*pageSize instead of (page-1)*pageSize, skipping a page of results. | auto: file+line+keyword match |
| planted-a-run1 | 2 | src/models/stats.ts:46 | high | TP:B2 | getReviewsSorted interpolates the caller-supplied sort string directly into the SQL ORDER BY clause with no wh | auto: file+line+keyword match |
| planted-a-run1 | 3 | src/routes/books.ts:50 | medium | TP:B4 | User-controlled display_name interpolated into raw HTML response without escaping, enabling stored XSS. | auto: file+line+keyword match |
| planted-a-run2 | 0 | src/models/stats.ts:46 | high | TP:B2 | SQL injection via unsanitized `sort` ORDER BY interpolation | auto: file+line+keyword match |
| planted-a-run2 | 1 | src/models/stats.ts:34 | high | TP:B1 | Pagination offset off-by-one page: uses `page * pageSize` instead of `(page - 1) * pageSize` | auto: file+line+keyword match |
| planted-a-run2 | 2 | src/routes/api.ts:201 | high | TP:B3 | Rating range validation is logically always false, so no rating is ever rejected | auto: file+line+keyword match |
| planted-a-run2 | 3 | src/routes/books.ts:50 | medium | TP:B4 | Stored XSS: user-controlled display_name rendered unescaped into HTML response | auto: file+line+keyword match |
| planted-a-run3 | 0 | src/routes/api.ts:201 | high | TP:B3 | Rating range check is a logical no-op: a value cannot simultaneously be <1 and >5, so no value is ever rejecte | auto: file+line+keyword match |
| planted-a-run3 | 1 | src/models/stats.ts:34 | high | TP:B1 | Pagination offset is off by one page: uses page*pageSize instead of (page-1)*pageSize, per the function's own  | auto: file+line+keyword match |
| planted-a-run3 | 2 | src/models/stats.ts:46 | high | TP:B2 | User-controlled sort string is interpolated directly into the SQL ORDER BY clause with no whitelist/validation | auto: file+line+keyword match |
| planted-a-run3 | 3 | src/routes/books.ts:50 | medium | TP:B4 | Review display_name is inserted into HTML response without escaping, allowing stored XSS. | auto: file+line+keyword match |
| clean-b-run1 | 0 | src/routes/api.ts:34 | low | FP | GET /books/:id/reviews does not validate that the book exists or that :id is numeric, unlike the sibling /book | 200 [] for an unknown/non-numeric book, identical to the pre-existing /api/reviews/book/:bookId contract; NaN is bound as a parameter |
| clean-b-run2 | 0 | src/routes/api.ts:18 | low | FP | minReviews=0 explicitly requested is silently coerced to 1 due to the `\|\| 1` fallback, contradicting the doc c | minReviews=0 -> 1: the INNER JOIN already excludes books with no reviews, so results are identical; lenient default |
| clean-b-run2 | 1 | src/routes/api.ts:23 | low | FP | page=0 is silently coerced to the default (1) via `\|\| 1`, bypassing the 'page must be >= 1' check that correct | page=0 -> page 1: lenient defaulting with valid output (counted conservatively) |
| clean-b-run2 | 2 | src/routes/api.ts:24 | low | FP | pageSize=0 is silently coerced to the default (10) via `\|\| 10`, bypassing the 'pageSize < 1' validation for th | pageSize=0 -> 10: lenient defaulting with valid output (counted conservatively) |
| clean-b-run3 | 0 | src/routes/api.ts:34 | high | FP | GET /books/:id/reviews does not validate that the parsed bookId is a number before using it in a SQL query, un | NaN bookId is bound as a ? parameter and matches no rows -> 200 []; no injection, no crash |
