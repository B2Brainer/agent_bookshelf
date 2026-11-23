---
name: review-pr
description: Review the current branch (or a given base..head range) with read-only specialist reviewers, verify every finding adversarially, and return JSON findings with file, line, severity, issue and evidence. Use to review a PR, a branch, or uncommitted changes.
argument-hint: "[base-ref] [-- pathspec...] (default base: merge-base with origin/main, main, origin/master or master)"
allowed-tools: Bash(git *), Bash(node *collect-diff.mjs*), Read, Grep, Glob, Agent
---

# /ticket-to-merge:review-pr

Audit a diff for real defects. Precision matters as much as recall: report only what you can prove.
You (the orchestrator) collect the diff; the reviewers are read-only subagents. Never edit files in this skill.

Arguments: `$ARGUMENTS`

## 1. Collect the change set (one command)

Run exactly one Bash command (arguments: optional base ref, optionally `--` and a pathspec):

`node "${CLAUDE_PLUGIN_ROOT}/scripts/collect-diff.mjs" $ARGUMENTS`

It resolves the base (given ref, else the first of `origin/main`, `main`, `origin/master`, `master`;
merge-base with HEAD), writes the full diff of committed + uncommitted + untracked changes (lock files and
`dist/` excluded) to `diffPath`, and prints JSON `{baseRef, base, head, diffPath, files, diffLines}`.
Do not run other git commands and do not Read the diff yourself; the reviewers read it.
If `files` is empty, output `{"base": "<base>", "head": "<head>", "findings": []}` with the note
"no changes to review" and stop. If the script is unavailable, fall back to `git merge-base`, `git diff` and
`git ls-files --others --exclude-standard` and write nothing.

Keep tests in scope (a wrong test is a defect), but do not report "missing tests".

## 2. Specialist review (parallel, read-only)

Dispatch both reviewers in ONE message so they run in parallel, in the foreground (do not set
`run_in_background`; wait for both results instead of polling or scheduling wakeups). Keep the brief short
and identical for both; do NOT paste the diff into the prompt:
"Review the change set base <base> → head <head> (working tree). Read the unified diff at <diffPath> first,
then Read the changed files as needed. Changed files: <files>. Spec, if any: <SPEC.md or README section path>.
Return only your JSON."

- `ticket-to-merge:review-correctness`: logic, contracts, edge cases, data integrity
- `ticket-to-merge:review-security`: injection, input validation, unsafe handling, data exposure

Each returns `{"findings":[{file, line, severity, issue, evidence}]}`. If a reviewer returns invalid JSON,
extract the findings it describes; do not re-run it.

## 3. Merge and verify

1. Merge both lists. Drop exact duplicates (same file, lines within 3, same root cause).
2. If the merged list is empty, skip verification.
3. Otherwise dispatch `ticket-to-merge:review-verifier` once, in the foreground, with the merged candidates
   (as JSON) and the same `diffPath` (not the diff text).
   Keep only its `confirmed` list. Do not re-add rejected findings.

## 4. Output

Print a one-paragraph summary (base..head, files reviewed, N confirmed, M rejected), then the final
result as a single fenced `json` block, exactly this shape, sorted by severity (high, medium, low):

```json
{
  "base": "<base sha>",
  "head": "<head sha>",
  "findings": [
    {"file": "src/routes/api.ts", "line": 42, "severity": "high", "issue": "...", "evidence": "..."}
  ]
}
```

`file` is repo-relative; `line` is the line number in the current (head / working-tree) version of the file.
No findings means `"findings": []`. Do not fix anything here; /ticket-to-merge:ship-ticket owns the fix loop.
