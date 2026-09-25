
/* ================= storage & auth ================= */
const LSU = 'forma-users-v2', LSS = 'forma-session-v2';
const $ = function(id){ return document.getElementById(id); };
const esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };

function readUsers(){ try { return JSON.parse(localStorage.getItem(LSU)) || {}; } catch(e){ return {}; } }
function writeUsers(u){ try { localStorage.setItem(LSU, JSON.stringify(u)); } catch(e){} }
let USERS = readUsers();
const ALL_RECIPES = RECIPES.concat(typeof SHAKES !== 'undefined' ? SHAKES : []);
function findR(id){ return ALL_RECIPES.find(function(x){ return x.id === id; }); }
let KEY = null;   // current login key
let ME = null;    // { name, pass, profile }

function save(){ if(!KEY) return; USERS[KEY] = ME; writeUsers(USERS); }
function today(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function toast(t){
  const el = $('toast'); el.textContent = t;
  // при открытом окне на телефоне тост уходит наверх, чтобы не закрывать кнопки внизу окна
  el.classList.toggle('top', (!!document.querySelector('.modal.on') || (typeof Chat !== 'undefined' && Chat.isOpen())) && window.innerWidth <= 700);
  el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(function(){ el.classList.remove('on'); }, 2200);
}
/* мгновенный отклик кнопки: блокируем от двойного нажатия и показываем спиннер */
function busy(btn, on){ if(!btn) return; btn.classList.toggle('busy', on); btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); }
/* тяжёлую работу запускаем после того, как браузер успел отрисовать спиннер */
function afterPaint(fn){ requestAnimationFrame(function(){ setTimeout(fn, 0); }); }

/* ---------- сессия и «Запомнить меня» ----------
   Аккаунты хранятся в этом браузере (сервера у сайта нет). При входе создаётся случайный
   токен сессии: с «Запомнить меня» — в localStorage на 30 дней (продлевается при каждом заходе),
   без — в sessionStorage (до закрытия вкладки). Пароли хранятся как SHA-256 с солью. */
const SESSION_DAYS = 30;
function randHex(n){
  const a = new Uint8Array(n);
  if(window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for(let i = 0; i < n; i++) a[i] = Math.random() * 256 | 0;
  return Array.prototype.map.call(a, function(b){ return b.toString(16).padStart(2, '0'); }).join('');
}
function readSession(){
  const get = function(store, remember){
    try {
      const v = store.getItem(LSS); if(!v) return null;
      if(v.charAt(0) !== '{') return { k:v, legacy:true, remember:true };   // старый формат: просто логин
      const o = JSON.parse(v); o.remember = remember; return o;
    } catch(e){ return null; }
  };
  return get(sessionStorage, false) || get(localStorage, true);
}
function writeSession(key, remember){
  const u = USERS[key], now = Date.now();
  const tok = randHex(16), exp = now + (remember ? SESSION_DAYS * 864e5 : 12 * 36e5);
  u.toks = (u.toks || []).filter(function(x){ return x.exp > now; }).slice(-4);
  u.toks.push({ t:tok, exp:exp });
  writeUsers(USERS);
  const data = JSON.stringify({ k:key, t:tok, exp:exp });
  try {
    (remember ? localStorage : sessionStorage).setItem(LSS, data);
    (remember ? sessionStorage : localStorage).removeItem(LSS);
  } catch(e){}
}
function clearSession(){
  const s = readSession();
  if(s && s.t && USERS[s.k] && USERS[s.k].toks){ USERS[s.k].toks = USERS[s.k].toks.filter(function(x){ return x.t !== s.t; }); writeUsers(USERS); }
  try { localStorage.removeItem(LSS); sessionStorage.removeItem(LSS); } catch(e){}
}
function validSession(){
  const s = readSession(); if(!s) return null;
  const u = USERS[s.k]; if(!u) return null;
  if(s.legacy) return { k:s.k, remember:true };
  const tk = (u.toks || []).find(function(x){ return x.t === s.t; });
  if(!tk || tk.exp < Date.now()) return null;
  return { k:s.k, remember:s.remember };
}
async function hashPass(pass, salt){
  if(!(window.crypto && crypto.subtle)) return null;   // не https — хеширование недоступно
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pass));
  return Array.prototype.map.call(new Uint8Array(buf), function(b){ return b.toString(16).padStart(2, '0'); }).join('');
}
async function setPass(u, pass){
  u.salt = randHex(8);
  const h = await hashPass(pass, u.salt);
  if(h){ u.ph = h; delete u.pass; } else { u.pass = pass; }
}
async function checkPass(u, pass){
  if(u.ph) return (await hashPass(pass, u.salt)) === u.ph;
  if(u.pass === pass){ await setPass(u, pass); return true; }   // старый аккаунт — заодно переводим пароль в хеш
  return false;
}

let authMode = 'login';
function setMode(m){
  authMode = m;
  const slide = $('authSlide');
  if(slide) slide.classList.toggle('signup-active', m === 'reg');
  $('authErr').textContent = '';
  $('authErrUp').textContent = '';
}
$('toSignup').onclick = function(){ setMode('reg'); };
$('toSignin').onclick = function(){ setMode('login'); };
$('toSignupM').onclick = function(e){ e.preventDefault(); setMode('reg'); setTimeout(function(){ if(window.innerWidth > 700) $('aNameUp').focus(); }, 60); };
$('toSigninM').onclick = function(e){ e.preventDefault(); setMode('login'); };

function pwToggleInit(btnId, inputId){
  const btn = $(btnId), input = $(inputId);
  if(!btn || !input) return;
  btn.onclick = function(){
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.querySelector('.eyeOpen').style.display = show ? 'none' : '';
    btn.querySelector('.eyeClosed').style.display = show ? '' : 'none';
    btn.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
  };
}
pwToggleInit('pwToggle', 'aPass');
pwToggleInit('pwToggleUp', 'aPassUp');

function segInit(id, cb){
  const box = $(id); if(!box) return;
  box.addEventListener('click', function(e){
    const b = e.target.closest('button'); if(!b) return;
    box.querySelectorAll('button').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on');
    if(cb) cb(b.dataset.v);
  });
}
function segGet(id){ const b = $(id).querySelector('button.on'); return b ? b.dataset.v : null; }
function segSet(id, v){
  $(id).querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.dataset.v === v); });
}
segInit('oSex'); segInit('oGoal'); segInit('rateMeal');

let pending = null, diaryReady = false;
$('authGo').onclick = async function(){
  const btn = this;
  if(btn.disabled) return;
  const mail = $('aMail').value.trim().toLowerCase();
  const pass = $('aPass').value;
  const err = $('authErr');
  err.textContent = '';
  if(!mail){ err.textContent = 'Введи почту или логин.'; return; }
  if(pass.length < 4){ err.textContent = 'Пароль от 4 символов.'; return; }
  USERS = readUsers();
  const u = USERS[mail];
  if(!u){ err.textContent = 'Такого аккаунта нет. Нажми «Создать аккаунт».'; return; }
  busy(btn, true);
  const ok = await checkPass(u, pass);
  if(!ok){ busy(btn, false); err.textContent = 'Неверный пароль.'; return; }
  writeUsers(USERS);
  afterPaint(function(){
    enter(mail, $('aRemember').checked);
    busy(btn, false);
    toast('Успешный вход!');
  });
};
$('aPass').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('authGo').click(); });
$('aMail').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('authGo').click(); });

$('authGoUp').onclick = function(){
  const mail = $('aMailUp').value.trim().toLowerCase();
  const pass = $('aPassUp').value;
  const name = $('aNameUp').value.trim();
  const err = $('authErrUp');
  err.textContent = '';
  if(!name){ err.textContent = 'Напиши, как тебя зовут.'; return; }
  if(!mail){ err.textContent = 'Введи почту или логин.'; return; }
  if(pass.length < 4){ err.textContent = 'Пароль от 4 символов.'; return; }
  USERS = readUsers();
  if(USERS[mail]){ err.textContent = 'Такой аккаунт уже есть — войди.'; return; }
  pending = { mail: mail, name: name, pass: pass };
  $('authStep1').style.display = 'none';
  $('authStep2').style.display = '';
};
$('aPassUp').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('authGoUp').click(); });
$('aMailUp').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('authGoUp').click(); });
$('aNameUp').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('authGoUp').click(); });

$('onbGo').onclick = async function(){
  const btn = this;
  const p = pending; if(!p || btn.disabled) return;
  busy(btn, true);
  const acc = { name: p.name };
  await setPass(acc, p.pass);
  USERS[p.mail] = Object.assign(acc, {
    profile: {
      sex: segGet('oSex'), age: +$('oAge').value || 20, height: +$('oHeight').value || 175,
      weight: +$('oWeight').value || 75, act: $('oAct').value, goal: segGet('oGoal'),
      weights: [{ date: today(), kg: +$('oWeight').value || 75 }], cooked: []
    }
  });
  writeUsers(USERS);
  afterPaint(function(){
    enter(p.mail, $('aRememberUp').checked);
    pending = null;
    busy(btn, false);
    toast('Успешная регистрация!');
  });
};

function enter(key, remember){
  KEY = key; ME = USERS[key];
  writeSession(key, remember !== false);
  if(!ME.profile.cooked) ME.profile.cooked = [];
  if(!ME.profile.weights) ME.profile.weights = [];
  const pr = ME.profile;
  if(!pr.favs) pr.favs = [];
  if(!pr.exSeen) pr.exSeen = [];
  if(!pr.visits) pr.visits = [];
  if(!pr.daysBuilt) pr.daysBuilt = 0;
  if(pr.visits.indexOf(today()) < 0){ pr.visits.push(today()); save(); }
  $('auth').style.display = 'none';
  $('app').style.display = '';
  const first = (ME.name || '?').trim().charAt(0).toUpperCase();
  $('ava').textContent = first; $('meName').textContent = ME.name; $('meMail').textContent = key;
  $('meNameM').textContent = ME.name;
  if(!diaryReady){ diaryInit(); Chat.init(); diaryReady = true; }
  dDate = today();
  fillNorm(); go('norm'); renderAll();
  achInit(); updateFab();
  $('qtToggle').checked = QuoteToasts.enabled();
  QuoteToasts.start();
  window.scrollTo(0, 0);
}
function leave(){
  clearSession();
  KEY = null; ME = null;
  QuoteToasts.stop();
  Chat.reset();
  closeProfile();
  $('app').style.display = 'none';
  $('auth').style.display = '';
  $('authStep1').style.display = ''; $('authStep2').style.display = 'none';
  $('aPass').value = ''; $('aMail').value = '';
  $('aPassUp').value = ''; $('aMailUp').value = ''; $('aNameUp').value = '';
  setMode('login');
  window.scrollTo(0, 0);
}
$('logout').onclick = leave;
$('logoutM').onclick = leave;

/* ================= navigation ================= */
const IC = {
  norm:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v9l6.4 6.4"/></svg>',
  recipes:'<svg viewBox="0 0 24 24"><path d="M4 4v7a4 4 0 0 0 8 0V4"/><path d="M8 4v16"/><path d="M18 4c-1.5 2-2 4-2 6s.7 3 2 3v7"/></svg>',
  day:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  weight:'<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/></svg>',
  gym:'<svg viewBox="0 0 24 24"><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/></svg>',
  history:'<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/></svg>',
  diary:'<svg viewBox="0 0 24 24"><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18M10 8h5M10 12h5"/></svg>'
};
const TABS = [
  { id:'norm', label:'Норма КБЖУ', short:'КБЖУ' },
  { id:'diary', label:'Дневник', short:'Дневник' },
  { id:'recipes', label:'Рецепты', short:'Рецепты' },
  { id:'gym', label:'Упражнения', short:'Зал' }
];
$('nav').innerHTML = TABS.map(function(t){
  return '<button type="button" class="navbtn" data-go="' + t.id + '">' + IC[t.id] + '<span>' + t.label + '</span></button>';
}).join('');
$('tabbar').innerHTML = TABS.map(function(t){
  return '<button type="button" data-go="' + t.id + '">' + IC[t.id] + '<span>' + t.short + '</span></button>';
}).join('');

/* Ленивая отрисовка: при входе сразу рисуется только открытая вкладка,
   остальные — когда браузер свободен (или в момент перехода на них). */
const dirtyTab = {};
function flushTab(id){
  if(!dirtyTab[id] || !ME) return;
  dirtyTab[id] = false;
  if(id === 'recipes'){ renderRecipes(); if($('viewShakes').style.display !== 'none') renderShakes(); }
  else if(id === 'gym') renderGym();
  else if(id === 'diary') renderDiary();
}
function go(id){
  document.querySelectorAll('.tab').forEach(function(s){ s.classList.toggle('on', s.id === 'tab-' + id); });
  document.querySelectorAll('[data-go]').forEach(function(b){ b.classList.toggle('on', b.dataset.go === id); });
  flushTab(id);
  if(id === 'diary') renderDiary();
  window.scrollTo(0, 0);
}

/* ---- подвкладки внутри "Рецепты": все рецепты / готовый день ---- */
segInit('rSub', function(v){
  $('viewAll').style.display = v === 'all' ? '' : 'none';
  $('viewDay').style.display = v === 'day' ? '' : 'none';
  $('viewShakes').style.display = v === 'shakes' ? '' : 'none';
  $('rSearchWrap').style.display = v === 'day' ? 'none' : '';
  if(v === 'shakes') renderShakes();
  if(v === 'day' && !$('daySlots').children.length) buildDay();
});
document.addEventListener('click', function(e){
  const b = e.target.closest('[data-go]');
  if(b) go(b.dataset.go);
  const c = e.target.closest('[data-close]');
  if(c) $(c.dataset.close).classList.remove('on');
});
document.querySelectorAll('.modal').forEach(function(m){
  m.addEventListener('click', function(e){ if(e.target === m) m.classList.remove('on'); });
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') document.querySelectorAll('.modal.on').forEach(function(m){ m.classList.remove('on'); });
});

/* ================= НОРМА КБЖУ ================= */
let norm = { kcal:2600, p:150, f:70, c:300 };
let normBarBuilt = false;

/* плавный счётчик числа */
function animateNum(el, from, to, suffix, ms){
  suffix = suffix || ''; ms = ms || 550;
  cancelAnimationFrame(el._raf);
  const t0 = performance.now();
  const ease = function(x){ return 1 - Math.pow(1 - x, 3); };
  function step(now){
    const p = Math.min(1, (now - t0) / ms);
    const v = Math.round(from + (to - from) * ease(p));
    el.textContent = v.toLocaleString('ru-RU') + suffix;
    if(p < 1) el._raf = requestAnimationFrame(step);
    else el.textContent = to.toLocaleString('ru-RU') + suffix;
  }
  el._raf = requestAnimationFrame(step);
}
function pulse(el){
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

let normMode = 'auto';
function clampNum(v, min, max){ return Math.min(max, Math.max(min, v)); }

function fillNorm(){
  const p = ME.profile;
  segSet('nSex', p.sex); segSet('nGoal', p.goal);
  $('nAge').value = p.age; $('nHeight').value = p.height;
  $('nWeight').value = p.weight; $('nAct').value = p.act;

  normMode = p.normMode === 'manual' ? 'manual' : 'auto';
  segSet('nMode', normMode);
  $('normAutoFields').style.display = normMode === 'manual' ? 'none' : '';
  $('normManualFields').style.display = normMode === 'manual' ? '' : 'none';
  if(p.manualNorm){
    $('mKcal').value = p.manualNorm.kcal;
    $('mProt').value = p.manualNorm.p;
    $('mFat').value = p.manualNorm.f;
  }
  recalcNorm();
}

/* считает автоматическую норму по антропометрии — научный расчёт */
function calcAutoNorm(){
  const sex = segGet('nSex'), goal = segGet('nGoal');
  const age = +$('nAge').value || 20, h = +$('nHeight').value || 175;
  const w = +$('nWeight').value || 75, act = parseFloat($('nAct').value) || 1.55;

  // Основной обмен — формула Миффлина-Сан Жеора (Mifflin-St Jeor, 1990),
  // признана самой точной для BMR в клинических рекомендациях (Academy of Nutrition and Dietetics).
  const bmr = 10*w + 6.25*h - 5*age + (sex === 'm' ? 5 : -161);
  const tdee = bmr * act;

  // Дефицит/избыток калорий — умеренный темп (ISSN Position Stand по body composition):
  // сушка -18% (безопасный дефицит без потери мышц), масса +12% (чистый набор, минимум жира).
  const factor = goal === 'cut' ? 0.82 : (goal === 'mass' ? 1.12 : 1);
  const kcal = Math.round(tdee * factor / 10) * 10;

  // Белок — г/кг веса по целям (ISSN Position Stand: Protein and Exercise, 2017):
  // сушка 2.2 г/кг (максимум сохранения мышц в дефиците), масса 2.0, поддержание 1.8 — всё в пределах 1.6–2.2 г/кг,
  // рекомендованных для тренирующихся.
  const p = Math.round(w * (goal === 'cut' ? 2.2 : goal === 'mass' ? 2.0 : 1.8));
  // Жиры — не ниже 0.6 г/кг (минимум для гормонального здоровья), обычно 0.8-0.9 г/кг.
  const f = Math.max(Math.round(w*0.6), Math.round(w * (goal === 'cut' ? 0.8 : 0.9)));
  // Углеводы — остаток калорий после белков и жиров (4 ккал/г белки и углеводы, 9 ккал/г жиры),
  // с защитным минимумом 50 г для работы мозга и ЦНС.
  const c = Math.max(50, Math.round((kcal - p*4 - f*9) / 4));

  const note = goal === 'cut' ? 'Сушка: минус 18% от расхода, белок высокий — мышцы остаются.'
    : goal === 'mass' ? 'Масса: плюс 12% к расходу — рост без лишнего жира.'
    : 'Форма: едим ровно столько, сколько тратим.';
  const bmrText = 'Основной обмен ' + Math.round(bmr) + ' ккал · расход с активностью ' + Math.round(tdee) + ' ккал';
  return { kcal:kcal, p:p, f:f, c:c, note:note, bmrText:bmrText };
}

/* проверяет ручной ввод КБЖУ и мягко подгоняет его к безопасным/адекватным границам,
   объясняя пользователю, что и почему было скорректировано */
function validateManualNorm(){
  const msgs = [];
  let kcal = Math.round(+$('mKcal').value);
  let p = Math.round(+$('mProt').value);
  let f = Math.round(+$('mFat').value);
  const w = (ME && ME.profile && ME.profile.weight) ? ME.profile.weight : null;

  if(!kcal || isNaN(kcal)) kcal = 2600;
  const kcalClamped = clampNum(kcal, 800, 6000);
  if(kcalClamped !== kcal) msgs.push('Калории скорректированы до диапазона 800–6000 ккал — это безопасные границы для взрослого человека.');
  kcal = kcalClamped;

  if(!p || isNaN(p)) p = 150;
  let pClamped = clampNum(p, 20, 400);
  if(pClamped !== p) msgs.push('Белки скорректированы до диапазона 20–400 г.');
  p = pClamped;

  if(!f || isNaN(f)) f = 70;
  let fClamped = clampNum(f, 20, 300);
  if(fClamped !== f) msgs.push('Жиры скорректированы до диапазона 20–300 г.');
  f = fClamped;

  // если известен вес — проверяем г/кг (ISSN: белок редко нужен выше 3 г/кг, жиры выше 2 г/кг избыточны)
  if(w){
    const pPerKg = p / w, fPerKg = f / w;
    if(pPerKg > 3.2){ p = Math.round(w * 3.0); msgs.push('Белка на твой вес указано слишком много (> 3.2 г/кг) — снизили до разумных 3 г/кг.'); }
    if(fPerKg > 2.5){ f = Math.round(w * 2.0); msgs.push('Жиров на твой вес указано слишком много — снизили до 2 г/кг.'); }
  }

  // белки+жиры не должны «съедать» больше 85% калорий — иначе на углеводы ничего не остаётся
  const pfKcal = p*4 + f*9;
  if(pfKcal > kcal * 0.85){
    const scale = (kcal * 0.85) / pfKcal;
    p = Math.max(20, Math.round(p * scale));
    f = Math.max(20, Math.round(f * scale));
    msgs.push('Белки и жиры уменьшены — при таких цифрах на углеводы не оставалось калорий.');
  }

  const c = Math.max(50, Math.round((kcal - p*4 - f*9) / 4));

  $('mKcal').value = kcal; $('mProt').value = p; $('mFat').value = f; $('mCarb').value = c;
  $('mErr').textContent = msgs.join(' ');
  return { kcal:kcal, p:p, f:f, c:c,
    note: msgs.length ? 'Свои цифры КБЖУ — часть значений подправлена, чтобы всё было адекватно.' : 'Свои цифры КБЖУ — заданы вручную.',
    bmrText: '' };
}

/* отображает итоговые числа независимо от источника (авторасчёт или ручной ввод) */
function renderNorm(r){
  const kcal = r.kcal, p = r.p, f = r.f, c = r.c;
  const prevKcal = norm.kcal, prevP = norm.p, prevF = norm.f, prevC = norm.c;
  norm = { kcal:kcal, p:p, f:f, c:c };

  animateNum($('outKcal'), prevKcal || kcal, kcal, '', 700);
  animateNum($('outP'), prevP || p, p, ' г', 700);
  animateNum($('outF'), prevF || f, f, ' г', 700);
  animateNum($('outC'), prevC || c, c, ' г', 700);
  pulse($('macroP')); pulse($('macroF')); pulse($('macroC'));
  $('outNote').textContent = r.note;
  $('outBmr').textContent = r.bmrText;

  const kp = p*4, kf = f*9, kc = c*4, tot = kp + kf + kc;
  if(!normBarBuilt){
    $('outBar').innerHTML =
      '<i style="width:0%;background:#C9F45C" data-k="p"></i>' +
      '<i style="width:0%;background:#5FD08C" data-k="f"></i>' +
      '<i style="width:0%;background:#4C8DFF" data-k="c"></i>';
    normBarBuilt = true;
    requestAnimationFrame(function(){ requestAnimationFrame(setBar); });
  } else {
    setBar();
  }
  function setBar(){
    $('outBar').querySelector('[data-k="p"]').style.width = (kp/tot*100) + '%';
    $('outBar').querySelector('[data-k="f"]').style.width = (kf/tot*100) + '%';
    $('outBar').querySelector('[data-k="c"]').style.width = (kc/tot*100) + '%';
  }
  $('mBreak').textContent = Math.round(kcal*0.25) + ' ккал';
  $('mLunch').textContent = Math.round(kcal*0.35) + ' ккал';
  $('mDin').textContent = Math.round(kcal*0.25) + ' ккал';
  $('mSnack').textContent = Math.round(kcal*0.15) + ' ккал';
}

function recalcNorm(){
  if(normMode === 'manual') renderNorm(validateManualNorm());
  else renderNorm(calcAutoNorm());
}

segInit('nSex', recalcNorm); segInit('nGoal', recalcNorm);
['nAge','nHeight','nWeight','nAct'].forEach(function(id){ $(id).addEventListener('input', recalcNorm); });
['mKcal','mProt','mFat'].forEach(function(id){ $(id).addEventListener('input', recalcNorm); });
segInit('nMode', function(v){
  normMode = v;
  $('normAutoFields').style.display = v === 'manual' ? 'none' : '';
  $('normManualFields').style.display = v === 'manual' ? '' : 'none';
  recalcNorm();
});
$('nSave').onclick = function(){
  ME.profile.sex = segGet('nSex'); ME.profile.goal = segGet('nGoal');
  ME.profile.age = +$('nAge').value; ME.profile.height = +$('nHeight').value;
  ME.profile.weight = +$('nWeight').value; ME.profile.act = $('nAct').value;
  ME.profile.normMode = normMode;
  if(normMode === 'manual'){
    const r = validateManualNorm();
    ME.profile.manualNorm = { kcal:r.kcal, p:r.p, f:r.f };
  }
  ME.profile.normSaved = true;
  save(); toast('Сохранил в профиль');
  achCheck();
};

/* ================= РЕЦЕПТЫ ================= */
let fMeal = 'all', fKind = 'all';
const KINDS = ['без огня','микроволновка','1 сковорода','духовка','кастрюля'];

$('fMeal').innerHTML = '<button type="button" class="chip on" data-meal="all">Все приёмы</button>' +
  ['breakfast','lunch','dinner','snack'].map(function(m){
    return '<button type="button" class="chip" data-meal="' + m + '">' + MEAL_LABEL[m] + '</button>';
  }).join('');
$('fKind').innerHTML = '<button type="button" class="chip on" data-kind="all">Любая готовка</button>' +
  KINDS.map(function(k){ return '<button type="button" class="chip" data-kind="' + k + '">' + k + '</button>'; }).join('');

function chipsInit(id, attr, set){
  $(id).addEventListener('click', function(e){
    const b = e.target.closest('.chip'); if(!b) return;
    $(id).querySelectorAll('.chip').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on'); set(b.dataset[attr]); renderRecipes();
  });
}
chipsInit('fMeal', 'meal', function(v){ fMeal = v; });
chipsInit('fKind', 'kind', function(v){ fKind = v; });

function avgStars(id){
  const list = ME.profile.cooked.filter(function(c){ return c.id === id; });
  if(!list.length) return 0;
  return list.reduce(function(s, c){ return s + c.stars; }, 0) / list.length;
}
function starsHtml(n){
  let out = '';
  for(let i = 1; i <= 5; i++) out += i <= Math.round(n) ? '★' : '<i>★</i>';
  return out;
}
const KIND_ICON = {
  'без огня':'❄️', 'микроволновка':'📻', '1 сковорода':'🍳', 'духовка':'🔥', 'кастрюля':'🥘'
};
/* миниатюра 640px для карточек (полное фото — только в окне рецепта/упражнения) */
function thumbSrc(src){ return src.replace(/(^|\/)static\/img\//, '$1static/img/t/'); }
function foodThumb(r){
  if(r.img) return '<img src="' + thumbSrc(r.img) + '" alt="' + esc(r.name) + '" loading="lazy" decoding="async" width="640" height="478" />';
  return '<div class="rph-ph"><span>' + (KIND_ICON[r.kind] || '🍽️') + '</span></div>';
}
const HEART = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
function isFav(id){ return ME && ME.profile.favs.indexOf(id) >= 0; }
function toggleFav(id, btn){
  const f = ME.profile.favs, i = f.indexOf(id);
  if(i >= 0) f.splice(i, 1); else f.push(id);
  save();
  document.querySelectorAll('.favbtn[data-id="' + id + '"]').forEach(function(b){ b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', i < 0); });
  toast(i < 0 ? 'Добавил в избранное' : 'Убрал из избранного');
  achCheck();
}
function favBtn(id){
  const on = isFav(id);
  return '<button type="button" class="favbtn' + (on ? ' on' : '') + '" data-id="' + id + '" aria-pressed="' + on + '" aria-label="В избранное" onclick="event.stopPropagation();toggleFav(' + id + ',this)">' + HEART + '</button>';
}
function recipeCard(r, i){
  const av = avgStars(r.id);
  return '<article class="rcard" style="--d:' + Math.min(i, 12) * 0.04 + 's">' +
    '<div class="rphoto">' + foodThumb(r) + '<span class="rtag">' + r.kcal + ' ккал</span>' + favBtn(r.id) + '</div>' +
    '<div class="rbody">' +
      '<div class="rtop"><h3>' + esc(r.name) + '</h3></div>' +
      '<div class="rmeta">' + r.time + ' мин · ' + r.kind + ' · ' + r.meal.map(function(m){ return MEAL_LABEL[m]; }).join(', ') + '</div>' +
      '<div class="kb">' + (r.shake ? '<span class="pw">Протеин ' + r.powder + ' г</span>' : '') +
        '<span>Б ' + r.p + '</span><span>Ж ' + r.f + '</span><span>У ' + r.c + '</span>' +
        (r.shake ? '' : '<span>' + r.ing.length + ' ингредиентов</span>') + '</div>' +
      '<div class="rfoot">' +
        '<button class="btn sm ghost" type="button" onclick="openRecipe(' + r.id + ')">Как готовить</button>' +
        '<button class="linkbtn" type="button" onclick="openRate(' + r.id + ')">Оценить</button>' +
        (av ? '<span class="stars" style="margin-left:auto">' + starsHtml(av) + '</span>' : '') +
      '</div>' +
    '</div></article>';
}
/* поиск: все слова запроса должны встретиться в названии, ингредиентах или типе блюда */
let rQuery = '', eQuery = '';
function matchQ(hay, q){
  const nq = normTxt(q); if(!nq) return true;
  const h = normTxt(hay);
  return nq.split(' ').every(function(w){ return h.indexOf(w) >= 0; });
}
function recipeHay(r){ return r.name + ' ' + r.ing.join(' ') + ' ' + r.kind + ' ' + r.meal.map(function(m){ return MEAL_LABEL[m]; }).join(' ') + (r.shake ? ' коктейль шейк протеин' : ''); }
function renderRecipes(){
  const list = RECIPES.filter(function(r){
    return (fMeal === 'all' || r.meal.indexOf(fMeal) >= 0) && (fKind === 'all' || r.kind === fKind) && matchQ(recipeHay(r), rQuery);
  });
  $('rQn').textContent = rQuery ? list.length + ' ' + plural(list.length, 'рецепт', 'рецепта', 'рецептов') : '';
  if(!list.length){
    $('recipeGrid').innerHTML = '<div class="empty">' + (rQuery ? 'По запросу «' + esc(rQuery) + '» ничего не нашлось' + (fMeal !== 'all' || fKind !== 'all' ? ' с этими фильтрами' : '') + '. <button class="linkbtn" type="button" onclick="clearRQ()">Сбросить поиск</button>' : 'Под такие фильтры ничего нет. Сбрось один из них.') + '</div>';
    return;
  }
  $('recipeGrid').innerHTML = list.map(recipeCard).join('');
}
function renderShakes(){
  const list = SHAKES.filter(function(r){ return matchQ(recipeHay(r), rQuery); });
  if($('viewShakes').style.display !== 'none') $('rQn').textContent = rQuery ? list.length + ' ' + plural(list.length, 'коктейль', 'коктейля', 'коктейлей') : '';
  $('shakeGrid').innerHTML = list.length ? list.map(recipeCard).join('')
    : '<div class="empty">Коктейля «' + esc(rQuery) + '» нет. <button class="linkbtn" type="button" onclick="clearRQ()">Сбросить поиск</button></div>';
}
function clearRQ(){ rQuery = ''; $('rQ').value = ''; renderRecipes(); renderShakes(); }
$('rQ').addEventListener('input', function(){
  rQuery = this.value.trim();
  if($('viewShakes').style.display !== 'none') renderShakes(); else renderRecipes();
});
function openRecipe(id){
  const r = findR(id);
  $('rmTitle').textContent = r.name;
  $('rmBody').innerHTML =
    (r.img ? '<img src="' + r.img + '" alt="' + esc(r.name) + '" />' : '') +
    '<div class="kb">' + (r.shake ? '<span class="pw">Протеин без вкуса ' + r.powder + ' г</span>' : '') + '<span>' + r.kcal + ' ккал</span><span>Б ' + r.p + '</span><span>Ж ' + r.f + '</span><span>У ' + r.c + '</span><span>' + r.time + ' мин</span></div>' +
    '<div><b style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">' + (r.shake ? 'Ингредиенты на 1 порцию' : 'Надо купить') + '</b>' +
      '<div class="kb" style="margin-top:8px">' + r.ing.map(function(i){ return '<span>' + esc(i) + '</span>'; }).join('') + '</div></div>' +
    '<div class="steps">' + r.steps.map(function(s, i){
        return '<div class="step"><i>' + (i+1) + '</i><span>' + esc(s) + '</span></div>';
      }).join('') + '</div>' +
    '<div class="hint"><b>Совет:</b> ' + esc(r.hint) + '</div>' +
    '<button class="btn wide" type="button" onclick="openRate(' + r.id + ')">Я это готовил — оценить</button>';
  $('recipeModal').classList.add('on');
  $('recipeModal').querySelector('.sheet').scrollTop = 0;
}

/* ---- оценка ---- */
let rateId = null, rateStars = 5;
function paintStars(){
  $('starPick').querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', +b.dataset.s <= rateStars); });
}
$('starPick').addEventListener('click', function(e){
  const b = e.target.closest('button'); if(!b) return;
  rateStars = +b.dataset.s; paintStars();
});
function openRate(id){
  rateId = id;
  const r = findR(id);
  const prev = ME.profile.cooked.filter(function(c){ return c.id === id; }).pop();
  rateStars = prev ? prev.stars : 5;
  const h = new Date().getHours();
  segSet('rateMeal', r.shake ? 'snack' : r.meal.indexOf(h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack') >= 0 ? (h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack') : r.meal[0]);
  $('rateTitle').textContent = r.name;
  $('rateDate').value = today();
  $('rateNote').value = '';
  paintStars();
  $('recipeModal').classList.remove('on');
  $('rateModal').classList.add('on');
}
$('rateSave').onclick = function(){
  const r = findR(rateId);
  ME.profile.cooked.push({ id:r.id, name:r.name, kcal:r.kcal, stars:rateStars, note:$('rateNote').value.trim(), date:$('rateDate').value || today() });
  if($('rateDiary').checked){
    const dd = dayData($('rateDate').value || today(), true);
    dd.meals[segGet('rateMeal')].push({ id:uid(), name:r.name, brand:'рецепт WSPORT', grams:null, portion:'1 порция', kcal:r.kcal, p:r.p, f:r.f, c:r.c, src:'recipe',
      base:{ id:'r' + r.id, name:r.name, kcal:r.kcal, p:r.p, f:r.f, c:r.c, per100:false, src:'recipe' } });
    renderDiary();
  }
  save(); $('rateModal').classList.remove('on');
  renderRecipes(); renderHistory(); if($('viewShakes').style.display !== 'none') renderShakes();
  toast('Добавил в историю');
  achCheck();
};

/* ================= ГОТОВЫЙ ДЕНЬ ================= */
/* Подбор меню под норму калорий.
   Для каждого приёма пищи берём случайный рецепт и размер порции (½…2 с шагом ¼),
   ближайший к доле нормы (завтрак 25%, обед 35%, ужин 25%, перекус 15%),
   затем подгоняем порции, чтобы сумма совпала с нормой. Из сотен вариантов
   выбираем тот, где итог ближе всего к норме, а белок — к норме белка. */
const DAY_PORTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
let lastDay = null;
function dayPool(meal){
  const list = RECIPES.filter(function(r){ return r.meal.indexOf(meal) >= 0; });
  return meal === 'snack' ? list.concat(SHAKES) : list;
}
function planDay(target, protein){
  let slots = [{ k:'breakfast', share:.25 }, { k:'lunch', share:.35 }, { k:'dinner', share:.25 }, { k:'snack', share:.15 }];
  // при очень высокой норме 4 приёмов даже по 2 порции может не хватить — добавляем второй перекус
  const maxOf = function(k){ return Math.max.apply(null, dayPool(k).map(function(r){ return r.kcal; })) * 2; };
  const cap = slots.reduce(function(s2, x){ return s2 + maxOf(x.k) * .8; }, 0);
  if(target > cap) slots = [{ k:'breakfast', share:.22 }, { k:'lunch', share:.3 }, { k:'dinner', share:.22 }, { k:'snack', share:.13 }, { k:'snack', share:.13, extra:true }];
  const nearest = function(kcal, want){
    return DAY_PORTIONS.reduce(function(b, m){ return Math.abs(kcal * m - want) < Math.abs(kcal * b - want) ? m : b; }, 1);
  };
  let best = null;
  for(let t = 0; t < 900; t++){
    const used = {}, plan = slots.map(function(sl){
      const pool = dayPool(sl.k).filter(function(r){ return !used[r.id]; });
      const r = pool[Math.floor(Math.random() * pool.length)];
      used[r.id] = 1;
      return { k:sl.k, extra:sl.extra, r:r, m:nearest(r.kcal, target * sl.share) };
    });
    // точная подгонка: по шагу ¼ порции уменьшаем разницу с нормой
    for(let it = 0; it < 12; it++){
      const tot = plan.reduce(function(a, x){ return a + x.r.kcal * x.m; }, 0);
      let bestMove = null, bestErr = Math.abs(tot - target);
      plan.forEach(function(x, i){
        [-.25, .25].forEach(function(d){
          const m = x.m + d; if(m < .5 || m > 2) return;
          const err = Math.abs(tot + x.r.kcal * d - target);
          if(err < bestErr - 1){ bestErr = err; bestMove = [i, m]; }
        });
      });
      if(!bestMove) break;
      plan[bestMove[0]].m = bestMove[1];
    }
    const kcal = plan.reduce(function(a, x){ return a + x.r.kcal * x.m; }, 0);
    const p = plan.reduce(function(a, x){ return a + x.r.p * x.m; }, 0);
    const score = Math.abs(kcal - target) / target * 100 + Math.max(0, protein - p) / protein * 25;
    if(!best || score < best.score) best = { plan:plan, score:score };
    if(Math.abs(kcal - target) <= target * .012 && p >= protein * .85 && t > 40) break;
  }
  return best.plan;
}
function portionLabel(m){
  return { 0.5:'½ порции', 0.75:'¾ порции', 1:'1 порция', 1.25:'1¼ порции', 1.5:'1½ порции', 1.75:'1¾ порции', 2:'2 порции' }[m] || (m + ' порции');
}
function buildDay(){
  const target = norm.kcal;
  const plan = planDay(target, norm.p);
  lastDay = plan;
  const sc = function(v, m){ return Math.round(v * m); };
  $('daySlots').innerHTML = plan.map(function(x, idx){
    const r = x.r;
    return '<div class="slot" style="--d:' + (idx * 0.06) + 's">' +
      '<div class="slot-photo">' + foodThumb(r) + '</div>' +
      '<div class="slot-body"><i>' + (x.extra ? 'Второй перекус' : MEAL_LABEL[x.k]) + '</i><b>' + esc(r.name) + '</b>' +
      '<em>' + portionLabel(x.m) + ' · <strong>' + sc(r.kcal, x.m) + ' ккал</strong> · ' + r.time + ' мин</em>' +
      '<em class="slot-m">Б ' + sc(r.p, x.m) + ' · Ж ' + sc(r.f, x.m) + ' · У ' + sc(r.c, x.m) + '</em>' +
      '<div style="margin-top:10px"><button class="linkbtn" type="button" onclick="openRecipe(' + r.id + ')">Рецепт →</button></div></div></div>';
  }).join('');
  const tot = plan.reduce(function(a, x){
    return { kcal:a.kcal + x.r.kcal * x.m, p:a.p + x.r.p * x.m, f:a.f + x.r.f * x.m, c:a.c + x.r.c * x.m };
  }, { kcal:0, p:0, f:0, c:0 });
  const kcal = Math.round(tot.kcal), diff = kcal - target, ok = Math.abs(diff) <= target * .03;
  $('dayTotal').innerHTML =
    '<div class="kpi"><b>' + kcal + '</b><span>ккал за день</span></div>' +
    '<div class="kpi ' + (tot.p >= norm.p * .85 ? 'good' : '') + '"><b>' + Math.round(tot.p) + ' <small>/ ' + norm.p + ' г</small></b><span>белки</span></div>' +
    '<div class="kpi"><b>' + Math.round(tot.f) + ' г</b><span>жиры</span></div>' +
    '<div class="kpi ' + (ok ? 'good' : '') + '"><b>' + (diff >= 0 ? '+' : '') + diff + '</b><span>к норме ' + target + '</span></div>';
  $('dayHint').textContent = ok
    ? 'Итого ' + kcal + ' ккал при норме ' + target + ' — разница ' + Math.abs(diff) + ' ккал (' + (Math.abs(diff) / target * 100).toFixed(1) + '%). Не нравится блюдо — жми «Собрать день» ещё раз.'
    : 'Ближе к норме ' + target + ' ккал из рецептов сайта не собрать — разница ' + Math.abs(diff) + ' ккал.';
  $('dayToDiary').style.display = '';
}
$('dayToDiary').onclick = function(){
  if(!lastDay) return;
  const d = dayData(today(), true);
  lastDay.forEach(function(x){
    const r = x.r;
    d.meals[x.k].push({ id:uid(), name:r.name, brand:'готовый день', grams:null, portion:portionLabel(x.m),
      kcal:Math.round(r.kcal * x.m), p:r1(r.p * x.m), f:r1(r.f * x.m), c:r1(r.c * x.m), src:'recipe',
      base:{ id:'r' + r.id, name:r.name, kcal:r.kcal, p:r.p, f:r.f, c:r.c, per100:false, src:'recipe' } });
  });
  save(); renderDiary(); achCheck();
  toast('Меню записано в дневник на сегодня');
};
$('dayGo').onclick = function(){ buildDay(); ME.profile.daysBuilt = (ME.profile.daysBuilt || 0) + 1; save(); achCheck(); };

/* ================= МОЙ ВЕС ================= */
function sortedW(){
  return ME.profile.weights.slice().sort(function(a, b){ return a.date < b.date ? -1 : 1; });
}
function fmtDate(d){
  const p = d.split('-');
  return p[2] + '.' + p[1];
}
function renderWeight(){
  const w = sortedW();
  if(!w.length){
    $('wStats').innerHTML = '';
    $('wList').innerHTML = '<div class="empty">Пока нет записей. Взвесься утром натощак и добавь первую цифру.</div>';
    drawChart(); return;
  }
  const first = w[0].kg, last = w[w.length-1].kg, diff = +(last - first).toFixed(1);
  const min = Math.min.apply(null, w.map(function(x){ return x.kg; }));
  $('wStats').innerHTML =
    '<div class="kpi"><b>' + last.toFixed(1) + '</b><span>сейчас, кг</span></div>' +
    '<div class="kpi ' + (diff < 0 ? 'good' : diff > 0 ? 'bad' : '') + '"><b>' + (diff > 0 ? '+' : '') + diff.toFixed(1) + '</b><span>с начала</span></div>' +
    '<div class="kpi"><b>' + min.toFixed(1) + '</b><span>минимум</span></div>' +
    '<div class="kpi"><b>' + w.length + '</b><span>взвешиваний</span></div>';
  $('wList').innerHTML = w.slice().reverse().map(function(x, i, arr){
    const prev = arr[i+1];
    const d = prev ? +(x.kg - prev.kg).toFixed(1) : null;
    return '<div class="witem"><b>' + x.kg.toFixed(1) + ' кг</b><span>' + fmtDate(x.date) + '</span>' +
      (d !== null ? '<span class="d ' + (d < 0 ? 'down' : d > 0 ? 'up' : '') + '">' + (d > 0 ? '+' : '') + d.toFixed(1) + ' кг</span>' : '<span class="d">старт</span>') +
      '<button class="del" type="button" style="margin-left:14px" onclick="delW(\'' + x.date + '\')">удалить</button></div>';
  }).join('');
  drawChart();
}
function delW(date){
  ME.profile.weights = ME.profile.weights.filter(function(x){ return x.date !== date; });
  save(); renderWeight(); renderDiary(); if(profileOpen) renderProfile(); toast('Запись удалена');
}
$('wSave').onclick = function(){
  const kg = parseFloat($('wKg').value);
  const date = $('wDate').value || today();
  if(!kg || kg < 35 || kg > 250){ toast('Введи вес от 35 до 250 кг'); return; }
  ME.profile.weights = ME.profile.weights.filter(function(x){ return x.date !== date; });
  ME.profile.weights.push({ date:date, kg:kg });
  ME.profile.weight = kg;
  save(); $('wKg').value = '';
  fillNorm(); renderWeight(); renderDiary(); if(profileOpen) renderProfile(); toast('Записал: ' + kg.toFixed(1) + ' кг');
  achCheck();
};

function drawChart(){
  const cv = $('chart'); if(!cv) return;
  const w = sortedW();
  const dpr = window.devicePixelRatio || 1;
  const cssW = cv.clientWidth || 600, cssH = 230;
  cv.width = cssW * dpr; cv.height = cssH * dpr;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cssW, cssH);
  const padL = 42, padR = 14, padT = 16, padB = 28;
  const iw = cssW - padL - padR, ih = cssH - padT - padB;
  g.strokeStyle = '#22262C'; g.lineWidth = 1;
  g.font = '11px Inter, sans-serif'; g.fillStyle = '#7C848E';
  if(w.length < 2){
    g.fillStyle = '#7C848E'; g.textAlign = 'center';
    g.fillText('Добавь минимум два взвешивания — появится график', cssW/2, cssH/2);
    return;
  }
  const vals = w.map(function(x){ return x.kg; });
  let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  if(mx - mn < 2){ const c = (mx+mn)/2; mn = c - 1; mx = c + 1; }
  const pad = (mx - mn) * 0.18; mn -= pad; mx += pad;
  const X = function(i){ return padL + iw * (i / (w.length - 1)); };
  const Y = function(v){ return padT + ih * (1 - (v - mn) / (mx - mn)); };
  for(let i = 0; i <= 3; i++){
    const y = padT + ih * i / 3;
    g.beginPath(); g.moveTo(padL, y); g.lineTo(cssW - padR, y); g.stroke();
    g.textAlign = 'right';
    g.fillText((mx - (mx - mn) * i / 3).toFixed(1), padL - 8, y + 4);
  }
  const grad = g.createLinearGradient(0, padT, 0, padT + ih);
  grad.addColorStop(0, 'rgba(201,244,92,.26)');
  grad.addColorStop(1, 'rgba(201,244,92,0)');
  g.beginPath(); g.moveTo(X(0), Y(vals[0]));
  for(let i = 1; i < w.length; i++) g.lineTo(X(i), Y(vals[i]));
  g.lineTo(X(w.length-1), padT + ih); g.lineTo(X(0), padT + ih); g.closePath();
  g.fillStyle = grad; g.fill();
  g.beginPath(); g.moveTo(X(0), Y(vals[0]));
  for(let i = 1; i < w.length; i++) g.lineTo(X(i), Y(vals[i]));
  g.strokeStyle = '#C9F45C'; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke();
  for(let i = 0; i < w.length; i++){
    g.beginPath(); g.arc(X(i), Y(vals[i]), 4, 0, Math.PI*2);
    g.fillStyle = '#0B0C0E'; g.fill();
    g.strokeStyle = '#C9F45C'; g.lineWidth = 2; g.stroke();
  }
  g.fillStyle = '#7C848E'; g.textAlign = 'center';
  const step = Math.ceil(w.length / 6);
  for(let i = 0; i < w.length; i += step) g.fillText(fmtDate(w[i].date), X(i), cssH - 8);
}
window.addEventListener('resize', function(){ if(profileOpen && accOpen.weight) drawChart(); });

/* ================= УПРАЖНЕНИЯ ================= */
let fGroup = 'Все';
$('fGroup').innerHTML = GROUPS.map(function(g, i){
  return '<button type="button" class="chip' + (i === 0 ? ' on' : '') + '" data-g="' + g + '">' + g + '</button>';
}).join('');
$('fGroup').addEventListener('click', function(e){
  const b = e.target.closest('.chip'); if(!b) return;
  $('fGroup').querySelectorAll('.chip').forEach(function(x){ x.classList.remove('on'); });
  b.classList.add('on'); fGroup = b.dataset.g; renderGym();
});
function msCls(k, main, also){
  if(main && main.indexOf(k) >= 0) return 'ms on';
  if(also && also.indexOf(k) >= 0) return 'ms alt';
  return 'ms';
}
function bodySvg(view, main, also){
  main = main || []; also = also || [];
  function c(k){ return msCls(k, main, also); }
  var b = '<svg viewBox="0 0 120 210" preserveAspectRatio="xMidYMid meet">';
  b += '<circle class="body-fig" cx="60" cy="15" r="11"/>';
  b += '<rect class="body-fig" x="54" y="23" width="12" height="10" rx="4"/>';
  b += '<rect class="body-fig" x="47" y="92" width="26" height="16" rx="7"/>';
  b += '<circle class="body-fig" cx="28" cy="111" r="4.5"/><circle class="body-fig" cx="92" cy="111" r="4.5"/>';
  b += '<circle class="body-fig" cx="53" cy="157" r="5"/><circle class="body-fig" cx="67" cy="157" r="5"/>';
  b += '<ellipse class="body-fig" cx="53" cy="201" rx="6" ry="4"/><ellipse class="body-fig" cx="67" cy="201" rx="6" ry="4"/>';
  if(view === 'back'){
    b += '<polygon class="' + c('traps') + '" points="46,41 54,26 66,26 74,41 67,51 53,51"/>';
    b += '<ellipse class="' + c('delt_r') + '" cx="41" cy="46" rx="9" ry="9"/><ellipse class="' + c('delt_r') + '" cx="79" cy="46" rx="9" ry="9"/>';
    b += '<ellipse class="' + c('delt_s') + '" cx="34" cy="49" rx="5" ry="8"/><ellipse class="' + c('delt_s') + '" cx="86" cy="49" rx="5" ry="8"/>';
    b += '<polygon class="' + c('lats') + '" points="47,51 58,53 58,88 49,79 43,63"/><polygon class="' + c('lats') + '" points="73,51 62,53 62,88 71,79 77,63"/>';
    b += '<rect class="' + c('midback') + '" x="52" y="51" width="16" height="19" rx="5"/>';
    b += '<rect class="' + c('lowback') + '" x="52" y="72" width="16" height="20" rx="5"/>';
    b += '<ellipse class="' + c('triceps') + '" cx="33" cy="68" rx="6.5" ry="13"/><ellipse class="' + c('triceps') + '" cx="87" cy="68" rx="6.5" ry="13"/>';
    b += '<ellipse class="' + c('forearm') + '" cx="29" cy="93" rx="5.5" ry="14"/><ellipse class="' + c('forearm') + '" cx="91" cy="93" rx="5.5" ry="14"/>';
    b += '<ellipse class="' + c('glutes') + '" cx="53" cy="106" rx="10" ry="10"/><ellipse class="' + c('glutes') + '" cx="67" cy="106" rx="10" ry="10"/>';
    b += '<ellipse class="' + c('hams') + '" cx="53" cy="134" rx="9" ry="21"/><ellipse class="' + c('hams') + '" cx="67" cy="134" rx="9" ry="21"/>';
    b += '<ellipse class="' + c('calves') + '" cx="53" cy="178" rx="7" ry="17"/><ellipse class="' + c('calves') + '" cx="67" cy="178" rx="7" ry="17"/>';
  } else {
    b += '<polygon class="' + c('traps') + '" points="47,41 55,27 65,27 73,41 60,38"/>';
    b += '<ellipse class="' + c('delt_f') + '" cx="41" cy="46" rx="9" ry="9"/><ellipse class="' + c('delt_f') + '" cx="79" cy="46" rx="9" ry="9"/>';
    b += '<ellipse class="' + c('delt_s') + '" cx="34" cy="49" rx="5" ry="8"/><ellipse class="' + c('delt_s') + '" cx="86" cy="49" rx="5" ry="8"/>';
    b += '<rect class="' + c('chest') + '" x="46" y="41" width="13" height="21" rx="6"/><rect class="' + c('chest') + '" x="61" y="41" width="13" height="21" rx="6"/>';
    b += '<rect class="' + c('oblique') + '" x="43" y="64" width="7" height="29" rx="3"/><rect class="' + c('oblique') + '" x="70" y="64" width="7" height="29" rx="3"/>';
    b += '<rect class="' + c('abs') + '" x="51" y="64" width="18" height="31" rx="5"/>';
    b += '<ellipse class="' + c('biceps') + '" cx="33" cy="68" rx="6.5" ry="13"/><ellipse class="' + c('biceps') + '" cx="87" cy="68" rx="6.5" ry="13"/>';
    b += '<ellipse class="' + c('forearm') + '" cx="29" cy="93" rx="5.5" ry="14"/><ellipse class="' + c('forearm') + '" cx="91" cy="93" rx="5.5" ry="14"/>';
    b += '<ellipse class="' + c('quads') + '" cx="53" cy="132" rx="9" ry="23"/><ellipse class="' + c('quads') + '" cx="67" cy="132" rx="9" ry="23"/>';
    b += '<ellipse class="' + c('calves') + '" cx="53" cy="179" rx="6.5" ry="17"/><ellipse class="' + c('calves') + '" cx="67" cy="179" rx="6.5" ry="17"/>';
  }
  b += '</svg>';
  return b;
}
function renderGym(){
  // «бицепс» ≠ «бицепс бедра»: без слова «бедро» в запросе не путаем руки с ногами
  const thigh = /бедр/.test(normTxt(eQuery));
  const fix = function(t){ return thigh ? t : t.replace(/[Бб]ицепс бедра/g, 'задняя поверхность бедра'); };
  const rank = function(e){ return matchQ(e.name, eQuery) ? 0 : matchQ(fix(e.main) + ' ' + e.group, eQuery) ? 1 : 2; };
  const list = EXERCISES.filter(function(e){
    return (fGroup === 'Все' || e.group === fGroup) && matchQ(fix(e.name + ' ' + e.group + ' ' + e.main + ' ' + e.also.join(' ')), eQuery);
  }).map(function(e, i){ return { e:e, i:i, r:eQuery ? rank(e) : 0 }; })
    .sort(function(a, b){ return a.r - b.r || a.i - b.i; }).map(function(o){ return o.e; });   // сначала совпадения в названии
  $('eQn').textContent = eQuery ? list.length + ' ' + plural(list.length, 'упражнение', 'упражнения', 'упражнений') : '';
  if(!list.length){
    $('gymGrid').innerHTML = '<div class="empty">По запросу «' + esc(eQuery) + '» ничего не нашлось' + (fGroup !== 'Все' ? ' в группе «' + fGroup + '»' : '') + '. <button class="linkbtn" type="button" onclick="clearEQ()">Сбросить поиск</button></div>';
    return;
  }
  $('gymGrid').innerHTML = list.map(function(e){
    return '<article class="ecard">' +
      '<div class="ephoto"><img src="' + thumbSrc(e.img) + '" alt="' + esc(e.name) + '" loading="lazy" decoding="async" width="640" height="478" /><b>' + e.group + '</b>' +
        '<div class="bmap">' + bodySvg(e.view, e.mMain, e.mAlso) + '</div>' +
        '<span class="mtag"><i class="dot"></i>' + esc(e.main) + '</span>' +
      '</div>' +
      '<div class="ebody">' +
        '<h3>' + esc(e.name) + '</h3>' +
        '<div class="muscles"><span class="m1">' + esc(e.main) + '</span>' +
          e.also.map(function(m){ return '<span class="m2">' + esc(m) + '</span>'; }).join('') + '</div>' +
        '<div class="esets">' + esc(e.sets) + '</div>' +
        '<button class="linkbtn" type="button" onclick="openEx(\'' + e.id + '\')">Как делать →</button>' +
      '</div></article>';
  }).join('');
}
function clearEQ(){ eQuery = ''; $('eQ').value = ''; renderGym(); }
$('eQ').addEventListener('input', function(){ eQuery = this.value.trim(); renderGym(); });
function openEx(id){
  const e = EXERCISES.find(function(x){ return x.id === id; });
  const alsoTxt = e.also.map(function(m){ return esc(m); }).join(', ');
  $('emTitle').textContent = e.name;
  $('emBody').innerHTML =
    '<div class="ephoto"><img src="' + e.img + '" alt="' + esc(e.name) + '" />' +
      '<span class="mtag"><i class="dot"></i>' + esc(e.main) + '</span></div>' +
    '<div class="anat">' +
      '<div class="acard">' + bodySvg('front', e.mMain, e.mAlso) + '<span>Спереди</span></div>' +
      '<div class="acard">' + bodySvg('back', e.mMain, e.mAlso) + '<span>Сзади</span></div>' +
    '</div>' +
    '<div class="mlegend"><span class="l1"><i></i>Красным — ' + esc(e.main) + '</span>' +
      (alsoTxt ? '<span class="l2"><i></i>Тёмно-красным — ' + alsoTxt + '</span>' : '') + '</div>' +
    '<div class="esets">' + esc(e.sets) + '</div>' +
    '<div class="steps">' + e.steps.map(function(s, i){
      return '<div class="step"><i>' + (i+1) + '</i><span>' + esc(s) + '</span></div>';
    }).join('') + '</div>' +
    '<div class="hint"><b>Частая ошибка:</b> ' + esc(e.err) + '</div>';
  $('exModal').classList.add('on');
  if(ME && ME.profile.exSeen.indexOf(id) < 0){ ME.profile.exSeen.push(id); save(); achCheck(); }
}

/* ================= ИСТОРИЯ ================= */
function renderHistory(){
  const c = ME.profile.cooked.slice().sort(function(a, b){ return a.date < b.date ? 1 : -1; });
  if(!c.length){
    $('hStats').innerHTML = '';
    $('hList').innerHTML = '<div class="empty">Пока пусто. Приготовь любой рецепт и нажми «Оценить».</div>';
    return;
  }
  const avg = c.reduce(function(s, x){ return s + x.stars; }, 0) / c.length;
  const best = c.slice().sort(function(a, b){ return b.stars - a.stars; })[0];
  const uniq = new Set(c.map(function(x){ return x.id; })).size;
  $('hStats').innerHTML =
    '<div class="kpi"><b>' + c.length + '</b><span>всего готовок</span></div>' +
    '<div class="kpi"><b>' + uniq + '</b><span>разных блюд</span></div>' +
    '<div class="kpi"><b>' + avg.toFixed(1) + '</b><span>средняя оценка</span></div>' +
    '<div class="kpi"><b style="font-size:15px;line-height:1.3">' + esc(best.name) + '</b><span>лучшее блюдо</span></div>';
  $('hList').innerHTML = c.map(function(x, i){
    return '<div class="hitem"><div><b>' + esc(x.name) + '</b>' +
      '<div class="meta">' + fmtDate(x.date) + ' · ' + x.kcal + ' ккал' + (x.note ? ' · ' + esc(x.note) : '') + '</div></div>' +
      '<div class="right"><span class="stars">' + starsHtml(x.stars) + '</span>' +
      '<button class="del" type="button" onclick="delCooked(' + i + ')">удалить</button></div></div>';
  }).join('');
}
function delCooked(i){
  const c = ME.profile.cooked.slice().sort(function(a, b){ return a.date < b.date ? 1 : -1; });
  const item = c[i];
  const idx = ME.profile.cooked.indexOf(item);
  if(idx >= 0) ME.profile.cooked.splice(idx, 1);
  save(); renderHistory(); renderRecipes(); if(profileOpen) renderProfile(); toast('Удалил из истории'); achCheck(true);
}
$('wipe').onclick = function(){
  if(!confirm('Удалить историю блюд и все взвешивания? Дневник питания останется.')) return;
  ME.profile.weights = []; ME.profile.cooked = [];
  save(); renderAll(); toast('Данные очищены'); achCheck(true);
};


/* ================= ПРОФИЛЬ ================= */

/* Стрик записи еды — считается по дневнику питания (дни, где есть хотя бы один продукт). */
const FoodStreak = {
  calc: function(days){
    const set = new Set(days);
    let current = 0;
    for(let i = set.has(addDays(today(), 0)) ? 0 : 1; set.has(addDays(today(), -i)); i++) current++;
    let best = 0, run = 0, prev = null;
    days.slice().sort().forEach(function(d){
      run = (prev && addDays(prev, 1) === d) ? run + 1 : 1;
      best = Math.max(best, run); prev = d;
    });
    return { current: current, best: best };
  },
  get: function(){ const days = loggedDays(); return Object.assign({ days: days, isMock: false }, this.calc(days)); },
  week: function(){   // последние 7 дней для виджета в профиле
    const set = new Set(loggedDays()), out = [];
    for(let i = 6; i >= 0; i--){ const ds = addDays(today(), -i); out.push({ d: parseDate(ds), on: set.has(ds) }); }
    return out;
  }
};

const KIND_STAT = { 'без огня':'k_nofire', 'микроволновка':'k_micro', '1 сковорода':'k_pan', 'духовка':'k_oven', 'кастрюля':'k_pot' };

/* вся статистика пользователя — из неё считаются достижения и блоки профиля */
function achStats(){
  const p = ME.profile, c = p.cooked;
  const st = { cooks: c.length, fiveStars: 0, lowStars: 0, notes: 0, shakes: 0,
    m_breakfast:0, m_lunch:0, m_dinner:0, m_snack:0, k_nofire:0, k_micro:0, k_pan:0, k_oven:0, k_pot:0 };
  const per = {}, shakeIds = new Set();
  c.forEach(function(x){
    per[x.id] = (per[x.id] || 0) + 1;
    if(x.stars >= 5) st.fiveStars++;
    if(x.stars <= 2) st.lowStars++;
    if(x.note) st.notes++;
    const r = findR(x.id); if(!r) return;
    r.meal.forEach(function(m){ st['m_' + m]++; });
    if(KIND_STAT[r.kind]) st[KIND_STAT[r.kind]]++;
    if(r.shake){ st.shakes++; shakeIds.add(r.id); }
  });
  st.unique = Object.keys(per).length;
  st.maxRepeat = Math.max.apply(null, [0].concat(Object.values(per)));
  st.shakesUnique = shakeIds.size;
  st.favs = p.favs.length;
  st.exSeen = p.exSeen.filter(function(id){ return EXERCISES.some(function(e){ return e.id === id; }); }).length;
  GROUPS.slice(1).forEach(function(g){ st['grp_' + g] = 0; });
  p.exSeen.forEach(function(id){ const e = EXERCISES.find(function(x){ return x.id === id; }); if(e) st['grp_' + e.group]++; });
  const fs = FoodStreak.get();
  st.streakBest = fs.isMock ? 0 : fs.best;   // демо-стрик не даёт достижений
  const w = sortedW();
  st.weighIns = w.length;
  st.lost = w.length > 1 ? Math.max(0, w[0].kg - w[w.length-1].kg) : 0;
  st.gained = w.length > 1 ? Math.max(0, w[w.length-1].kg - w[0].kg) : 0;
  st.visitDays = p.visits.length;
  st.normSaved = p.normSaved ? 1 : 0;
  st.manualNorm = p.normSaved && p.normMode === 'manual' ? 1 : 0;
  st.daysBuilt = p.daysBuilt || 0;
  st.avg = c.length ? c.reduce(function(s, x){ return s + x.stars; }, 0) / c.length : 0;
  return st;
}

/* полученные достижения хранятся в профиле — однажды заработанное не пропадает */
function achCheck(silent){
  if(!ME) return;
  const st = achStats(), p = ME.profile;
  if(!p.achDone) p.achDone = [];
  const fresh = ACHIEVEMENTS.filter(function(a){ return p.achDone.indexOf(a.id) < 0 && (st[a.stat] || 0) >= a.goal; });
  if(fresh.length){
    fresh.forEach(function(a){ p.achDone.push(a.id); });
    save();
    if(!silent){
      setTimeout(function(){
        toast('🏆 ' + fresh[0].title + (fresh.length > 1 ? ' и ещё ' + (fresh.length - 1) : ''));
      }, 1300);
    }
  }
  updateFab();
  if(profileOpen) renderProfile();
}
function achInit(){ achCheck(true); }

const FIRE = '<svg viewBox="0 0 24 24"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.6 1 2.6 2.1 3.1C11 9 10.8 6 12 3z"/></svg>';

function updateFab(){
  if(!ME) return;
  $('fabAva').textContent = (ME.name || '?').trim().charAt(0).toUpperCase();
  $('fabName').textContent = ME.name;
  $('fabSub').textContent = 'Достижения ' + (ME.profile.achDone || []).length + '/100';
  $('fabFire').innerHTML = FIRE + '<b>' + FoodStreak.get().current + '</b>';
}

let profileOpen = false, achCat = 'all';
function openProfile(){
  if(!ME) return;
  profileOpen = true;
  renderProfile();
  $('pdrawer').classList.add('on');
  $('pdrawer').setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('noscroll');
  $('pdPanel').scrollTop = 0;
  setTimeout(function(){ $('pdClose').focus({ preventScroll: true }); }, 60);
}
function closeProfile(){
  if(!profileOpen) return;
  profileOpen = false;
  $('pdrawer').classList.remove('on');
  $('pdrawer').setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('noscroll');
  $('pfab').focus({ preventScroll: true });
}
$('pfab').onclick = openProfile;
$('qtToggle').addEventListener('change', function(){ QuoteToasts.setEnabled(this.checked); toast(this.checked ? 'Цитаты включены' : 'Цитаты выключены'); });

/* сворачиваемые разделы профиля */
const accOpen = { cooked:true, fav:true };
document.querySelectorAll('.acc').forEach(function(sec){
  const key = sec.dataset.acc, h = sec.querySelector('.acc-h');
  if(accOpen[key]) sec.classList.add('open');
  h.addEventListener('click', function(){
    const open = !sec.classList.contains('open');
    sec.classList.toggle('open', open);
    h.setAttribute('aria-expanded', open);
    accOpen[key] = open;
    if(open && key === 'weight'){ drawChart(); setTimeout(drawChart, 320); }
  });
});
$('pdClose').onclick = closeProfile;
$('pdBack').onclick = closeProfile;
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && profileOpen && !document.querySelector('.modal.on')) closeProfile();
}, true);

function renderStreak(){
  const fs = FoodStreak.get();
  const days = ['вс','пн','вт','ср','чт','пт','сб'];
  $('pdStreak').innerHTML =
    '<div class="stk-main"><span class="stk-fire">' + FIRE + '</span>' +
      '<div><b>' + fs.current + ' ' + plural(fs.current, 'день', 'дня', 'дней') + ' подряд</b>' +
      '<span>записываешь приёмы пищи · рекорд ' + fs.best + '</span></div></div>' +
    '<div class="stk-week">' + FoodStreak.week().map(function(x, i){
      return '<div class="stk-day' + (x.on ? ' on' : '') + (i === 6 ? ' today' : '') + '"><i>' + (x.on ? FIRE : '') + '</i><span>' + days[x.d.getDay()] + '</span></div>';
    }).join('') + '</div>' +
    '<button type="button" class="linkbtn stk-go" onclick="closeProfile();go(\'diary\')">' + (fs.current ? 'Открыть дневник →' : 'Записать еду в дневник →') + '</button>';
}

function miniCard(r, extra){
  return '<button type="button" class="pmini" onclick="openRecipe(' + r.id + ')">' +
    '<span class="pmini-ph">' + foodThumb(r) + '</span>' +
    '<span class="pmini-t"><b>' + esc(r.name) + '</b><em>' + extra + '</em></span></button>';
}

function renderProfile(){
  const p = ME.profile, st = achStats();
  $('pdAva').textContent = (ME.name || '?').trim().charAt(0).toUpperCase();
  $('pdName').textContent = ME.name;
  $('pdMail').textContent = KEY;
  renderStreak();

  const w = sortedW();
  const wd = w.length > 1 ? +(w[w.length-1].kg - w[0].kg).toFixed(1) : null;
  $('pdStats').innerHTML =
    '<div class="kpi"><b>' + st.cooks + '</b><span>готовок</span></div>' +
    '<div class="kpi"><b>' + st.unique + '</b><span>разных блюд</span></div>' +
    '<div class="kpi"><b>' + (st.avg ? st.avg.toFixed(1) : '—') + '</b><span>средняя оценка</span></div>' +
    '<div class="kpi"><b>' + st.visitDays + '</b><span>' + plural(st.visitDays, 'день', 'дня', 'дней') + ' на сайте</span></div>' +
    '<div class="kpi"><b>' + st.exSeen + '<small>/' + EXERCISES.length + '</small></b><span>изучено упражнений</span></div>' +
    '<div class="kpi ' + (wd === null ? '' : wd < 0 ? 'good' : '') + '"><b>' + (wd === null ? '—' : (wd > 0 ? '+' : '') + wd + ' кг') + '</b><span>вес с начала</span></div>';

  // приготовленные: уникальные рецепты, последние сверху
  const last = {}, cnt = {};
  p.cooked.forEach(function(x){ cnt[x.id] = (cnt[x.id] || 0) + 1; if(!last[x.id] || x.date > last[x.id]) last[x.id] = x.date; });
  const cookedIds = Object.keys(last).map(Number).sort(function(a, b){ return last[a] < last[b] ? 1 : -1; });
  $('pdCooked').innerHTML = cookedIds.length ? cookedIds.map(function(id){
    const r = findR(id); if(!r) return '';
    return miniCard(r, cnt[id] + ' ' + plural(cnt[id], 'раз', 'раза', 'раз') + ' · ' + fmtDate(last[id]));
  }).join('') : '<div class="empty">Отметь рецепт кнопкой «Оценить» — он появится здесь.</div>';

  // избранное + лучшие по оценке
  const rated = Object.keys(cnt).map(Number).filter(function(id){ return avgStars(id) >= 4; })
    .sort(function(a, b){ return avgStars(b) - avgStars(a); });
  const favIds = p.favs.slice().reverse().concat(rated.filter(function(id){ return p.favs.indexOf(id) < 0; }));
  $('pdFav').innerHTML = favIds.length ? favIds.map(function(id){
    const r = findR(id); if(!r) return '';
    const av = avgStars(id);
    return miniCard(r, (p.favs.indexOf(id) >= 0 ? '<i class="pheart">' + HEART + '</i>' : '') + (av ? '<span class="stars">' + starsHtml(av) + '</span>' : 'в избранном'));
  }).join('') : '<div class="empty">Нажми ♡ на карточке рецепта или поставь блюду 4–5 звёзд.</div>';

  renderAch(st);
  const hc = p.cooked.length;
  $('accHistN').textContent = hc ? hc + ' ' + plural(hc, 'готовка', 'готовки', 'готовок') + ' · средняя ' + st.avg.toFixed(1) + '★' : 'пока пусто';
  $('accWeightN').textContent = w.length ? w[w.length-1].kg.toFixed(1) + ' кг' + (wd !== null ? ' · ' + (wd > 0 ? '+' : '') + wd + ' кг с начала' : '') : 'нет записей';
  $('pdCookedN').textContent = cookedIds.length ? cookedIds.length + ' ' + plural(cookedIds.length, 'рецепт', 'рецепта', 'рецептов') : 'пока пусто';
  $('pdFavN').textContent = favIds.length ? favIds.length + ' ' + plural(favIds.length, 'рецепт', 'рецепта', 'рецептов') : 'пока пусто';
  if(accOpen.weight) requestAnimationFrame(drawChart);
}

function renderAch(st){
  const done = new Set(ME.profile.achDone || []);
  $('pdAchSub').textContent = done.size + ' из 100 получено';
  $('pdAchBar').style.width = done.size + '%';
  $('pdAchCats').innerHTML = [{ id:'all', label:'Все' }].concat(ACH_CATS).map(function(c){
    const n = c.id === 'all' ? done.size : ACHIEVEMENTS.filter(function(a){ return a.cat === c.id && done.has(a.id); }).length;
    const t = c.id === 'all' ? 100 : ACHIEVEMENTS.filter(function(a){ return a.cat === c.id; }).length;
    return '<button type="button" class="chip' + (achCat === c.id ? ' on' : '') + '" data-cat="' + c.id + '">' + c.label + ' <small>' + n + '/' + t + '</small></button>';
  }).join('');
  const list = ACHIEVEMENTS.filter(function(a){ return achCat === 'all' || a.cat === achCat; })
    .map(function(a, i){ return { a: a, i: i, ok: done.has(a.id) }; })
    .sort(function(x, y){ return (y.ok - x.ok) || (x.i - y.i); });   // полученные — первыми
  $('pdAch').innerHTML = list.map(function(o){
    const a = o.a, cur = Math.min(a.goal, Math.floor(st[a.stat] || 0));
    const isStreak = a.cat === 'streak' && FoodStreak.get().isMock;
    return '<div class="ach' + (o.ok ? ' ok' : ' lock') + '" title="' + esc(a.desc) + '">' +
      '<div class="ach-ic">' + ACH_ICON[a.cat] + (o.ok ? '' : '<span class="ach-lock">' + ACH_ICON.lock + '</span>') + '</div>' +
      '<b>' + esc(a.title) + '</b><p>' + esc(a.desc) + '</p>' +
      (o.ok ? '<span class="ach-st">Получено</span>'
        : (a.goal > 1 && !isStreak ? '<span class="ach-pg"><i style="width:' + (cur / a.goal * 100) + '%"></i></span><span class="ach-st">' + cur + ' / ' + a.goal + '</span>'
          : '<span class="ach-st">' + (isStreak ? 'Скоро' : 'Заблокировано') + '</span>')) +
    '</div>';
  }).join('');
}
$('pdAchCats').addEventListener('click', function(e){
  const b = e.target.closest('.chip'); if(!b) return;
  achCat = b.dataset.cat; renderAch(achStats());
});

/* ================= мобильная клавиатура =================
   Пока фокус в поле ввода (на телефоне) — нижнее меню и плавающие кнопки спрятаны. */
(function(){
  const typing = function(el){ return el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|file|date|color)$/.test(el.type))) || (el && el.isContentEditable); };
  const touch = window.matchMedia('(hover:none)').matches;
  if(!touch) return;
  document.addEventListener('focusin', function(e){ if(typing(e.target)) document.body.classList.add('kb-open'); });
  document.addEventListener('focusout', function(){ setTimeout(function(){ if(!typing(document.activeElement)) document.body.classList.remove('kb-open'); }, 80); });
})();

/* ================= init ================= */
function renderAll(){
  dirtyTab.recipes = dirtyTab.gym = dirtyTab.diary = true;
  const cur = document.querySelector('.tab.on');
  if(cur) flushTab(cur.id.replace('tab-', ''));
  const idle = window.requestIdleCallback || function(f){ return setTimeout(f, 250); };
  idle(function(){ ['diary', 'recipes', 'gym'].forEach(flushTab); renderWeight(); renderHistory(); }, { timeout:1500 });
}
$('wDate').value = today();
$('rateDate').value = today();
setMode('login');
(function(){
  // авто-вход: есть действующий токен — сразу в приложение, минуя экран входа
  const v = validSession();
  if(v) enter(v.k, v.remember);
  else clearSession();
})();

/* ================= маскот-гантеля: медленно поворачивается к курсору ================= */
(function(){
  const mascot = $('mascot'); if(!mascot) return;
  let raf = null;
  document.addEventListener('mousemove', function(e){
    if(raf) return;
    raf = requestAnimationFrame(function(){
      raf = null;
      const half = window.innerWidth / 2;
      const dx = (e.clientX - half) / half; // от -1 (слева) до 1 (справа)
      const shift = Math.max(-1, Math.min(1, dx)) * 14; // px смещения
      const rot = Math.max(-1, Math.min(1, dx)) * 5;    // deg наклона
      mascot.style.setProperty('--mx', shift.toFixed(1) + 'px');
      mascot.style.setProperty('--mr', rot.toFixed(1) + 'deg');
    });
  });
})();
