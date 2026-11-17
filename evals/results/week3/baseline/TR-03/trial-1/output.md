Mocha is not installed (no `node_modules` present, and no global install), and I am not permitted to install dependencies. I cannot execute the test suite in its current state.

**Commands executed:**
- `npm test` (runs `mocha` per `package.json`) → failed with `sh: mocha: command not found` (exit code 127)
- `which mocha` / `npm ls -g mocha` / `command -v npx` → confirmed mocha is not installed locally or globally

**Test execution status:** Not executed / blocked

**Test counts:** None available — the test runner never started

**Limitations preventing verification:**
- The project's `node_modules` directory does not exist, so the `mocha` dependency declared in `package.json` (`^10.8.2`) is missing.
- Per my constraints, I am not permitted to install dependencies (e.g., `npm install`) to resolve this.

**Project details found (for reference):**
- `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-wUKm4p/package.json` — defines `"test": "mocha"`
- `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-wUKm4p/format.js` — source under test (`formatTitle`)
- `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-wUKm4p/test/format.spec.js` — one test case (`formatTitle joins title and author`), not run

To proceed, dependencies need to be installed (e.g., `npm install`) by someone with permission to do so; I can re-run the suite immediately afterward if asked.