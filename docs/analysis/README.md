# Analysis Module Documentation

## Overview
The Analysis module transforms raw collected items from `radar_items` into grounded, concise explanations suitable for Telegram delivery.

## Architecture
- **LLM Client**: Supports Qwen (OpenAI-compatible) and a Mock provider for local development.
- **Analysis Worker**: 
  - Uses `claim_queue_items` RPC for atomic job processing.
  - Implements bounded retries and timeouts.
  - Validates LLM output against strict character limits.
- **Ranking**: Pure function calculating scores based on topic relevance, freshness, and evidence level.

## Constraints
| Field | Max Chars | Rule |
|---|---|---|
| `short_title` | 80 | Plain language, no hype. |
| `summary` | 180 | Grounded in source. |
| `why_it_matters` | 120 | Explain significance concisely. |

## Ranking Formula
Score = (Matched Topics * 10) + Freshness (0-20) + Evidence Weight (2-15) + Category Weight (1-5).

## Testing
Run `deno run supabase/functions/radar-analyze/test_suite.ts` to verify core logic.
