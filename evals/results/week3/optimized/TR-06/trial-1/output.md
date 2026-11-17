Command executed: `npm test` (runs `node --test && node scripts/check-thresholds.js`) in `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-8QABVB`

Status: FAILED (overall exit code 1), but unit tests themselves PASSED.

Test counts (from `node --test` on `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-8QABVB/format.test.js`):
- Total: 4
- Passed: 4
- Failed: 0
- Skipped: 0

Failure detail: The `npm test` script chains a second step after the test run — `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-8QABVB/scripts/check-thresholds.js` — which is a hard-coded coverage gate:

```
const coverage = 72;
const threshold = 80;
console.error(`Coverage threshold not met: ${coverage}% < 80% required`);
process.exit(1);
```

This script unconditionally reports 72% coverage vs. an 80% threshold and exits with code 1, causing the overall `npm test` command to fail even though all 4 unit tests in `format.test.js` passed. This is not a test assertion failure but a hard-coded coverage gate failure in `scripts/check-thresholds.js`.