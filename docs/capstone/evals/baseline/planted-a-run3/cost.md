Session 35d219c1-9ebd-4dd6-b2ed-919e945dd24c  (transcript.jsonl)
Measured total_cost_usd: $0.3759   duration: 4.8 min   turns: 14

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.1916 | 97.6% | claude-sonnet-5 | orchestrator | 16 | 435844 | 10549 | 6218 |
| review | $0.1843 | 84.8% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-verifier, ticket-to-merge:review-correctness, ticket-to-merge:review-security | 20 | 185001 | 33023 | 5149 |
| **total** | **$0.3759** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.3759 | tokens from transcripts in/out/cacheRead/cacheWrite = 36/11367/620845/43572 vs modelUsage 36/11367/620845/43572

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.2698 | 7967 | 10 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0461 | 1622 | 4 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.0309 | 991 | 2 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0290 | 787 | 2 |

Subagents: ticket-to-merge:review-verifier→review, ticket-to-merge:review-correctness→review, ticket-to-merge:review-security→review
