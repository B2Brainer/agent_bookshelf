Session ca38e1c9-6a47-4d3a-8bfb-1ffa7fabaf60  (transcript.jsonl)
Measured total_cost_usd: $0.3870   duration: 1.5 min   turns: 5

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.0967 | 82.9% | claude-sonnet-5 | orchestrator | 4 | 86197 | 17799 | 822 |
| review | $0.2903 | 86.8% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-verifier, ticket-to-merge:review-security, ticket-to-merge:review-correctness | 42 | 335150 | 50768 | 9096 |
| **total** | **$0.3870** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.3870 | tokens from transcripts in/out/cacheRead/cacheWrite = 46/9918/421347/68567 vs modelUsage 46/9918/421347/68567

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.1451 | 2012 | 4 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.1375 | 5107 | 8 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0602 | 1689 | 7 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0441 | 1110 | 4 |

Subagents: ticket-to-merge:review-verifier→review, ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review
