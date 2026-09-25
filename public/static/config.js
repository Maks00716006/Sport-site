/* Настройки сайта.
   chatProvider — как работает ИИ-ментор:
     'puter'  — бесплатно, без ключей и сервера (по умолчанию);
     'server' — свой сервер worker/index.js на Cloudflare с ключом Anthropic (тогда заполни chatEndpoint).
   chatEndpoint — адрес серверного роута, например 'https://forma-app.<поддомен>.workers.dev/api/chat'. */
window.WSPORT_CONFIG = {
  chatProvider: 'puter',
  chatEndpoint: ''
};
