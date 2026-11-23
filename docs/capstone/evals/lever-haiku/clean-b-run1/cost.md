Session e23d7fb3-82fb-4de1-966c-cf5343542e7b  (transcript.jsonl)
Measured total_cost_usd: $0.6552   duration: 4.5 min   turns: 12

| Stage | Cost (USD) | Cache hit | Models | Agents | Input | Cache read | Cache write | Output |
|---|---|---|---|---|---|---|---|---|
| build | $0.2454 | 95.5% | claude-sonnet-5 | orchestrator | 18 | 480202 | 22554 | 5911 |
| review | $0.4098 | 78.0% | claude-sonnet-5, claude-haiku-4-5-20251001 | orchestrator, ticket-to-merge:review-verifier, ticket-to-merge:review-security, ticket-to-merge:review-correctness | 94 | 301695 | 85115 | 41377 |
| **total** | **$0.6552** | | | | | | | |

Cache hit = cache_read / (input + cache_read + cache_write) for the stage.

Reconciliation against the result event (modelUsage):
- claude-sonnet-5: costUSD $0.3640 | tokens from transcripts in/out/cacheRead/cacheWrite = 28/8927/625143/40779 vs modelUsage 28/8927/625143/40779
- claude-haiku-4-5-20251001: costUSD $0.2912 | tokens from transcripts in/out/cacheRead/cacheWrite = 84/38361/156754/66890 vs modelUsage 84/38361/156754/66890

Per agent: | agent | model | cost | output tokens | messages |
| orchestrator | claude-sonnet-5 | $0.3228 | 7424 | 11 |
| ticket-to-merge:review-correctness | claude-haiku-4-5-20251001 | $0.1659 | 22116 | 5 |
| ticket-to-merge:review-security | claude-haiku-4-5-20251001 | $0.1252 | 16245 | 5 |
| ticket-to-merge:review-verifier | claude-sonnet-5 | $0.0412 | 1503 | 3 |

Subagents: ticket-to-merge:review-verifier→review, ticket-to-merge:review-security→review, ticket-to-merge:review-correctness→review
