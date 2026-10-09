# Test Suite: Telegram Interface & Delivery

## 1. Webhook Authentication
- **Scenario:** Request sent without `X-Telegram-Bot-Api-Secret-Token` or with wrong token.
- **Expected:** 401 Unauthorized.

## 2. Duplicate Updates
- **Scenario:** Send the same `update_id` twice.
- **Expected:** Second request returns 200 OK (Ack) but does not trigger duplicate command logic.

## 3. Commands
- **Scenario:** Send `/start`, `/help`, `/pause`, `/resume`.
- **Expected:**
    - `/start`: New user created in `radar_users` with defaults.
    - `/pause`: `is_paused` set to `true`.
    - `/resume`: `is_paused` set to `false`.

## 4. Message Length & Links
- **Scenario:** Delivery of a research item.
- **Expected:**
    - Content length < 500 chars.
    - Includes mandatory source/paper link.

## 5. Delivery Retries & 429s
- **Scenario:** Telegram API returns 429 (Rate Limit).
- **Expected:** Error caught, logged, and delivery skipped for that user until next cycle (or retry logic applied).

## 6. User Pause
- **Scenario:** User sets `/pause`, then cron triggers.
- **Expected:** No message sent to the paused user.
