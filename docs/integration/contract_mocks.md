# Telegram Interface & Delivery Pipeline Contract (Mocks)

This document defines the expected interfaces for Agent 3 to work against Agent 1 (Database/Collection) and Agent 2 (Analysis).

## 1. Database Schema (Expected from Agent 1)

### Table: `radar_users`
Stores user preferences.
- `chat_id` (BIGINT, PK): Telegram chat ID.
- `language` (TEXT): 'English' or 'Russian' (Default: 'English').
- `region` (TEXT): 'global', 'China', or 'both' (Default: 'both').
- `daily_count` (INT): Number of items per digest (Default: 3).
- `is_paused` (BOOLEAN): True if digests are disabled (Default: false).
- `timezone` (TEXT): IANA timezone (Default: 'Asia/Almaty').
- `digest_time` (TIME): Time of day for delivery (Default: '09:00').
- `created_at` (TIMESTAMPTZ).

### Table: `radar_updates`
Durable storage for incoming Telegram updates.
- `update_id` (BIGINT, PK): Telegram update ID.
- `payload` (JSONB): Full update object.
- `status` (TEXT): 'pending', 'processing', 'completed', 'failed'.
- `lease_expires_at` (TIMESTAMPTZ).
- `processed_at` (TIMESTAMPTZ).

### Table: `radar_analyses`
Ready-to-publish items (from Agent 2).
- `id` (UUID, PK).
- `category` (TEXT): 'paper', 'model', 'product', 'company'.
- `title` (TEXT).
- `summary` (TEXT): Max 500 chars.
- `url` (TEXT): Original paper or official source link.
- `region` (TEXT): 'global' or 'China'.
- `language` (TEXT).
- `published_at` (TIMESTAMPTZ).
- `is_delivered` (BOOLEAN, Default: false).

## 2. API / Logic Interfaces

### Collection & Analysis (Mocks)
Since Agent 3 works against mocks initially:
- `get_ready_analyses(user_prefs)`: Returns a list of `radar_analyses` matching user region/language that haven't been delivered to that user.
- `mark_as_delivered(analysis_id, chat_id)`: Records that a specific item was sent.

## 3. Telegram Bot API
- Bot Token: `BOT_TOKEN` (Secret).
- Webhook Secret: `X-Telegram-Bot-Api-Secret-Token` (Secret).
