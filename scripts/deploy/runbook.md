# Deployment Runbook: AI Research Radar Telegram Bot

## 1. Secrets Configuration
Set the following secrets in Supabase (Project Settings -> Edge Functions):
- `SUPABASE_URL`: Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `X_TELEGRAM_BOT_API_SECRET_TOKEN`: Custom secure token for webhook auth
- `TELEGRAM_BOT_TOKEN`: API token from @BotFather

## 2. Database Setup
Apply migrations (handled by Agent 1):
- Create `radar_users`
- Create `radar_updates`
- Create `radar_analyses`
- Enable RLS on all `radar_` tables.

## 3. Function Deployment
Deploy the Edge Functions using Supabase CLI:
```bash
supabase functions deploy radar-telegram
supabase functions deploy radar-deliver
```

## 4. Webhook Activation
Set the webhook with Telegram:
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -d "url=https://<PROJECT_ID>.supabase.co/functions/v1/radar-telegram" \
     -d "secret_token=<X_TELEGRAM_BOT_API_SECRET_TOKEN>"
```

## 5. Scheduling
Configure the Cron job to trigger `radar-deliver` daily at 09:00 Asia/Almaty.

## 6. Smoke Test
1. Send `/start` to the bot from an authorized test account.
2. Verify user is created in `radar_users`.
3. Test `/pause` and `/resume`.
4. Manually trigger `radar-deliver` and verify the card format and links.
