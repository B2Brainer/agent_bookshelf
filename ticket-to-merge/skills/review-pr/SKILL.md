---
name: review-pr
description: Review the current branch (or a given base..head range) with read-only specialist reviewers, verify every finding adversarially, and return JSON findings with file, line, severity, issue and evidence. Use to review a PR, a branch, or uncommitted changes.
argument-hint: "[base-ref] [-- pathspec...] (default base: merge-base with origin/main, main, origin/master or master)"
allowed-tools: Bash(git *), Read, Grep, Glob, Agent
---

# /ticket-to-merge:review-pr

Audit a diff for real defects. Precision matters as much as recall: report only what you can prove.
You (the orchestrator) collect the diff; the reviewers are read-only subagents. Never edit files in this skill.

Arguments: `$ARGUMENTS`

## 1. Resolve the diff

Run these with Bash (read-only git only):

0. Arguments: an optional base ref, optionally followed by `--` and a pathspec that limits the review to
   those paths (used by /ticket-to-merge:ship-ticket to exclude pre-existing changes). Append the pathspec to
   every git command below and keep only untracked files that match it.
1. Base ref: if the arguments name a ref, use it. Otherwise use the first that exists of
   `origin/main`, `main`, `origin/master`, `master` (`git rev-parse --verify --quiet <ref>`).
2. `BASE=$(git merge-base <base-ref> HEAD)`. If `BASE` equals `HEAD` and the base ref is a different
   commit, the branch is behind the base: use `BASE=<base-ref>` instead.
3. Collect the change set: committed + uncommitted changes against `BASE`:
   - `git diff --stat $BASE` and `git diff --unified=5 $BASE -- . ':(exclude)package-lock.json'`
   - untracked files: `git ls-files --others --exclude-standard` (treat each as a fully added file).
4. If there are no changes, output `{"base": "<sha>", "head": "<sha>", "findings": []}` with the note
   "no changes to review" and stop.

Exclude from review: lock files, generated/build output (`dist/`), binary files, and vendored code.
Keep tests in scope (a wrong test is a defect), but do not report "missing tests".

## 2. Specialist review (parallel, read-only)

Dispatch both reviewers in ONE message so they run in parallel, in the foreground (do not set
`run_in_background`; wait for both results instead of polling or scheduling wakeups). Give each the same brief:
the base and head SHAs, the list of changed files, the full diff text (and the list of untracked files,
which they should Read in full), plus any spec in the repo that defines the intended behaviour
(e.g. `SPEC.md`, the README section for the feature) if one exists.

- `ticket-to-merge:review-correctness`: logic, contracts, edge cases, data integrity
- `ticket-to-merge:review-security`: injection, input validation, unsafe handling, data exposure

Each returns `{"findings":[{file, line, severity, issue, evidence}]}`. If a reviewer returns invalid JSON,
extract the findings it describes; do not re-run it.

## 3. Merge and verify

1. Merge both lists. Drop exact duplicates (same file, lines within 3, same root cause).
2. If the merged list is empty, skip verification.
3. Otherwise dispatch `ticket-to-merge:review-verifier` once, in the foreground, with the merged candidates and the same diff.
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
