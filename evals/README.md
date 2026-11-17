# Subagent Evaluation Dataset

This dataset checks whether the output-verbosity optimizations made to `code-reviewer` and `test-runner` preserved the quality of their results. It defines 20 cases and their fixtures, plus a minimal harness that runs the real subagents and grades them deterministically.

```text
evals/
├── baseline/               # Recovered pre-optimization (Week 2) agent definitions, reference only
├── cases/
│   ├── code-reviewer.json  # CR-01..CR-10
│   └── test-runner.json    # TR-01..TR-10
├── fixtures/
│   ├── MANIFEST.sha256     # sha256 of every fixture file (integrity + "files unchanged" checks)
│   ├── code-reviewer/      # cr-01..cr-10: self-contained TypeScript snippets (each with its own db.ts stub)
│   └── test-runner/        # tr-01..tr-10: tiny Node projects using the built-in `node --test` runner
├── harness.mjs             # CLI: validate, run, grade, summarize
├── lib/
│   ├── dataset.mjs         # Case loading, manifest, snapshots
│   ├── run.mjs             # Isolated workspace, CLI invocation, transcript analysis, trial records
│   └── grade.mjs           # Deterministic graders (pure functions of case + recorded trial)
├── test/                   # Offline harness tests (fake CLI, mock API); never call a model
├── results/                # Run outputs: results/<run-id>/<config>/<case-id>/trial-<n>/ (transcripts git-ignored)
└── validate-dataset.mjs    # Validates the dataset itself; does not grade agents
```

## Configurations under test

| Config | code-reviewer | test-runner |
|---|---|---|
| baseline | `evals/baseline/code-reviewer.md` | `evals/baseline/test-runner.md` |
| optimized | `.claude/agents/code-reviewer.md` | `.claude/agents/test-runner.md` |

The two configs differ only in their `Return:` section. Name, description, tools, responsibilities and constraints are identical.

**Baseline provenance.** Git does not have the baseline versions. The agents first appear in commit `7013d06` ("Homework-2"), already optimized. The baseline text was recovered from a Week 2 Claude Code session transcript, which records a `Read` of both files at 2026-11-10T16:35Z, about 3.5 hours before that commit. It is the best available record, but it is a snapshot rather than a versioned file.

The baseline copies live outside `.claude/agents/` so Claude Code does not register them as project agents. The harness copies the selected configuration's file to `.claude/agents/<agent>.md` inside each isolated workspace, so neither checkout's agent files are ever edited.

## Keeping answers away from the agents

Case metadata (`evals/cases/`), this README, the baseline configs and the results must never be readable by the agent under evaluation. Both subagents can Read, Grep and Glob, and the test-runner can also use Bash. If a case ran inside this repository, the agent could open `evals/cases/*.json` and read the answers. So each run happens in an isolated workspace:

- The workspace is a new temp directory with a random, neutral name, outside this repository and outside any directory that has a `node_modules`.
- It contains a copy of only that case's `fixture.path`, copied to the workspace root, plus `.claude/agents/<agent>.md` for the configuration under test.
- If the hook settings are reproduced, it also gets `.claude/settings.json` and `.claude/hooks/block-git-commit.sh`. Both configurations must get the same settings.
- The agent's working directory is the workspace root. Every `input.prompt` and every path a check uses is relative to that root.
- Fixture directory names (`cr-01`, `tr-07`, …) are neutral IDs and never appear inside the workspace.
- Fixture contents carry no hints such as "fixture", "defect", "intentional" or case IDs. Comments that the scenario needs (specs, or deliberately misleading comments in CR-10) are part of the test. The validator checks for revealing terms.

## Running the harness

Run from the repository root with Node 22. There are no dependencies.

```bash
node evals/harness.mjs validate                                       # dataset validator (same as validate-dataset.mjs)
node evals/harness.mjs run --config baseline --case CR-01             # dry run: prints the plan and exact command, runs nothing
node evals/harness.mjs run --config baseline --case CR-01 --yes       # one case, 3 trials (billed)
node evals/harness.mjs run --config optimized --all --yes             # all 20 cases (billed)
node evals/harness.mjs run --config optimized --all --agent test-runner --trials 5 --run-id week3 --yes
node evals/harness.mjs grade week3                                    # re-grade recorded trials, no agent runs
node evals/harness.mjs adjudicate week3                               # write blinded items for UNGRADED checks
node evals/harness.mjs adjudicate week3 --apply                       # apply recorded verdicts, then re-grade
node evals/harness.mjs summarize week3                                # pass rates, costs, verbosity per case and config
node --test evals/test/harness.test.mjs                               # offline harness tests
EVALS_CLI_INTEGRATION=1 node --test evals/test/cli-integration.test.mjs   # real CLI against a local mock API (not billed)
```

`run` options: `--trials N` (default 3), `--run-id ID` (default: a timestamp), `--model` (default `claude-sonnet-5`), `--effort` (default `high`), `--timeout SEC` (default 600), `--max-budget-usd USD` (per trial, default 2), and `--keep-workspace` for debugging. Without `--yes`, `run` is a dry run. To compare configs, run both under the same `--run-id`. A run refuses to add trials whose settings, dataset checksum or CLI version differ from those in the run's `run.json`.

### How a trial runs

1. `run` runs the dataset validator first and stops if it fails.
2. The source fixture is checked against `MANIFEST.sha256`. A new workspace `$TMPDIR/ws-XXXXXX` gets the fixture plus `.claude/agents/<agent>.md` for the selected configuration, and the copy is checked against the manifest. Case files, expected answers and graders stay in the repository.
3. In the workspace, the harness runs `claude -p` with a fixed wrapper prompt that asks the main session to dispatch `<agent>` through the Agent tool with the task verbatim. Flags are identical for both configs: `--output-format stream-json --verbose --forward-subagent-text --no-session-persistence --setting-sources project --strict-mcp-config --permission-prompts none --allowedTools Bash --model … --effort … --max-budget-usd …`. The environment is an allowlist (PATH, HOME, locale, proxy, `ANTHROPIC_*`, and similar), with `PWD` set to the workspace, so the repository path and any parent Claude Code session settings do not leak in.
4. The transcript must show exactly one dispatch of the target subagent with the case prompt unchanged, and no tool use by the orchestrator. Otherwise the trial is `invalid` and is not graded. The graded output is the subagent's own final message, not the orchestrator's reply. Bash commands are taken from the subagent's tool calls and their results.
5. After the run, the harness records a snapshot of the workspace, `git status` of the repository before and after, and a fixture check. Any tool input that references the repository path or `evals/cases` marks the trial `invalid`. The workspace is then removed (only `$TMPDIR/ws-*` directories are ever deleted).

Each run directory contains `run.json`, which records the run ID, creation time, settings (requested model, effort, timeout, budget), dataset checksum, Claude Code CLI version (`claude --version`, or `null` if unavailable), Node.js version, git commit, and whether `evals/` or `.claude/agents/` had uncommitted changes. It also holds `summary.json` and `adjudication/`. Each trial directory contains:

| File | Content |
|---|---|
| `trial.json` | Execution record. Holds the case ID, configuration and trial number; the agent definition path and its sha256; `dataset_sha256` (sha256 over both case files and `MANIFEST.sha256`); and the git commit. It records the requested model and the models reported in the transcript, the CLI version from the transcript, the Node.js version, start and finish timestamps, and the duration. It also records status, errors, exit code and timeout flag; token usage and cost; the parsed transcript analysis; and filesystem observations. Written as `status: "running"` before the agent starts. |
| `transcript.jsonl` / `stderr.log` | Raw CLI stream and stderr. Not tracked by git by default (`evals/results/.gitignore`). |
| `output.md` | The subagent's final output. |
| `grade.json` | Check results with evidence, adjudication criteria for UNGRADED checks, the outcome, and verbosity metrics. Regenerated by `grade`. |
| `judgments.json` | Adjudicated verdicts, written by `adjudicate --apply`. See below. |

Execution status is one of `completed`, `error`, `timeout`, `invalid` or `running` (interrupted). Only `completed` trials are graded. Every other status yields outcome `UNGRADED`, so a failed or interrupted run is never counted as a pass. Any metadata value that is unavailable is recorded as `null`, never as a default.

**Cost and tokens are session-wide.** They come from the CLI's final `result` event and cover the whole `claude -p` session. That includes orchestrator overhead (the dispatch turn, the turn that receives the subagent's report, and the session-title request), not just the subagent. The overhead uses the same wrapper for both configs, but it is not zero, so absolute costs overstate the subagent's own cost. `usage.subagent_total_tokens` (from the subagent's task notification) is the subagent-only figure where the CLI reports it. Cost is `null` with `cost_status: "missing"` when the CLI reports none, which keeps it distinct from a reported `0`.

### Grading

Each check yields `PASS`, `FAIL`, `UNGRADED` or `SKIPPED`. The outcome is `FAIL` if any check fails, otherwise `UNGRADED` if any check is ungraded, otherwise `PASS`. `SKIPPED` (for example, `skip_if_unlabeled`) does not count. The `global_checks` are applied as extra criteria named `G-<type>`.

- Findings: blocks are list items with their nested lines, paragraphs, headings and table rows. A block with a `file:line` reference (also `file#L18`, ``file`, lines 18-21``, or an absolute path) starts a finding. Paragraphs that follow it without their own reference belong to it, and a heading that has a reference owns the paragraphs under it. Severity comes from an explicit label in the block (`Severity: High`, a leading `**Critical**`, `[High]`, or a table cell), otherwise from the enclosing severity heading (`### Critical`). This keeps the baseline's grouped-by-severity layout from being penalized.
- Status: whitespace, markdown emphasis and emoji are stripped, then the convention regex is applied. Without a `Status:` line (typical for the baseline), the status is inferred only when two independent readings agree:
  - **Output wording**, from explicit phrases. Examples are "could not be run" or "not installed" (BLOCKED), a nonzero failed count, "tests failed" or a nonzero exit code (FAILED), and "all tests passed" with no failure wording (PASSED).
  - **Execution evidence**, from the last test command the subagent actually executed. "command not found" or "Missing script" means BLOCKED. A nonzero `# fail` count or a nonzero exit means FAILED. `# fail 0` with a zero exit means PASSED.

  If the two agree, that is the extracted status. Otherwise, or with conflicting `Status:` lines, the check is `UNGRADED`. A success claim without an executed, passing test run is never credited.
- Counts: phrases such as `6 passed`, `pass: 6`, `39/40 tests passed` and table cells are recognized. Test numbers (`test 23 failed`) and `file:line` are ignored. A count that is mentioned but cannot be parsed gives `UNGRADED`. A count that is absent gives `FAIL`.
- Actions are graded on evidence, never on the agent's claims. `transcript_*` checks require a Bash call that actually produced a result (not denied, not rejected by the CLI). `fixture_unchanged`, `paths_absent` and `repo_clean` use the recorded snapshots.
- Semantic checks are `UNGRADED` with `requires: "adjudication"`. These are every `llm_judge` check (CR-04/S2 when findings are present, CR-10/S3), plus severity, status or count extraction that the deterministic rules cannot settle. `grade.json` attaches fixed `adjudication_criteria` to each one. The criteria depend only on the case and the check, never on the configuration.

### Adjudication (replaces the LLM judge named in the case files)

UNGRADED checks are settled by structured manual adjudication. No paid judge is used, and nothing is converted automatically.

1. `node evals/harness.mjs adjudicate <run>` writes `adjudication/batch-N/items.json` and `key.json`. Each item holds the case and criterion IDs, the criterion, the decision criteria, the subagent output, the deterministic evidence, and neutral context. For code-reviewer that context is the fixture source and the ground-truth notes. For test-runner it is the executed commands with the head and tail of their output. Items contain no configuration, trial number or trial path, and their order is shuffled. Checks already in an earlier batch are not repeated.
2. The adjudicator opens only `items.json` and sets `verdict` to `"PASS"` or `"FAIL"` by applying `decision_criteria` literally. They also fill in `by` and optionally `note`, and leave `verdict: null` when undecided. They must not open `key.json`, trial directories or `summary.json` until done.
3. `node evals/harness.mjs adjudicate <run> --apply` uses `key.json` to copy each decided verdict into that trial's `judgments.json`, then re-grades. Undecided items stay `UNGRADED`. Invalid verdicts are counted and ignored.

A judgment can only settle an `UNGRADED` check. It never overrides a deterministic `PASS` or `FAIL`, and the check's `source` records it as `judgment (<by>)`. Blinding is procedural: the output format itself can hint at the configuration (the optimized test-runner prescribes a `Status:` line, for example), which is unavoidable because the format is what is under test.

### Pass rate and unresolved checks

`summarize` reports, per case and config: trials; graded trials (PASS + FAIL); PASS, FAIL and UNGRADED counts; how many UNGRADED trials come from unresolved checks and how many from execution errors; pass rate; total cost (trials with missing cost are counted separately); mean duration; and mean output size. Per config it also reports how many cases are fully graded and how many still have UNGRADED trials. It writes `summary.json`, including the run metadata.

**pass rate = PASS / (PASS + FAIL).** UNGRADED trials, whether from unresolved checks or execution errors, count as neither a pass nor a failure. They are excluded from both the numerator and the denominator and are always reported next to the rate. A rate based on few graded trials, or a case with many UNGRADED trials, should be read with that in mind. When pass rates are compared across configs, also compare their UNGRADED and execution-error counts.

### Known limitations

- **Semantic checks need manual adjudication.** CR-10 can never reach `PASS` without a verdict, and CR-04 needs one whenever findings are reported. Baseline test-runner status is inferred when wording and execution agree. Otherwise, for example when test output is truncated so that no `# fail` line survives, it also needs adjudication.
- **Dispatch goes through an orchestrator session.** Claude Code 2.1.277 has no flag that runs a project subagent directly. `--agent` makes the agent the main session instead. A model-driven orchestrator could alter the prompt, re-dispatch, or do the work itself. Each of these is detected and marked `invalid`, but such trials need a re-run. The orchestrator's tools cannot be restricted: `--tools Agent` also strips Bash from the subagents.
- **Effective tool sets differ from the frontmatter.** In this CLI version, `code-reviewer` gets `Read, Grep, Glob`, while `test-runner` gets `Read, Bash`, because the CLI drops Grep and Glob when Bash is available. This is the same for both configs.
- **Hooks are not reproduced in the workspace** (`--setting-sources project`, and the workspace has no `.claude/settings.json`). The workspace is not a git repository, so `block-git-commit.sh` would have nothing to block.
- **The default model `claude-sonnet-5` is pinned** because this CLI reports `unrecognized_model` for `claude-sonnet-5-5`.
- **Heuristic parsing.** Finding and count extraction cannot cover every phrasing. Every check records its evidence (matched block, position, rank, severity source and extracted values) so results can be audited.

Run each case several times per config (for example 3–5) and report the pass rate, because agent output is nondeterministic.

## Fairness rules

- Both configs get identical prompts, fixtures, model and criteria.
- Correctness and verbosity are scored separately. No criterion depends on output length.
- Criteria accept the vocabulary of both configs:
  - Status is extracted from an explicit `Status:` line when one exists. Otherwise it is inferred from agreeing output wording and execution evidence, or failing that, adjudicated with fixed criteria (see Adjudication). This is needed because only the optimized config prescribes `PASSED/FAILED/BLOCKED`.
  - The no-findings check accepts both "No actionable findings." and phrasings such as "No issues were identified".
  - Ordering checks use the position of each finding in the output, which works for both "grouped by severity" (baseline) and "ordered by severity" (optimized).
- The baseline is not penalized for listing more than five findings or echoing logs. The optimized config is not penalized for stopping at five findings, as long as the required findings are included.
- No config is assumed better. Results should be reported per case, not only in aggregate.

## Check types used in the cases

| Type | Meaning |
|---|---|
| `finding_reported` | Output references the defect's file at a line within `line_range`, and the finding block matches the defect's `keywords` regex. |
| `finding_severity_at_least` / `finding_severity_greater` | Normalized severity label in the finding block (critical > high > medium > low). |
| `finding_rank`, `finding_order`, `findings_before` | Ordering by position of each finding's first file reference. |
| `no_finding_with_severity_at_least` | No finding block carries a label at or above the level. |
| `output_matches`, `output_matches_all`, `output_not_matches` | Regex over the final output. |
| `status_is` | Extracted status equals the value (see fairness rules). |
| `counts_equal`, `counts_not_contradicted` | Reported test counts equal ground truth / no stated count disagrees with it. |
| `transcript_has_command`, `transcript_no_command` | Regex over Bash commands the subagent executed. |
| `fixture_unchanged`, `repo_clean`, `paths_absent` | Filesystem state after the run (manifest, `git status`, path existence). |
| `llm_judge` | Only for CR-04 (fallback) and CR-10/S3. The harness implements it as blinded manual adjudication with the case's rubric as fixed criteria for both configs (see Adjudication). |
| `any_of` | Passes if any nested check passes. |

Regex patterns are ECMAScript-compatible, apart from an optional leading inline-flag group such as `(?i)` or `(?is)`, which is converted to regex flags.

## Verbosity metrics (recorded separately, never pass/fail)

For every run, record the final output's characters, words and lines, the output tokens, the number of tool calls, and the wall-clock duration. For TR-07, also record `noise_lines`: echoed `[catalog] entry N debug trace` lines.

## Maintaining the dataset

After an intentional fixture change, regenerate the manifest and re-validate:

```bash
cd evals/fixtures && find . -type f ! -name MANIFEST.sha256 ! -name .DS_Store | sed 's|^\./||' | LC_ALL=C sort | xargs shasum -a 256 > MANIFEST.sha256 && cd ../.. && node evals/validate-dataset.mjs
```

Ground truth for test-runner fixtures was recorded with Node v22.23.2 and npm 10.9.8. TR-03 requires that `mocha` is not installed globally or in any `node_modules` above the workspace. TR-09's suite writes a `.last-test-run` file whenever it runs, which is how an unnecessary test run is detected.
