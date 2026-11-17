// Executes one trial: isolated workspace -> real Claude Code subagent -> recorded observations.
// Grading is a separate, pure step (grade.mjs) so recorded trials can be re-graded offline.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, copyFileSync, readFileSync, writeFileSync, renameSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, isAbsolute, basename } from 'node:path';
import { REPO_ROOT, sha256, manifestFor, snapshotDir, diffSnapshot, agentDefinition, datasetChecksum } from './dataset.mjs';

// Identical for both configurations. Overridable per run, recorded in every trial.
export const DEFAULT_SETTINGS = {
  model: 'claude-sonnet-5', // full id the installed CLI recognizes (the `sonnet` alias resolves to it)
  effort: 'high',
  timeoutSec: 600,
  maxBudgetUsd: 2,
};

const WORKSPACE_PREFIX = 'ws-';
// Orchestrator tools that only coordinate the dispatched subagent and cannot touch the workspace.
const COORDINATION_TOOLS = new Set(['Agent', 'Task', 'TaskOutput', 'ListAgents']);

// Fixed wrapper; the case prompt must reach the subagent verbatim (verified in the transcript).
export function wrapPrompt(agent, prompt) {
  return [
    `Use the ${agent} subagent for the task below.`,
    'Pass the task text to it verbatim as its prompt, do not do any of the work yourself,',
    'and when it finishes reply with its final report unchanged.',
    '',
    'Task:',
    prompt,
  ].join('\n');
}

export function claudeArgs(agent, prompt, settings) {
  return [
    '-p', wrapPrompt(agent, prompt),
    '--output-format', 'stream-json',
    '--verbose',
    '--forward-subagent-text',
    '--no-session-persistence',
    '--setting-sources', 'project', // ignore user/local settings; the workspace has no project settings
    '--strict-mcp-config', // no MCP servers
    '--permission-prompts', 'none', // nothing can be approved interactively
    '--allowedTools', 'Bash', // only test-runner declares Bash; code-reviewer's tool list excludes it
    '--model', settings.model,
    '--effort', settings.effort,
    '--max-budget-usd', String(settings.maxBudgetUsd),
  ];
}

// ---------- workspace ----------

export function createWorkspace(kase, config) {
  const fixtureDir = join(REPO_ROOT, kase.fixture.path);
  const manifest = manifestFor(kase.fixture.path);
  const sourceDiff = diffSnapshot(snapshotDir(fixtureDir), manifest);
  if (!sourceDiff.clean) throw new IntegrityError(`source fixture ${kase.fixture.path} does not match MANIFEST.sha256`, sourceDiff);

  const ws = realpathSync(mkdtempSync(join(tmpdir(), WORKSPACE_PREFIX)));
  assertSafeWorkspace(ws);
  cpSync(fixtureDir, ws, { recursive: true });
  const def = agentDefinition(kase, config);
  mkdirSync(join(ws, '.claude', 'agents'), { recursive: true });
  copyFileSync(def, join(ws, '.claude', 'agents', `${kase.agent}.md`));

  const expected = { ...manifest, [`.claude/agents/${kase.agent}.md`]: sha256(readFileSync(def)) };
  const initial = diffSnapshot(snapshotDir(ws), expected);
  if (!initial.clean) {
    removeWorkspace(ws);
    throw new IntegrityError('workspace copy does not match the manifest', initial);
  }
  return { ws, expected };
}

export function assertSafeWorkspace(ws) {
  const rel = relative(REPO_ROOT, ws);
  if (!rel.startsWith('..') && !isAbsolute(rel)) throw new Error(`workspace ${ws} is inside the repository`);
  for (let d = dirname(ws); ; d = dirname(d)) {
    if (existsSync(join(d, 'node_modules'))) throw new Error(`workspace ancestor ${d} has node_modules`);
    if (dirname(d) === d) break;
  }
}

// Removes only directories this harness created: a direct child of the temp dir with our prefix.
export function removeWorkspace(ws) {
  const tmp = realpathSync(tmpdir());
  if (dirname(ws) !== tmp || !basename(ws).startsWith(WORKSPACE_PREFIX)) {
    throw new Error(`refusing to remove ${ws}: not a harness workspace`);
  }
  rmSync(ws, { recursive: true, force: true });
}

export class IntegrityError extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
  }
}

// ---------- repository state (repo_clean) ----------

export function repoState() {
  const out = execFileSync('git', ['status', '--porcelain=v1', '-uall', '--', '.', ':(exclude)evals/results'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const lines = out.split('\n').filter(Boolean).sort();
  const hashes = {};
  for (const l of lines) {
    const p = join(REPO_ROOT, l.slice(3).replace(/^.* -> /, ''));
    try { hashes[l] = sha256(readFileSync(p)); } catch { hashes[l] = null; }
  }
  return { lines, hashes };
}

export function gitRevision() {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'evals', '.claude/agents'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim() !== '';
    return { git_commit: commit, git_dirty_evals_or_agents: dirty };
  } catch {
    return { git_commit: null, git_dirty_evals_or_agents: null };
  }
}

// Version string of the CLI, or null if it cannot be determined.
export function cliVersion(bin) {
  try {
    const out = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 15000, env: trialEnv(tmpdir()), stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out || null;
  } catch {
    return null;
  }
}

// ---------- process execution ----------

// The CLI and the agent's shell get an allowlisted environment, never the harness's own:
// inherited variables would leak the repository path (PWD, OLDPWD, VSCODE_CWD), alter CLI behavior
// (CLAUDE_EFFORT, CLAUDE_CODE_* from a parent session) or the fixtures' test runs (NODE_TEST_CONTEXT).
const ENV_ALLOW = /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|TERM|LANG|LC_\w+|TZ|ANTHROPIC_\w+|CLAUDE_CONFIG_DIR|HTTPS?_PROXY|NO_PROXY|https?_proxy|no_proxy|NODE_EXTRA_CA_CERTS)$/;

export function trialEnv(ws, extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => ENV_ALLOW.test(k)));
  return { ...env, PWD: ws, ...extra };
}

export function execute(bin, args, { cwd, timeoutSec, env }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let child;
    try {
      child = spawn(bin, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return resolve({ exitCode: null, signal: null, timedOut, spawnError: e.message, stdout, stderr, durationMs: 0 });
    }
    const killGroup = (sig) => { try { process.kill(-child.pid, sig); } catch {} };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup('SIGTERM');
      setTimeout(() => killGroup('SIGKILL'), 5000).unref();
    }, timeoutSec * 1000);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ exitCode: null, signal: null, timedOut, spawnError: e.message, stdout, stderr, durationMs: Date.now() - started });
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      killGroup('SIGKILL'); // reap leftovers (e.g. test processes) from the group
      resolve({ exitCode, signal, timedOut, spawnError: null, stdout, stderr, durationMs: Date.now() - started });
    });
  });
}

// ---------- transcript parsing (pure) ----------

export function parseEvents(stdout) {
  const events = [];
  let unparsed = 0;
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { unparsed++; }
  }
  return { events, unparsed };
}

const blocksOf = (ev) => (Array.isArray(ev.message?.content) ? ev.message.content : []);
const resultText = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x.text ?? '').join('\n') : '');

export function analyzeTranscript(events, agent) {
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init') ?? null;
  const results = events.filter((e) => e.type === 'result');
  const result = results.at(-1) ?? null; // cumulative; the last one covers the whole session
  const denied = new Set((result?.permission_denials ?? []).map((d) => d.tool_use_id));

  const toolUses = [];
  const toolResults = new Map();
  for (const ev of events) {
    for (const b of blocksOf(ev)) {
      if (ev.type === 'assistant' && b.type === 'tool_use') toolUses.push({ ...b, parent: ev.parent_tool_use_id ?? null });
      if (ev.type === 'user' && b.type === 'tool_result') toolResults.set(b.tool_use_id, b);
    }
  }
  const dispatches = toolUses.filter((t) => t.parent === null && (t.name === 'Agent' || t.name === 'Task'));
  const orchestratorTools = toolUses.filter((t) => t.parent === null && !COORDINATION_TOOLS.has(t.name));
  const dispatch = dispatches[0] ?? null;
  const subId = dispatch?.id;

  const toolCalls = toolUses
    .filter((t) => t.parent !== null)
    .map((t) => {
      const r = toolResults.get(t.id);
      // A tool counts as executed only if it produced a result that is not a denial or a CLI
      // rejection (<tool_use_error>, e.g. unavailable tool). A failing command still counts.
      const rejected = Boolean(r?.is_error) && /^\s*<tool_use_error>/.test(resultText(r.content));
      return {
        id: t.id,
        name: t.name,
        input: t.input,
        by: t.parent === subId ? 'subagent' : 'other',
        executed: Boolean(r) && !denied.has(t.id) && !rejected,
        denied: denied.has(t.id),
        is_error: r?.is_error ?? null,
        result_excerpt: r ? resultText(r.content).slice(0, 2000) : null,
        result_tail: r ? resultText(r.content).slice(-2000) : null, // test summaries sit at the end of long output
      };
    });

  // Final subagent output: text of the last subagent assistant message that has text.
  const byMessage = new Map();
  for (const ev of events) {
    if (ev.type !== 'assistant' || !subId || ev.parent_tool_use_id !== subId) continue;
    const text = blocksOf(ev).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!text.trim()) continue;
    const id = ev.message?.id ?? ev.uuid;
    byMessage.delete(id); // keep insertion order = last occurrence
    byMessage.set(id, (byMessage.get(id) ?? '') + text);
  }
  const notification = events.find((e) => e.type === 'system' && e.subtype === 'task_notification' && e.tool_use_id === subId) ?? null;
  let output = [...byMessage.values()].at(-1) ?? null;
  let outputSource = output ? 'subagent_messages' : null;
  if (!output && notification?.summary) {
    output = notification.summary;
    outputSource = 'task_notification';
  }

  return {
    init: init && { model: init.model, agents: init.agents, tools: init.tools, claude_code_version: init.claude_code_version, cwd: init.cwd },
    dispatch: dispatch && { id: dispatch.id, subagent_type: dispatch.input?.subagent_type, prompt: dispatch.input?.prompt },
    dispatch_count: dispatches.length,
    orchestrator_tool_calls: orchestratorTools.map((t) => ({ name: t.name, input: t.input })),
    subagent_status: notification?.status ?? null,
    subagent_usage: notification?.usage ?? null,
    tool_calls: toolCalls,
    output,
    output_source: outputSource,
    result: result && {
      subtype: result.subtype,
      is_error: result.is_error,
      terminal_reason: result.terminal_reason ?? null,
      total_cost_usd: result.total_cost_usd,
      usage: result.usage ?? null,
      model_usage: result.modelUsage ?? null,
      duration_ms: result.duration_ms ?? null,
      num_turns: result.num_turns ?? null,
      permission_denials: result.permission_denials ?? [],
    },
  };
}

// Token and cost totals. Missing data is null, never 0.
export function usageSummary(result) {
  const mu = result?.model_usage;
  let input = null;
  let output = null;
  if (mu && Object.keys(mu).length) {
    input = 0;
    output = 0;
    for (const m of Object.values(mu)) {
      input += (m.inputTokens ?? 0) + (m.cacheReadInputTokens ?? 0) + (m.cacheCreationInputTokens ?? 0);
      output += m.outputTokens ?? 0;
    }
  } else if (result?.usage) {
    input = result.usage.input_tokens ?? null;
    output = result.usage.output_tokens ?? null;
  }
  const cost = typeof result?.total_cost_usd === 'number' ? result.total_cost_usd : null;
  return { input_tokens: input, output_tokens: output, cost_usd: cost, cost_status: cost === null ? 'missing' : 'reported' };
}

// Decides the execution status. Only 'completed' trials are graded.
export function classifyExecution({ proc, analysis, kase, unparsed, escape }) {
  const errors = [];
  if (proc.spawnError) errors.push(`spawn failed: ${proc.spawnError}`);
  if (proc.timedOut) return { status: 'timeout', errors: [`exceeded timeout`, ...errors] };
  if (proc.exitCode !== 0) errors.push(`claude exited with ${proc.exitCode ?? proc.signal}`);
  if (!analysis.result) errors.push('no result event in transcript');
  else if (analysis.result.is_error || analysis.result.subtype !== 'success') {
    errors.push(`result ${analysis.result.subtype}${analysis.result.terminal_reason ? ` (${analysis.result.terminal_reason})` : ''}`);
  }
  if (unparsed) errors.push(`${unparsed} unparseable transcript lines`);
  if (errors.length) return { status: 'error', errors };

  const invalid = [];
  if (!analysis.dispatch) invalid.push('subagent was not invoked');
  else {
    if (analysis.dispatch.subagent_type !== kase.agent) invalid.push(`wrong subagent: ${analysis.dispatch.subagent_type}`);
    if ((analysis.dispatch.prompt ?? '').trim() !== kase.input.prompt.trim()) invalid.push('orchestrator altered the task prompt');
  }
  if (analysis.dispatch_count > 1) invalid.push(`${analysis.dispatch_count} subagent dispatches`);
  if (analysis.orchestrator_tool_calls.length) {
    invalid.push(`orchestrator used tools: ${analysis.orchestrator_tool_calls.map((t) => t.name).join(', ')}`);
  }
  if (escape.length) invalid.push(`agent referenced the source repository: ${escape.join('; ')}`);
  if (invalid.length) return { status: 'invalid', errors: invalid };

  if (analysis.subagent_status && analysis.subagent_status !== 'completed') {
    return { status: 'error', errors: [`subagent ended with status ${analysis.subagent_status}`] };
  }
  if (!analysis.output) return { status: 'error', errors: ['no subagent output captured'] };
  return { status: 'completed', errors: [] };
}

// Tool inputs that point back into the source repository (where the answers live).
export function findRepoReferences(analysis, repoRoot = REPO_ROOT) {
  const hits = [];
  for (const t of analysis.tool_calls) {
    const s = JSON.stringify(t.input ?? {});
    if (s.includes(repoRoot) || /evals\/(cases|baseline|results|README)/.test(s)) hits.push(`${t.name} ${s.slice(0, 200)}`);
  }
  return hits;
}

// ---------- one trial ----------

export async function runTrial({ kase, config, trial, trialDir, settings, bin = 'claude', extraEnv = {}, keepWorkspace = false }) {
  mkdirSync(trialDir, { recursive: true });
  const base = {
    schema: 1,
    case_id: kase.id,
    agent: kase.agent,
    config,
    trial,
    agent_definition: kase.configurations[config],
    agent_definition_sha256: sha256(readFileSync(agentDefinition(kase, config))),
    dataset_sha256: datasetChecksum(),
    ...gitRevision(),
    settings,
    node_version: process.version,
    started_at: new Date().toISOString(),
  };
  // Placeholder first: an interrupted run leaves status "running", which is never graded as a pass.
  writeJson(join(trialDir, 'trial.json'), { ...base, status: 'running' });

  let ws;
  let expected;
  try {
    ({ ws, expected } = createWorkspace(kase, config));
  } catch (e) {
    const rec = { ...base, status: 'invalid', errors: [`workspace setup: ${e.message}`], integrity_detail: e.detail ?? null, finished_at: new Date().toISOString() };
    writeJson(join(trialDir, 'trial.json'), rec);
    return rec;
  }

  const repoBefore = repoState();
  const args = claudeArgs(kase.agent, kase.input.prompt, settings);
  const childEnv = trialEnv(ws, extraEnv);
  const proc = await execute(bin, args, { cwd: ws, timeoutSec: settings.timeoutSec, env: childEnv });
  const snapshot = snapshotDir(ws);
  const repoAfter = repoState();
  const sourceAfter = diffSnapshot(snapshotDir(join(REPO_ROOT, kase.fixture.path)), manifestFor(kase.fixture.path));

  writeFileSync(join(trialDir, 'transcript.jsonl'), proc.stdout);
  writeFileSync(join(trialDir, 'stderr.log'), proc.stderr);
  const { events, unparsed } = parseEvents(proc.stdout);
  const analysis = analyzeTranscript(events, kase.agent);
  const escape = findRepoReferences(analysis);
  const exec = classifyExecution({ proc, analysis, kase, unparsed, escape });
  if (!sourceAfter.clean) {
    exec.status = 'invalid';
    exec.errors.push('source fixture changed during the run');
  }
  if (analysis.output !== null) writeFileSync(join(trialDir, 'output.md'), analysis.output);

  const record = {
    ...base,
    finished_at: new Date().toISOString(),
    status: exec.status,
    errors: exec.errors,
    process: { exit_code: proc.exitCode, signal: proc.signal, timed_out: proc.timedOut, spawn_error: proc.spawnError, duration_ms: proc.durationMs },
    command: { bin, args, cwd_basename: basename(ws), env_keys: Object.keys(childEnv).sort() }, // names only, never values
    claude_code_version: analysis.init?.claude_code_version ?? null,
    model_requested: settings.model,
    models_reported: [...new Set([analysis.init?.model, ...Object.keys(analysis.result?.model_usage ?? {})].filter(Boolean))],
    usage: {
      ...usageSummary(analysis.result),
      subagent_total_tokens: analysis.subagent_usage?.total_tokens ?? null,
      scope: 'session: orchestrator turns + subagent + session-title request',
    },
    transcript: { file: 'transcript.jsonl', stderr: 'stderr.log', events: events.length, unparsed_lines: unparsed },
    output_file: analysis.output !== null ? 'output.md' : null,
    analysis,
    observations: {
      workspace_snapshot: snapshot,
      expected_files: expected,
      fixture_diff: diffSnapshot(snapshot, expected),
      repo_before: repoBefore,
      repo_after: repoAfter,
      source_fixture_diff: sourceAfter,
    },
  };
  writeJson(join(trialDir, 'trial.json'), record);
  if (!keepWorkspace) removeWorkspace(ws);
  else record.workspace = ws;
  return record;
}

export function writeJson(path, data) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, path); // atomic on the same filesystem: readers never see a half-written record
}
