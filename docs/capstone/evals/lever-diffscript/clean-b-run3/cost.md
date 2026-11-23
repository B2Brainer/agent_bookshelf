Session 9af9b554-201d-480e-b7c6-dd01e3dbdd49  (transcript.jsonl)
Measured total_cost_usd: $0.2871   duration: 0.9 min   turns: 5

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.0965 | 82.9% | claude-sonnet-5 | orchestrator | 4 | 86187 | 17804 | 803 |
| review | $0.1906 | 84.1% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-security, ticket-to-merge:review-verifier, ticket-to-merge:review-correctness | 24 | 188391 | 35538 | 5828 |
| **total** | **$0.2871** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.2871 | tokens from transcripts in/out/cacheRead/cacheWrite = 28/6631/274578/53342 vs modelUsage 28/6631/274578/53342

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.1485 | 2248 | 4 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.0584 | 2561 | 4 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0419 | 1003 | 2 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0384 | 819 | 4 |

Subagents: ticket-to-merge:review-security→review, ticket-to-merge:review-verifier→review, ticket-to-merge:review-correctness→review
