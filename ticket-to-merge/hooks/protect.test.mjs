// Run: node --test ticket-to-merge/hooks/protect.test.mjs
// Spawns the real hook with Claude Code PreToolUse JSON on stdin inside a throwaway git repo
// (never the real project), and asserts exit 2 (blocked) or exit 0 (allowed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'protect.js');
const root = realpathSync(mkdtempSync(join(tmpdir(), 'protect-')));
mkdirSync(join(root, '.git', 'ticket-to-merge'), { recursive: true });
mkdirSync(join(root, 'src', 'db'), { recursive: true });
mkdirSync(join(root, 'tests', 'routes'), { recursive: true });
for (const f of ['bookshelf.db', 'bookshelf.db-wal', '.env', 'src/db/seed.sql', 'src/db/schema.sql', 'tests/routes/search.test.ts', 'tests/routes/api.test.ts']) writeFileSync(join(root, f), 'x');
symlinkSync(join(root, 'bookshelf.db'), join(root, 'innocent.txt'));
writeFileSync(join(root, '.git', 'ticket-to-merge', 'locked-tests.json'), JSON.stringify({ files: { 'tests/routes/search.test.ts': 'abc' } }));

function run(tool_name, tool_input, extra = {}) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name, tool_input, cwd: root, ...extra }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root }, encoding: 'utf8',
  });
  return r;
}
const bash = (command, extra) => run('Bash', { command }, extra);

const BLOCKED_BASH = [
  // direct
  'rm bookshelf.db', 'echo hi >> .env', 'cat .env', 'cp /dev/null src/db/seed.sql', 'sed -i "" s/a/b/ src/db/seed.sql',
  'truncate -s 0 bookshelf.db-wal', 'mv bookshelf.db /tmp/x', 'tee .env.local < /dev/null', 'dd if=/dev/zero of=bookshelf.db',
  'git checkout -- src/db/seed.sql', 'ln -sf /dev/null bookshelf.db', `rm ${'$'}PWD/bookshelf.db`, 'rm /abs/path/BOOKSHELF.DB',
  // quoting / escaping / case
  "rm 'book''shelf.db'", 'rm "bookshelf"".db"', 'rm book\\shelf.db', 'echo x > ./.e"n"v', 'RM BookShelf.DB',
  // globs / braces
  'rm *.db', 'rm bookshelf.d?', 'rm bookshelf.*', 'rm src/db/*', 'cat .en[v]', 'rm bookshelf.{db,bak}', 'find . -name "*.sql" -delete',
  // parent directory / repo-wide
  'rm -rf src/db', 'rm -rf .', 'find . -type f -delete', 'mv src /tmp/', 'git clean -fdx', 'git stash -u', 'git reset --hard HEAD',
  // indirection / obfuscation
  'echo cm0gYm9va3NoZWxmLmRi | base64 -d | sh', 'a=book; b=shelf.db; rm $a$b', 'eval "r""m x"', "rm $'\\x62ookshelf.db'",
  'echo bd.flehskoob | rev | xargs rm', 'python3 -c "open(\'.e\'+\'nv\',\'w\')"', 'node -e "require(\'fs\').unlinkSync(\'bookshelf.db\')"',
  'printf "%b" "\\x72\\x6d" | bash',
  // found by the live headless bypass test (escaped quotes inside double quotes) and its variants
  'python3 -c "open(\\".e\\"+\\"nv\\",\\"w\\").write(\\"x\\")"', "python3 -c \"open('vne.'[::-1],'w')\"",
  "python3 -c \"import os; os.remove('.'+'env')\"", "perl -e 'unlink \".e\".\"nv\"'", "node -e \"require('fs').writeFileSync(process.argv[1],'')\" x",
  "ruby -e 'File.delete(ARGV[0])' y", "python3 -c \"import subprocess; subprocess.run(['rm', 'x'])\"",
  // locked tests
  'echo "" > tests/routes/search.test.ts', 'rm tests/routes/search.test.ts', 'sed -i "" s/expect/x/ tests/routes/search.test.ts',
  'rm tests/routes/*.ts', 'git checkout HEAD -- tests/routes/search.test.ts', 'cat x >> tests/routes/search.test.ts', 'rm -rf tests',
  'cat .git/ticket-to-merge/locked-tests.json',
];
for (const cmd of BLOCKED_BASH) test(`blocks Bash: ${cmd}`, () => { const r = bash(cmd); assert.equal(r.status, 2, r.stderr); assert.match(r.stderr, /BLOCKED/); });

test('subagent cannot run the test-lock gate', () => {
  assert.equal(bash('node /x/skills/ship-ticket/scripts/tests-gate.mjs unlock', { agent_id: 'a1', agent_type: 'ticket-to-merge:implementer' }).status, 2);
});

const ALLOWED_BASH = [
  'npm run test:run', 'npm run test:run 2>&1 | tail -40', 'npx vitest run tests/routes/search.test.ts', 'git diff main...HEAD',
  'git diff . 2>&1', 'git status --short', 'cat src/models/book.ts', 'ls src/db/schema.sql', 'grep -rn "searchBooks" src tests',
  'node -e "console.log(process.env.PORT)"', 'echo ok > /tmp/out.txt', 'git log --oneline -5', 'cat tests/routes/search.test.ts',
  'node /x/skills/ship-ticket/scripts/tests-gate.mjs verify', 'rm -rf /tmp/scratch-dir', 'npm run test:run > /dev/null',
  // found by the pilot review-pr run: `rev` rule matched `git rev-parse`
  'git rev-parse --verify --quiet origin/main || git rev-parse --verify --quiet main', 'git merge-base origin/main HEAD',
  "git diff --unified=5 abc -- . ':(exclude)package-lock.json'", 'git ls-files --others --exclude-standard',
  'node -e "console.log(1+2)"', 'python3 -c "print(42)"', 'node --test ticket-to-merge/hooks/protect.test.mjs',
];
for (const cmd of ALLOWED_BASH) test(`allows Bash: ${cmd}`, () => { const r = bash(cmd); assert.equal(r.status, 0, r.stderr); });

test('blocks Edit/Write/MultiEdit/NotebookEdit on protected files (relative, absolute, .., case, symlink)', () => {
  for (const [tool, input] of [
    ['Write', { file_path: '.env', content: 'A=1' }],
    ['Write', { file_path: join(root, 'bookshelf.db'), content: '' }],
    ['Edit', { file_path: 'src/db/../db/seed.sql', old_string: 'a', new_string: 'b' }],
    ['Edit', { file_path: 'SRC/DB/SEED.SQL', old_string: 'a', new_string: 'b' }],
    ['Write', { file_path: 'innocent.txt', content: 'x' }],
    ['MultiEdit', { file_path: 'bookshelf.db-shm', edits: [] }],
    ['NotebookEdit', { notebook_path: '.env.production', new_source: '' }],
    ['Edit', { file_path: 'tests/routes/search.test.ts', old_string: 'a', new_string: 'b' }],
    ['Write', { file_path: '.git/ticket-to-merge/locked-tests.json', content: '{}' }],
    ['Write', { file_path: 'scripts/wipe.js', content: "require('fs').unlinkSync('bookshelf.db')" }],
  ]) { const r = run(tool, input); assert.equal(r.status, 2, `${tool} ${JSON.stringify(input)} -> ${r.status}`); }
});

test('allows normal source and unlocked test edits', () => {
  assert.equal(run('Edit', { file_path: 'src/models/book.ts', old_string: 'a', new_string: 'b' }).status, 0);
  assert.equal(run('Write', { file_path: 'tests/routes/api.test.ts', content: 'x' }).status, 0);
  assert.equal(run('Write', { file_path: 'src/db/schema-notes.md', content: 'reads seed.sql at startup' }).status, 0);
});

test('fails closed on malformed input', () => {
  const r = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(r.status, 2);
});
