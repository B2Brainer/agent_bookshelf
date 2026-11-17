// Opt-in: drives the REAL installed `claude` CLI through runTrial, with the Messages API
// replaced by a local mock (ANTHROPIC_BASE_URL). Verifies that the harness invokes the actual
// subagent definition and records its transcript. No model is called; nothing is billed.
// Run: EVALS_CLI_INTEGRATION=1 node --test evals/test/cli-integration.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findCase, REPO_ROOT } from '../lib/dataset.mjs';
import { runTrial } from '../lib/run.mjs';
import { gradeTrial } from '../lib/grade.mjs';
import { startMockApi } from './mock-api.mjs';

const enabled = process.env.EVALS_CLI_INTEGRATION === '1';
const scratch = mkdtempSync(join(tmpdir(), 'harness-cli-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

for (const config of ['baseline', 'optimized']) {
  test(`real CLI dispatches the ${config} test-runner subagent (mock API)`, { skip: !enabled && 'set EVALS_CLI_INTEGRATION=1' }, async () => {
    const kase = findCase('TR-01');
    const mock = await startMockApi({
      agent: 'test-runner',
      agentMarker: 'You are a software testing specialist.',
      command: 'npm test',
      report: 'Command executed: npm test\nStatus: PASSED\nTests: 4 passed, 0 failed, 0 skipped',
    });
    try {
      const trialDir = mkdtempSync(join(scratch, 'trial-'));
      const extraEnv = { ANTHROPIC_BASE_URL: mock.url, ANTHROPIC_API_KEY: 'sk-ant-offline-mock' };
      const settings = { model: 'claude-sonnet-5', effort: 'high', timeoutSec: 90, maxBudgetUsd: 1 };
      const record = await runTrial({ kase, config, trial: 1, trialDir, settings, extraEnv });

      assert.ok(mock.requests.length > 0, 'CLI must talk to the mock, not the real API');
      assert.equal(record.status, 'completed', record.errors?.join('; '));
      assert.equal(record.analysis.dispatch.subagent_type, 'test-runner');
      assert.equal(record.analysis.dispatch.prompt, kase.input.prompt);

      // The subagent request carries this configuration's definition and its own tool set.
      const sub = mock.requests.find((r) => r.isSubagent);
      assert.ok(sub, 'subagent request seen');
      const def = readFileSync(join(REPO_ROOT, kase.configurations[config]), 'utf8');
      const returnSection = def.slice(def.indexOf('Return:')).trim().split('\n')[1];
      assert.ok(sub.system.includes(JSON.stringify(returnSection).slice(1, -1)), `system prompt contains "${returnSection}"`);
      assert.ok(sub.tools.includes('Bash'));
      assert.ok(!sub.tools.includes('Agent'));

      // The Bash call really ran in the workspace: the result is real `node --test` output.
      const bash = record.analysis.tool_calls.find((t) => t.name === 'Bash');
      assert.equal(bash.executed, true);
      assert.match(bash.result_excerpt, /pass 4/);

      const g = gradeTrial(kase, record);
      assert.equal(g.outcome, 'PASS', JSON.stringify(g.checks, null, 1));
      assert.ok(!existsSync(join(tmpdir(), record.command.cwd_basename)), 'workspace removed');
    } finally {
      mock.close();
    }
  });
}
