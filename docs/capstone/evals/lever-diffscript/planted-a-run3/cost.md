Session 2945635e-4603-4edd-85b8-013e908a3dbf  (transcript.jsonl)
Measured total_cost_usd: $0.3121   duration: 1.3 min   turns: 5

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.0971 | 82.9% | claude-sonnet-5 | orchestrator | 4 | 86191 | 17835 | 851 |
| review | $0.2150 | 86.8% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-security, ticket-to-merge:review-correctness, ticket-to-merge:review-verifier | 30 | 231450 | 35018 | 7398 |
| **total** | **$0.3121** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.3121 | tokens from transcripts in/out/cacheRead/cacheWrite = 34/8249/317641/52853 vs modelUsage 34/8249/317641/52853

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.1563 | 2634 | 4 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0701 | 2602 | 6 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0447 | 1527 | 4 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.0409 | 1486 | 3 |

Subagents: ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review, ticket-to-merge:review-verifier→review
