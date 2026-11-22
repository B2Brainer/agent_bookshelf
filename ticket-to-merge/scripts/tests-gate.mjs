#!/usr/bin/env node
// ticket-to-merge verification gate. State lives in <git-dir>/ticket-to-merge/ (never committed).
//   start [--test-cmd "<cmd>"]  mark a /ship-ticket run active (arms the Stop hook)
//   lock <test files...>       record sha256 of the accepted tests (protect.js then blocks writes)
//   verify                     exit 1 if any locked test changed or disappeared
//   check                      verify + run the test command; exit 1 on failure
//   stop-check                 Stop hook: no-op unless a run is active; exit 2 while the gate fails
//   finish                     check, then disarm (remove active + lock state)
//   abort                      disarm without checking (report the run as incomplete)
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const MAX_STOP_BLOCKS = 3;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
let root, stateDir;
try {
  root = git('rev-parse', '--show-toplevel');
  stateDir = join(resolve(root, git('rev-parse', '--git-dir')), 'ticket-to-merge');
} catch {
  if (process.argv[2] === 'stop-check') process.exit(0); // not a git repo: nothing to gate
  console.error('tests-gate: not inside a git repository'); process.exit(1);
}
const ACTIVE = join(stateDir, 'active.json');
const LOCK = join(stateDir, 'locked-tests.json');
const readJson = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

function verify() {
  const files = readJson(LOCK, { files: {} }).files;
  const problems = [];
  for (const [rel, hash] of Object.entries(files)) {
    const abs = join(root, rel);
    if (!existsSync(abs)) problems.push(`${rel}: missing`);
    else if (sha(abs) !== hash) problems.push(`${rel}: modified after lock`);
  }
  return { count: Object.keys(files).length, problems };
}

// Backstop for the PreToolUse hook: detect any change to protected files, however it happened.
const PROTECTED = ['bookshelf.db', 'bookshelf.db-wal', 'bookshelf.db-shm', 'bookshelf.db-journal', '.env', 'src/db/seed.sql'];
function protectedSnapshot() {
  const snap = {};
  for (const rel of PROTECTED) { const abs = join(root, rel); snap[rel] = existsSync(abs) ? sha(abs) : null; }
  return snap;
}
function protectedProblems() {
  const before = readJson(ACTIVE, {}).protected;
  if (!before) return [];
  const now = protectedSnapshot();
  return PROTECTED.filter((rel) => before[rel] !== now[rel]).map((rel) => `${rel}: ${before[rel] === null ? 'created' : now[rel] === null ? 'deleted' : 'modified'}`);
}

function runTests() {
  const cmd = readJson(ACTIVE, {}).testCmd || 'npm run test:run';
  const r = spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8', timeout: 540_000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { cmd, ok: r.status === 0, tail: out.split('\n').slice(-40).join('\n') };
}

function check() {
  const v = verify();
  const p = protectedProblems();
  const t = runTests();
  const ok = v.problems.length === 0 && p.length === 0 && t.ok;
  const lines = [
    `locked tests: ${v.count} file(s), ${v.problems.length ? 'CHANGED: ' + v.problems.join('; ') : 'unchanged'}`,
    `protected files: ${p.length ? 'CHANGED: ' + p.join('; ') : 'unchanged'}`,
    `test command: ${t.cmd} -> ${t.ok ? 'PASS' : 'FAIL'}`,
  ];
  if (!t.ok) lines.push(t.tail);
  return { ok, report: lines.join('\n') };
}

const [cmd, ...args] = process.argv.slice(2);
mkdirSync(stateDir, { recursive: true });

switch (cmd) {
  case 'start': {
    const i = args.indexOf('--test-cmd');
    const testCmd = i >= 0 ? args[i + 1] : 'npm run test:run';
    writeFileSync(ACTIVE, JSON.stringify({ testCmd, startedAt: new Date().toISOString(), stopBlocks: 0, protected: protectedSnapshot() }, null, 2));
    console.log(`gate armed (test command: ${testCmd})`);
    break;
  }
  case 'lock': {
    if (!args.length) { console.error('usage: lock <test files...>'); process.exit(1); }
    const lock = readJson(LOCK, { files: {} });
    for (const f of args) {
      const abs = resolve(f);
      if (!existsSync(abs)) { console.error(`no such file: ${f}`); process.exit(1); }
      lock.files[relative(root, abs)] = sha(abs);
    }
    lock.lockedAt = new Date().toISOString();
    writeFileSync(LOCK, JSON.stringify(lock, null, 2));
    for (const [rel, h] of Object.entries(lock.files)) console.log(`locked ${rel} sha256=${h}`);
    break;
  }
  case 'verify': {
    const v = verify();
    console.log(v.problems.length ? `FAIL ${v.problems.join('; ')}` : `OK ${v.count} locked test file(s) unchanged`);
    process.exit(v.problems.length ? 1 : 0);
  }
  case 'check': {
    const c = check(); console.log(c.report); process.exit(c.ok ? 0 : 1);
  }
  case 'stop-check': {
    if (!existsSync(ACTIVE)) process.exit(0);
    // Armed means a /ship-ticket run has not reached `finish` or `abort`: stopping now is premature
    // even when the suite is green (e.g. the review/fix loop has not run yet).
    const state = readJson(ACTIVE, {});
    const c = check();
    state.stopBlocks = (state.stopBlocks || 0) + 1;
    writeFileSync(ACTIVE, JSON.stringify(state, null, 2));
    if (state.stopBlocks > MAX_STOP_BLOCKS) {
      console.error(`ticket-to-merge gate: stop blocked ${MAX_STOP_BLOCKS} times; allowing stop. Report the run as NOT done.\n${c.report}`);
      process.exit(0);
    }
    const next = c.ok
      ? 'Gate checks pass, but the run is not finished: complete the review/fix loop (steps 6-8), then run tests-gate finish and write the completion report.'
      : 'Fix the implementation (locked tests are read-only), then continue the loop and finish with tests-gate finish.';
    console.error(`ticket-to-merge gate: not done. ${next}\n${c.report}`);
    process.exit(2);
  }
  case 'finish': {
    const c = check(); console.log(c.report);
    if (!c.ok) process.exit(1);
    rmSync(ACTIVE, { force: true }); rmSync(LOCK, { force: true });
    console.log('gate passed; disarmed');
    break;
  }
  case 'abort':
    rmSync(ACTIVE, { force: true }); rmSync(LOCK, { force: true });
    console.log('gate disarmed without passing (run incomplete)');
    break;
  default:
    console.error('usage: tests-gate.mjs start|lock|verify|check|stop-check|finish|abort'); process.exit(1);
}
