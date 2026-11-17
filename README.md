# Anonymous Telegram Bot — Cloudflare Workers

This version runs as a Cloudflare Worker using Telegram webhooks. It does not need an always-on server or a database.

## Deploy

1. In Cloudflare, go to Workers & Pages → Create application → GitHub.
2. Connect this repository and select the `main` branch.
3. Set the build command to empty and the deploy command to `npm run deploy`.
4. Add these Worker variables under Settings → Variables and Secrets:
   - `BOT_TOKEN` — Telegram bot token (Secret)
   - `ADMIN_IDS` — numeric Telegram administrator IDs separated by commas (Text)
   - `WEBHOOK_SECRET` — random 32+ character string using letters, numbers, underscore or hyphen (Secret)
   - `SETUP_PASSWORD` — a separate strong setup password (Secret)
5. Deploy the Worker.
6. Stop the old Render polling service, then open `https://YOUR-WORKER.workers.dev/setup` and enter `SETUP_PASSWORD`.
7. Test /start and send text, photo, video and voice messages.

Never commit bot tokens or passwords to GitHub. The old `ADMIN_ID` variable is also accepted as a fallback.
