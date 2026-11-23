Session 49bfc185-5207-4113-b2c8-03af7da3685c  (transcript.jsonl)
Measured total_cost_usd: $0.2921   duration: 0.9 min   turns: 5

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.0967 | 82.8% | claude-sonnet-5 | orchestrator | 4 | 86201 | 17848 | 805 |
| review | $0.1954 | 84.4% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-security, ticket-to-merge:review-correctness, ticket-to-merge:review-verifier | 24 | 190859 | 35285 | 6155 |
| **total** | **$0.2921** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.2921 | tokens from transcripts in/out/cacheRead/cacheWrite = 28/6960/277060/53133 vs modelUsage 28/6960/277060/53133

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.1571 | 2616 | 4 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0583 | 2116 | 5 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.0396 | 1230 | 3 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0370 | 998 | 2 |

Subagents: ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review, ticket-to-merge:review-verifier→review
