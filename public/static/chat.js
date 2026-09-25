/* ================= ИИ-МЕНТОР (чат на Claude) =================
   Режимы подключения:
     • server — через свой защищённый роут /api/chat (worker/index.js): ключ на сервере, промпт на сервере.
       Адрес берётся из static/config.js (chatEndpoint) или /api/chat, если сайт открыт с Cloudflare.
     • key    — для личного использования: свой ключ Anthropic, хранится только в этом браузере,
       запрос идёт напрямую в Anthropic.
   Ответ приходит потоком (SSE) и печатается в реальном времени.
   История диалога хранится в браузере отдельно для каждого аккаунта (последние 60 сообщений),
   в модель уходят последние 30 — чтобы ИИ помнил контекст. */
const Chat = (function(){
  const CFG_KEY = 'wsport-chat-cfg';
  const HIST_MAX = 60, SEND_MAX = 30;
  let history = [], streaming = null, open = false, promptMod = null;

  const IC = {
    send:'<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    stop:'<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>'
  };
  const SUGGEST = [
    'Выгорел, ничего не хочется — что делать?',
    'Составь тренировку на 3 дня в неделю',
    'Как перестать срываться на сладкое?',
    'Помоги разобраться с кодом на Python'
  ];

  /* ---------- настройки ---------- */
  function cfg(){
    let c = {};
    try { c = JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch(e){}
    return { mode:c.mode || 'server', endpoint:c.endpoint || '', apiKey:c.apiKey || '', model:c.model || '' };
  }
  function saveCfg(c){ try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch(e){} }
  function endpoint(){
    const c = cfg();
    if(c.endpoint) return c.endpoint;
    const site = (window.WSPORT_CONFIG && window.WSPORT_CONFIG.chatEndpoint) || '';
    if(site) return site;
    // на GitHub Pages сервера нет — нужен адрес воркера в config.js
    return /github\.io$/.test(location.hostname) || location.protocol === 'file:' ? '' : '/api/chat';
  }
  function ready(){ const c = cfg(); return c.mode === 'key' ? !!c.apiKey : !!endpoint(); }

  /* ---------- история ---------- */
  function histKey(){ return 'wsport-chat-' + (typeof KEY !== 'undefined' && KEY ? KEY : 'guest'); }
  function loadHist(){ try { history = JSON.parse(localStorage.getItem(histKey())) || []; } catch(e){ history = []; } }
  function saveHist(){ try { localStorage.setItem(histKey(), JSON.stringify(history.slice(-HIST_MAX))); } catch(e){} }

  /* ---------- безопасный мини-markdown ---------- */
  function md(text){
    const e = function(s){ return s.replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); };
    const parts = String(text).split(/```/);
    return parts.map(function(part, i){
      if(i % 2 === 1){ const code = part.replace(/^[\w+-]*\n/, ''); return '<pre><code>' + e(code.replace(/\n$/, '')) + '</code></pre>'; }
      let h = e(part)
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, '$1<i>$2</i>');
      // списки и абзацы
      const lines = h.split('\n'), out = []; let list = null;
      lines.forEach(function(l){
        const ul = /^\s*[-•*]\s+(.*)/.exec(l), ol = /^\s*(\d+)[.)]\s+(.*)/.exec(l);
        if(ul || ol){
          const t = ul ? 'ul' : 'ol';
          if(list !== t){ if(list) out.push('</' + list + '>'); out.push('<' + t + '>'); list = t; }
          out.push('<li>' + (ul ? ul[1] : ol[2]) + '</li>');
        } else {
          if(list){ out.push('</' + list + '>'); list = null; }
          if(/^#{1,4}\s+/.test(l)) out.push('<p><b>' + l.replace(/^#{1,4}\s+/, '') + '</b></p>');
          else if(l.trim()) out.push('<p>' + l + '</p>');
        }
      });
      if(list) out.push('</' + list + '>');
      return out.join('');
    }).join('');
  }

  /* ---------- отрисовка ---------- */
  const log = function(){ return $('chatLog'); };
  function nearBottom(){ const l = log(); return l.scrollHeight - l.scrollTop - l.clientHeight < 80; }
  function toBottom(force){ const l = log(); if(force || nearBottom()) l.scrollTop = l.scrollHeight; }
  function bubble(role, text){
    const el = document.createElement('div');
    el.className = 'msg ' + (role === 'user' ? 'me' : 'ai');
    el.innerHTML = role === 'user' ? '<div class="bub">' + md(text) + '</div>' : '<div class="bub">' + (text ? md(text) : '<span class="typing"><i></i><i></i><i></i></span>') + '</div>';
    log().appendChild(el);
    return el;
  }
  function renderAll(){
    const l = log(); l.innerHTML = '';
    if(!history.length){
      l.innerHTML = '<div class="chat-hello"><span class="chat-spark">' + SPARK + '</span><b>Привет' + (typeof ME !== 'undefined' && ME && ME.name ? ', ' + esc(ME.name) : '') + '!</b>' +
        '<p>Я твой ИИ-ментор. Можно выговориться, разобрать загон или выгорание, спросить про тренировки и питание — или про код, музыку, учёбу. Пиши как другу.</p></div>';
    }
    history.forEach(function(m){ bubble(m.role, m.content); });
    $('chatSugg').style.display = history.length ? 'none' : '';
    if(!ready()) showSetup();
    toBottom(true);
  }
  function note(html, kind){
    const el = document.createElement('div');
    el.className = 'chat-note' + (kind ? ' ' + kind : '');
    el.innerHTML = html;
    log().appendChild(el); toBottom(true);
    return el;
  }
  function showSetup(){
    note('Чат ещё не подключён к ИИ. Владельцу сайта: задеплой сервер <code>worker/index.js</code> на Cloudflare и впиши его адрес в <code>static/config.js</code> — или открой ⚙︎ и подключи свой ключ Anthropic для личного пользования.', 'warn');
  }

  /* ---------- отправка и стриминг ---------- */
  async function getPrompt(){
    if(!promptMod) promptMod = await import(new URL('static/chatPrompt.mjs', document.baseURI).href);
    return promptMod;
  }
  async function request(messages, signal){
    const c = cfg();
    if(c.mode === 'key'){
      const p = await getPrompt();
      return fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', signal:signal,
        headers:{ 'content-type':'application/json', 'x-api-key':c.apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body:JSON.stringify({ model:c.model || p.CHAT_MODEL, max_tokens:1024, system:p.SYSTEM_PROMPT, messages:messages, stream:true })
      });
    }
    return fetch(endpoint(), { method:'POST', signal:signal, headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ messages:messages }) });
  }
  function errText(status, body){
    const m = body && (body.message || (body.error && body.error.message));
    if(status === 401) return 'Ключ API не подошёл — проверь его в настройках ⚙︎.';
    if(status === 404) return 'Сервер чата не найден. Задеплой worker/index.js на Cloudflare и укажи его адрес в static/config.js (или в ⚙︎).';
    if(status === 403) return 'Этому сайту нельзя обращаться к серверу чата (проверь ALLOWED_ORIGINS в wrangler.jsonc).';
    if(status === 429) return m || 'Слишком много сообщений подряд — подожди минуту.';
    if(status === 529 || status === 503) return 'ИИ сейчас перегружен — попробуй через минуту.';
    return m || ('Сервис ответил ошибкой ' + status + '.');
  }
  async function send(text){
    text = String(text || '').trim();
    if(!text || streaming) return;
    if(!ready()){ showSetup(); openCfg(true); return; }
    $('chatSugg').style.display = 'none';
    const hello = log().querySelector('.chat-hello'); if(hello) hello.remove();
    history.push({ role:'user', content:text }); saveHist();
    bubble('user', text); toBottom(true);
    $('chatQ').value = ''; autosize();
    const el = bubble('assistant', ''), bub = el.querySelector('.bub');
    toBottom(true);
    const ctrl = new AbortController();
    streaming = ctrl; setSendState(true);
    let acc = '', raf = 0;
    const paint = function(){ raf = 0; const stick = nearBottom(); bub.innerHTML = md(acc) + '<span class="caret"></span>'; if(stick) toBottom(true); };
    try {
      const msgs = history.slice(-SEND_MAX).map(function(m){ return { role:m.role, content:m.content }; });
      const res = await request(msgs, ctrl.signal);
      if(!res.ok || !res.body){
        let b = null; try { b = await res.json(); } catch(e){}
        throw { ui:errText(res.status, b) };
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for(;;){
        const r = await reader.read();
        if(r.done) break;
        buf += dec.decode(r.value, { stream:true });
        let i;
        while((i = buf.indexOf('\n\n')) >= 0){
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const dataLine = chunk.split('\n').filter(function(l){ return l.indexOf('data:') === 0; }).map(function(l){ return l.slice(5).trim(); }).join('');
          if(!dataLine) continue;
          let ev; try { ev = JSON.parse(dataLine); } catch(e){ continue; }
          if(ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta'){
            acc += ev.delta.text;
            if(!raf) raf = requestAnimationFrame(paint);
          } else if(ev.type === 'error'){
            throw { ui:(ev.error && ev.error.type === 'overloaded_error') ? 'ИИ сейчас перегружен — попробуй через минуту.' : ((ev.error && ev.error.message) || 'Ошибка во время ответа.') };
          }
        }
      }
      if(raf) cancelAnimationFrame(raf);
      if(!acc.trim()) throw { ui:'Пустой ответ — попробуй ещё раз.' };
      bub.innerHTML = md(acc);
      history.push({ role:'assistant', content:acc }); saveHist();
    } catch(e){
      if(raf) cancelAnimationFrame(raf);
      if(e && e.name === 'AbortError'){
        if(acc.trim()){ bub.innerHTML = md(acc); history.push({ role:'assistant', content:acc + ' …' }); saveHist(); }
        else { el.remove(); history.pop(); saveHist(); }
      } else {
        if(acc.trim()){ bub.innerHTML = md(acc); history.push({ role:'assistant', content:acc }); saveHist(); }
        else { el.remove(); }
        note((e && e.ui) ? esc(e.ui) : 'Нет связи с сервером чата. Проверь интернет и попробуй ещё раз.', 'err');
      }
    } finally {
      streaming = null; setSendState(false); toBottom();
    }
  }
  function setSendState(on){
    const b = $('chatSend');
    b.innerHTML = on ? IC.stop : IC.send;
    b.setAttribute('aria-label', on ? 'Остановить ответ' : 'Отправить');
    b.classList.toggle('stop', on);
    $('chatStatus').textContent = on ? 'печатает…' : (ready() ? 'онлайн' : 'не подключён');
  }

  /* ---------- окно ---------- */
  function autosize(){ const t = $('chatQ'); t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }
  function syncViewport(){
    // iOS: окно чата по высоте видимой области, чтобы клавиатура не закрывала поле ввода
    const vv = window.visualViewport;
    if(vv) document.documentElement.style.setProperty('--vvh', vv.height + 'px');
  }
  function show(){
    if(open) return;
    open = true;
    if(typeof closeProfile === 'function') closeProfile();
    loadHist(); renderAll(); setSendState(false);
    $('chat').classList.add('on'); $('chat').setAttribute('aria-hidden', 'false');
    $('chatFab').classList.add('hide');
    if(window.innerWidth <= 700) document.documentElement.classList.add('noscroll');
    syncViewport();
    setTimeout(function(){ if(window.innerWidth > 700) $('chatQ').focus(); }, 120);
  }
  function hide(){
    if(!open) return;
    open = false;
    $('chat').classList.remove('on'); $('chat').setAttribute('aria-hidden', 'true');
    $('chatFab').classList.remove('hide');
    document.documentElement.classList.remove('noscroll');
    $('chatQ').blur();
  }
  function openCfg(force){
    const box = $('chatCfg'), c = cfg();
    const on = force === true ? true : box.hidden;
    box.hidden = !on;
    if(!on) return;
    segSet('chatMode', c.mode);
    $('chatEp').value = c.endpoint || ''; $('chatEp').placeholder = endpoint() || 'https://…workers.dev/api/chat';
    $('chatKey').value = c.apiKey || ''; $('chatModel').value = c.model || '';
    $('chatEpRow').style.display = c.mode === 'key' ? 'none' : '';
    $('chatKeyRow').style.display = c.mode === 'key' ? '' : 'none';
  }

  function init(){
    $('chatFab').onclick = show;
    $('chatClose').onclick = hide;
    $('chatGear').onclick = function(){ openCfg(); };
    $('chatClear').onclick = function(){
      if(streaming) streaming.abort();
      if(history.length && !confirm('Очистить переписку с ментором?')) return;
      history = []; saveHist(); renderAll();
    };
    $('chatForm').addEventListener('submit', function(e){ e.preventDefault(); if(streaming) streaming.abort(); else send($('chatQ').value); });
    $('chatQ').addEventListener('input', autosize);
    $('chatQ').addEventListener('keydown', function(e){
      // Enter — отправить, Shift+Enter — новая строка (на телефоне Enter = новая строка)
      if(e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(hover:hover)').matches){ e.preventDefault(); $('chatForm').requestSubmit(); }
    });
    $('chatSugg').innerHTML = SUGGEST.map(function(s){ return '<button type="button" class="chip">' + s + '</button>'; }).join('');
    $('chatSugg').addEventListener('click', function(e){ const b = e.target.closest('.chip'); if(b) send(b.textContent); });
    segInit('chatMode', function(v){ $('chatEpRow').style.display = v === 'key' ? 'none' : ''; $('chatKeyRow').style.display = v === 'key' ? '' : 'none'; });
    $('chatCfgSave').onclick = function(){
      saveCfg({ mode:segGet('chatMode'), endpoint:$('chatEp').value.trim(), apiKey:$('chatKey').value.trim(), model:$('chatModel').value.trim() });
      $('chatCfg').hidden = true; renderAll(); setSendState(false);
      toast(ready() ? 'Чат подключён' : 'Настройки сохранены');
    };
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && open && !document.querySelector('.modal.on')) hide(); });
    if(window.visualViewport){ window.visualViewport.addEventListener('resize', syncViewport); window.visualViewport.addEventListener('scroll', syncViewport); }
  }

  return { init:init, show:show, hide:hide, isOpen:function(){ return open; }, send:send, md:md, cfg:cfg, endpoint:endpoint,
           reset:function(){ hide(); history = []; } };
})();
const SPARK = '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
