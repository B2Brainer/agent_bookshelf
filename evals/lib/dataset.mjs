// Dataset access shared by the runner, grader and CLI. Read-only.
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EVALS_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const REPO_ROOT = dirname(EVALS_DIR);
export const FIXTURES_DIR = join(EVALS_DIR, 'fixtures');
export const RESULTS_DIR = join(EVALS_DIR, 'results');
export const AGENTS = ['code-reviewer', 'test-runner'];
export const CONFIGS = ['baseline', 'optimized'];

// Same convention as validate-dataset.mjs: optional leading inline-flag group, e.g. (?i) or (?is).
export function compile(pattern, extraFlags = '') {
  const m = pattern.match(/^\(\?([a-z]+)\)/);
  const flags = new Set([...(m ? m[1] : ''), ...extraFlags]);
  return new RegExp(m ? pattern.slice(m[0].length) : pattern, [...flags].join(''));
}

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

export function loadCases() {
  return AGENTS.flatMap((agent) => {
    const suite = JSON.parse(readFileSync(join(EVALS_DIR, 'cases', `${agent}.json`), 'utf8'));
    return suite.cases.map((c) => ({
      ...c,
      agent: suite.agent,
      conventions: suite.conventions,
      global_checks: suite.global_checks,
      configurations: suite.configurations,
    }));
  });
}

export function findCase(id) {
  const c = loadCases().find((x) => x.id.toLowerCase() === String(id).toLowerCase());
  if (!c) throw new Error(`unknown case ${id}`);
  return c;
}

// Absolute path of the agent definition for a configuration.
export function agentDefinition(kase, config) {
  if (!CONFIGS.includes(config)) throw new Error(`unknown configuration ${config} (use ${CONFIGS.join(' or ')})`);
  return join(REPO_ROOT, kase.configurations[config]);
}

// Manifest entries for one fixture, keyed by fixture-relative path.
export function manifestFor(fixturePath) {
  const prefix = relative(FIXTURES_DIR, join(REPO_ROOT, fixturePath)) + '/';
  const entries = {};
  for (const line of readFileSync(join(FIXTURES_DIR, 'MANIFEST.sha256'), 'utf8').trim().split('\n')) {
    const [hash, file] = line.split(/\s+\*?/, 2);
    const rel = file.replace(/^\.\//, '');
    if (rel.startsWith(prefix)) entries[rel.slice(prefix.length)] = hash;
  }
  if (Object.keys(entries).length === 0) throw new Error(`no manifest entries for ${fixturePath}`);
  return entries;
}

// Snapshot of a directory: files with sha256, and directories. node_modules is recorded
// but not descended into. Symlinks are recorded as such and never followed.
export function snapshotDir(root) {
  const files = {};
  const dirs = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === '.DS_Store') continue;
      const abs = join(dir, name);
      const rel = relative(root, abs);
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) files[rel] = 'symlink';
      else if (st.isDirectory()) {
        dirs.push(rel);
        if (name !== 'node_modules') walk(abs);
      } else files[rel] = sha256(readFileSync(abs));
    }
  };
  walk(root);
  return { files, dirs: dirs.sort() };
}

// Compare a snapshot with the expected file -> hash map. Directories implied by expected files are allowed.
export function diffSnapshot(snapshot, expected) {
  const allowedDirs = new Set();
  for (const f of Object.keys(expected)) {
    for (let d = dirname(f); d !== '.'; d = dirname(d)) allowedDirs.add(d);
  }
  const changed = [];
  const missing = [];
  for (const [f, h] of Object.entries(expected)) {
    if (!(f in snapshot.files)) missing.push(f);
    else if (snapshot.files[f] !== h) changed.push(f);
  }
  const added = [
    ...Object.keys(snapshot.files).filter((f) => !(f in expected)),
    ...snapshot.dirs.filter((d) => !allowedDirs.has(d)).map((d) => d + '/'),
  ];
  return { changed, missing, added, clean: !changed.length && !missing.length && !added.length };
}
