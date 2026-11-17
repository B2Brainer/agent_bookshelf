# Subagent Evaluation Dataset

This dataset checks whether the output-verbosity optimizations made to `code-reviewer` and `test-runner` preserved the quality of their results. It defines 20 cases and their fixtures. It does not include a grader or a harness yet.

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
├── results/                # Run outputs go here (empty)
└── validate-dataset.mjs    # Validates the dataset itself; does not grade agents
```

## Configurations under test

| Config | code-reviewer | test-runner |
|---|---|---|
| baseline | `evals/baseline/code-reviewer.md` | `evals/baseline/test-runner.md` |
| optimized | `.claude/agents/code-reviewer.md` | `.claude/agents/test-runner.md` |

The two configs differ only in their `Return:` section. Name, description, tools, responsibilities and constraints are identical.

**Baseline provenance.** Git does not have the baseline versions. The agents first appear in commit `7013d06` ("Homework-2"), already optimized. The baseline text was recovered from a Week 2 Claude Code session transcript, which records a `Read` of both files at 2026-11-10T16:35Z, about 3.5 hours before that commit. It is the best available record, but it is a snapshot rather than a versioned file.

The baseline copies live outside `.claude/agents/` so Claude Code does not register them as project agents. To run a baseline case, use a throwaway git worktree and copy `evals/baseline/<agent>.md` over `.claude/agents/<agent>.md` there. Never edit the main checkout's agent files.

## Keeping answers away from the agents

Case metadata (`evals/cases/`), this README, the baseline configs and the results must never be readable by the agent under evaluation. Both subagents can Read, Grep and Glob, and the test-runner can also use Bash. If a case ran inside this repository, the agent could open `evals/cases/*.json` and read the answers. So each run happens in an isolated workspace:

- The workspace is a new temp directory with a random, neutral name, outside this repository and outside any directory that has a `node_modules`.
- It contains a copy of only that case's `fixture.path`, copied to the workspace root, plus `.claude/agents/<agent>.md` for the configuration under test.
- If the hook settings are reproduced, it also gets `.claude/settings.json` and `.claude/hooks/block-git-commit.sh`. Both configurations must get the same settings.
- The agent's working directory is the workspace root. Every `input.prompt` and every path a check uses is relative to that root.
- Fixture directory names (`cr-01`, `tr-07`, …) are neutral IDs and never appear inside the workspace.
- Fixture contents carry no hints such as "fixture", "defect", "intentional" or case IDs. Comments that the scenario needs (specs, or deliberately misleading comments in CR-10) are part of the test. The validator checks for revealing terms.

## Running a case (protocol only; no harness yet)

1. `node evals/validate-dataset.mjs` must print `OK`.
2. Build a new isolated workspace for the case and configuration, as described above.
3. In the workspace, invoke the subagent with the case's `input.prompt`, verbatim. For example: `claude -p "Use the <agent> subagent with exactly this task: <prompt>" --output-format stream-json --verbose`. Use the same model, wrapper and settings for both configurations.
4. Save the subagent's final output and its transcript to `evals/results/<config>/<case-id>/` in this repository, outside the workspace.
5. Apply `success_criteria`, then the file's `global_checks`. `fixture_unchanged` compares the workspace with the fixture's entries in `MANIFEST.sha256`. A case passes only if every criterion passes.
6. Discard the workspace. Every run starts from a new copy, so fixtures never need restoring.

Run each case several times per config (for example 3–5) and report the pass rate, because agent output is nondeterministic.

## Fairness rules

- Both configs get identical prompts, fixtures, model and criteria.
- Correctness and verbosity are scored separately. No criterion depends on output length.
- Criteria accept the vocabulary of both configs:
  - Status is extracted from an explicit `Status:` line when one exists. Otherwise a fixed LLM-judge prompt classifies it, because only the optimized config prescribes `PASSED/FAILED/BLOCKED`.
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
| `llm_judge` | Only for CR-04 (fallback) and CR-10/S3. Use a fixed prompt and the same judge model for both configs. |
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
