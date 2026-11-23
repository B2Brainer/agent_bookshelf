#!/usr/bin/env node
// Deterministic change-set collection for /ticket-to-merge:review-pr (cost lever: one orchestrator turn
// instead of ~8 git turns, and reviewers Read one diff file instead of the orchestrator retyping it).
//   usage: collect-diff.mjs [base-ref] [-- pathspec...]
// Writes <git-dir>/ticket-to-merge/review.diff (committed + uncommitted + untracked changes vs the merge-base)
// and prints a JSON summary: {base, head, baseRef, diffPath, files:[{status,path}], diffLines}.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const tryGit = (...a) => { try { return git(...a); } catch { return ''; } };

const argv = process.argv.slice(2);
const dd = argv.indexOf('--');
const refArgs = dd >= 0 ? argv.slice(0, dd) : argv;
const pathspec = dd >= 0 ? argv.slice(dd + 1) : [];
const EXCLUDE = [':(exclude)package-lock.json', ':(exclude)yarn.lock', ':(exclude)pnpm-lock.yaml', ':(exclude)dist/**'];
const spec = ['--', ...(pathspec.length ? pathspec : ['.']), ...EXCLUDE];

const baseRef = refArgs[0] || ['origin/main', 'main', 'origin/master', 'master'].find((r) => tryGit('rev-parse', '--verify', '--quiet', r));
if (!baseRef) { console.error('collect-diff: no base ref found (pass one explicitly)'); process.exit(1); }
const head = git('rev-parse', 'HEAD');
const baseSha = git('rev-parse', baseRef);
let base = tryGit('merge-base', baseRef, 'HEAD') || baseSha;
if (base === head && baseSha !== head) base = baseSha; // branch is behind the base ref

const files = git('diff', '--name-status', base, ...spec).split('\n').filter(Boolean)
  .map((l) => { const [status, ...p] = l.split('\t'); return { status, path: p[p.length - 1] }; });
const untracked = git('ls-files', '--others', '--exclude-standard', ...spec).split('\n').filter(Boolean);
for (const p of untracked) files.push({ status: 'A (untracked)', path: p });

let diff = git('diff', '--unified=5', '--no-color', base, ...spec);
for (const p of untracked) {
  const r = spawnSync('git', ['diff', '--no-color', '--no-index', '--', '/dev/null', p], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.stdout && !/^Binary files/m.test(r.stdout)) diff += `\n${r.stdout}`;
}

const stateDir = join(resolve(git('rev-parse', '--git-dir')), 'ticket-to-merge');
mkdirSync(stateDir, { recursive: true });
const diffPath = join(stateDir, 'review.diff');
writeFileSync(diffPath, diff ? `${diff}\n` : '');
console.log(JSON.stringify({ baseRef, base, head, diffPath, files, diffLines: diff ? diff.split('\n').length : 0 }, null, 2));
