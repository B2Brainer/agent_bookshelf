## Test Results

**Command executed:** `npm test` (runs `node --test`) in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-EZbY9S`

**Status:** FAILED

**Test counts:** 3 total — 2 passed, 1 failed, 0 skipped

**Passed:**
- `formatTitle joins title and author`
- `slugify produces url-safe slugs`

**Failed:**
- `averageRating rounds to one decimal place`
  - File: `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-EZbY9S/format.test.js:13`
  - Assertion failed in `format.test.js:14:10`: expected `4.3`, received `4.333333333333333`
  - The `averageRating` function in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-EZbY9S/format.js` does not appear to round its result to one decimal place.