#!/usr/bin/env node
// Validates the evaluation dataset only. It does not run agents or grade outputs.
// Usage (from the repository root): node evals/validate-dataset.mjs
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';

const ROOT = process.cwd();
const EVALS = join(ROOT, 'evals');
const FIXTURES = join(EVALS, 'fixtures');
const LEAK = /fixture|defect|intentional|sentinel|simulat|ground.?truth|\beval|expected (outcome|result|answer)|\b(?:cr|tr)-\d\d\b/i;
const errors = [];
const fail = (msg) => errors.push(msg);

// Patterns use an optional leading inline-flag group, e.g. (?i) or (?is).
function compile(pattern) {
  const m = pattern.match(/^\(\?([a-z]+)\)/);
  return new RegExp(m ? pattern.slice(m[0].length) : pattern, m ? m[1] : '');
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.name === '.DS_Store') return [];
    return e.isDirectory() ? walk(p) : [p];
  });
}

// 1. Cases
const suites = ['code-reviewer', 'test-runner'].map((agent) => {
  const file = join(EVALS, 'cases', `${agent}.json`);
  const suite = JSON.parse(readFileSync(file, 'utf8'));
  if (suite.agent !== agent) fail(`${agent}.json: agent field is "${suite.agent}"`);
  for (const cfg of Object.values(suite.configurations)) {
    if (!existsSync(join(ROOT, cfg))) fail(`${agent}.json: configuration ${cfg} missing`);
  }
  return suite;
});

const cases = suites.flatMap((s) => s.cases.map((c) => ({ ...c, agent: s.agent, conventions: s.conventions })));
if (cases.length !== 20) fail(`expected 20 cases, found ${cases.length}`);
for (const s of suites) if (s.cases.length !== 10) fail(`${s.agent}: expected 10 cases, found ${s.cases.length}`);

const ids = cases.map((c) => c.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) fail(`duplicate ids: ${dupes.join(', ')}`);

const REQUIRED = ['id', 'objective', 'polarity', 'scenario', 'input', 'fixture', 'expected_outcome', 'success_criteria', 'grading'];
for (const c of cases) {
  for (const key of REQUIRED) if (c[key] === undefined) fail(`${c.id}: missing ${key}`);
  if (!c.input?.prompt) fail(`${c.id}: missing input.prompt`);
  if (!['positive', 'negative'].includes(c.polarity)) fail(`${c.id}: invalid polarity`);
  if (!['deterministic', 'hybrid'].includes(c.grading?.method)) fail(`${c.id}: invalid grading.method`);

  const fixtureDir = join(ROOT, c.fixture?.path ?? '');
  if (!c.fixture?.path || !existsSync(fixtureDir) || !statSync(fixtureDir).isDirectory()) {
    fail(`${c.id}: fixture ${c.fixture?.path} missing`);
    continue;
  }

  // Prompts are workspace-relative: named files must exist inside the fixture, and
  // nothing may point back into the repository's evals/ tree.
  if (/evals\//.test(c.input.prompt)) fail(`${c.id}: prompt references the evals/ tree`);
  for (const p of c.input.prompt.match(/(?<![\w./-])[a-z][\w./-]*\.(?:ts|js|json)\b/g) ?? []) {
    if (!existsSync(join(fixtureDir, p))) fail(`${c.id}: prompt references missing file ${p}`);
  }

  // Fixtures must be self-contained (relative imports resolve inside the fixture)
  // and must not reveal the evaluation or its expected answers.
  for (const f of walk(fixtureDir)) {
    const rel = relative(fixtureDir, f);
    const text = readFileSync(f, 'utf8');
    if (LEAK.test(rel) || LEAK.test(text)) fail(`${c.id}: revealing term in ${rel}: ${(rel.match(LEAK) ?? text.match(LEAK))[0]}`);
    for (const [, spec] of text.matchAll(/from '(\.{1,2}\/[^']+)'/g)) {
      const target = join(dirname(f), spec);
      if (!relative(fixtureDir, target).split(/[\\/]/).every((s) => s !== '..') || ![target, target.replace(/\.js$/, '.ts')].some(existsSync)) {
        fail(`${c.id}: ${rel} imports ${spec}, which is not inside the fixture`);
      }
    }
  }

  // Criteria must be non-empty, uniquely identified, and use valid patterns.
  const crit = c.success_criteria ?? [];
  if (crit.length === 0) fail(`${c.id}: no success criteria`);
  const critIds = crit.map((s) => s.id);
  if (new Set(critIds).size !== critIds.length) fail(`${c.id}: duplicate criterion ids`);
  const visit = (check, sid) => {
    if (!check?.type) return fail(`${c.id}/${sid}: check without type`);
    const pats = [check.pattern, ...(check.patterns ?? [])].filter(Boolean);
    for (const p of pats) {
      if (p.startsWith('conventions.')) {
        if (!c.conventions[p.slice('conventions.'.length)]) fail(`${c.id}/${sid}: unknown ${p}`);
        continue;
      }
      try { compile(p); } catch (e) { fail(`${c.id}/${sid}: bad regex ${p}: ${e.message}`); }
    }
    for (const d of [check.defect].flat().filter(Boolean)) {
      if (!c.ground_truth?.defects?.some((x) => x.id === d)) fail(`${c.id}/${sid}: unknown defect ${d}`);
    }
    (check.checks ?? []).forEach((sub) => visit(sub, sid));
  };
  crit.forEach((s) => visit(s.check, s.id));

  // Ground-truth defect locations must exist in the fixture.
  for (const d of [...(c.ground_truth?.defects ?? []), ...(c.ground_truth?.non_defects ?? [])]) {
    const f = join(fixtureDir, d.file);
    if (!existsSync(f)) { fail(`${c.id}: ground-truth file ${d.file} missing`); continue; }
    const lines = readFileSync(f, 'utf8').split('\n').length;
    if (d.line_range[1] > lines) fail(`${c.id}: ${d.file} line_range ${d.line_range} exceeds ${lines} lines`);
    if (d.keywords) try { compile(d.keywords); } catch (e) { fail(`${c.id}/${d.id}: bad keywords regex`); }
  }
}

// 2. Fixture manifest integrity
const manifestPath = join(FIXTURES, 'MANIFEST.sha256');
const manifest = new Map(
  readFileSync(manifestPath, 'utf8').trim().split('\n').map((l) => {
    const [hash, file] = l.split(/\s+\*?/, 2);
    return [file.replace(/^\.\//, ''), hash];
  })
);
const actual = walk(FIXTURES).map((p) => relative(FIXTURES, p)).filter((p) => p !== 'MANIFEST.sha256');
for (const f of actual) {
  const hash = createHash('sha256').update(readFileSync(join(FIXTURES, f))).digest('hex');
  if (!manifest.has(f)) fail(`fixture file not in manifest: ${f}`);
  else if (manifest.get(f) !== hash) fail(`fixture file changed: ${f}`);
}
for (const f of manifest.keys()) if (!actual.includes(f)) fail(`manifest file missing: ${f}`);

// 3. Application and subagent files untouched
const changed = execFileSync('git', ['status', '--porcelain', '--', '.', ':(exclude)evals'], { encoding: 'utf8' }).trim();
if (changed) fail(`files changed outside evals/:\n${changed}`);

// Report
const byAgent = suites.map((s) => `${s.agent}=${s.cases.length}`).join(', ');
const polarity = cases.reduce((acc, c) => ({ ...acc, [c.polarity]: (acc[c.polarity] ?? 0) + 1 }), {});
console.log(`cases: ${cases.length} (${byAgent}); polarity: ${JSON.stringify(polarity)}; fixture files: ${actual.length}`);
if (errors.length) {
  console.error(`FAILED (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('OK: dataset is valid.');
