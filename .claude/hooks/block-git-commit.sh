
#!/usr/bin/env bash

# Guardrail: prevent unauthorized git commits.
# Claude Code PreToolUse hook.

set -euo pipefail

INPUT="$(cat)"

COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

# Block direct git commit commands, including git -C path commit.
if printf '%s' "$COMMAND" | grep -Eq '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit([[:space:]]|$)'; then
  echo "BLOCKED: git commit requires explicit user authorization." >&2
  exit 2
fi

exit 0
