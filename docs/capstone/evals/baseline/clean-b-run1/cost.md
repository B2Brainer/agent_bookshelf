Session 83228cfa-78a9-4b6c-a9e6-e8b273ff32fb  (transcript.jsonl)
Measured total_cost_usd: $0.4558   duration: 2.2 min   turns: 14

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.2566 | 96.4% | claude-sonnet-5 | orchestrator | 22 | 589235 | 22261 | 4967 |
| review | $0.1992 | 82.2% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-security, ticket-to-merge:review-correctness, ticket-to-merge:review-verifier | 20 | 182117 | 39500 | 5363 |
| **total** | **$0.4558** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.4558 | tokens from transcripts in/out/cacheRead/cacheWrite = 42/10330/771352/61761 vs modelUsage 42/10330/771352/61761

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.3205 | 6128 | 13 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.0526 | 1690 | 4 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0446 | 1440 | 2 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0381 | 1072 | 2 |

Subagents: ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review, ticket-to-merge:review-verifier→review
