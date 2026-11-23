Session 01b45808-26fb-46bb-8e72-649ae93594ee  (transcript.jsonl)
Measured total_cost_usd: $0.8302   duration: 8.6 min   turns: 15

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.3099 | 96.5% | claude-sonnet-5 | orchestrator | 24 | 653245 | 23707 | 8442 |
| review | $0.5202 | 77.3% | claude-sonnet-5, claude-haiku-4-5-20251001 | orchestrator, ticket-to-merge:review-security, ticket-to-merge:review-correctness, ticket-to-merge:review-verifier | 100 | 364895 | 107183 | 48600 |
| **total** | **$0.8302** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.5062 | tokens from transcripts in/out/cacheRead/cacheWrite = 40/13803/858110/57511 vs modelUsage 40/13803/858110/57511
- claude-haiku-4-5-20251001: costUSD $0.3240 | tokens from transcripts in/out/cacheRead/cacheWrite = 84/43239/160030/73379 vs modelUsage 84/43239/160030/73379

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.3947 | 9765 | 14 |
| ticket-to-merge:review-security | claude-haiku-4-5-20251001 | $0.1865 | 25390 | 5 |
| ticket-to-merge:review-correctness | claude-haiku-4-5-20251001 | $0.1375 | 17849 | 5 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.1114 | 4038 | 6 |

Subagents: ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review, ticket-to-merge:review-verifier→review
