## Per run

| run | case | planted | bugs found | recall | findings | real | precision | cost USD | agents |
|---|---|---|---|---|---|---|---|---|---|
| planted-a-run1 | planted-a | 4 | B1 B2 B3 B4 | 100% | 4 | 4 | 100% | 0.4977 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| planted-a-run2 | planted-a | 4 | B2 B3 B4 | 75% | 3 | 3 | 100% | 0.4372 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| planted-a-run3 | planted-a | 4 | B1 B2 B3 B4 | 100% | 4 | 4 | 100% | 0.3759 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run1 | clean-b | 0 | - | n/a | 0 | 0 | n/a | 0.4558 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run2 | clean-b | 0 | - | n/a | 1 | 0 | 0% | 0.4568 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |
| clean-b-run3 | clean-b | 0 | - | n/a | 2 | 0 | 0% | 0.4710 | ticket-to-merge:review-correctness,ticket-to-merge:review-security,ticket-to-merge:review-verifier |

## Aggregate (6 runs)

- Recall (mean over planted-bug runs): 92%  (4/4, 3/4, 4/4)
- Precision (pooled, all runs incl. clean controls): 79%  (11/14)
- Total measured cost: $2.6944 (mean $0.4491/run)
- Brief formula: recall points 6 × 92% = 5.50; precision points 4 × 11/14 = 3.14

## Every finding

| run | # | file:line | sev | verdict | issue | reason |
|---|---|---|---|---|---|---|
| planted-a-run1 | 0 | src/models/stats.ts:46 | high | TP:B2 | User-supplied `sort` string is interpolated directly into the SQL ORDER BY clause with no whitelist validation | auto: file+line+keyword match |
| planted-a-run1 | 1 | src/routes/api.ts:201 | high | TP:B3 | Rating range check is a tautological contradiction — it can never be true — so any integer rating is accepted  | auto: file+line+keyword match |
| planted-a-run1 | 2 | src/models/stats.ts:34 | high | TP:B1 | Off-by-one pagination offset: uses `page * pageSize` instead of `(page - 1) * pageSize` for a 1-based page par | auto: file+line+keyword match |
| planted-a-run1 | 3 | src/routes/books.ts:48 | medium | TP:B4 | `top.display_name` is interpolated unescaped into raw HTML via res.send, allowing stored XSS if a user's displ | auto: file+line+keyword match |
| planted-a-run2 | 0 | src/routes/api.ts:201 | high | TP:B3 | Rating bounds check uses && instead of \|\|, so it can never reject an invalid value — any integer rating (e.g.  | auto: file+line+keyword match |
| planted-a-run2 | 1 | src/models/stats.ts:46 | high | TP:B2 | SQL injection: the `sort` parameter from `GET /books/:id/reviews?sort=` is interpolated unsanitized into the O | auto: file+line+keyword match |
| planted-a-run2 | 2 | src/routes/books.ts:48 | medium | TP:B4 | Stored XSS: display_name is rendered into an HTML response via raw template-string res.send() with no escaping | auto: file+line+keyword match |
| planted-a-run3 | 0 | src/routes/api.ts:201 | high | TP:B3 | Rating validation condition is logically always false, so out-of-range ratings are never rejected. | auto: file+line+keyword match |
| planted-a-run3 | 1 | src/models/stats.ts:46 | high | TP:B2 | getReviewsSorted interpolates the raw `sort` query parameter directly into ORDER BY with no allowlist, enablin | auto: file+line+keyword match |
| planted-a-run3 | 2 | src/models/stats.ts:34 | high | TP:B1 | Pagination offset uses page*pageSize instead of (page-1)*pageSize, so page=1 skips the first pageSize rows. | auto: file+line+keyword match |
| planted-a-run3 | 3 | src/routes/books.ts:50 | medium | TP:B4 | User-controlled display_name is interpolated into raw HTML without escaping, enabling stored XSS. | auto: file+line+keyword match |
| clean-b-run2 | 0 | src/routes/api.ts:34 | medium | FP | GET /books/:id/reviews does not verify the book exists, unlike the sibling histogram route which 404s for unkn | returns 200 [] for an unknown book, identical to the pre-existing /api/reviews/book/:bookId contract; no spec requires 404 |
| clean-b-run3 | 0 | src/routes/api.ts:34 | low | FP | GET /books/:id/reviews does not validate that the book exists, unlike the sibling /books/:id/histogram and /bo | same as clean-b-run2#0 |
| clean-b-run3 | 1 | src/routes/api.ts:23 | low | FP | page/pageSize of 0 or non-numeric input are silently coerced to defaults (1/10) via `\|\| 1`/`\|\| 10` before the  | 0/non-numeric page and pageSize fall back to defaults: lenient defaulting with valid output, not a defect (counted conservatively) |
