/* Настройки сайта.
   chatEndpoint — адрес серверного роута ИИ-чата.
   • Если сайт открыт с Cloudflare (npx wrangler deploy) — оставь пустым: чат сам пойдёт на /api/chat.
   • Если сайт на GitHub Pages — впиши адрес воркера, например:
       'https://forma-app.<твой-поддомен>.workers.dev/api/chat' */
window.WSPORT_CONFIG = {
  chatEndpoint: ''
};
