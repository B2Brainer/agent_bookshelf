Command executed: `npm test` (runs `node --test`) in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-llalN2`

Status: FAILED

Test counts: 2 total, 1 passed, 1 failed, 0 skipped

Failure detail:
- Test: `slugify collapses separators` in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-llalN2/format.test.js:9`
- Assertion failed: expected `'war_and_peace'`, got `'war-and-peace'`
- Root cause: `slugify` in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-llalN2/format.js:6` replaces separators with `-` (hyphen), but the test expects `_` (underscore).

Per my constraints, I did not modify any source or test files to fix this mismatch.