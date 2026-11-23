Session 71d8fc21-ca89-4d6e-b663-2ae3bd990d57  (transcript.jsonl)
Measured total_cost_usd: $0.5083   duration: 0.7 min   turns: 2

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.2364 | 94.9% | claude-sonnet-5 | orchestrator | 16 | 420229 | 22621 | 6188 |
| review | $0.2719 | 91.1% | claude-sonnet-5, claude-haiku-4-5-20251001 | orchestrator, ticket-to-merge:review-correctness, ticket-to-merge:review-security, ticket-to-merge:review-verifier | 102 | 496717 | 48419 | 10129 |
| **total** | **$0.5083** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.4401 | tokens from transcripts in/out/cacheRead/cacheWrite = 34/10179/842311/47065 vs modelUsage 34/10179/842311/47065
- claude-haiku-4-5-20251001: costUSD $0.0682 | tokens from transcripts in/out/cacheRead/cacheWrite = 84/6138/74635/23975 vs modelUsage 84/6138/74635/23975

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.3908 | 8846 | 14 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0493 | 1333 | 3 |
| ticket-to-merge:review-security | claude-haiku-4-5-20251001 | $0.0363 | 3169 | 6 |
| ticket-to-merge:review-correctness | claude-haiku-4-5-20251001 | $0.0319 | 2969 | 4 |

Subagents: ticket-to-merge:review-correctness→review, ticket-to-merge:review-security→review, ticket-to-merge:review-verifier→review
