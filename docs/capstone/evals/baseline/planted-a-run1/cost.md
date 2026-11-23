Session 87fe2070-49f2-4f78-9888-64d395598f2c  (transcript.jsonl)
Measured total_cost_usd: $0.4977   duration: 2.7 min   turns: 13

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.2481 | 95.9% | claude-sonnet-5 | orchestrator | 20 | 532724 | 22908 | 4987 |
| review | $0.2496 | 86.5% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-security, ticket-to-merge:review-correctness, ticket-to-merge:review-verifier | 16 | 223034 | 34848 | 9857 |
| **total** | **$0.4977** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.4977 | tokens from transcripts in/out/cacheRead/cacheWrite = 36/14844/755758/57756 vs modelUsage 36/14844/755758/57756

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.4079 | 11953 | 13 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0466 | 1467 | 3 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.0217 | 700 | 1 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0215 | 724 | 1 |

Subagents: ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review, ticket-to-merge:review-verifier→review
