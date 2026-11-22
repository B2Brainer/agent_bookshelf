#!/usr/bin/env node
// Per-stage cost report for one headless /ship-ticket (or /review-pr) session.
//   usage: cost-by-stage.mjs <stream-json transcript> [--projects-dir ~/.claude/projects/<proj>]
//
// Measured inputs (no estimates of totals):
//   - result event of the stream-json transcript: total_cost_usd and per-model costUSD (Claude Code's own accounting)
//   - the session's on-disk transcripts (main + subagents/*.jsonl): finalized per-message token usage
// Attribution: stages follow the orchestrator's dispatch order
//   build  = everything until the first reviewer dispatch (plan, test-writer, implementer, verification)
//   review = first review round (reviewers + verifier + orchestrator turns until the next builder dispatch)
//   fix    = everything after that (implementer fixes, re-verification, later review rounds, report)
// Each model's measured costUSD is split across stages in proportion to price-weighted tokens
// (input 1, output 5, cache read 0.1, cache write 5m 1.25 / 1h 2 — the published Claude price ratios),
// so stage costs always sum to the measured total. Token totals are cross-checked against modelUsage.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

const streamPath = process.argv[2];
const pdIdx = process.argv.indexOf('--projects-dir');
const events = readFileSync(streamPath, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const result = events.filter((e) => e.type === 'result').pop();
const sessionId = events.find((e) => e.session_id)?.session_id;
const cwd = events.find((e) => e.type === 'system' && e.cwd)?.cwd;
const projectsDir = pdIdx > 0 ? process.argv[pdIdx + 1] : join(homedir(), '.claude', 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
const mainFile = join(projectsDir, `${sessionId}.jsonl`);
if (!existsSync(mainFile)) { console.error(`session transcript not found: ${mainFile}`); process.exit(1); }

const readJsonl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
// Last occurrence of each message id carries the finalized usage.
function messages(entries) {
  const byId = new Map();
  for (const e of entries) if (e.type === 'assistant' && e.message?.id && e.message.usage) byId.set(e.message.id, e);
  return [...byId.values()];
}

const REVIEWERS = /review-(correctness|security|verifier)/;
const BUILDERS = /(implementer|test-writer)/;
// Each content block of a message is a separate on-disk entry: scan every entry for dispatches,
// tag each message id with the stage current at its first entry, and use the last entry's usage.
const mainEntries = readJsonl(mainFile);
const stageOfTool = new Map(); const stageOfMsg = new Map();
let stage = 'build';
for (const e of mainEntries) {
  if (e.type !== 'assistant' || !e.message?.id) continue;
  for (const d of (e.message.content || []).filter((c) => c.type === 'tool_use' && c.name === 'Agent')) {
    const type = d.input?.subagent_type || '';
    if (stage === 'build' && REVIEWERS.test(type)) stage = 'review';
    else if (stage === 'review' && BUILDERS.test(type)) stage = 'fix';
    stageOfTool.set(d.id, { stage, type });
  }
  if (!stageOfMsg.has(e.message.id)) stageOfMsg.set(e.message.id, stage);
}
const tagged = messages(mainEntries).map((m) => ({ who: 'orchestrator', stage: stageOfMsg.get(m.message.id), m }));
const subDir = join(projectsDir, sessionId, 'subagents');
const agentsSeen = [];
if (existsSync(subDir)) {
  for (const f of readdirSync(subDir).filter((x) => x.endsWith('.jsonl'))) {
    const meta = JSON.parse(readFileSync(join(subDir, f.replace(/\.jsonl$/, '.meta.json')), 'utf8'));
    const s = stageOfTool.get(meta.toolUseId)?.stage ?? 'unattributed';
    agentsSeen.push({ agent: meta.agentType, stage: s, file: basename(f) });
    for (const m of messages(readJsonl(join(subDir, f)))) tagged.push({ who: meta.agentType, stage: s, m });
  }
}

const weight = (u) => {
  const cw = u.cache_creation || {};
  const cw1h = cw.ephemeral_1h_input_tokens ?? 0;
  const cw5m = cw.ephemeral_5m_input_tokens ?? Math.max(0, (u.cache_creation_input_tokens || 0) - cw1h);
  return (u.input_tokens || 0) + 5 * (u.output_tokens || 0) + 0.1 * (u.cache_read_input_tokens || 0) + 1.25 * cw5m + 2 * cw1h;
};
const models = result.modelUsage || {};
const wByModel = {}; const tokByModel = {};
for (const t of tagged) {
  const model = t.m.message.model; const u = t.m.message.usage;
  wByModel[model] = (wByModel[model] || 0) + weight(u);
  const k = (tokByModel[model] ||= { in: 0, out: 0, cr: 0, cw: 0 });
  k.in += u.input_tokens || 0; k.out += u.output_tokens || 0; k.cr += u.cache_read_input_tokens || 0; k.cw += u.cache_creation_input_tokens || 0;
}
const canon = (m) => Object.keys(models).find((k) => m === k || m.startsWith(k) || k.startsWith(m)) || m;
const stages = {};
for (const t of tagged) {
  const model = t.m.message.model; const u = t.m.message.usage;
  const cost = models[canon(model)] ? models[canon(model)].costUSD * weight(u) / wByModel[model] : 0;
  const s = (stages[t.stage] ||= { cost: 0, in: 0, cr: 0, cw: 0, out: 0, models: new Set(), agents: new Set() });
  s.cost += cost; s.in += u.input_tokens || 0; s.cr += u.cache_read_input_tokens || 0; s.cw += u.cache_creation_input_tokens || 0; s.out += u.output_tokens || 0;
  s.models.add(model); s.agents.add(t.who);
}

const order = ['build', 'review', 'fix', 'unattributed'].filter((s) => stages[s]);
console.log(`Session ${sessionId}  (${basename(streamPath)})`);
console.log(`Measured total_cost_usd: $${result.total_cost_usd.toFixed(4)}   duration: ${(result.duration_ms / 60000).toFixed(1)} min   turns: ${result.num_turns}\n`);
console.log('| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |');
console.log('|---|---|---|---|---|---|---|---|---|');
let sum = 0;
for (const s of order) {
  const x = stages[s]; sum += x.cost;
  const hit = x.cr / Math.max(1, x.in + x.cr + x.cw);
  console.log(`| ${s} | $${x.cost.toFixed(4)} | ${(100 * hit).toFixed(1)}% | ${[...x.models].join(', ')} | ${[...x.agents].join(', ')} | ${x.in} | ${x.cr} | ${x.cw} | ${x.out} |`);
}
console.log(`| **total** | **$${sum.toFixed(4)}** | | | | | | | |`);
console.log('\nCache hit = cache_read / (input + cache_read + cache_write) for the stage.');
console.log('\nReconciliation against the result event (modelUsage):');
for (const [m, mu] of Object.entries(models)) {
  const k = Object.entries(tokByModel).filter(([x]) => canon(x) === m).reduce((a, [, v]) => ({ in: a.in + v.in, out: a.out + v.out, cr: a.cr + v.cr, cw: a.cw + v.cw }), { in: 0, out: 0, cr: 0, cw: 0 });
  console.log(`- ${m}: costUSD $${mu.costUSD.toFixed(4)} | tokens from transcripts in/out/cacheRead/cacheWrite = ${k.in}/${k.out}/${k.cr}/${k.cw} vs modelUsage ${mu.inputTokens}/${mu.outputTokens}/${mu.cacheReadInputTokens}/${mu.cacheCreationInputTokens}`);
}
console.log(`\nSubagents: ${agentsSeen.map((a) => `${a.agent}→${a.stage}`).join(', ') || 'none'}`);
