## Test Results

**Command executed:** `npm test` (runs `node --test`)

**Status:** FAILED

**Test counts:** 11 total — 6 passed, 2 failed, 2 skipped, 1 todo

**Failures:**

1. `slugify keeps accented letters` — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-MdLI1n/format.test.js:29`
   - Expected: `'café-society'`
   - Actual: `'caf-society'`
   - `slugify` in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-MdLI1n/format.js` is stripping accented characters instead of preserving them.

2. `averageRating ignores null ratings` — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-MdLI1n/format.test.js:33`
   - Expected: `4`
   - Actual: `2.6666666666666665`
   - `averageRating` in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-MdLI1n/format.js` appears to be including `null` in the divisor/sum instead of filtering it out.

**Skipped:**
- `formatTitle supports subtitles` (reason: "subtitle support not implemented")
- `slugify handles emoji` (reason: skip: true, no message)

**Todo:**
- `averageRating weights recent reviews` (reason: "pending product decision")