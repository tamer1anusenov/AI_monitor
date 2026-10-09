import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const TELEGRAM_SECRET_TOKEN = Deno.env.get("X_TELEGRAM_BOT_API_SECRET_TOKEN")!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function handleCommand(chatId: number, text: string) {
  const user = await supabase
    .from("radar_users")
    .select("*")
    .eq("chat_id", chatId)
    .single()

  if (!user.data) {
    // Auto-register user with defaults
    await supabase.from("radar_users").insert({
      chat_id: chatId,
      language: "English",
      region: "both",
      daily_count: 3,
      timezone: "Asia/Almaty",
      digest_time: "09:00",
    })
  }

  switch (text) {
    case "/start":
      return "Welcome to AI Research Radar! Use /help to see commands."
    case "/help":
      return "Available commands:\n/start - Start bot\n/topics - Current topics\n/region - Change region (global, China, both)\n/language - Change language (English, Russian)\n/latest - Get latest updates\n/pause - Pause daily digest\n/resume - Resume daily digest"
    case "/pause":
      await supabase.from("radar_users").update({ is_paused: true }).eq("chat_id", chatId)
      return "Daily digests paused."
    case "/resume":
      await supabase.from("radar_users").update({ is_paused: false }).eq("chat_id", chatId)
      return "Daily digests resumed."
    case "/latest":
      return "Fetching latest research... (Mock: No new items for your region)."
    default:
      return "Unknown command. Type /help for assistance."
  }
}

serve(async (req) => {
  const secretToken = req.headers.get("X-Telegram-Bot-Api-Secret-Token")
  if (secretToken !== TELEGRAM_SECRET_TOKEN) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const update = await req.json()
    const updateId = update.update_id

    // 1. Durable Persistence & Deduplication
    const { error: insertError } = await supabase
      .from("radar_updates")
      .insert({
        update_id: updateId,
        payload: update,
        status: "pending",
      })

    if (insertError && insertError.code !== "23505") { // 23505 is unique_violation
      return new Response("Database Error", { status: 500 })
    }
    if (insertError && insertError.code === "23505") {
      return new Response("Duplicate update", { status: 200 }) // Ack duplicates
    }

    // 2. Process Update (Asynchronously for speed, but here handled sequentially for simplicity in mock)
    const message = update.message
    if (message && message.text) {
      const chatId = message.chat.id
      const text = message.text
      const responseText = await handleCommand(chatId, text)

      // Mock: Send message back to Telegram
      console.log(`Sending to ${chatId}: ${responseText}`)
      // In production: fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { ... })
    }

    await supabase
      .from("radar_updates")
      .update({ status: "completed", processed_at: new Date().toISOString() })
      .eq("update_id", updateId)

    return new Response("OK", { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response("Internal Error", { status: 500 })
  }
})
