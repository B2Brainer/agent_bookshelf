#!/usr/bin/env node
// Score review-pr runs against answer-key.json.
//   usage: score.mjs <adjudication.json|-> <case>=<run-dir> [<case>=<run-dir> ...]
// A finding auto-matches a planted bug when its file matches and its line is inside the bug's range (±3).
// Every other finding must have a manual verdict in the adjudication file, keyed "<run-dir basename>#<index>":
//   {"verdict": "REAL" | "FP" | "TP:B2", "reason": "..."}   (REAL = genuine defect that was not planted)
// Recall = distinct planted bugs found / planted (per run). Precision = (TP + REAL) / all findings (per run).
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(here, 'answer-key.json'), 'utf8'));
const [adjPath, ...runs] = process.argv.slice(2);
const adj = adjPath !== '-' && existsSync(adjPath) ? JSON.parse(readFileSync(adjPath, 'utf8')) : {};

const norm = (f) => String(f || '').replace(/^\.?\//, '').replace(/^.*?(?=src\/|tests\/)/, '');
const inRange = (f, bug) => [{ file: bug.file, lines: bug.lines }, ...(bug.alt || [])]
  .some((loc) => norm(f.file) === loc.file && Number(f.line) >= loc.lines[0] - 3 && Number(f.line) <= loc.lines[1] + 3);

const rows = []; const perRun = []; let pending = 0;
for (const spec of runs) {
  const [caseId, dir] = spec.split('=');
  const bugs = key.cases[caseId].bugs;
  const data = JSON.parse(readFileSync(join(dir, 'findings.json'), 'utf8'));
  const found = new Set(); let real = 0;
  data.findings.forEach((f, i) => {
    const id = `${basename(dir)}#${i}`;
    let verdict = adj[id]?.verdict; let reason = adj[id]?.reason || '';
    if (!verdict) {
      const text = `${f.issue} ${f.evidence}`.toLowerCase();
      const b = bugs.find((bug) => inRange(f, bug) && bug.keywords.some((k) => text.includes(k)));
      if (b) { verdict = `TP:${b.id}`; reason = 'auto: file+line+keyword match'; }
    }
    if (!verdict) { verdict = 'PENDING'; pending++; }
    if (verdict.startsWith('TP:')) { found.add(verdict.slice(3)); real++; } else if (verdict === 'REAL') real++;
    rows.push({ run: basename(dir), case: caseId, i, file: norm(f.file), line: f.line, severity: f.severity, verdict, issue: String(f.issue).slice(0, 110), reason });
  });
  perRun.push({ run: basename(dir), case: caseId, parse_ok: data.parse_ok, planted: bugs.length, found: [...found].sort(), findings: data.findings.length, real,
    recall: bugs.length ? found.size / bugs.length : null, precision: data.findings.length ? real / data.findings.length : null,
    cost: data.total_cost_usd, agents: (data.agents_dispatched || []).join(',') });
}

const pct = (x) => (x === null ? 'n/a' : `${(100 * x).toFixed(0)}%`);
console.log('## Per run\n\n| run | case | planted | bugs found | recall | findings | real | precision | cost USD | agents |\n|---|---|---|---|---|---|---|---|---|---|');
for (const r of perRun) console.log(`| ${r.run} | ${r.case} | ${r.planted} | ${r.found.join(' ') || '-'} | ${pct(r.recall)} | ${r.findings} | ${r.real} | ${pct(r.precision)} | ${r.cost?.toFixed(4) ?? 'n/a'} | ${r.agents} |`);
const planted = perRun.filter((r) => r.planted);
const sum = (a, k) => a.reduce((s, r) => s + r[k], 0);
const recallMean = planted.length ? planted.reduce((s, r) => s + r.recall, 0) / planted.length : null;
const totalFindings = sum(perRun, 'findings'); const totalReal = sum(perRun, 'real');
console.log(`\n## Aggregate (${perRun.length} runs)\n`);
console.log(`- Recall (mean over planted-bug runs): ${pct(recallMean)}  (${planted.map((r) => `${r.found.length}/${r.planted}`).join(', ')})`);
console.log(`- Precision (pooled, all runs incl. clean controls): ${pct(totalFindings ? totalReal / totalFindings : null)}  (${totalReal}/${totalFindings})`);
console.log(`- Total measured cost: $${perRun.reduce((s, r) => s + (r.cost || 0), 0).toFixed(4)} (mean $${(perRun.reduce((s, r) => s + (r.cost || 0), 0) / perRun.length).toFixed(4)}/run)`);
console.log(`- Brief formula: recall points 6 × ${pct(recallMean)} = ${recallMean === null ? 'n/a' : (6 * recallMean).toFixed(2)}; precision points 4 × ${totalReal}/${totalFindings} = ${totalFindings ? (4 * totalReal / totalFindings).toFixed(2) : 'n/a'}`);
if (pending) console.log(`\n**${pending} finding(s) PENDING manual adjudication.**`);
console.log('\n## Every finding\n\n| run | # | file:line | sev | verdict | issue | reason |\n|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.run} | ${r.i} | ${r.file}:${r.line} | ${r.severity} | ${r.verdict} | ${r.issue.replace(/\|/g, '\\|')} | ${r.reason.replace(/\|/g, '\\|')} |`);
