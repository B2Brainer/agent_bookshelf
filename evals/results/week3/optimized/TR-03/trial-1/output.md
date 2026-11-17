Mocha is not available locally (`node_modules` is absent) or globally, and installing dependencies is outside my permitted scope.

Command executed: `npm test` (which runs `mocha`) — attempted via `npx --no-install mocha --version` as a pre-check first.

Status: BLOCKED

Blocking reason: The project declares `mocha` as a devDependency (`/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-jiCQhj/package.json`), but `node_modules` does not exist in the working directory and `mocha` is not installed globally. Running `npm test` would fail with `mocha: command not found`. I am not permitted to install dependencies to resolve this.

Relevant files:
- `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-jiCQhj/package.json` (test script: `mocha`)
- `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-jiCQhj/test/format.spec.js` (the test file that would run)
- `/private/var/folders/gx/j4c6wn9x7m5d_d1tmbh_lby80000gn/T/ws-jiCQhj/format.js` (source under test)

To unblock: run `npm install` (or equivalent) in that directory to populate `node_modules`, then re-run `npm test`.