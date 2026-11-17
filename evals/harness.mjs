#!/usr/bin/env node
// Evaluation harness CLI. Run from the repository root. See evals/README.md.
//   node evals/harness.mjs validate
//   node evals/harness.mjs run --config baseline|optimized (--case CR-01[,TR-02] | --all [--agent test-runner]) [--trials 3] [--run-id ID] --yes
//   node evals/harness.mjs grade <run-id>
//   node evals/harness.mjs summarize <run-id>
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { REPO_ROOT, EVALS_DIR, RESULTS_DIR, CONFIGS, AGENTS, loadCases, findCase, datasetChecksum } from './lib/dataset.mjs';
import { DEFAULT_SETTINGS, claudeArgs, runTrial, writeJson, cliVersion, gitRevision } from './lib/run.mjs';
import { gradeTrial } from './lib/grade.mjs';
import { createAdjudication, applyAdjudication } from './lib/adjudicate.mjs';

const USAGE = `usage:
  node evals/harness.mjs validate
  node evals/harness.mjs run --config <baseline|optimized> (--case <ID[,ID...]> | --all [--agent <code-reviewer|test-runner>])
                             [--trials N] [--run-id ID] [--model M] [--effort E] [--timeout SEC] [--max-budget-usd USD]
                             [--keep-workspace] --yes
  node evals/harness.mjs grade <run-id|dir>
  node evals/harness.mjs adjudicate <run-id|dir> [--apply]
  node evals/harness.mjs summarize <run-id|dir>`;

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

function validate() {
  const r = spawnSync(process.execPath, [join(EVALS_DIR, 'validate-dataset.mjs')], { cwd: REPO_ROOT, stdio: 'inherit' });
  return r.status === 0;
}

function runDir(arg) {
  if (!arg) throw new Error('missing run id');
  const dir = isAbsolute(arg) || arg.includes('/') ? arg : join(RESULTS_DIR, arg);
  if (!existsSync(dir)) throw new Error(`no such run: ${dir}`);
  return dir;
}

// trial.json files under a run directory: <run>/<config>/<case>/trial-<n>/trial.json
function trialDirs(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = join(d, e.name);
      if (existsSync(join(p, 'trial.json'))) out.push(p);
      else walk(p);
    }
  };
  walk(dir);
  return out.sort();
}

export async function cmdRun(opts) {
  if (!CONFIGS.includes(opts.config)) throw new Error(`--config must be one of ${CONFIGS.join(', ')}`);
  let cases = loadCases();
  if (opts.case) {
    cases = opts.case.split(',').map((id) => findCase(id.trim()));
  } else if (!opts.all) throw new Error('pass --case <ID> or --all');
  if (opts.agent) {
    if (!AGENTS.includes(opts.agent)) throw new Error(`--agent must be one of ${AGENTS.join(', ')}`);
    cases = cases.filter((c) => c.agent === opts.agent);
  }
  const settings = {
    model: opts.model ?? DEFAULT_SETTINGS.model,
    effort: opts.effort ?? DEFAULT_SETTINGS.effort,
    timeoutSec: Number(opts.timeout ?? DEFAULT_SETTINGS.timeoutSec),
    maxBudgetUsd: Number(opts['max-budget-usd'] ?? DEFAULT_SETTINGS.maxBudgetUsd),
  };
  const trials = Number(opts.trials ?? 3);
  if (!Number.isInteger(trials) || trials < 1) throw new Error('--trials must be a positive integer');
  const runId = opts['run-id'] ?? new Date().toISOString().replace(/[:.]/g, '-');
  const bin = opts['claude-bin'] ?? 'claude';

  console.log(`run ${runId}: config=${opts.config} cases=${cases.map((c) => c.id).join(',')} trials=${trials}`);
  console.log(`settings: ${JSON.stringify(settings)}`);
  console.log(`command (per trial, cwd = fresh temp workspace): ${bin} ${claudeArgs('<agent>', '<case prompt>', settings).map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
  if (!opts.yes) {
    console.log('\nDry run only: nothing was executed. Agent runs are billed; add --yes to execute.');
    return 0;
  }
  if (!validate()) throw new Error('dataset validation failed; not running');

  const dir = join(RESULTS_DIR, runId);
  mkdirSync(dir, { recursive: true });
  // Every configuration in a run must use identical settings, dataset and CLI version.
  const runFile = join(dir, 'run.json');
  const pinned = { settings, dataset_sha256: datasetChecksum(), claude_cli_version: cliVersion(bin) };
  if (existsSync(runFile)) {
    const prev = read(runFile);
    for (const [k, v] of Object.entries(pinned)) {
      if (JSON.stringify(prev[k]) !== JSON.stringify(v)) {
        throw new Error(`run ${runId} was recorded with ${k}=${JSON.stringify(prev[k])}, now ${JSON.stringify(v)}; use a new --run-id`);
      }
    }
  } else {
    writeJson(runFile, { run_id: runId, created_at: new Date().toISOString(), ...pinned, ...gitRevision(), node_version: process.version, claude_bin: bin });
  }

  let failures = 0;
  for (const kase of cases) {
    const caseDir = join(dir, opts.config, kase.id);
    mkdirSync(caseDir, { recursive: true });
    const existing = readdirSync(caseDir).map((n) => Number(n.match(/^trial-(\d+)$/)?.[1] ?? 0));
    const first = Math.max(0, ...existing) + 1;
    for (let t = first; t < first + trials; t++) {
      const trialDir = join(caseDir, `trial-${t}`);
      const record = await runTrial({ kase, config: opts.config, trial: t, trialDir, settings, bin, extraEnv: opts.env, keepWorkspace: opts['keep-workspace'] });
      const grade = gradeTrial(kase, record, readJudgments(trialDir));
      writeJson(join(trialDir, 'grade.json'), grade);
      if (record.status !== 'completed') failures++;
      const cost = record.usage?.cost_usd ?? null;
      console.log(`${kase.id} ${opts.config} trial ${t}: ${record.status} -> ${grade.outcome}` +
        ` (cost ${cost === null ? 'n/a' : '$' + cost.toFixed(4)}, ${record.process?.duration_ms ?? '?'} ms)` +
        (record.errors?.length ? ` [${record.errors.join('; ')}]` : ''));
    }
  }
  console.log(`\nresults: ${relative(REPO_ROOT, dir)}`);
  return failures ? 2 : 0;
}

function readJudgments(trialDir) {
  const p = join(trialDir, 'judgments.json');
  return existsSync(p) ? read(p) : {};
}

export function cmdGrade(dir) {
  const rows = [];
  for (const td of trialDirs(dir)) {
    const trial = read(join(td, 'trial.json'));
    const grade = gradeTrial(findCase(trial.case_id), trial, readJudgments(td));
    writeJson(join(td, 'grade.json'), grade);
    rows.push(grade);
    const notes = grade.checks.filter((c) => c.status !== 'PASS').map((c) => `${c.id}=${c.status}`).join(' ');
    console.log(`${trial.case_id} ${trial.config} trial ${trial.trial}: ${grade.outcome}${grade.reason ? ` (${grade.reason})` : ''}${notes ? ` [${notes}]` : ''}`);
  }
  if (!rows.length) console.log('no trials found');
  return rows;
}

export function summarize(dir) {
  const groups = new Map();
  for (const td of trialDirs(dir)) {
    const trial = read(join(td, 'trial.json'));
    const gradePath = join(td, 'grade.json');
    // A trial without grade.json (e.g. interrupted) is graded on the fly; a "running" trial grades as UNGRADED.
    const grade = existsSync(gradePath) ? read(gradePath) : gradeTrial(findCase(trial.case_id), trial, readJudgments(td));
    const key = `${trial.config}\t${trial.case_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ trial, grade });
  }
  const stats = (items) => {
    const n = items.length;
    const count = (o) => items.filter((i) => i.grade.outcome === o).length;
    const costs = items.map((i) => i.trial.usage?.cost_usd).filter((c) => typeof c === 'number');
    const durations = items.map((i) => i.trial.process?.duration_ms).filter((d) => typeof d === 'number');
    const chars = items.map((i) => i.grade.metrics?.output_chars).filter((d) => typeof d === 'number');
    const outTok = items.map((i) => i.trial.usage?.output_tokens).filter((d) => typeof d === 'number');
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const graded = count('PASS') + count('FAIL');
    const execErrors = items.filter((i) => i.trial.status !== 'completed').length;
    return {
      trials: n,
      graded,
      pass: count('PASS'),
      fail: count('FAIL'),
      ungraded: count('UNGRADED'),
      ungraded_unresolved_checks: count('UNGRADED') - execErrors,
      execution_errors: execErrors,
      // UNGRADED trials are excluded from both numerator and denominator: neither pass nor fail.
      pass_rate: graded ? count('PASS') / graded : null,
      cost_usd_total: costs.length ? costs.reduce((a, b) => a + b, 0) : null,
      cost_missing: n - costs.length,
      mean_duration_ms: mean(durations),
      mean_output_chars: mean(chars),
      mean_output_tokens: mean(outTok),
    };
  };
  const perCase = [...groups.entries()].map(([key, items]) => {
    const [config, case_id] = key.split('\t');
    return { config, case_id, ...stats(items) };
  }).sort((a, b) => a.case_id.localeCompare(b.case_id) || a.config.localeCompare(b.config));
  const perConfig = CONFIGS.map((config) => {
    const rows = perCase.filter((r) => r.config === config);
    const items = [...groups.entries()].filter(([k]) => k.startsWith(config + '\t')).flatMap(([, v]) => v);
    if (!items.length) return null;
    return {
      config,
      cases: rows.length,
      cases_fully_graded: rows.filter((r) => r.ungraded === 0).length,
      cases_with_ungraded: rows.filter((r) => r.ungraded > 0).length,
      ...stats(items),
    };
  }).filter(Boolean);
  const runFile = join(dir, 'run.json');
  const summary = { generated_at: new Date().toISOString(), run: existsSync(runFile) ? read(runFile) : null, per_case: perCase, per_config: perConfig };
  writeJson(join(dir, 'summary.json'), summary);

  const fmt = (v, d = 0) => (v === null ? 'n/a' : typeof v === 'number' ? v.toFixed(d) : v);
  const cost = (r) => (r.cost_usd_total === null ? 'n/a' : `$${r.cost_usd_total.toFixed(4)}`) + (r.cost_missing ? ` (${r.cost_missing} missing)` : '');
  const header = ['case', 'config', 'trials', 'graded', 'PASS', 'FAIL', 'UNGRADED', 'exec-err', 'pass-rate', 'cost', 'mean-ms', 'mean-chars'];
  const line = (r, label) => [label ?? r.case_id, r.config, r.trials, r.graded, r.pass, r.fail, r.ungraded, r.execution_errors, r.pass_rate === null ? 'n/a' : `${Math.round(r.pass_rate * 100)}%`, cost(r), fmt(r.mean_duration_ms), fmt(r.mean_output_chars)];
  const table = [header, ...perCase.map((r) => line(r)), ...perConfig.map((r) => line(r, 'ALL'))];
  const widths = header.map((_, i) => Math.max(...table.map((row) => String(row[i]).length)));
  for (const row of table) console.log(row.map((c, i) => String(c).padEnd(widths[i])).join('  '));
  for (const r of perConfig) console.log(`${r.config}: ${r.cases_fully_graded} of ${r.cases} cases fully graded, ${r.cases_with_ungraded} with UNGRADED trials`);
  console.log('\npass-rate = PASS / (PASS + FAIL). UNGRADED trials (unresolved checks or execution errors) count as neither and are reported separately.');
  console.log('Cost and tokens are session-wide (orchestrator turns, subagent, session-title request). Cost totals exclude trials with missing cost data.');
  return summary;
}

export function cmdAdjudicate(dir, apply) {
  if (apply) {
    const r = applyAdjudication(dir);
    console.log(`applied ${r.applied} verdicts; ${r.pending} still undecided; ${r.invalid} invalid (left UNGRADED)`);
    cmdGrade(dir);
    return r;
  }
  const r = createAdjudication(dir, trialDirs(dir));
  console.log(r.items ? `wrote ${r.items} blinded items to ${relative(REPO_ROOT, r.dir)}/items.json (do not open key.json while adjudicating)` : 'nothing to adjudicate');
  return r;
}

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: 'string' },
      case: { type: 'string' },
      all: { type: 'boolean' },
      agent: { type: 'string' },
      trials: { type: 'string' },
      'run-id': { type: 'string' },
      model: { type: 'string' },
      effort: { type: 'string' },
      timeout: { type: 'string' },
      'max-budget-usd': { type: 'string' },
      'keep-workspace': { type: 'boolean' },
      'claude-bin': { type: 'string' }, // test hook: substitute executable
      yes: { type: 'boolean' },
      apply: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [cmd, arg] = positionals;
  switch (cmd) {
    case 'validate':
      return validate() ? 0 : 1;
    case 'run':
      return cmdRun(values);
    case 'grade':
      cmdGrade(runDir(arg));
      return 0;
    case 'adjudicate':
      cmdAdjudicate(runDir(arg), values.apply);
      return 0;
    case 'summarize':
      summarize(runDir(arg));
      return 0;
    default:
      console.log(USAGE);
      return cmd || values.help ? (values.help ? 0 : 1) : 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (e) => { console.error(`error: ${e.message}`); process.exitCode = 1; },
  );
}
