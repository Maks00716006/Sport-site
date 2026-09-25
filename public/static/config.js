/* Настройки сайта.
   chatProvider — как работает ИИ (ментор + распознавание еды по фото):
     'auto'   — если ниже вписан aiKey → ИИ сайта (Pollinations): без входа, без окон и вкладок;
                если ключа нет → запасной бесплатный Puter (нужен разовый вход через окно);
     'open'   — только ИИ сайта (aiBase + aiKey);
     'puter'  — только Puter;
     'server' — свой сервер worker/index.js на Cloudflare с ключом Anthropic (тогда заполни chatEndpoint).
   aiKey    — публичный ключ приложения (pk_…) с enter.pollinations.ai. Он специально сделан для
              сайтов: виден в коде, но тратит только бесплатный дневной лимит и ограничен по IP.
   aiModels — модели по очереди: если первая недоступна или лимит на неё кончился — берётся следующая.
   aiVisionModels — модели для распознавания еды по фото (должны понимать картинки). */
window.WSPORT_CONFIG = {
  chatProvider: 'auto',
  aiBase: 'https://gen.pollinations.ai/v1',
  aiKey: '',
  aiModels: ['openai', 'openai-fast'],
  aiVisionModels: ['openai', 'openai-fast'],
  chatEndpoint: ''
};

/* Запрос к OpenAI-совместимому API сайта с перебором моделей.
   body — тело chat/completions без model. Возвращает Response (для stream) последней попытки. */
window.siteAI = {
  ready: function(){ const c = window.WSPORT_CONFIG || {}; return !!(c.aiKey && c.aiBase); },
  fetch: async function(body, opts){
    const c = window.WSPORT_CONFIG || {};
    const models = (opts && opts.models) || c.aiModels || [];
    const list = models.length ? models : [undefined];
    let res = null, lastErr = null;
    for(let i = 0; i < list.length; i++){
      const b = Object.assign({}, body); if(list[i]) b.model = list[i];
      try {
        res = await fetch(c.aiBase.replace(/\/$/, '') + '/chat/completions', {
          method:'POST', signal:opts && opts.signal,
          headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + c.aiKey },
          body:JSON.stringify(b)
        });
      } catch(e){ if(e && e.name === 'AbortError') throw e; lastErr = e; res = null; continue; }
      // модель недоступна / лимит на неё / сбой — пробуем следующую
      if(res.ok || [400, 402, 403, 404, 408, 422, 429, 500, 502, 503, 504].indexOf(res.status) < 0) return res;
    }
    if(res) return res;
    throw lastErr || new Error('network');
  }
};
