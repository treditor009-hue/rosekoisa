# Rose A. Assistent — free AI setup

This app uses Groq-hosted `openai/gpt-oss-20b` for general conversation and `whisper-large-v3-turbo` for uploaded-audio transcription. Groq has a free tier with quotas and rate limits that can change.

## Enable AI
1. Create a Groq account and API key at https://console.groq.com/keys.
2. Open Vercel project **rose-a-assistent** → Settings → Environment Variables.
3. Add `GROQ_API_KEY` as an **Encrypted** variable for **Production**.
4. Redeploy Production so the server routes receive the secret.

Never put the key in `index.html`, the browser, or this repository. Routes: `/api/chat` and `/api/transcribe`. Browser live dictation works without the key; general AI chat and uploaded-audio transcription require it. Audio uploads are limited to 2.6 MB in this version.
