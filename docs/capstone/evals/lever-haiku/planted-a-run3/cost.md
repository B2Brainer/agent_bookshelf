Session 027210c6-eaec-40d0-a945-13da692b9c32  (transcript.jsonl)
Measured total_cost_usd: $0.5814   duration: 0.7 min   turns: 2

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.2353 | 95.9% | claude-sonnet-5 | orchestrator | 20 | 532250 | 22817 | 3750 |
| review | $0.3461 | 85.9% | claude-sonnet-5, claude-haiku-4-5-20251001 | orchestrator, ticket-to-merge:review-verifier, ticket-to-merge:review-correctness, ticket-to-merge:review-security | 82 | 404292 | 66482 | 21371 |
| **total** | **$0.5814** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.4478 | tokens from transcripts in/out/cacheRead/cacheWrite = 34/10350/867930/47031 vs modelUsage 34/10350/867930/47031
- claude-haiku-4-5-20251001: costUSD $0.1336 | tokens from transcripts in/out/cacheRead/cacheWrite = 68/14771/68612/42268 vs modelUsage 68/14771/68612/42268

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.3999 | 8689 | 15 |
| ticket-to-merge:review-security | claude-haiku-4-5-20251001 | $0.0711 | 8637 | 4 |
| ticket-to-merge:review-correctness | claude-haiku-4-5-20251001 | $0.0625 | 6134 | 4 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0478 | 1661 | 2 |

Subagents: ticket-to-merge:review-verifier→review, ticket-to-merge:review-correctness→review, ticket-to-merge:review-security→review
