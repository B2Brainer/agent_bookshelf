Session 74f82862-e9e6-4636-b85a-8789f56de2f1  (transcript.jsonl)
Measured total_cost_usd: $0.2747   duration: 0.9 min   turns: 5

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.0965 | 82.8% | claude-sonnet-5 | orchestrator | 4 | 86197 | 17842 | 788 |
| review | $0.1782 | 85.1% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-correctness, ticket-to-merge:review-verifier, ticket-to-merge:review-security | 22 | 172358 | 30140 | 6103 |
| **total** | **$0.2747** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.2747 | tokens from transcripts in/out/cacheRead/cacheWrite = 26/6891/258555/47982 vs modelUsage 26/6891/258555/47982

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.1541 | 2353 | 4 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0531 | 2381 | 4 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.0378 | 1293 | 3 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0297 | 864 | 2 |

Subagents: ticket-to-merge:review-correctness→review, ticket-to-merge:review-verifier→review, ticket-to-merge:review-security→review
