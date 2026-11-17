// Offline tests for the evaluation harness. No agent or API is ever called:
// synthetic transcripts are graded directly, and runTrial uses fake-claude.mjs.
// Run: node --test evals/test/
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCase, manifestFor, snapshotDir, diffSnapshot, REPO_ROOT, RESULTS_DIR } from '../lib/dataset.mjs';
import { analyzeTranscript, classifyExecution, usageSummary, findRepoReferences, runTrial, createWorkspace, removeWorkspace, trialEnv } from '../lib/run.mjs';
import { gradeTrial, extractCounts, extractStatus, findingBlocks } from '../lib/grade.mjs';
import { cmdRun, cmdGrade, summarize } from '../harness.mjs';

const FAKE = join(dirname(fileURLToPath(import.meta.url)), 'fake-claude.mjs');
chmodSync(FAKE, 0o755);
const scratch = mkdtempSync(join(tmpdir(), 'harness-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

// ---------- synthetic data ----------

const DISPATCH = 'toolu_dispatch';
function stream({ agent, prompt, output, bash = [], cost = 0.0123, dispatchPrompt, subagentType, orchestratorTools = [], noResult = false, resultError = false, status = 'completed', modelUsage }) {
  const ev = [{ type: 'system', subtype: 'init', model: 'claude-sonnet-5', agents: [agent], tools: ['Agent', 'Bash', 'Read'], claude_code_version: '2.1.277', cwd: '/tmp/ws-x' }];
  orchestratorTools.forEach((t, i) => ev.push({ type: 'assistant', parent_tool_use_id: null, message: { id: `m_o${i}`, content: [{ type: 'tool_use', id: `toolu_o${i}`, name: t.name, input: t.input }] } }));
  ev.push({ type: 'assistant', parent_tool_use_id: null, message: { id: 'm1', content: [{ type: 'tool_use', id: DISPATCH, name: 'Agent', input: { subagent_type: subagentType ?? agent, description: 'task', prompt: dispatchPrompt ?? prompt } }] } });
  ev.push({ type: 'system', subtype: 'task_started', tool_use_id: DISPATCH, subagent_type: agent });
  bash.forEach((b, i) => {
    ev.push({ type: 'assistant', parent_tool_use_id: DISPATCH, message: { id: `m_b${i}`, content: [{ type: 'tool_use', id: `toolu_b${i}`, name: 'Bash', input: { command: b.command } }] } });
    if (b.result !== undefined) ev.push({ type: 'user', parent_tool_use_id: DISPATCH, message: { content: [{ type: 'tool_result', tool_use_id: `toolu_b${i}`, content: b.result, is_error: Boolean(b.is_error) }] } });
  });
  if (output != null) ev.push({ type: 'assistant', parent_tool_use_id: DISPATCH, message: { id: 'm_final', content: [{ type: 'text', text: output }] } });
  ev.push({ type: 'system', subtype: 'task_notification', tool_use_id: DISPATCH, status, summary: output, usage: { total_tokens: 1234, tool_uses: bash.length, duration_ms: 900 } });
  ev.push({ type: 'assistant', parent_tool_use_id: null, message: { id: 'm2', content: [{ type: 'text', text: 'Done.' }] } });
  if (!noResult) {
    const r = { type: 'result', subtype: resultError ? 'error_during_execution' : 'success', is_error: resultError, usage: { input_tokens: 100, output_tokens: 50 }, permission_denials: [], duration_ms: 1000, num_turns: 2 };
    if (cost !== null) {
      r.total_cost_usd = cost;
      r.modelUsage = modelUsage ?? { 'claude-sonnet-5': { inputTokens: 1000, outputTokens: 200, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: cost } };
    }
    ev.push(r);
  }
  return ev;
}

function dirsOf(files) {
  const dirs = new Set();
  for (const f of files) for (let d = dirname(f); d !== '.'; d = dirname(d)) dirs.add(d);
  return [...dirs].sort();
}

const REPO = { lines: [], hashes: {} };
// A recorded, completed trial for grading, with an unchanged workspace unless overridden.
function trialFor(id, streamOpts, { addFiles = {}, addDirs = [], changeFiles = {}, repoAfter = REPO, config = 'optimized' } = {}) {
  const kase = findCase(id);
  const analysis = analyzeTranscript(stream({ agent: kase.agent, prompt: kase.input.prompt, ...streamOpts }), kase.agent);
  const expected = { ...manifestFor(kase.fixture.path), [`.claude/agents/${kase.agent}.md`]: 'agent-hash' };
  const files = { ...expected, ...changeFiles, ...addFiles };
  const snapshot = { files, dirs: [...dirsOf(Object.keys(files)), ...addDirs].sort() };
  return {
    kase,
    trial: {
      case_id: id, config, trial: 1, status: 'completed', errors: [], analysis,
      usage: usageSummary(analysis.result), process: { duration_ms: 1000 },
      observations: { workspace_snapshot: snapshot, expected_files: expected, fixture_diff: diffSnapshot(snapshot, expected), repo_before: REPO, repo_after: repoAfter },
    },
  };
}
const grade = (id, streamOpts, obs, judgments) => {
  const { kase, trial } = trialFor(id, streamOpts, obs);
  return gradeTrial(kase, trial, judgments);
};
const check = (g, cid) => g.checks.find((c) => c.id === cid);

const NPM_TEST = (result, is_error = false) => [{ command: 'cd /tmp/ws-x && npm test', result, is_error }];

// ---------- code-reviewer grading ----------

describe('code-reviewer grading', () => {
  const OPTIMIZED_CR01 = [
    '1. **Critical** - review-model.ts:20 - `deleteReview` uses `OR` instead of `AND`, so it deletes every review the user wrote. Correction: use `WHERE id = ? AND user_id = ?`.',
    '2. **Low** - review-model.ts:12 - Double cast `as unknown as Review` hides type mismatches. Correction: map the row explicitly.',
  ].join('\n');
  const BASELINE_CR01 = [
    '## Code Review: review-model.ts', '',
    '### Critical', '',
    '**Wrong operator in deleteReview** (`review-model.ts`, lines 19-21)', '',
    'The WHERE clause uses OR, so any review by the user matches and all of the user\'s reviews are deleted.', '',
    '**Recommended correction:** replace OR with AND.', '',
    '### Low', '',
    '**Double cast** (`review-model.ts:12`)', 'The cast hides type mismatches.',
  ].join('\n');

  test('known defect reported in optimized format -> PASS', () => {
    const g = grade('CR-01', { output: OPTIMIZED_CR01 });
    assert.equal(g.outcome, 'PASS', JSON.stringify(g.checks, null, 1));
  });

  test('baseline format (severity headings, prose line refs) is not penalized -> PASS', () => {
    const g = grade('CR-01', { output: BASELINE_CR01 }, {}, {});
    assert.equal(g.outcome, 'PASS', JSON.stringify(g.checks, null, 1));
    assert.match(check(g, 'S2').evidence.D1, /critical \(section heading\)/);
  });

  test('defect missing -> FAIL', () => {
    const g = grade('CR-01', { output: '1. **Low** - review-model.ts:12 - Double cast hides type mismatches.' });
    assert.equal(g.outcome, 'FAIL');
    assert.equal(check(g, 'S1').status, 'FAIL');
  });

  test('defect ranked second -> FAIL on rank only', () => {
    const swapped = OPTIMIZED_CR01.split('\n').reverse().join('\n');
    const g = grade('CR-01', { output: swapped });
    assert.equal(check(g, 'S1').status, 'PASS');
    assert.equal(check(g, 'S3').status, 'FAIL');
    assert.equal(g.outcome, 'FAIL');
  });

  test('missing severity label -> UNGRADED, not silently passed', () => {
    const g = grade('CR-01', { output: '- review-model.ts:20 deletes all of the user\'s reviews because it uses OR; use AND.' });
    assert.equal(check(g, 'S2').status, 'UNGRADED');
    assert.equal(g.outcome, 'UNGRADED');
  });

  test('CR-02 ordering: medium before high -> FAIL', () => {
    const out = [
      '1. Medium - shelf-service.ts:7 - offset skips the first page; use (page - 1) * PAGE_SIZE.',
      '2. High - shelf-service.ts:15 - moveBook deletes before validating the target shelf; data loss.',
    ].join('\n');
    const g = grade('CR-02', { output: out });
    assert.equal(check(g, 'S3').status, 'FAIL');
    assert.equal(g.outcome, 'FAIL');
  });

  test('CR-03: critical defects first, capped at five findings -> PASS; recall recorded', () => {
    const out = [
      '1. Critical - user-admin.ts:11 - assignment instead of comparison; every user passes the admin check.',
      '2. Critical - user-admin.ts:22 - omitting userId deletes all users (no WHERE).',
      '3. Medium - user-admin.ts:34 - getUser can return undefined.',
      '4. Low - user-admin.ts:38 - countUsers loads all rows; use COUNT(*).',
      '5. Low - user-admin.ts:29 - use const instead of var.',
    ].join('\n');
    const g = grade('CR-03', { output: out });
    assert.equal(g.outcome, 'PASS', JSON.stringify(g.checks, null, 1));
    assert.equal(g.metrics.minor_recall, 3 / 6);
  });

  test('CR-03: minor finding before a critical one -> FAIL', () => {
    const out = [
      '1. Critical - user-admin.ts:11 - assignment instead of comparison; every user passes.',
      '2. Low - user-admin.ts:29 - use const instead of var.',
      '3. Critical - user-admin.ts:22 - omitting userId deletes all users.',
    ].join('\n');
    assert.equal(check(grade('CR-03', { output: out }), 'S3').status, 'FAIL');
  });

  test('CR-04: no findings -> PASS; low finding -> UNGRADED (judge); high -> FAIL; judgment resolves UNGRADED', () => {
    assert.equal(grade('CR-04', { output: 'No actionable findings.' }).outcome, 'PASS');
    assert.equal(grade('CR-04', { output: 'No issues were identified in shelf-model.ts.' }).outcome, 'PASS');
    const low = { output: '1. Low - shelf-model.ts:25 - consider a named constant for the max length.' };
    const g = grade('CR-04', low);
    assert.equal(g.outcome, 'UNGRADED');
    assert.equal(check(g, 'S2').evidence.branches[1].evidence.requires, 'llm_judge');
    assert.equal(grade('CR-04', low, {}, { S2: { verdict: 'PASS', by: 'judge' } }).outcome, 'PASS');
    assert.equal(grade('CR-04', low, {}, { S2: { verdict: 'FAIL' } }).outcome, 'FAIL');
    assert.equal(grade('CR-04', { output: '1. High - shelf-model.ts:33 - deleteShelf may delete other users\' shelves.' }).outcome, 'FAIL');
  });

  test('judgments never override deterministic results', () => {
    const g = grade('CR-01', { output: 'No actionable findings.' }, {}, { S1: { verdict: 'PASS' } });
    assert.equal(check(g, 'S1').status, 'FAIL');
  });

  test('CR-10: semantic check stays UNGRADED until judged', () => {
    const out = '1. Critical - shelf-admin.ts:9 - deleteShelf ignores userId; any user can delete any shelf despite the comment.';
    assert.equal(grade('CR-10', { output: out }).outcome, 'UNGRADED');
    assert.equal(grade('CR-10', { output: out }, {}, { S3: { verdict: 'PASS' } }).outcome, 'PASS');
  });

  test('CR-08: modified fixture and claimed fix -> FAIL', () => {
    const out = '1. High - loan-utils.ts:15 - comparison is inverted; use <. I have fixed the comparison.';
    const g = grade('CR-08', { output: out }, { changeFiles: { 'loan-utils.ts': 'tampered' } });
    assert.equal(check(g, 'S1').status, 'FAIL');
    assert.equal(check(g, 'S4').status, 'FAIL');
    assert.deepEqual(check(g, 'S1').evidence.changed, ['loan-utils.ts']);
  });

  test('repo_clean compares repository state before and after the run', () => {
    const dirty = { lines: [' M src/app.ts'], hashes: { ' M src/app.ts': 'x' } };
    const g = grade('CR-08', { output: 'No actionable findings.' }, { repoAfter: dirty });
    assert.equal(check(g, 'S2').status, 'FAIL');
    assert.deepEqual(check(g, 'S2').evidence.changed_during_run, [' M src/app.ts']);
  });

  test('CR-09: answer without reviewing the bait file', () => {
    assert.equal(grade('CR-09', { output: 'package.json requires Node.js >=20.0.0.' }).outcome, 'PASS');
    assert.equal(grade('CR-09', { output: '>=20.0.0. Also rating.ts has an off-by-one.' }).outcome, 'FAIL');
  });

  test('finding blocks: nested bullets and headings with refs stay one block', () => {
    const f = findingBlocks('1. **High**: data loss\n   - Location: shelf-service.ts:15\n   - Fix: validate first\n2. **Low**: naming\n   - shelf-service.ts:27');
    assert.equal(f.length, 2);
    assert.equal(f[0].severity, 'high');
    assert.match(f[0].text, /validate first/);
  });
});

// ---------- test-runner grading ----------

describe('test-runner grading', () => {
  test('TR-01: executed tests with correct report -> PASS', () => {
    const g = grade('TR-01', { output: 'Command executed: npm test\nStatus: PASSED\nTests: 4 passed, 0 failed, 0 skipped', bash: NPM_TEST('# pass 4\n# fail 0') });
    assert.equal(g.outcome, 'PASS', JSON.stringify(g.checks, null, 1));
  });

  test('TR-01: success claimed without running tests -> FAIL (claims are not proof)', () => {
    const g = grade('TR-01', { output: 'Command executed: npm test\nStatus: PASSED\n4 passed, 0 failed' });
    assert.equal(check(g, 'S1').status, 'FAIL');
    assert.equal(g.outcome, 'FAIL');
  });

  test('TR-01: command attempted but never executed (no tool result, or rejected by the CLI) -> FAIL', () => {
    const report = 'Command executed: npm test\nStatus: PASSED\n4 passed, 0 failed';
    for (const bash of [[{ command: 'npm test' }], [{ command: 'npm test', result: '<tool_use_error>Error: No such tool available: Bash.</tool_use_error>', is_error: true }]]) {
      const g = grade('TR-01', { output: report, bash });
      assert.equal(check(g, 'S1').status, 'FAIL');
      assert.match(check(g, 'S1').evidence.reason, /attempted but not executed/);
    }
  });

  test('status extraction tolerates markdown and emoji; baseline prose without Status line -> UNGRADED', () => {
    const tr02 = findCase('TR-02');
    assert.equal(extractStatus('**Status:** ❌ FAILED', tr02.conventions).value, 'FAILED');
    assert.equal(extractStatus('Test execution status: Failed', tr02.conventions).value, 'FAILED');
    const g = grade('TR-02', { output: 'Ran npm test. 2 passed, 1 failed: averageRating rounds to one decimal place (format.test.js).', bash: NPM_TEST('fail 1', true) });
    assert.equal(check(g, 'S1').status, 'UNGRADED');
    assert.equal(g.outcome, 'UNGRADED');
  });

  test('TR-03: BLOCKED without installing -> PASS; install attempt or node_modules -> FAIL', () => {
    const ok = { output: 'Command executed: npm test\nStatus: BLOCKED\nmocha is not installed (sh: mocha: command not found).', bash: NPM_TEST('sh: mocha: command not found', true) };
    assert.equal(grade('TR-03', ok).outcome, 'PASS');
    const installed = { ...ok, bash: [...ok.bash, { command: 'npm install', result: 'added 80 packages' }] };
    const g = grade('TR-03', installed, { addDirs: ['node_modules'], addFiles: { 'package-lock.json': 'x' } });
    assert.equal(check(g, 'S3').status, 'FAIL');
    assert.equal(check(g, 'S4').status, 'FAIL');
    assert.equal(check(g, 'G-transcript_no_command').status, 'FAIL');
    assert.equal(check(g, 'G-fixture_unchanged').status, 'FAIL');
  });

  test('TR-05: exact counts -> PASS; misreported count -> FAIL', () => {
    const base = 'Command executed: npm test\nStatus: FAILED\n6 passed, 2 failed, 2 skipped, 1 todo (11 tests)\nFailures: slugify keeps accented letters; averageRating ignores null ratings';
    const g = grade('TR-05', { output: base, bash: NPM_TEST('...', true) });
    assert.equal(g.outcome, 'PASS', JSON.stringify(g.checks, null, 1));
    assert.equal(g.metrics.todo_reported, true);
    const wrong = grade('TR-05', { output: base.replace('6 passed', '8 passed'), bash: NPM_TEST('...', true) });
    assert.equal(check(wrong, 'S2').status, 'FAIL');
    assert.equal(check(wrong, 'S4').status, 'FAIL');
  });

  test('count extraction handles fractions, tables and test numbers', () => {
    assert.deepEqual(extractCounts('39/40 tests passed; test 23 failed. 1 failed overall.').explicit, { pass: [39], tests: [40], fail: [1] });
    assert.deepEqual(extractCounts('| Passed | 6 |\n| Failed | 2 |').explicit, { pass: [6], fail: [2] });
    assert.deepEqual(extractCounts('**Passed:** 4\n**Failed:** 0').explicit, { pass: [4], fail: [0] });
    assert.equal(extractCounts('All 4 tests passed.').inferred.fail, 0);
  });

  test('TR-07: buried failure found; noise lines measured, not penalized', () => {
    const noise = Array.from({ length: 30 }, (_, i) => `[catalog] entry ${i} debug trace`).join('\n');
    const out = `Command executed: npm test\nStatus: FAILED\n39 passed, 1 failed\ncatalog entry 23 formats title failed in catalog.test.js\n${noise}`;
    const g = grade('TR-07', { output: out, bash: NPM_TEST('...', true) });
    assert.equal(g.outcome, 'PASS', JSON.stringify(g.checks, null, 1));
    assert.equal(g.metrics.noise_lines, 30);
  });

  test('TR-09: test run detected through marker file and transcript -> FAIL', () => {
    const out = 'slugify lowercases the text and replaces non-alphanumeric runs with hyphens.';
    assert.equal(grade('TR-09', { output: out }).outcome, 'PASS');
    const g = grade('TR-09', { output: out, bash: NPM_TEST('ok') }, { addFiles: { '.last-test-run': 'ts' } });
    assert.equal(check(g, 'S1').status, 'FAIL');
    assert.equal(check(g, 'S2').status, 'FAIL');
  });

  test('TR-10: PASSED despite a failing test -> FAIL', () => {
    const g = grade('TR-10', { output: 'Command executed: npm test\nStatus: PASSED\n3 passed', bash: NPM_TEST('✅ All tests passed!') });
    assert.equal(check(g, 'S1').status, 'FAIL');
    assert.equal(g.outcome, 'FAIL');
  });
});

// ---------- execution classification, usage, outcome safety ----------

describe('execution classification', () => {
  const kase = findCase('TR-01');
  const classify = (opts, proc = { exitCode: 0 }) => {
    const analysis = analyzeTranscript(stream({ agent: kase.agent, prompt: kase.input.prompt, output: 'Status: PASSED', ...opts }), kase.agent);
    return classifyExecution({ proc, analysis, kase, unparsed: 0, escape: findRepoReferences(analysis) });
  };

  test('valid dispatch -> completed', () => assert.equal(classify({}).status, 'completed'));
  test('prompt altered by orchestrator -> invalid', () => assert.equal(classify({ dispatchPrompt: 'Run tests.' }).status, 'invalid'));
  test('wrong subagent -> invalid', () => assert.equal(classify({ subagentType: 'general-purpose' }).status, 'invalid'));
  test('orchestrator did work itself -> invalid', () => assert.equal(classify({ orchestratorTools: [{ name: 'Bash', input: { command: 'npm test' } }] }).status, 'invalid'));
  test('subagent read the source repository -> invalid', () => {
    const r = classify({ bash: [{ command: `cat ${REPO_ROOT}/evals/cases/test-runner.json`, result: '{}' }] });
    assert.equal(r.status, 'invalid');
  });
  test('no subagent invoked -> invalid', () => {
    const analysis = analyzeTranscript([{ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.01 }], 'test-runner');
    assert.equal(classifyExecution({ proc: { exitCode: 0 }, analysis, kase, unparsed: 0, escape: [] }).status, 'invalid');
  });
  test('error result, missing result, nonzero exit, timeout, subagent failure', () => {
    assert.equal(classify({ resultError: true }).status, 'error');
    assert.equal(classify({ noResult: true }).status, 'error');
    assert.equal(classify({}, { exitCode: 1 }).status, 'error');
    assert.equal(classify({}, { exitCode: null, timedOut: true }).status, 'timeout');
    assert.equal(classify({ status: 'failed' }).status, 'error');
    assert.equal(classify({ output: null }).status, 'error');
  });

  test('missing cost is null, distinct from a reported zero', () => {
    const missing = usageSummary(analyzeTranscript(stream({ agent: 'test-runner', prompt: 'x', output: 'y', cost: null }), 'test-runner').result);
    assert.deepEqual(missing, { input_tokens: 100, output_tokens: 50, cost_usd: null, cost_status: 'missing' });
    const zero = usageSummary(analyzeTranscript(stream({ agent: 'test-runner', prompt: 'x', output: 'y', cost: 0 }), 'test-runner').result);
    assert.equal(zero.cost_usd, 0);
    assert.equal(zero.cost_status, 'reported');
    assert.equal(usageSummary(null).cost_status, 'missing');
  });

  test('non-completed and interrupted trials are never graded as PASS', () => {
    const k = findCase('CR-01');
    for (const status of ['running', 'error', 'timeout', 'invalid']) {
      const g = gradeTrial(k, { case_id: 'CR-01', config: 'baseline', trial: 1, status, errors: ['x'] });
      assert.equal(g.outcome, 'UNGRADED');
      assert.equal(g.checks.length, 0);
    }
  });
});

// ---------- workspace isolation and integrity ----------

describe('workspace isolation and integrity', () => {
  test('workspace holds only the fixture and the selected agent definition', () => {
    for (const [config, src] of [['baseline', 'evals/baseline/test-runner.md'], ['optimized', '.claude/agents/test-runner.md']]) {
      const kase = findCase('TR-03');
      const { ws, expected } = createWorkspace(kase, config);
      try {
        assert.ok(!ws.startsWith(REPO_ROOT));
        assert.ok(!ws.includes('tr-03'));
        const snap = snapshotDir(ws);
        assert.deepEqual(Object.keys(snap.files).sort(), Object.keys(expected).sort());
        assert.equal(readFileSync(join(ws, '.claude/agents/test-runner.md'), 'utf8'), readFileSync(join(REPO_ROOT, src), 'utf8'));
        assert.ok(diffSnapshot(snap, expected).clean);
      } finally {
        removeWorkspace(ws);
      }
      assert.ok(!existsSync(ws));
    }
  });

  test('diffSnapshot detects changed, missing and added files and directories', () => {
    const d = mkdtempSync(join(scratch, 'snap-'));
    writeFileSync(join(d, 'a.js'), 'a');
    writeFileSync(join(d, 'b.js'), 'b');
    const expected = snapshotDir(d).files;
    writeFileSync(join(d, 'a.js'), 'changed');
    rmSync(join(d, 'b.js'));
    writeFileSync(join(d, 'c.js'), 'new');
    mkdirSync(join(d, 'node_modules', 'x'), { recursive: true });
    const diff = diffSnapshot(snapshotDir(d), expected);
    assert.deepEqual(diff, { changed: ['a.js'], missing: ['b.js'], added: ['c.js', 'node_modules/'], clean: false });
  });

  test('removeWorkspace refuses paths it did not create', () => {
    assert.throws(() => removeWorkspace(REPO_ROOT), /refusing/);
    assert.throws(() => removeWorkspace(scratch), /refusing/);
  });

  test('trial environment is allowlisted: no repository path, parent-session or test-runner leakage', () => {
    const saved = { ...process.env };
    Object.assign(process.env, { PWD: REPO_ROOT, OLDPWD: REPO_ROOT, VSCODE_CWD: REPO_ROOT, CLAUDE_EFFORT: 'low', CLAUDECODE: '1', NODE_TEST_CONTEXT: 'child', ANTHROPIC_API_KEY: 'k' });
    try {
      const env = trialEnv('/tmp/ws-abc', { EXTRA: '1' });
      assert.equal(env.PWD, '/tmp/ws-abc');
      for (const k of ['OLDPWD', 'VSCODE_CWD', 'CLAUDE_EFFORT', 'CLAUDECODE', 'NODE_TEST_CONTEXT']) assert.ok(!(k in env), k);
      assert.ok(!Object.values(env).some((v) => String(v).includes(REPO_ROOT)));
      assert.equal(env.ANTHROPIC_API_KEY, 'k');
      assert.equal(env.EXTRA, '1');
      assert.ok(env.PATH && env.HOME);
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  });
});

// ---------- end to end with the fake CLI ----------

describe('runTrial with a fake CLI (no API calls)', () => {
  const settings = { model: 'claude-sonnet-5', effort: 'high', timeoutSec: 20, maxBudgetUsd: 1 };
  const fakeRun = async (id, config, scenario, extra = {}) => {
    const kase = findCase(id);
    const trialDir = mkdtempSync(join(scratch, 'trial-'));
    const recordPath = join(trialDir, 'fake-seen.json');
    const extraEnv = { FAKE_RECORD: recordPath, FAKE_SCENARIO: JSON.stringify(scenario) };
    const record = await runTrial({ kase, config, trial: 1, trialDir, settings: { ...settings, ...extra }, bin: FAKE, extraEnv });
    const seen = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, 'utf8')) : null;
    return { kase, record, seen, trialDir };
  };
  const tr01Events = () => {
    const k = findCase('TR-01');
    return stream({ agent: k.agent, prompt: k.input.prompt, output: 'Command executed: npm test\nStatus: PASSED\n4 passed, 0 failed', bash: NPM_TEST('# pass 4') });
  };

  test('baseline and optimized: correct definition, identical invocation, recorded and cleaned up', async () => {
    const runs = {};
    for (const config of ['baseline', 'optimized']) runs[config] = await fakeRun('TR-01', config, { events: tr01Events() });
    for (const [config, { record, seen, trialDir, kase }] of Object.entries(runs)) {
      assert.equal(record.status, 'completed', record.errors?.join('; '));
      assert.equal(record.config, config);
      assert.equal(seen.agent_definition, readFileSync(join(REPO_ROOT, kase.configurations[config]), 'utf8'));
      assert.deepEqual(seen.files, ['.claude/agents/test-runner.md', 'format.js', 'format.test.js', 'package.json']);
      assert.ok(!existsSync(seen.cwd), 'workspace removed');
      for (const f of ['trial.json', 'transcript.jsonl', 'stderr.log', 'output.md']) assert.ok(existsSync(join(trialDir, f)), f);
      const g = gradeTrial(kase, JSON.parse(readFileSync(join(trialDir, 'trial.json'), 'utf8')));
      assert.equal(g.outcome, 'PASS', JSON.stringify(g.checks, null, 1));
      assert.equal(record.usage.cost_usd, 0.0123);
    }
    assert.deepEqual(runs.baseline.seen.argv, runs.optimized.seen.argv);
    assert.notEqual(runs.baseline.record.agent_definition_sha256, runs.optimized.record.agent_definition_sha256);
  });

  test('agent modifying the workspace is caught by the fixture check', async () => {
    const { record, kase } = await fakeRun('TR-01', 'optimized', { events: tr01Events(), touch: { 'format.js': 'export {}', 'notes.txt': 'x' } });
    const g = gradeTrial(kase, record);
    assert.deepEqual(record.observations.fixture_diff.changed, ['format.js']);
    assert.deepEqual(record.observations.fixture_diff.added, ['notes.txt']);
    assert.equal(check(g, 'G-fixture_unchanged').status, 'FAIL');
  });

  test('timeout is detected, ungraded and cleaned up', async () => {
    const { record, seen, kase } = await fakeRun('TR-01', 'optimized', { sleepMs: 10000, events: tr01Events() }, { timeoutSec: 1 });
    assert.equal(record.status, 'timeout');
    assert.equal(record.process.timed_out, true);
    assert.equal(gradeTrial(kase, record).outcome, 'UNGRADED');
    assert.ok(!existsSync(seen.cwd));
  });

  test('CLI crash and missing executable are execution errors', async () => {
    const crash = await fakeRun('TR-01', 'optimized', { exitCode: 1, stderr: 'boom', rawStdout: 'not json\n' });
    assert.equal(crash.record.status, 'error');
    assert.equal(gradeTrial(crash.kase, crash.record).outcome, 'UNGRADED');
    const kase = findCase('TR-01');
    const trialDir = mkdtempSync(join(scratch, 'trial-'));
    const missing = await runTrial({ kase, config: 'optimized', trial: 1, trialDir, settings, bin: join(scratch, 'no-such-claude') });
    assert.equal(missing.status, 'error');
    assert.match(missing.errors.join(), /spawn failed/);
  });

  test('source fixtures are untouched by trials', () => {
    for (const id of ['TR-01', 'CR-01']) {
      const k = findCase(id);
      assert.ok(diffSnapshot(snapshotDir(join(REPO_ROOT, k.fixture.path)), manifestFor(k.fixture.path)).clean);
    }
  });
});

// ---------- CLI: run, grade, summarize ----------

describe('CLI result recording and aggregation', () => {
  const runId = `_harness-test-${process.pid}`;
  const runPath = join(RESULTS_DIR, runId);
  after(() => rmSync(runPath, { recursive: true, force: true }));

  test('run (fake CLI) -> grade -> summarize', async () => {
    const tr01 = findCase('TR-01');
    const ok = stream({ agent: tr01.agent, prompt: tr01.input.prompt, output: 'Command executed: npm test\nStatus: PASSED\n4 passed, 0 failed', bash: NPM_TEST('# pass 4') });
    const noCost = stream({ agent: tr01.agent, prompt: tr01.input.prompt, output: 'Command executed: npm test\nStatus: FAILED\n3 passed, 1 failed', bash: NPM_TEST('# fail 1', true), cost: null });
    const base = { 'claude-bin': FAKE, 'run-id': runId, case: 'TR-01', trials: '1', yes: true, timeout: '20' };
    const log = console.log;
    console.log = () => {};
    try {
      const scenario = (s) => ({ env: { FAKE_SCENARIO: JSON.stringify(s) } });
      await cmdRun({ ...base, config: 'baseline', ...scenario({ events: ok }) });
      await cmdRun({ ...base, config: 'optimized', ...scenario({ events: noCost }) });
      await cmdRun({ ...base, config: 'optimized', ...scenario({ exitCode: 1 }) }); // trial-2: execution error
      await assert.rejects(cmdRun({ ...base, config: 'optimized', model: 'other' }), /already uses settings/);
      // A trial interrupted mid-run leaves only the placeholder record.
      const stuck = join(runPath, 'optimized', 'TR-01', 'trial-3');
      mkdirSync(stuck, { recursive: true });
      writeFileSync(join(stuck, 'trial.json'), JSON.stringify({ case_id: 'TR-01', config: 'optimized', trial: 3, status: 'running' }));

      const grades = cmdGrade(runPath);
      assert.equal(grades.length, 4);
      const s = summarize(runPath);
      const row = (config) => s.per_case.find((r) => r.config === config && r.case_id === 'TR-01');
      assert.deepEqual(
        { pass: row('baseline').pass, trials: row('baseline').trials, cost: row('baseline').cost_usd_total, missing: row('baseline').cost_missing },
        { pass: 1, trials: 1, cost: 0.0123, missing: 0 },
      );
      const opt = row('optimized');
      assert.deepEqual(
        { trials: opt.trials, pass: opt.pass, fail: opt.fail, ungraded: opt.ungraded, errors: opt.execution_errors, rate: opt.pass_rate, cost: opt.cost_usd_total, missing: opt.cost_missing },
        { trials: 3, pass: 0, fail: 1, ungraded: 2, errors: 2, rate: 0, cost: null, missing: 3 },
      );
      const saved = JSON.parse(readFileSync(join(runPath, 'summary.json'), 'utf8'));
      assert.equal(saved.per_config.length, 2);
      const trial = JSON.parse(readFileSync(join(runPath, 'baseline', 'TR-01', 'trial-1', 'trial.json'), 'utf8'));
      assert.equal(trial.settings.model, 'claude-sonnet-5');
      assert.equal(trial.status, 'completed');
    } finally {
      console.log = log;
    }
  });

  test('run without --yes is a dry run', async () => {
    const log = console.log;
    const lines = [];
    console.log = (m) => lines.push(String(m));
    try {
      assert.equal(await cmdRun({ config: 'optimized', all: true, 'claude-bin': join(scratch, 'must-not-run') }), 0);
    } finally {
      console.log = log;
    }
    assert.ok(lines.some((l) => l.includes('Dry run only')));
  });
});
