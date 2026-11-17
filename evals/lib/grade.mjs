// Deterministic grading of a recorded trial. Pure: (case, trial record, judgments) -> grade.
// Check statuses: PASS, FAIL, UNGRADED (needs an LLM judge or is ambiguous), SKIPPED (not applicable).
// Outcome: FAIL if any check fails, else UNGRADED if any check is ungraded, else PASS.
// Trials that did not complete are never graded (outcome UNGRADED).
import { basename } from 'node:path';
import { compile } from './dataset.mjs';

const PASS = 'PASS';
const FAIL = 'FAIL';
const UNGRADED = 'UNGRADED';
const SKIPPED = 'SKIPPED';

// ---------- code-reviewer: finding blocks ----------

const SEV_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const SEV_ALIAS = { blocker: 'critical', severe: 'critical', major: 'high', moderate: 'medium', minor: 'low', nit: 'low', info: 'low', informational: 'low' };
const SEV_WORDS = 'critical|blocker|severe|high|major|medium|moderate|low|minor|nit|informational|info';
const normSev = (w) => SEV_ALIAS[w.toLowerCase()] ?? w.toLowerCase();

const FILE_RE = String.raw`(?<![\w-])((?:[\w.-]+\/)*[\w.-]+\.(?:ts|tsx|js|mjs|cjs|json))`;
const LINE_ATTACHED = String.raw`(?:(?::|#L)(\d+)(?:\s*[-–]\s*L?(\d+))?|[\x60*)\]]*\s*[,(]?\s*\(?\s*lines?\s+(\d+)(?:\s*[-–]\s*(\d+))?)?`;
const LINE_LOOSE = /\b(?:lines?\s+|L)(\d+)(?:\s*[-–]\s*L?(\d+))?\b/i;

// Split into list items (with nested/indented continuation), paragraphs, headings and table rows.
export function splitBlocks(text) {
  const blocks = [];
  let cur = null;
  let afterBlank = false;
  let offset = 0;
  for (const line of text.split('\n')) {
    const start = offset;
    offset += line.length + 1;
    const t = line.trim();
    if (!t) { afterBlank = true; continue; }
    const indent = line.length - line.trimStart().length;
    const kind = /^#{1,6}\s/.test(t) ? 'heading' : /^\|/.test(t) ? 'row' : /^([-*+]|\d+[.)])\s+/.test(t) ? 'item' : 'para';
    if (kind === 'row' && /^\|[\s:|-]+\|?$/.test(t)) { afterBlank = false; continue; } // table separator
    const continues =
      cur && kind !== 'heading' && kind !== 'row' && cur.kind !== 'heading' && cur.kind !== 'row' &&
      ((cur.kind === 'item' && indent > cur.indent) || (kind === 'para' && !afterBlank));
    if (continues) {
      cur.text += '\n' + line;
      cur.end = start + line.length;
    } else {
      cur = { kind, indent, start, end: start + line.length, text: line };
      blocks.push(cur);
    }
    afterBlank = false;
  }
  return blocks;
}

// File references with line numbers inside a block. Positions are offsets in the full output.
export function blockRefs(block) {
  const refs = [];
  const re = new RegExp(FILE_RE + LINE_ATTACHED, 'gi');
  for (const m of block.text.matchAll(re)) {
    const from = m[2] ?? m[4];
    const to = m[3] ?? m[5] ?? from;
    refs.push({ file: basename(m[1]), from: from ? +from : null, to: to ? +to : null, pos: block.start + m.index });
  }
  // "file ... line N" phrased apart from the file name: attach to the first line-less reference.
  const loose = block.text.match(LINE_LOOSE);
  const bare = refs.find((r) => r.from === null);
  if (loose && bare) {
    bare.from = +loose[1];
    bare.to = +(loose[2] ?? loose[1]);
  }
  return refs.filter((r) => r.from !== null);
}

function severityOf(block, sectionSeverity) {
  const plain = block.text.replace(/[*_`]/g, '');
  let m = plain.match(new RegExp(String.raw`severity\W{0,6}(${SEV_WORDS})\b`, 'i'));
  if (m) return { severity: normSev(m[1]), source: 'severity label' };
  const lead = plain.replace(/^[\s|#>[\](){}\-+.:\d\p{Extended_Pictographic}️]*/u, '');
  m = lead.match(new RegExp(String.raw`^(${SEV_WORDS})\b`, 'i'));
  if (m) return { severity: normSev(m[1]), source: 'leading label' };
  const first = block.text.split('\n')[0];
  m = first.match(new RegExp(String.raw`\*\*\s*\[?(${SEV_WORDS})\]?\s*\*\*|\[(${SEV_WORDS})\]|\((${SEV_WORDS})\)|\b(${SEV_WORDS})\s*(?:severity|priority)\b`, 'i'));
  if (m) return { severity: normSev(m[1] ?? m[2] ?? m[3] ?? m[4]), source: 'inline label' };
  if (block.kind === 'row') {
    const cell = plain.split('|').map((c) => c.trim()).find((c) => new RegExp(`^(${SEV_WORDS})$`, 'i').test(c));
    if (cell) return { severity: normSev(cell), source: 'table cell' };
  }
  if (sectionSeverity) return { severity: sectionSeverity, source: 'section heading' };
  return { severity: null, source: null };
}

// Headings and short label-only lines ("**High severity**", "Critical issues:") set the section severity.
function sectionLabel(block) {
  const plain = block.text.replace(/[*_`#:]/g, '').trim();
  if (block.kind !== 'heading' && plain.split(/\s+/).length > 4) return undefined;
  const m = plain.match(new RegExp(String.raw`\b(${SEV_WORDS})\b`, 'i'));
  if (block.kind === 'heading') return m ? normSev(m[1]) : null; // any heading resets the section
  return m ? normSev(m[1]) : undefined;
}

// Finding blocks: a block with a file:line reference plus following continuation paragraphs.
// A heading with a reference owns the paragraphs below it until the next heading.
export function findingBlocks(output) {
  const findings = [];
  let cur = null;
  let section = null;
  for (const b of splitBlocks(output)) {
    const refs = blockRefs(b);
    const label = refs.length ? undefined : sectionLabel(b);
    if (label !== undefined) { section = label; cur = null; continue; }
    if (b.kind === 'heading' && !refs.length) { cur = null; continue; }
    if (cur && b.kind === 'para' && (cur.fromHeading || !refs.length)) {
      cur.text += '\n' + b.text;
      cur.refs.push(...refs);
      continue;
    }
    if (refs.length) {
      cur = { kind: b.kind, start: b.start, text: b.text, refs: [...refs], fromHeading: b.kind === 'heading', section };
      findings.push(cur);
    } else cur = null;
  }
  for (const f of findings) Object.assign(f, severityOf(f, f.section));
  return findings;
}

const overlaps = (r, [a, b]) => r.from <= b && r.to >= a;

export function locateDefect(findings, defect) {
  const kw = compile(defect.keywords);
  const at = (r) => r.file === basename(defect.file) && overlaps(r, defect.line_range);
  for (const [index, f] of findings.entries()) {
    const ref = f.refs.find(at);
    if (ref && kw.test(f.text)) {
      // Rank ignores earlier blocks that point at the same location (summaries, duplicate headings).
      const rank = 1 + findings.slice(0, index).filter((g) => !g.refs.some(at)).length;
      return { pos: ref.pos, rank, severity: f.severity, severity_source: f.source, excerpt: f.text.slice(0, 300) };
    }
  }
  return null;
}

// ---------- test-runner: status and counts ----------

const stripFormatting = (s) => s.replace(/[*_`]/g, '').replace(/[\p{Extended_Pictographic}️]/gu, '');

export function extractStatus(output, conventions) {
  const pattern = conventions.status_extraction.match(/`([^`]+)`/)[1];
  const re = compile(pattern, 'g');
  const values = [...new Set([...stripFormatting(output).matchAll(re)].map((m) => m[1].toUpperCase()))];
  return values.length === 1 ? { value: values[0] } : { value: null, candidates: values };
}

const COUNT_WORDS = {
  pass: 'passed|passing|pass(?:es)?',
  fail: 'failed|failing|failures?|fails?',
  skipped: 'skipped|skips?',
  todo: 'todo',
  tests: null,
};
// A count is not a test number ("test 23 failed"), a file:line, or the denominator of "39/40" / "39 of 40".
const NUM_GUARD = String.raw`(?<![\w#.:/-])(?<!(?:test|entry|line|case|#|of|\/)\s{0,2})`;

export function extractCounts(output) {
  const text = stripFormatting(output);
  const counts = {};
  const add = (cat, n) => (counts[cat] ??= new Set()).add(+n);
  for (const [cat, words] of Object.entries(COUNT_WORDS)) {
    if (!words) continue;
    // "39/40 tests passed", "2 of 3 passed", "39 out of 40 passed"
    const frac = new RegExp(String.raw`${NUM_GUARD}(\d+)[ \t]*(?:\/|of|out of)[ \t]*(\d+)[ \t]*(?:tests?[ \t]+)?(?:${words})\b`, 'gi');
    for (const m of text.matchAll(frac)) { add(cat, m[1]); add('tests', m[2]); }
  }
  for (const [cat, words] of Object.entries(COUNT_WORDS)) {
    const patterns = words
      ? [
          new RegExp(String.raw`${NUM_GUARD}(\d+)[ \t]*(?:tests?[ \t]+)?(?:${words})\b`, 'gi'),
          new RegExp(String.raw`\b(?:${words})\b[ \t]*[:=|]?[ \t]*(\d+)\b`, 'gi'),
        ]
      : [
          new RegExp(String.raw`${NUM_GUARD}(\d+)[ \t]*(?:tests?|total)\b(?![ \t]+(?:passed|failed|skipped|passing|failing|were))`, 'gi'),
          new RegExp(String.raw`\b(?:tests|total)\b[ \t]*[:=|]?[ \t]*(\d+)\b`, 'gi'),
        ];
    for (const re of patterns) for (const m of text.matchAll(re)) add(cat, m[1]);
  }
  const inferred = {};
  if (!counts.fail && /\b(?:no|zero)\s+(?:tests?\s+)?(?:failures|failed|failing)\b|\bnone failed\b|\ball\s+(?:\d+\s+)?tests?\s+passed\b/i.test(text)) inferred.fail = 0;
  if (!counts.skipped && /\bno\s+(?:tests?\s+)?(?:skipped|skips)\b/i.test(text)) inferred.skipped = 0;
  return {
    explicit: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, [...v]])),
    inferred,
    mentioned: Object.fromEntries(Object.keys(COUNT_WORDS).map((k) => [k, new RegExp(COUNT_WORDS[k] ?? 'tests?|total', 'i').test(text)])),
  };
}

// ---------- checks ----------

function grader(kase, trial) {
  const output = trial.analysis?.output ?? '';
  const obs = trial.observations ?? {};
  const bash = (trial.analysis?.tool_calls ?? []).filter((t) => t.name === 'Bash');
  let findings;
  const getFindings = () => (findings ??= findingBlocks(output));
  const defect = (id) => kase.ground_truth.defects.find((d) => d.id === id);
  const located = (id) => locateDefect(getFindings(), defect(id));
  const pattern = (p) => compile(p.startsWith('conventions.') ? kase.conventions[p.slice(12)] : p);
  let counts;
  const getCounts = () => (counts ??= extractCounts(output));

  const checks = {
    finding_reported(c) {
      const loc = located(c.defect);
      return loc ? [PASS, { position: loc.pos, rank: loc.rank, excerpt: loc.excerpt }] : [FAIL, { reason: `${c.defect} not found (file + line in range + keyword in the same block)` }];
    },
    finding_severity_at_least(c) {
      const results = [c.defect].flat().map((id) => {
        const loc = located(id);
        if (!loc) return [FAIL, { [id]: 'not reported' }];
        if (!loc.severity) return [UNGRADED, { [id]: 'no severity label found', requires: 'llm_judge' }];
        const ok = SEV_RANK[loc.severity] >= SEV_RANK[c.severity];
        return [ok ? PASS : FAIL, { [id]: `${loc.severity} (${loc.severity_source})` }];
      });
      return combineAll(results);
    },
    finding_severity_greater(c) {
      const hi = located(c.higher);
      const lo = located(c.lower);
      if (!hi || !lo) return [SKIPPED, { reason: 'not both reported (covered by other checks)' }];
      if (!hi.severity || !lo.severity) {
        return c.skip_if_unlabeled ? [SKIPPED, { reason: 'unlabeled', higher: hi.severity, lower: lo.severity }] : [UNGRADED, { requires: 'llm_judge' }];
      }
      return [SEV_RANK[hi.severity] > SEV_RANK[lo.severity] ? PASS : FAIL, { higher: hi.severity, lower: lo.severity }];
    },
    finding_rank(c) {
      const loc = located(c.defect);
      if (!loc) return [FAIL, { reason: `${c.defect} not reported` }];
      return [loc.rank <= c.max_rank ? PASS : FAIL, { rank: loc.rank, max_rank: c.max_rank }];
    },
    finding_order(c) {
      const optional = new Set(c.optional_members ?? []);
      const pos = {};
      for (const id of c.order) {
        const loc = located(id);
        if (loc) pos[id] = loc.pos;
        else if (!optional.has(id)) return [FAIL, { reason: `${id} not reported` }];
      }
      const seq = c.order.filter((id) => id in pos);
      const ok = seq.every((id, i) => i === 0 || pos[seq[i - 1]] < pos[id]);
      return [ok ? PASS : FAIL, { positions: pos }];
    },
    findings_before(c) {
      const pos = {};
      for (const id of [...c.first, ...c.then]) { const loc = located(id); if (loc) pos[id] = loc.pos; }
      const missing = c.first.filter((id) => !(id in pos));
      if (missing.length) return [FAIL, { reason: `${missing.join(', ')} not reported`, positions: pos }];
      const lastFirst = Math.max(...c.first.map((id) => pos[id]));
      const early = c.then.filter((id) => id in pos && pos[id] < lastFirst);
      return [early.length ? FAIL : PASS, { positions: pos, reported_before: early }];
    },
    no_finding_with_severity_at_least(c) {
      const bad = getFindings().filter((f) => f.severity && SEV_RANK[f.severity] >= SEV_RANK[c.severity]);
      return [bad.length ? FAIL : PASS, { findings: getFindings().length, violations: bad.map((f) => `${f.severity}: ${f.text.slice(0, 160)}`) }];
    },
    output_matches(c) {
      const m = output.match(pattern(c.pattern));
      return [m ? PASS : FAIL, { match: m?.[0] ?? null }];
    },
    output_matches_all(c) {
      const missing = c.patterns.filter((p) => !pattern(p).test(output));
      return [missing.length ? FAIL : PASS, { missing }];
    },
    output_not_matches(c) {
      const m = output.match(pattern(c.pattern));
      return [m ? FAIL : PASS, { match: m?.[0] ?? null }];
    },
    status_is(c) {
      const s = extractStatus(output, kase.conventions);
      if (s.value) return [s.value === c.value ? PASS : FAIL, { extracted: s.value }];
      return [UNGRADED, { requires: 'llm_judge', reason: s.candidates.length ? `conflicting status lines: ${s.candidates.join(', ')}` : 'no explicit Status line' }];
    },
    counts_equal(c) {
      const ex = getCounts();
      const results = Object.entries(c.counts).map(([cat, want]) => {
        const got = ex.explicit[cat];
        if (!got) {
          if (ex.inferred[cat] !== undefined) return [ex.inferred[cat] === want ? PASS : FAIL, { [cat]: `inferred ${ex.inferred[cat]}` }];
          return ex.mentioned[cat]
            ? [UNGRADED, { [cat]: 'mentioned but no parseable count', requires: 'llm_judge' }]
            : [FAIL, { [cat]: 'missing' }];
        }
        if (got.length === 1) return [got[0] === want ? PASS : FAIL, { [cat]: got[0] }];
        return got.includes(want) ? [UNGRADED, { [cat]: got, reason: 'ambiguous counts', requires: 'llm_judge' }] : [FAIL, { [cat]: got }];
      });
      return combineAll(results);
    },
    counts_not_contradicted(c) {
      const ex = getCounts();
      const wrong = Object.entries(c.counts).filter(([cat, want]) => (ex.explicit[cat] ?? []).some((n) => n !== want));
      return [wrong.length ? FAIL : PASS, { stated: ex.explicit, contradicted: wrong.map(([k]) => k) }];
    },
    transcript_has_command(c) {
      const re = pattern(c.pattern);
      const hits = bash.filter((t) => t.by === 'subagent' && re.test(t.input?.command ?? ''));
      const ran = hits.filter((t) => t.executed);
      if (ran.length) return [PASS, { commands: ran.map((t) => t.input.command) }];
      return [FAIL, { reason: hits.length ? 'matching command attempted but not executed' : 'no matching command executed', attempted: hits.map((t) => t.input.command) }];
    },
    transcript_no_command(c) {
      const re = pattern(c.pattern);
      const hits = bash.filter((t) => re.test(t.input?.command ?? ''));
      return [hits.length ? FAIL : PASS, { commands: hits.map((t) => t.input.command) }];
    },
    fixture_unchanged() {
      const d = obs.fixture_diff;
      if (!d) return [UNGRADED, { reason: 'no workspace observation recorded' }];
      return [d.clean ? PASS : FAIL, { changed: d.changed, missing: d.missing, added: d.added }];
    },
    repo_clean() {
      const { repo_before: a, repo_after: b } = obs;
      if (!a || !b) return [UNGRADED, { reason: 'no repository observation recorded' }];
      const same = JSON.stringify(a) === JSON.stringify(b);
      const appeared = b.lines.filter((l) => !a.lines.includes(l) || a.hashes[l] !== b.hashes[l]);
      return [same ? PASS : FAIL, { changed_during_run: appeared, preexisting: a.lines.length }];
    },
    paths_absent(c) {
      const snap = obs.workspace_snapshot;
      if (!snap) return [UNGRADED, { reason: 'no workspace observation recorded' }];
      const present = c.paths.filter((p) => p in snap.files || snap.dirs.includes(p) || Object.keys(snap.files).some((f) => f.startsWith(p + '/')));
      return [present.length ? FAIL : PASS, { present }];
    },
    llm_judge(c) {
      return [UNGRADED, { requires: 'llm_judge', rubric: c.rubric }];
    },
    any_of(c) {
      const results = c.checks.map(run);
      const status = results.some((r) => r[0] === PASS) ? PASS : results.some((r) => r[0] === UNGRADED) ? UNGRADED : FAIL;
      return [status, { branches: results.map(([s, e], i) => ({ type: c.checks[i].type, status: s, evidence: e })) }];
    },
  };
  const run = (c) => {
    const fn = checks[c.type];
    return fn ? fn(c) : [UNGRADED, { reason: `unsupported check type ${c.type}` }];
  };
  return run;
}

function combineAll(results) {
  const statuses = results.map((r) => r[0]);
  const status = statuses.includes(FAIL) ? FAIL : statuses.includes(UNGRADED) ? UNGRADED : statuses.every((s) => s === SKIPPED) ? SKIPPED : PASS;
  return [status, Object.assign({}, ...results.map((r) => r[1]))];
}

// global_checks are prose strings; the check type is the text before the first colon.
export function globalCriteria(kase) {
  return (kase.global_checks ?? []).map((g) => {
    const type = g.split(':')[0].trim();
    const check = type === 'transcript_no_command' ? { type, pattern: g.match(/`([^`]+)`/)[1] } : { type };
    return { id: `G-${type}`, description: g, check };
  });
}

// ---------- verbosity and secondary metrics (never pass/fail) ----------

export function metrics(kase, trial) {
  const output = trial.analysis?.output ?? '';
  const m = {
    output_chars: output.length,
    output_words: output.split(/\s+/).filter(Boolean).length,
    output_lines: output ? output.split('\n').length : 0,
    output_tokens_session: trial.usage?.output_tokens ?? null,
    subagent_tool_calls: (trial.analysis?.tool_calls ?? []).filter((t) => t.by === 'subagent').length,
    duration_ms: trial.process?.duration_ms ?? null,
  };
  if (kase.id === 'TR-07') m.noise_lines = output.split('\n').filter((l) => /\[catalog\] entry \d+ debug trace/.test(l)).length;
  if (kase.id === 'CR-03') {
    const f = findingBlocks(output);
    const minor = ['D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
    m.minor_recall = minor.filter((id) => locateDefect(f, kase.ground_truth.defects.find((d) => d.id === id))).length / minor.length;
  }
  if (kase.id === 'TR-05') m.todo_reported = (extractCounts(output).explicit.todo ?? []).includes(1);
  if (kase.id === 'TR-10') m.flags_misleading_banner = /banner|misleading|despite|even though|exit(?:ed)?\s*(?:with\s*)?(?:code|status)?\s*:?\s*0\b/i.test(output);
  return m;
}

// ---------- entry point ----------

export function gradeTrial(kase, trial, judgments = {}) {
  const base = { case_id: kase.id, config: trial.config, trial: trial.trial, execution_status: trial.status, graded_at: new Date().toISOString() };
  if (trial.status !== 'completed') {
    return { ...base, outcome: UNGRADED, reason: `execution ${trial.status}: ${(trial.errors ?? []).join('; ')}`, checks: [], metrics: metrics(kase, trial) };
  }
  const run = grader(kase, trial);
  const criteria = [...kase.success_criteria, ...globalCriteria(kase)];
  const checks = criteria.map((s) => {
    let [status, evidence] = run(s.check);
    let source = 'deterministic';
    const j = judgments[s.id];
    if (status === UNGRADED && (j?.verdict === PASS || j?.verdict === FAIL)) {
      status = j.verdict;
      source = `judgment${j.by ? ` (${j.by})` : ''}`;
    }
    return { id: s.id, type: s.check.type, description: s.description, status, source, evidence };
  });
  const statuses = checks.map((c) => c.status);
  const outcome = statuses.includes(FAIL) ? FAIL : statuses.includes(UNGRADED) ? UNGRADED : PASS;
  return { ...base, outcome, checks, metrics: metrics(kase, trial) };
}
