Session bdb48456-d45a-404d-ad1a-842d56062b3a  (transcript.jsonl)
Measured total_cost_usd: $0.3240   duration: 1.7 min   turns: 5

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.0970 | 82.9% | claude-sonnet-5 | orchestrator | 4 | 86185 | 17804 | 855 |
| review | $0.2270 | 87.8% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-verifier, ticket-to-merge:review-security, ticket-to-merge:review-correctness | 34 | 258580 | 35949 | 7979 |
| **total** | **$0.3240** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.3240 | tokens from transcripts in/out/cacheRead/cacheWrite = 38/8834/344765/53753 vs modelUsage 38/8834/344765/53753

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.1495 | 2393 | 4 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.1145 | 4973 | 9 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0309 | 1073 | 3 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0291 | 395 | 3 |

Subagents: ticket-to-merge:review-verifier→review, ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review
