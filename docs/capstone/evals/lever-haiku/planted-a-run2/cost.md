Session 27d317ea-cf45-4d2c-ba8d-77435d7f2357  (transcript.jsonl)
Measured total_cost_usd: $0.5557   duration: 2.7 min   turns: 13

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.2580 | 95.9% | claude-sonnet-5 | orchestrator | 20 | 532369 | 22844 | 6010 |
| review | $0.2977 | 72.4% | claude-sonnet-5, claude-haiku-4-5-20251001 | orchestrator, ticket-to-merge:review-security, ticket-to-merge:review-verifier, ticket-to-merge:review-correctness | 60 | 177683 | 67809 | 24107 |
| **total** | **$0.5557** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.3914 | tokens from transcripts in/out/cacheRead/cacheWrite = 28/9564/669615/44697 vs modelUsage 28/9564/669615/44697
- claude-haiku-4-5-20251001: costUSD $0.1643 | tokens from transcripts in/out/cacheRead/cacheWrite = 52/20553/40437/45956 vs modelUsage 52/20553/40437/45956

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.3428 | 7741 | 12 |
| ticket-to-merge:review-correctness | claude-haiku-4-5-20251001 | $0.0952 | 12323 | 3 |
| ticket-to-merge:review-security | claude-haiku-4-5-20251001 | $0.0691 | 8230 | 3 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0486 | 1823 | 2 |

Subagents: ticket-to-merge:review-security→review, ticket-to-merge:review-verifier→review, ticket-to-merge:review-correctness→review
