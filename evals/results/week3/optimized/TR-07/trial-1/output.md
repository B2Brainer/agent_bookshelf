Command executed: `npm test` (runs `node --test`) in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-S3Pcdo`

Status: FAILED

Test counts: 40 total, 39 passed, 1 failed, 0 skipped

Failure detail:
- Test: "catalog entry 23 formats title" at `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-S3Pcdo/catalog.test.js:115-117`
- Expected `'Catalog Book 23 - Author 23'` but got actual `'Catalog Book 23 by Author 23'`
- This assertion expects a `-` separator format, while `formatTitle` in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-S3Pcdo/format.js:1-3` produces a `by` separator format — inconsistent with the other 39 passing tests that all expect the `by` format.