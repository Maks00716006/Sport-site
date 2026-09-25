/* ================= WSPORT: сервер на Cloudflare Workers =================
   • Раздаёт сайт (папка public — через binding ASSETS).
   • POST /api/chat — защищённый прокси к Anthropic Messages API со стримингом.
     Ключ ANTHROPIC_API_KEY хранится в секретах Cloudflare и никогда не попадает в браузер.
     Системный промпт добавляется здесь, на сервере, — клиент не может его подменить.

   Переменные окружения (wrangler.jsonc → vars, секреты — `npx wrangler secret put`):
     ANTHROPIC_API_KEY   — секрет, обязательно
     ALLOWED_ORIGINS     — через запятую, с каких сайтов можно звать /api/chat
                           (по умолчанию GitHub Pages проекта и сам воркер)
     CHAT_MODEL          — модель Claude (по умолчанию из chatPrompt.mjs)
     CHAT_MAX_TOKENS     — лимит длины ответа (по умолчанию 1024) */
import { SYSTEM_PROMPT, CHAT_MODEL } from '../public/static/chatPrompt.mjs';

const DEFAULT_ORIGINS = ['https://maks00716006.github.io'];
const MAX_MESSAGES = 30;          // сколько последних сообщений диалога отправляем в модель
const MAX_CHARS = 4000;           // максимальная длина одного сообщения
const RATE = { windowMs: 60000, max: 20 };   // не больше 20 запросов в минуту с одного IP
const hits = new Map();           // простой лимит в памяти изолята (best effort)

function allowedOrigin(req, env){
  const origin = req.headers.get('Origin') || '';
  const list = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : DEFAULT_ORIGINS).map(function(s){ return s.trim(); }).filter(Boolean);
  const self = new URL(req.url).origin;
  if(!origin || origin === self || list.indexOf(origin) >= 0 || list.indexOf('*') >= 0) return origin || self;
  return null;
}
function cors(origin){
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(status, obj, origin){
  return new Response(JSON.stringify(obj), { status: status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, origin ? cors(origin) : {}) });
}
function rateLimited(ip){
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(function(t){ return now - t < RATE.windowMs; });
  arr.push(now); hits.set(ip, arr);
  if(hits.size > 5000) hits.clear();
  return arr.length > RATE.max;
}
/* чистим историю: только роли user/assistant, только текст, чередование, начинаем с user */
function sanitize(messages){
  if(!Array.isArray(messages)) return null;
  const out = [];
  messages.slice(-MAX_MESSAGES).forEach(function(m){
    if(!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return;
    const text = m.content.slice(0, MAX_CHARS).trim();
    if(!text) return;
    if(out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += '\n\n' + text;
    else out.push({ role: m.role, content: text });
  });
  while(out.length && out[0].role !== 'user') out.shift();
  if(!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

async function handleChat(req, env){
  const origin = allowedOrigin(req, env);
  if(!origin) return json(403, { error: 'origin_not_allowed' }, null);
  if(req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if(req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  if(!env.ANTHROPIC_API_KEY) return json(500, { error: 'server_not_configured', message: 'На сервере не задан ANTHROPIC_API_KEY' }, origin);

  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  if(rateLimited(ip)) return json(429, { error: 'rate_limited', message: 'Слишком много сообщений подряд — подожди минуту' }, origin);

  let body;
  try { body = await req.json(); } catch(e){ return json(400, { error: 'bad_json' }, origin); }
  const messages = sanitize(body && body.messages);
  if(!messages) return json(400, { error: 'bad_messages' }, origin);

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: env.CHAT_MODEL || CHAT_MODEL,
      max_tokens: +env.CHAT_MAX_TOKENS || 1024,
      system: SYSTEM_PROMPT,
      messages: messages,
      stream: true
    })
  });
  if(!upstream.ok || !upstream.body){
    let detail = '';
    try { detail = (await upstream.json()).error.message; } catch(e){}
    return json(upstream.status === 429 ? 429 : 502, { error: 'upstream_error', status: upstream.status, message: detail || 'Сервис ИИ временно недоступен' }, origin);
  }
  // стрим Anthropic (text/event-stream) отдаём клиенту как есть — текст печатается в реальном времени
  return new Response(upstream.body, {
    status: 200,
    headers: Object.assign({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' }, cors(origin))
  });
}

export default {
  async fetch(req, env){
    const url = new URL(req.url);
    if(url.pathname === '/api/chat'){
      try { return await handleChat(req, env); }
      catch(e){ return json(500, { error: 'internal', message: 'Ошибка сервера' }, allowedOrigin(req, env)); }
    }
    return env.ASSETS.fetch(req);
  }
};

export { sanitize, allowedOrigin };
