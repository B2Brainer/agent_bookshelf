Session 048124a5-1d26-4fb2-b659-34ffa2d73502  (build.jsonl)
Measured total_cost_usd: $1.8757   duration: 5.2 min   turns: 29

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $1.5246 | 91.7% | claude-opus-5, claude-sonnet-5 | orchestrator, ticket-to-merge:test-writer, ticket-to-merge:implementer | 78 | 1350774 | 121923 | 22081 |
| review | $0.3511 | 88.5% | claude-opus-5, claude-sonnet-5 | orchestrator, ticket-to-merge:review-correctness, ticket-to-merge:review-security | 22 | 320509 | 41827 | 5268 |
| **total** | **$1.8757** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-opus-5: costUSD $1.3029 | tokens from transcripts in/out/cacheRead/cacheWrite = 34/11271/1021089/51045 vs modelUsage 34/11271/1021089/51045
- claude-sonnet-5: costUSD $0.5727 | tokens from transcripts in/out/cacheRead/cacheWrite = 66/16078/650194/112705 vs modelUsage 66/16078/650194/112705

Subagents: ticket-to-merge:test-writer→build, ticket-to-merge:review-correctness→review, ticket-to-merge:implementer→build, ticket-to-merge:review-security→review, ticket-to-merge:test-writer→build
