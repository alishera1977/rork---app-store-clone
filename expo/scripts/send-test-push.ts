/**
 * Скрипт для отправки тестового push-уведомления.
 * Запуск: bun run expo/scripts/send-test-push.ts
 */

const SUPABASE_URL = "https://ihdnzusoorcimswnibuo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TorGh_nw0EbagKR5ZdF-Xg_3dad84nn";

const TITLE = "Промметпласт";
const BODY = "Тестовое уведомление работает 🚀";

async function main() {
  // 1. Загружаем Supabase клиент
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log("🔍 Fetching push tokens from Supabase…");

  const { data, error } = await supabase.from("push_tokens").select("token, platform, city");

  if (error) {
    console.error("❌ Supabase query failed:", error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("⚠️  No push tokens found in push_tokens table. Nothing to send.");
    process.exit(0);
  }

  const tokens = data.map((r: { token: string }) => r.token).filter(Boolean);
  console.log(`📋 Found ${data.length} token(s):`);
  data.forEach((r) => {
    console.log(`   - ${r.token.slice(0, 24)}… | platform=${r.platform} | city=${r.city}`);
  });

  if (tokens.length === 0) {
    console.log("⚠️  All tokens are empty. Nothing to send.");
    process.exit(0);
  }

  // 2. Отправляем через Expo Push API
  const messages = tokens.map((to: string) => ({
    to,
    title: TITLE,
    body: BODY,
    sound: "default" as const,
    priority: "high" as const,
    data: { type: "test" },
  }));

  console.log("\n📤 Sending push notification via Expo Push API…");
  console.log(`   Title: "${TITLE}"`);
  console.log(`   Body: "${BODY}"`);
  console.log(`   Recipients: ${messages.length}`);

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const json = await res.json();
  console.log("\n📬 Expo push response:", JSON.stringify(json, null, 2));

  if (json.data) {
    json.data.forEach((ticket: any, idx: number) => {
      if (ticket.status === "ok") {
        console.log(`   ✅ Token ${idx + 1}: OK (id: ${ticket.id})`);
      } else {
        console.log(`   ❌ Token ${idx + 1}: ERROR — ${ticket.message} (${ticket.details?.error})`);
      }
    });
  }

  if (json.errors) {
    console.log("   ⚠️  API errors:", json.errors);
  }
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
