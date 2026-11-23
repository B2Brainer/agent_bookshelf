#!/usr/bin/env bash
# Run /ticket-to-merge:review-pr once on a planted-bug (or clean) scenario, fully isolated.
#   usage: ticket-to-merge/evals/run-eval.sh <case> <out-dir> [--reviewer-model M] [--orchestrator-model M] [--oracle]
# - workspace: fresh detached git worktree of `main` in $TMPDIR (random name), scenario overlay applied
#   as uncommitted changes (review-pr reviews committed + uncommitted + untracked changes vs the merge-base)
# - plugin: a copy of ticket-to-merge WITHOUT evals/ (answer key and fixtures never reachable)
# - --reviewer-model: rewrites `model:` of review-correctness/review-security in the COPY only (cost lever)
# - --oracle: instead of reviewing, runs oracle.test.ts in the workspace to prove the ground truth
set -euo pipefail

CASE="$1"; OUT="$2"; shift 2
REVIEWER_MODEL=""; ORCH_MODEL="sonnet"; ORACLE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --reviewer-model) REVIEWER_MODEL="$2"; shift 2;;
    --orchestrator-model) ORCH_MODEL="$2"; shift 2;;
    --oracle) ORACLE=1; shift;;
    *) echo "unknown arg $1" >&2; exit 1;;
  esac
done

REPO="$(git rev-parse --show-toplevel)"
EVALS="$REPO/ticket-to-merge/evals"
[ -d "$EVALS/cases/$CASE/overlay" ] || { echo "no such case: $CASE" >&2; exit 1; }
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/ws-XXXXXX")"
WS="$TMP/repo"; PL="$TMP/plugin/ticket-to-merge"
cleanup() { git -C "$REPO" worktree remove --force "$WS" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

git -C "$REPO" worktree add --detach --quiet "$WS" main
cp -R "$EVALS/cases/$CASE/overlay/." "$WS/"

if [ "$ORACLE" = 1 ]; then
  ln -s "$REPO/node_modules" "$WS/node_modules"
  mkdir -p "$WS/tests/oracle" && cp "$EVALS/oracle.test.ts" "$WS/tests/oracle/"
  (cd "$WS" && npx vitest run tests/oracle --reporter verbose 2>&1) | sed "s#$TMP#<ws>#g" > "$OUT/oracle-$CASE.txt" || true
  grep -E "✓|×|FAIL|Tests " "$OUT/oracle-$CASE.txt" || true
  exit 0
fi

mkdir -p "$TMP/plugin"
rsync -a --exclude evals "$REPO/ticket-to-merge/" "$PL/"
if [ -n "$REVIEWER_MODEL" ]; then
  for a in review-correctness review-security; do
    sed -i '' "s/^model: .*/model: $REVIEWER_MODEL/" "$PL/agents/$a.md"
  done
fi
grep -H "^model:" "$PL"/agents/review-*.md > "$OUT/models.txt"
(cd "$WS" && git status --short) > "$OUT/workspace-status.txt"

cd "$WS"
claude -p "/ticket-to-merge:review-pr" \
  --plugin-dir "$PL" --model "$ORCH_MODEL" \
  --allowedTools "Bash(git *)" "Bash(node *)" Read Grep Glob Agent Skill \
  --output-format stream-json --verbose --max-budget-usd 5 \
  > "$OUT/transcript.jsonl" 2> "$OUT/stderr.log" || echo "claude exited $?" >> "$OUT/stderr.log"

node "$EVALS/extract-findings.mjs" "$OUT/transcript.jsonl" > "$OUT/findings.json"
echo "findings: $(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT/findings.json','utf8')).findings.length)")  cost: $(tail -1 "$OUT/transcript.jsonl" | jq .total_cost_usd)"
