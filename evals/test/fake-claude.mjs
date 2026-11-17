#!/usr/bin/env node
// Stand-in for the `claude` CLI in harness tests. Never calls any API.
// FAKE_SCENARIO (JSON): { events: [...], exitCode, sleepMs, touch: {relPath: content}, stderr }
// FAKE_RECORD (path): where to write what this process saw (argv, cwd, workspace files).
import { writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const scenario = JSON.parse(process.env.FAKE_SCENARIO ?? '{}');
const cwd = process.cwd();
const list = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? list(p) : [relative(cwd, p)];
});
if (process.env.FAKE_RECORD) {
  const agentFile = list(cwd).find((f) => f.startsWith('.claude/agents/'));
  writeFileSync(process.env.FAKE_RECORD, JSON.stringify({
    argv: process.argv.slice(2),
    cwd,
    files: list(cwd).sort(),
    agent_definition: agentFile ? readFileSync(join(cwd, agentFile), 'utf8') : null,
  }));
}
for (const [rel, content] of Object.entries(scenario.touch ?? {})) writeFileSync(join(cwd, rel), content);
if (scenario.sleepMs) await new Promise((r) => setTimeout(r, scenario.sleepMs));
for (const ev of scenario.events ?? []) process.stdout.write(JSON.stringify(ev) + '\n');
if (scenario.rawStdout) process.stdout.write(scenario.rawStdout);
if (scenario.stderr) process.stderr.write(scenario.stderr);
process.exit(scenario.exitCode ?? 0);
