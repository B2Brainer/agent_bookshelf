## Test Execution Report

**Command executed:** `npm test` (runs `node --test`), in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-T0gS8u`

**Status:** FAILED (exit code 1)

**Counts:**
- Total: 11
- Passed: 6
- Failed: 2
- Skipped: 2
- Todo: 1

### Failures

1. **`slugify keeps accented letters`** — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-T0gS8u/format.test.js:29`
   - Expected: `'café-society'`
   - Actual: `'caf-society'`
   - Cause: `slugify` in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-T0gS8u/format.js:6` uses regex `[^a-z0-9]+` which strips the accented `é` since it's outside the `a-z0-9` character class.

2. **`averageRating ignores null ratings`** — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-T0gS8u/format.test.js:33`
   - Expected: `4`
   - Actual: `2.6666666666666665`
   - Cause: `averageRating` in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-T0gS8u/format.js:9-12` divides by `ratings.length` (includes `null` entries) and sums `null` as `0`, instead of filtering out nulls before averaging.

### Skipped / Todo (not failures)
- `formatTitle supports subtitles` — skipped (reason: "subtitle support not implemented")
- `slugify handles emoji` — skipped
- `averageRating weights recent reviews` — marked todo ("pending product decision")

### Limitations
None — the suite ran to completion with no execution errors; all 11 declared tests produced a result.

Per my constraints, I did not modify `format.js` or `format.test.js` to fix these failures.