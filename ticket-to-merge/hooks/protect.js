#!/usr/bin/env node
// ticket-to-merge guardrail — Claude Code PreToolUse hook.
// Blocks (exit 2) any Edit/Write/MultiEdit/NotebookEdit/Bash that could read or modify
// protected files (bookshelf.db*, seed.sql, .env*), and any write to acceptance tests
// locked by the ship-ticket RED step. Fails closed: unparseable input is blocked.
'use strict';
const fs = require('fs');
const path = require('path');

const PROTECTED_BASENAMES = [
  'bookshelf.db', 'bookshelf.db-wal', 'bookshelf.db-shm', 'bookshelf.db-journal', 'seed.sql', '.env',
];
const isProtectedBasename = (b) => {
  const n = b.toLowerCase();
  return PROTECTED_BASENAMES.includes(n) || n.startsWith('.env.') || n.startsWith('bookshelf.db');
};
// Literal names searched for in commands and in written file content.
const NAME_PATTERNS = [/bookshelf\.db/, /seed\.sql/, /(^|[^a-z0-9_$])\.env([^a-z0-9_]|$)/];
const DESTRUCTIVE = /(^|[\s;&|(])(rm|rmdir|mv|cp|rsync|truncate|shred|dd|tee|ln|chmod|chown|install|unlink|sed\s+-i|perl\s+-[a-z]*i|find\b[^;&|]*-(delete|exec)|git\s+(clean|checkout|restore|stash|reset|rm|mv))\b/;
// Git operations that rewrite or delete untracked/ignored/tracked files without naming them.
const GIT_WIDE = [/git\s+clean\b[^;&|]*-[a-z]*x/i, /git\s+stash\b[^;&|]*(\s-[a-z]*[ua]\b|--include-untracked|--all)/, /git\s+reset\b[^;&|]*--hard/];
const REDIRECT_TARGET = /\d*>>?\|?\s*(?!&)([^\s;&|<>]+)/g;
const OBFUSCATION = [
  /base64\s+(-d|-D|--decode)/, /xxd\s+-r/, /openssl\s+(enc|base64)/, /(^|[\s;&|(])eval\b/,
  /\|\s*(sh|bash|zsh|dash|ksh|python3?|node|perl|ruby)\b/, /\$'/, /printf\s+['"]?%b/, /\\x[0-9a-f]{2}/,
  /\$\{?[a-z_][a-z0-9_]*\}?\$\{?[a-z_]/, // adjacent variable concatenation: $a$b
  /(^|[\s;&|(])rev(\s|$)/, // `rev` the command, not git rev-parse
  /['"]\\*\s*\+\s*\\*['"]/, /fromcharcode|\bchr\(|fromhex|\.decode\(|\[::-1\]|\.reverse\(\)/, // string building in code
];
// Inline interpreter code (python -c, node -e, perl -e, ruby -e, php -r, osascript -e) that writes or deletes
// files is blocked outright: file paths can be computed in endless ways, and builders have Edit/Write for edits.
const INLINE_CODE = /(^|[\s;&|(])(python[0-9.]*|node|nodejs|deno|bun|perl|ruby|php|osascript)\s+[^;&|]*?(-c|-e|-r|--eval|-p)\b/;
const FILE_WRITE_API = /delete\(|fileutils|open\([^)]*['"]\\*[wax+]|\.write|unlink|remove\(|rmtree|rename|truncate|writefile|appendfile|rmsync|rmdirsync|copyfile|createwritestream|shutil|os\.system|subprocess|child_process|execsync|spawnsync|\bsystem\(|\bexec\(/;

function block(reason) {
  process.stderr.write(`BLOCKED by ticket-to-merge guardrail: ${reason}\n`);
  process.exit(2);
}

function findGitDir(start) {
  let dir = start;
  for (;;) {
    const dotGit = path.join(dir, '.git');
    try {
      const st = fs.statSync(dotGit);
      if (st.isDirectory()) return { root: dir, gitDir: dotGit };
      const m = fs.readFileSync(dotGit, 'utf8').match(/gitdir:\s*(.+)/);
      if (m) return { root: dir, gitDir: path.resolve(dir, m[1].trim()) };
    } catch { /* keep walking */ }
    const parent = path.dirname(dir);
    if (parent === dir) return { root: start, gitDir: null };
    dir = parent;
  }
}

function lockedTests(root, gitDir) {
  if (!gitDir) return [];
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(gitDir, 'ticket-to-merge', 'locked-tests.json'), 'utf8'));
    return Object.keys(manifest.files || {}).map((rel) => path.resolve(root, rel));
  } catch { return []; }
}

function realish(p) {
  // Resolve symlinks for the deepest existing ancestor so links into protected files are caught.
  let cur = p; const rest = [];
  while (!fs.existsSync(cur) && path.dirname(cur) !== cur) { rest.unshift(path.basename(cur)); cur = path.dirname(cur); }
  try { return path.join(fs.realpathSync(cur), ...rest); } catch { return p; }
}

function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') { const j = glob.indexOf(']', i); if (j > i) { re += glob.slice(i, j + 1).replace(/^\[!/, '[^'); i = j; } else re += '\\['; }
    else if (c === '{') { const j = glob.indexOf('}', i); if (j > i) { re += '(' + glob.slice(i + 1, j).split(',').map((s) => s.replace(/[.+^$()|\\]/g, '\\$&')).join('|') + ')'; i = j; } else re += '\\{'; }
    else re += c.replace(/[.+^$()|\\/]/g, '\\$&');
  }
  return new RegExp('^' + re + '$', 'i');
}

function checkPath(filePath, cwd, root, locked, label) {
  if (typeof filePath !== 'string' || !filePath) return;
  const abs = realish(path.resolve(cwd, filePath));
  if (isProtectedBasename(path.basename(abs))) block(`${label} targets protected file ${path.basename(abs)}`);
  if (/[\\/]ticket-to-merge[\\/]locked-tests\.json$/i.test(abs)) block(`${label} targets the test lock manifest`);
  const lower = abs.toLowerCase();
  if (locked.some((t) => realish(t).toLowerCase() === lower)) block(`${label} targets locked acceptance test ${path.relative(root, abs)} (tests are read-only while implementing)`);
}

function checkContent(text, label) {
  if (typeof text !== 'string') return;
  const t = text.toLowerCase();
  if (FILE_WRITE_API.test(t) && /['"]\.e['"]?\s*\+|['"]\s*\+\s*['"]nv['"]|bookshelf['"]?\s*\+|fromcharcode|\[::-1\]/.test(t)) {
    block(`${label} writes code that builds a file name in a way that could target a protected file`);
  }
  if (NAME_PATTERNS.some((re) => re.test(t)) && /(writefile|appendfile|unlink|rmsync|rmdirsync|truncate|createwritestream|copyfile|rename|open\([^)]*['"][wa+]|>\s*['"]?[\w./-]*(bookshelf|seed|\.env))/.test(t)) {
    block(`${label} writes code that modifies a protected file`);
  }
}

function checkBash(cmd, cwd, root, locked, inSubagent) {
  const raw = String(cmd || '').toLowerCase();
  const norm = raw.replace(/\\(.)/g, '$1').replace(/["'`]/g, '');
  for (const re of NAME_PATTERNS) if (re.test(norm)) block('command references a protected file (bookshelf.db*, seed.sql, .env*)');
  const unesc = raw.replace(/\\(.)/g, '$1');
  for (const re of OBFUSCATION) if (re.test(raw) || re.test(unesc) || re.test(norm)) block('command uses an obfuscation/indirection construct that could hide a protected path');
  if (INLINE_CODE.test(norm) && FILE_WRITE_API.test(unesc)) block('inline interpreter code that writes, deletes or spawns is not allowed; use the Edit/Write tools');
  if (/locked-tests\.json/.test(norm)) block('command references the test lock manifest');
  if (inSubagent && /tests-gate\.mjs/.test(norm)) block('subagents may not run the test lock gate');

  const tokens = norm.split(/[\s;&|()<>=]+/).filter(Boolean);
  const destructive = DESTRUCTIVE.test(norm);
  const lockedAbs = locked.map((t) => t.toLowerCase());
  const lockedBase = locked.map((t) => path.basename(t).toLowerCase());
  const protectedAbs = [
    ...['bookshelf.db', 'bookshelf.db-wal', 'bookshelf.db-shm', '.env'].map((b) => path.join(root, b)),
    path.join(root, 'src', 'db', 'seed.sql'),
  ].map((p) => p.toLowerCase());

  for (const tok of tokens) {
    if (/[*?[{]/.test(tok)) {
      const re = globToRegex(path.basename(tok));
      if ([...PROTECTED_BASENAMES, '.env.local'].some((b) => re.test(b))) block(`glob "${tok}" could match a protected file`);
      if (destructive && lockedBase.some((b) => re.test(b))) block(`glob "${tok}" could modify a locked acceptance test`);
    }
    if (destructive && !tok.startsWith('-')) {
      const abs = path.resolve(cwd, tok.replace(/^~(?=\/|$)/, process.env.HOME || '~')).toLowerCase();
      const prefix = abs.endsWith(path.sep) ? abs : abs + path.sep;
      if (protectedAbs.some((p) => p.startsWith(prefix))) block(`destructive command on "${tok}", which contains a protected file`);
      if (lockedAbs.some((p) => p === abs || p.startsWith(prefix))) block(`destructive command on "${tok}", which is or contains a locked acceptance test`);
    }
  }
  if (destructive && lockedBase.some((b) => norm.includes(b))) block('command could modify a locked acceptance test');
  for (const re of GIT_WIDE) if (re.test(norm)) block('git operation could delete or rewrite protected files (clean -x / stash -u / reset --hard)');

  for (const m of norm.matchAll(REDIRECT_TARGET)) {
    const target = m[1];
    if (target === '/dev/null') continue;
    const abs = path.resolve(cwd, target).toLowerCase();
    if (lockedAbs.includes(abs) || lockedBase.includes(path.basename(abs))) block(`redirect writes to locked acceptance test ${target}`);
  }
}

function main(input) {
  let data;
  try { data = JSON.parse(input); } catch { block('could not parse hook input (failing closed)'); }
  const tool = data.tool_name || '';
  const ti = data.tool_input || {};
  const cwd = data.cwd || process.cwd();
  const { root, gitDir } = findGitDir(process.env.CLAUDE_PROJECT_DIR || cwd);
  const locked = lockedTests(root, gitDir);
  const inSubagent = Boolean(data.agent_id);

  if (tool === 'Bash') checkBash(ti.command, cwd, root, locked, inSubagent);
  else if (tool === 'Edit') { checkPath(ti.file_path, cwd, root, locked, 'Edit'); checkContent(ti.new_string, 'Edit'); }
  else if (tool === 'Write') { checkPath(ti.file_path, cwd, root, locked, 'Write'); checkContent(ti.content, 'Write'); }
  else if (tool === 'MultiEdit') { checkPath(ti.file_path, cwd, root, locked, 'MultiEdit'); (ti.edits || []).forEach((e) => checkContent(e && e.new_string, 'MultiEdit')); }
  else if (tool === 'NotebookEdit') { checkPath(ti.notebook_path, cwd, root, locked, 'NotebookEdit'); checkContent(ti.new_source, 'NotebookEdit'); }
  process.exit(0);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { buf += c; });
process.stdin.on('end', () => { try { main(buf); } catch (e) { block(`hook error (failing closed): ${e.message}`); } });
