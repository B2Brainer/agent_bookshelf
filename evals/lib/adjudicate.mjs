// Blinded manual adjudication of UNGRADED checks.
//   create: writes adjudication/batch-N/items.json (what the adjudicator sees) and key.json (the mapping back).
//   apply:  copies verdicts from every batch into the trials' judgments.json; the caller then re-grades.
// Items carry the output, decision criteria and neutral context, but never the configuration,
// trial number or trial path, and their order is shuffled.
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { join, relative } from 'node:path';
import { REPO_ROOT, findCase } from './dataset.mjs';
import { writeJson } from './run.mjs';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const VERDICTS = new Set(['PASS', 'FAIL']);

function batches(runDir) {
  const dir = join(runDir, 'adjudication');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => /^batch-\d+$/.test(n)).sort((a, b) => a.slice(6) - b.slice(6)).map((n) => join(dir, n));
}

// Context an adjudicator needs, identical for both configurations of a case.
function context(kase, trial) {
  if (kase.agent === 'code-reviewer') {
    const dir = join(REPO_ROOT, kase.fixture.path);
    const files = Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
    return { prompt: kase.input.prompt, fixture_files: files, ground_truth: kase.ground_truth };
  }
  const commands = (trial.analysis?.tool_calls ?? [])
    .filter((t) => t.by === 'subagent' && t.name === 'Bash')
    .map((t) => ({ command: t.input?.command, executed: t.executed, is_error: t.is_error, result_head: t.result_excerpt, result_tail: t.result_tail }));
  return { prompt: kase.input.prompt, ground_truth: kase.ground_truth, executed_commands: commands };
}

export function createAdjudication(runDir, trialDirs) {
  const pending = new Set();
  for (const b of batches(runDir)) for (const k of Object.values(read(join(b, 'key.json')))) pending.add(`${k.trial_dir}#${k.criterion_id}`);

  const items = [];
  const key = {};
  for (const td of trialDirs) {
    const gradePath = join(td, 'grade.json');
    if (!existsSync(gradePath)) continue;
    const trial = read(join(td, 'trial.json'));
    if (trial.status !== 'completed') continue; // execution failures are not adjudicable
    const kase = findCase(trial.case_id);
    for (const c of read(gradePath).checks.filter((x) => x.status === 'UNGRADED')) {
      const trialDir = relative(runDir, td);
      if (pending.has(`${trialDir}#${c.id}`)) continue; // already in an earlier batch
      const id = randomBytes(6).toString('hex');
      key[id] = { trial_dir: trialDir, criterion_id: c.id };
      items.push({
        item_id: id,
        case_id: kase.id,
        criterion_id: c.id,
        description: c.description,
        decision_criteria: c.adjudication_criteria,
        output: trial.analysis?.output ?? '',
        deterministic_evidence: c.evidence,
        context: context(kase, trial),
        verdict: null, // "PASS" or "FAIL"; leave null if undecided
        by: null,
        note: null,
      });
    }
  }
  if (!items.length) return { dir: null, items: 0 };
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  const dir = join(runDir, 'adjudication', `batch-${batches(runDir).length + 1}`);
  mkdirSync(dir, { recursive: true });
  writeJson(join(dir, 'items.json'), items);
  writeJson(join(dir, 'key.json'), key);
  return { dir, items: items.length };
}

export function applyAdjudication(runDir) {
  const counts = { applied: 0, pending: 0, invalid: 0 };
  for (const b of batches(runDir)) {
    const key = read(join(b, 'key.json'));
    for (const item of read(join(b, 'items.json'))) {
      const target = key[item.item_id];
      if (item.verdict === null || item.verdict === undefined) { counts.pending++; continue; }
      if (!VERDICTS.has(item.verdict) || !target || target.criterion_id !== item.criterion_id) { counts.invalid++; continue; }
      const path = join(runDir, target.trial_dir, 'judgments.json');
      const judgments = existsSync(path) ? read(path) : {};
      judgments[target.criterion_id] = { verdict: item.verdict, by: item.by ?? null, note: item.note ?? null, item_id: item.item_id };
      writeJson(path, judgments);
      counts.applied++;
    }
  }
  return counts;
}
