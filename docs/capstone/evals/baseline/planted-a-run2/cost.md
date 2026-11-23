Session 9e006b8e-1c11-43c7-81dd-9e0d702f71f5  (transcript.jsonl)
Measured total_cost_usd: $0.4372   duration: 0.5 min   turns: 2

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.2330 | 93.2% | claude-sonnet-5 | orchestrator | 12 | 308909 | 22467 | 8133 |
| review | $0.2042 | 89.5% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-correctness, ticket-to-merge:review-security, ticket-to-merge:review-verifier | 16 | 284664 | 33525 | 4382 |
| **total** | **$0.4372** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.4372 | tokens from transcripts in/out/cacheRead/cacheWrite = 28/12515/593573/55992 vs modelUsage 28/12515/593573/55992

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.3573 | 10005 | 10 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0433 | 1272 | 2 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0195 | 744 | 1 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.0171 | 494 | 1 |

Subagents: ticket-to-merge:review-correctness→review, ticket-to-merge:review-security→review, ticket-to-merge:review-verifier→review
