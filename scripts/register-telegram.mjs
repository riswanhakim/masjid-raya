const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, NEXTAUTH_URL } = process.env;
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !NEXTAUTH_URL?.startsWith("https://")) {
  throw new Error("Isi TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, dan NEXTAUTH_URL HTTPS di environment server.");
}
const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: new URL("/api/telegram", NEXTAUTH_URL).href, secret_token: TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message"], max_connections: 1 }),
});
const result = await response.json();
if (!response.ok || !result.ok) throw new Error("Pendaftaran webhook gagal. Periksa konfigurasi bot dan HTTPS.");
console.log("Webhook Telegram terdaftar.");
