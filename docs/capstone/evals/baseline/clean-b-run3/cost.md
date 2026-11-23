Session c20fefb3-0402-4a2f-918e-ed4e3b6b920e  (transcript.jsonl)
Measured total_cost_usd: $0.4710   duration: 0.4 min   turns: 2

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.2267 | 94.2% | claude-sonnet-5 | orchestrator | 14 | 364459 | 22245 | 6478 |
| review | $0.2443 | 90.1% | claude-sonnet-5 | orchestrator, ticket-to-merge:review-verifier, ticket-to-merge:review-security, ticket-to-merge:review-correctness | 30 | 356408 | 39113 | 5953 |
| **total** | **$0.4710** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.4710 | tokens from transcripts in/out/cacheRead/cacheWrite = 44/12431/720867/61358 vs modelUsage 44/12431/720867/61358

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.3360 | 8065 | 11 |
| ticket-to-merge:review-correctness | claude-sonnet-5 | $0.0622 | 2060 | 6 |
| ticket-to-merge:review-security | claude-sonnet-5 | $0.0421 | 1634 | 3 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0307 | 672 | 2 |

Subagents: ticket-to-merge:review-verifier→review, ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review
