#!/usr/bin/env node
// Extract the final review-pr JSON (last ```json block of the result) plus measured cost from a
// `claude -p --output-format stream-json` transcript.  usage: extract-findings.mjs transcript.jsonl
import { readFileSync } from 'node:fs';

const lines = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const result = lines.filter((e) => e.type === 'result').pop() || {};
const text = result.result || '';
let parsed = null;
const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1]);
for (const b of blocks.reverse()) { try { const j = JSON.parse(b); if (Array.isArray(j.findings)) { parsed = j; break; } } catch { /* next */ } }
if (!parsed) { try { const j = JSON.parse(text); if (Array.isArray(j.findings)) parsed = j; } catch { /* none */ } }

const dispatched = lines.filter((e) => e.type === 'assistant').flatMap((e) => e.message?.content || [])
  .filter((c) => c.type === 'tool_use' && c.name === 'Agent').map((c) => c.input?.subagent_type);

console.log(JSON.stringify({
  parse_ok: Boolean(parsed),
  base: parsed?.base ?? null,
  findings: parsed?.findings ?? [],
  agents_dispatched: dispatched,
  total_cost_usd: result.total_cost_usd ?? null,
  duration_ms: result.duration_ms ?? null,
  num_turns: result.num_turns ?? null,
  is_error: result.is_error ?? null,
  modelUsage: result.modelUsage ?? null,
}, null, 2));
