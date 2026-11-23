Session cf0c4722-501d-4a6f-8858-dd4708505a84  (transcript.jsonl)
Measured total_cost_usd: $0.5956   duration: 1.2 min   turns: 1

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.2332 | 95.6% | claude-sonnet-5 | orchestrator | 18 | 475450 | 22080 | 4980 |
| review | $0.3623 | 87.4% | claude-sonnet-5, claude-haiku-4-5-20251001 | orchestrator, ticket-to-merge:review-verifier, ticket-to-merge:review-security, ticket-to-merge:review-correctness | 98 | 476239 | 68499 | 28700 |
| **total** | **$0.5956** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.3882 | tokens from transcripts in/out/cacheRead/cacheWrite = 32/7914/809392/39170 vs modelUsage 32/7914/809392/39170
- claude-haiku-4-5-20251001: costUSD $0.2074 | tokens from transcripts in/out/cacheRead/cacheWrite = 84/25766/142297/51409 vs modelUsage 84/25766/142297/51409

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.3601 | 6919 | 14 |
| ticket-to-merge:review-security | claude-haiku-4-5-20251001 | $0.1295 | 16627 | 6 |
| ticket-to-merge:review-correctness | claude-haiku-4-5-20251001 | $0.0779 | 9139 | 4 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0280 | 995 | 2 |

Subagents: ticket-to-merge:review-verifier→review, ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review
