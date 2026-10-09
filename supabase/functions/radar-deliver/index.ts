import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function sendTelegramMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      disable_web_page_preview: false, // Defined by card type logic below
    }),
  })

  if (response.status === 429) {
    const data = await response.json()
    throw new Error(`Rate limited: retry after ${data.result.parameters.retry_after}s`)
  }
  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.statusText}`)
  }
}

function formatCard(analysis: any) {
  const emoji = { paper: "📄", model: "🤖", product: "🛠️", company: "🏢" }[analysis.category] || "📌"
  const header = `${emoji} *${analysis.title}*`
  const body = analysis.summary
  const link = `[Source](${analysis.url})`
  
  return `${header}\n\n${body}\n\n${link}`
}

async function processDelivery() {
  // 1. Find users needing delivery (Simplified: all non-paused)
  const { data: users, error: userError } = await supabase
    .from("radar_users")
    .select("*")
    .eq("is_paused", false)

  if (userError || !users) return

  for (const user of users) {
    // 2. Fetch ready analyses matching user prefs
    const { data: analyses, error: analysisError } = await supabase
      .from("radar_analyses")
      .select("*")
      .eq("language", user.language)
      .filter("region", "in", user.region === "both" ? '("global","China")' : `("${user.region}")`)
      .eq("is_delivered", false)
      .limit(user.daily_count)

    if (analysisError || !analyses || analyses.length === 0) continue

    try {
      const digestText = analyses.map(formatCard).join("\n\n---\n\n")
      await sendTelegramMessage(user.chat_id, digestText)

      // 3. Mark as delivered (Prevent repeats)
      await supabase
        .from("radar_analyses")
        .update({ is_delivered: true })
        .in("id", analyses.map(a => a.id))
    } catch (e) {
      console.error(`Delivery failed for ${user.chat_id}: ${e.message}`)
    }
  }
}

// This would be triggered by a Supabase Cron / Edge Function schedule
processDelivery().then(() => console.log("Delivery complete")).catch(console.error)
