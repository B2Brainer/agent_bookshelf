Session b5e19a11-d080-4f9f-92e6-2c5db07750a3  (transcript.jsonl)
Measured total_cost_usd: $0.4568   duration: 4.9 min   turns: 14

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.2359 | 94.2% | claude-sonnet-5 | orchestrator | 14 | 364292 | 22262 | 7399 |
| review | $0.2209 | 87.1% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-security, ticket-to-merge:review-correctness, ticket-to-merge:review-verifier | 24 | 263752 | 38946 | 5615 |
| **total** | **$0.4568** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.4568 | tokens from transcripts in/out/cacheRead/cacheWrite = 38/13014/628044/61208 vs modelUsage 38/13014/628044/61208

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.3273 | 8792 | 10 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0561 | 1852 | 5 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.0381 | 1538 | 2 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0353 | 832 | 2 |

Subagents: ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review, ticket-to-merge:review-verifier→review
