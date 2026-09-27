/* Настройки сайта.
   chatProvider — как работает ИИ (ментор + распознавание еды по фото):
     'open'   — ИИ сайта (Pollinations) по ключу aiKey: без входа, окон и вкладок для посетителей;
     'auto'   — ключ есть → 'open', ключа нет → Puter (Puter просит номер телефона США — не используем);
     'server' — свой сервер worker/index.js на Cloudflare (тогда заполни chatEndpoint).
   aiKey    — ключ с enter.pollinations.ai, хранится в виде 'enc:<base64 перевёрнутой строки>'.
              Ключ ограничен дешёвыми текстовыми моделями и тратит только бесплатный лимит аккаунта.
   aiPrefer / aiVisionPrefer — какие модели брать по очереди (по названию, как в кабинете Pollinations).
              Сайт сам узнаёт у Pollinations точные id моделей (/v1/models) и подставляет их.
              Если первая модель недоступна или на неё кончился лимит — берётся следующая.
   aiModels / aiVisionModels — запасные id, если список моделей получить не удалось. */
window.WSPORT_CONFIG = {
  chatProvider: 'open',
  aiBase: 'https://gen.pollinations.ai/v1',
  aiKey: 'enc:bnJrcGwyYjlvamNNa1FaOVJxV1JjUlk2OXlIc0pvSExfa3M=',
  aiPrefer:       ['Gemini 3.8 Flash', 'GPT-5.4 Mini', 'DeepSeek V4.1 Flash', 'GPT-5.4 Nano'],
  aiVisionPrefer: ['Gemini 3.8 Flash', 'GPT-5.4 Mini', 'GPT-5.4 Nano'],
  aiModels:       ['gemini-3.8-flash', 'gpt-5.4-mini', 'deepseek-v4.1-flash', 'gpt-5.4-nano', 'gemini-fast', 'openai', 'openai-fast'],
  aiVisionModels: ['gemini-3.8-flash', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gemini-fast', 'openai'],
  chatEndpoint: ''
};

/* Запрос к OpenAI-совместимому API сайта с перебором моделей. */
window.siteAI = {
  broken: false,
  ready: function(){ const c = window.WSPORT_CONFIG || {}; return !this.broken && !!(this.key() && c.aiBase); },
  key: function(){
    const k = (window.WSPORT_CONFIG || {}).aiKey || '';
    if(k.indexOf('enc:') !== 0) return k;
    try { return atob(k.slice(4)).split('').reverse().join(''); } catch(e){ return ''; }
  },
  norm: function(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9.]+/g, ''); },
  _list: null,
  /* список моделей Pollinations (кэш в браузере на 12 часов) → [{id, names:[...]}] */
  catalog: async function(){
    if(this._list) return this._list;
    const CK = 'wsport-ai-models-v1';
    try { const c = JSON.parse(localStorage.getItem(CK)); if(c && c.at > Date.now() - 12 * 3600e3 && c.list && c.list.length) return (this._list = c.list); } catch(e){}
    const c = window.WSPORT_CONFIG || {};
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(function(){ if(ctrl) ctrl.abort(); }, 6000);
    try {
      const r = await fetch(c.aiBase.replace(/\/$/, '') + '/models', { headers:{ 'Authorization':'Bearer ' + this.key() }, signal:ctrl && ctrl.signal });
      if(!r.ok) throw new Error('models ' + r.status);
      const j = await r.json();
      const arr = Array.isArray(j) ? j : (j.data || j.models || []);
      const list = arr.map(function(m){
        if(typeof m === 'string') return { id:m, names:[m] };
        const id = m.id || m.name || m.model;
        const names = [m.id, m.name, m.model, m.description, m.display_name, m.displayName, m.title].concat(m.aliases || []).filter(Boolean).map(String);
        return id ? { id:String(id), names:names } : null;
      }).filter(Boolean);
      if(list.length){ try { localStorage.setItem(CK, JSON.stringify({ at:Date.now(), list:list })); } catch(e){} }
      return (this._list = list);
    } catch(e){ return (this._list = []); }
    finally { clearTimeout(t); }
  },
  /* порядок моделей: сначала найденные по названиям из aiPrefer, затем запасные id */
  models: async function(vision){
    const c = window.WSPORT_CONFIG || {};
    const prefer = (vision ? c.aiVisionPrefer : c.aiPrefer) || [];
    const fallback = (vision ? c.aiVisionModels : c.aiModels) || [];
    const self = this, list = await this.catalog(), out = [];
    prefer.forEach(function(p){
      const want = self.norm(p);
      // точное совпадение названия важнее частичного (чтобы «Flash» не путать с «Flash Lite»)
      let hit = list.find(function(m){ return m.names.some(function(n){ return self.norm(n) === want; }); });
      if(!hit) hit = list.find(function(m){ return m.names.some(function(n){ const x = self.norm(n); return x.indexOf(want) === 0 && !/lite|preview|search|vision/.test(x.slice(want.length)); }); });
      if(hit && out.indexOf(hit.id) < 0) out.push(hit.id);
    });
    fallback.forEach(function(id){ if(out.indexOf(id) < 0) out.push(id); });
    return out;
  },
  fetch: async function(body, opts){
    const c = window.WSPORT_CONFIG || {};
    const bad = this.bad || (this.bad = {});
    let list = (opts && opts.models) || await this.models(opts && opts.vision);
    const good = list.filter(function(m){ return !bad[m]; });
    if(good.length) list = good;                                  // модели, которые ключу не разрешены, больше не пробуем
    let res = null, lastErr = null;
    for(let i = 0; i < list.length; i++){
      const b = Object.assign({}, body); if(list[i]) b.model = list[i];
      try {
        res = await fetch(c.aiBase.replace(/\/$/, '') + '/chat/completions', {
          method:'POST', signal:opts && opts.signal,
          headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + this.key() },
          body:JSON.stringify(b)
        });
      } catch(e){ if(e && e.name === 'AbortError') throw e; lastErr = e; res = null; continue; }
      if(res.ok){ this.lastModel = list[i]; return res; }
      if([400, 403, 404, 422].indexOf(res.status) >= 0) bad[list[i]] = 1;
      if(res.status === 401) return res;                          // ключ не подходит — другие модели не помогут
      // модель не разрешена ключу / нет такой / лимит / сбой — пробуем следующую
      if([400, 402, 403, 404, 408, 422, 429, 500, 502, 503, 504].indexOf(res.status) < 0) return res;
    }
    if(res) return res;
    throw lastErr || new Error('network');
  }
};
