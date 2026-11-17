const START_TEXT = `Привет! 👋

Это анонимный бот
«Подслушано @pingtablet»

Присылай сюда слушок 😇
Можно текст, фото, видео или голосовое.

Твой профиль никто не увидит, даже мы.

Публикация анонимно:
@pingtabletpeople`;

async function telegram(env, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || `Telegram API error: ${method}`);
  return data.result;
}

function adminIds(env) {
  const raw = env.ADMIN_IDS || env.ADMIN_ID || "";
  return [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
}

async function sendToAdmins(env, method, payload) {
  const admins = adminIds(env);
  if (!admins.length) throw new Error("ADMIN_IDS is empty");
  const results = await Promise.allSettled(admins.map((chat_id) =>
    telegram(env, method, { ...payload, chat_id })
  ));
  if (results.every((result) => result.status === "rejected")) {
    throw new Error("Could not deliver the message to any administrator");
  }
}

async function handleMessage(message, env) {
  if (!message?.chat?.id || message.from?.is_bot) return;

  if (message.text?.startsWith("/start")) {
    await telegram(env, "sendMessage", { chat_id: message.chat.id, text: START_TEXT });
    return;
  }

  if (message.text) {
    await sendToAdmins(env, "sendMessage", {
      text: `💬 Анонимное сообщение:\n\n${message.text}`,
    });
  } else if (message.photo?.length) {
    await sendToAdmins(env, "sendPhoto", {
      photo: message.photo[message.photo.length - 1].file_id,
      caption: message.caption || "📷 Анонимное фото",
    });
  } else if (message.video) {
    await sendToAdmins(env, "sendVideo", {
      video: message.video.file_id,
      caption: message.caption || "🎥 Анонимное видео",
    });
  } else if (message.voice) {
    await sendToAdmins(env, "sendVoice", { voice: message.voice.file_id });
  } else {
    await telegram(env, "sendMessage", {
      chat_id: message.chat.id,
      text: "Можно отправить только:\n\n• текст\n• фото\n• видео\n• голосовое сообщение",
    });
    return;
  }

  await telegram(env, "sendMessage", {
    chat_id: message.chat.id,
    text: "✅ Сообщение отправлено!",
  });
}

function setupPage() {
  return new Response(`<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Настройка Telegram-бота</title>
<style>
body{font:16px system-ui;max-width:480px;margin:50px auto;padding:0 20px;color:#222}
input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:12px;font:inherit}
button{cursor:pointer;background:#111;color:white;border:0}
</style>
<h2>Подключение Telegram webhook</h2>
<p>Введи пароль настройки, который ты добавил в Cloudflare как SETUP_PASSWORD.</p>
<form method="post" action="/setup">
<input name="password" type="password" placeholder="Пароль настройки" required>
<button type="submit">Подключить бота</button>
</form></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") return new Response("Anonymous Telegram bot is running.");
    if (url.pathname === "/setup" && request.method === "GET") return setupPage();

    if (url.pathname === "/setup" && request.method === "POST") {
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET || !env.SETUP_PASSWORD) {
        return new Response("Set BOT_TOKEN, WEBHOOK_SECRET and SETUP_PASSWORD in Worker settings first.", { status: 500 });
      }
      const form = await request.formData();
      if (form.get("password") !== env.SETUP_PASSWORD) return new Response("Неверный пароль.", { status: 403 });
      try {
        await telegram(env, "setWebhook", {
          url: `${url.origin}/telegram`,
          secret_token: env.WEBHOOK_SECRET,
          allowed_updates: ["message"],
          drop_pending_updates: false,
        });
        return new Response("Готово! Webhook подключён. Можно закрыть эту страницу и написать боту в Telegram.");
      } catch (error) {
        return new Response(`Не удалось подключить webhook: ${error.message}`, { status: 502 });
      }
    }

    if (url.pathname === "/telegram" && request.method === "POST") {
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET) return new Response("Worker is not configured", { status: 500 });
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const update = await request.json();
        if (update.message) await handleMessage(update.message, env);
        return new Response("ok");
      } catch (error) {
        console.error("Update processing failed:", error);
        return new Response("Update processing failed", { status: 500 });
      }
    }
    return new Response("Not found", { status: 404 });
  },
};
