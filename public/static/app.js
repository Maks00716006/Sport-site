
/* ================= storage & auth ================= */
const LSU = 'forma-users-v2', LSS = 'forma-session-v2';
const $ = function(id){ return document.getElementById(id); };
const esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };

function readUsers(){ try { return JSON.parse(localStorage.getItem(LSU)) || {}; } catch(e){ return {}; } }
function writeUsers(u){ try { localStorage.setItem(LSU, JSON.stringify(u)); } catch(e){} }
let USERS = readUsers();
let KEY = null;   // current login key
let ME = null;    // { name, pass, profile }

function save(){ if(!KEY) return; USERS[KEY] = ME; writeUsers(USERS); }
function today(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function toast(t){ const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(function(){ el.classList.remove('on'); }, 2200); }

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
$('toSignupM').onclick = function(e){ e.preventDefault(); setMode('reg'); };
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
segInit('oSex'); segInit('oGoal');

let pending = null;
$('authGo').onclick = function(){
  const mail = $('aMail').value.trim().toLowerCase();
  const pass = $('aPass').value;
  const err = $('authErr');
  err.textContent = '';
  if(!mail){ err.textContent = 'Введи почту или логин.'; return; }
  if(pass.length < 4){ err.textContent = 'Пароль от 4 символов.'; return; }
  USERS = readUsers();
  const u = USERS[mail];
  if(!u){ err.textContent = 'Такого аккаунта нет. Нажми «Создать аккаунт».'; return; }
  if(u.pass !== pass){ err.textContent = 'Неверный пароль.'; return; }
  enter(mail);
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

$('onbGo').onclick = function(){
  const p = pending; if(!p) return;
  USERS[p.mail] = {
    name: p.name, pass: p.pass,
    profile: {
      sex: segGet('oSex'), age: +$('oAge').value || 20, height: +$('oHeight').value || 175,
      weight: +$('oWeight').value || 75, act: $('oAct').value, goal: segGet('oGoal'),
      weights: [{ date: today(), kg: +$('oWeight').value || 75 }], cooked: []
    }
  };
  writeUsers(USERS);
  enter(p.mail);
  toast('Аккаунт создан, брат');
};

function enter(key){
  KEY = key; ME = USERS[key];
  if(!ME.profile.cooked) ME.profile.cooked = [];
  if(!ME.profile.weights) ME.profile.weights = [];
  try { localStorage.setItem(LSS, key); } catch(e){}
  $('auth').style.display = 'none';
  $('app').style.display = '';
  const first = (ME.name || '?').trim().charAt(0).toUpperCase();
  $('ava').textContent = first; $('meName').textContent = ME.name; $('meMail').textContent = key;
  $('meNameM').textContent = ME.name;
  fillNorm(); renderAll(); go('norm');
  window.scrollTo(0, 0);
}
function leave(){
  try { localStorage.removeItem(LSS); } catch(e){}
  KEY = null; ME = null;
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
  history:'<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/></svg>'
};
const TABS = [
  { id:'norm', label:'Норма КБЖУ', short:'КБЖУ' },
  { id:'recipes', label:'Рецепты', short:'Рецепты' },
  { id:'weight', label:'Мой вес', short:'Вес' },
  { id:'gym', label:'Упражнения', short:'Зал' },
  { id:'history', label:'История блюд', short:'История' }
];
$('nav').innerHTML = TABS.map(function(t){
  return '<button type="button" class="navbtn" data-go="' + t.id + '">' + IC[t.id] + '<span>' + t.label + '</span></button>';
}).join('');
$('tabbar').innerHTML = TABS.map(function(t){
  return '<button type="button" data-go="' + t.id + '">' + IC[t.id] + '<span>' + t.short + '</span></button>';
}).join('');

function go(id){
  document.querySelectorAll('.tab').forEach(function(s){ s.classList.toggle('on', s.id === 'tab-' + id); });
  document.querySelectorAll('[data-go]').forEach(function(b){ b.classList.toggle('on', b.dataset.go === id); });
  if(id === 'weight') drawChart();
  window.scrollTo(0, 0);
}

/* ---- подвкладки внутри "Рецепты": все рецепты / готовый день ---- */
segInit('rSub', function(v){
  $('viewAll').style.display = v === 'all' ? '' : 'none';
  $('viewDay').style.display = v === 'day' ? '' : 'none';
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

function fillNorm(){
  const p = ME.profile;
  segSet('nSex', p.sex); segSet('nGoal', p.goal);
  $('nAge').value = p.age; $('nHeight').value = p.height;
  $('nWeight').value = p.weight; $('nAct').value = p.act;
  calcNorm();
}
function calcNorm(){
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
  const prevKcal = norm.kcal, prevP = norm.p, prevF = norm.f, prevC = norm.c;
  norm = { kcal:kcal, p:p, f:f, c:c };

  animateNum($('outKcal'), prevKcal || kcal, kcal, '', 700);
  animateNum($('outP'), prevP || p, p, ' г', 700);
  animateNum($('outF'), prevF || f, f, ' г', 700);
  animateNum($('outC'), prevC || c, c, ' г', 700);
  pulse($('macroP')); pulse($('macroF')); pulse($('macroC'));
  $('outNote').textContent = goal === 'cut' ? 'Сушка: минус 18% от расхода, белок высокий — мышцы остаются.'
    : goal === 'mass' ? 'Масса: плюс 12% к расходу — рост без лишнего жира.'
    : 'Форма: едим ровно столько, сколько тратим.';
  $('outBmr').textContent = 'Основной обмен ' + Math.round(bmr) + ' ккал · расход с активностью ' + Math.round(tdee) + ' ккал';

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
segInit('nSex', calcNorm); segInit('nGoal', calcNorm);
['nAge','nHeight','nWeight','nAct'].forEach(function(id){ $(id).addEventListener('input', calcNorm); });
$('nSave').onclick = function(){
  ME.profile.sex = segGet('nSex'); ME.profile.goal = segGet('nGoal');
  ME.profile.age = +$('nAge').value; ME.profile.height = +$('nHeight').value;
  ME.profile.weight = +$('nWeight').value; ME.profile.act = $('nAct').value;
  save(); toast('Сохранил в профиль');
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
function foodThumb(r){
  if(r.img) return '<img src="' + r.img + '" alt="' + esc(r.name) + '" loading="lazy" />';
  return '<div class="rph-ph"><span>' + (KIND_ICON[r.kind] || '🍽️') + '</span></div>';
}
function renderRecipes(){
  const list = RECIPES.filter(function(r){
    return (fMeal === 'all' || r.meal.indexOf(fMeal) >= 0) && (fKind === 'all' || r.kind === fKind);
  });
  if(!list.length){ $('recipeGrid').innerHTML = '<div class="empty">Под такие фильтры ничего нет. Сбрось один из них.</div>'; return; }
  $('recipeGrid').innerHTML = list.map(function(r, i){
    const av = avgStars(r.id);
    return '<article class="rcard" style="--d:' + Math.min(i, 12) * 0.04 + 's">' +
      '<div class="rphoto">' + foodThumb(r) + '<span class="rtag">' + r.kcal + ' ккал</span></div>' +
      '<div class="rbody">' +
        '<div class="rtop"><h3>' + esc(r.name) + '</h3></div>' +
        '<div class="rmeta">' + r.time + ' мин · ' + r.kind + ' · ' + r.meal.map(function(m){ return MEAL_LABEL[m]; }).join(', ') + '</div>' +
        '<div class="kb"><span>Б ' + r.p + '</span><span>Ж ' + r.f + '</span><span>У ' + r.c + '</span><span>' + r.ing.length + ' ингредиентов</span></div>' +
        '<div class="rfoot">' +
          '<button class="btn sm ghost" type="button" onclick="openRecipe(' + r.id + ')">Как готовить</button>' +
          '<button class="linkbtn" type="button" onclick="openRate(' + r.id + ')">Оценить</button>' +
          (av ? '<span class="stars" style="margin-left:auto">' + starsHtml(av) + '</span>' : '') +
        '</div>' +
      '</div></article>';
  }).join('');
}
function openRecipe(id){
  const r = RECIPES.find(function(x){ return x.id === id; });
  $('rmTitle').textContent = r.name;
  $('rmBody').innerHTML =
    (r.img ? '<img src="' + r.img + '" alt="' + esc(r.name) + '" />' : '') +
    '<div class="kb"><span>' + r.kcal + ' ккал</span><span>Б ' + r.p + '</span><span>Ж ' + r.f + '</span><span>У ' + r.c + '</span><span>' + r.time + ' мин</span></div>' +
    '<div><b style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">Надо купить</b>' +
      '<div class="kb" style="margin-top:8px">' + r.ing.map(function(i){ return '<span>' + esc(i) + '</span>'; }).join('') + '</div></div>' +
    '<div class="steps">' + r.steps.map(function(s, i){
        return '<div class="step"><i>' + (i+1) + '</i><span>' + esc(s) + '</span></div>';
      }).join('') + '</div>' +
    '<div class="hint"><b>Совет:</b> ' + esc(r.hint) + '</div>' +
    '<button class="btn wide" type="button" onclick="openRate(' + r.id + ')">Я это готовил — оценить</button>';
  $('recipeModal').classList.add('on');
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
  const r = RECIPES.find(function(x){ return x.id === id; });
  const prev = ME.profile.cooked.filter(function(c){ return c.id === id; }).pop();
  rateStars = prev ? prev.stars : 5;
  $('rateTitle').textContent = r.name;
  $('rateDate').value = today();
  $('rateNote').value = '';
  paintStars();
  $('recipeModal').classList.remove('on');
  $('rateModal').classList.add('on');
}
$('rateSave').onclick = function(){
  const r = RECIPES.find(function(x){ return x.id === rateId; });
  ME.profile.cooked.push({ id:r.id, name:r.name, kcal:r.kcal, stars:rateStars, note:$('rateNote').value.trim(), date:$('rateDate').value || today() });
  save(); $('rateModal').classList.remove('on');
  renderRecipes(); renderHistory();
  toast('Добавил в историю');
};

/* ================= ГОТОВЫЙ ДЕНЬ ================= */
function pick(meal){
  const list = RECIPES.filter(function(r){ return r.meal.indexOf(meal) >= 0; });
  return list[Math.floor(Math.random() * list.length)];
}
function portion(n){
  if(n === 0.5) return 'полпорции · ';
  if(n === 1.5) return '1,5 порции · ';
  if(n === 2) return '2 порции · ';
  return '';
}
function buildDay(){
  const slots = { breakfast:pick('breakfast'), lunch:pick('lunch'), dinner:pick('dinner'), snack:pick('snack') };
  const mult = { breakfast:1, lunch:1, dinner:1, snack:1 };
  const keys = ['breakfast','lunch','dinner','snack'];
  const sumWith = function(){ return keys.reduce(function(s, k){ return s + slots[k].kcal * mult[k]; }, 0); };
  for(let guard = 0; guard < 14; guard++){
    const diff = norm.kcal - sumWith();
    if(Math.abs(diff) <= 60) break;
    const dir = diff > 0 ? 0.5 : -0.5;
    const cand = keys.filter(function(k){ const v = mult[k] + dir; return v >= 0.5 && v <= 2; });
    if(!cand.length) break;
    cand.sort(function(a, b){ return dir > 0 ? mult[a] - mult[b] : mult[b] - mult[a]; });
    mult[cand[0]] += dir;
  }
  const sc = function(v, k){ return Math.round(v * mult[k]); };
  $('daySlots').innerHTML = keys.map(function(k, idx){
    const r = slots[k];
    return '<div class="slot" style="--d:' + (idx * 0.06) + 's">' +
      '<div class="slot-photo">' + foodThumb(r) + '</div>' +
      '<div class="slot-body"><i>' + MEAL_LABEL[k] + '</i><b>' + esc(r.name) + '</b>' +
      '<em>' + portion(mult[k]) + sc(r.kcal, k) + ' ккал · ' + r.time + ' мин</em>' +
      '<div style="margin-top:10px"><button class="linkbtn" type="button" onclick="openRecipe(' + r.id + ')">Рецепт →</button></div></div></div>';
  }).join('');
  const tot = keys.reduce(function(a, k){
    const r = slots[k];
    return { kcal:a.kcal + sc(r.kcal, k), p:a.p + sc(r.p, k), f:a.f + sc(r.f, k), c:a.c + sc(r.c, k) };
  }, { kcal:0, p:0, f:0, c:0 });
  const diff = tot.kcal - norm.kcal;
  $('dayTotal').innerHTML =
    '<div class="kpi"><b>' + tot.kcal + '</b><span>ккал за день</span></div>' +
    '<div class="kpi"><b>' + tot.p + ' г</b><span>белки</span></div>' +
    '<div class="kpi"><b>' + tot.f + ' г</b><span>жиры</span></div>' +
    '<div class="kpi ' + (Math.abs(diff) <= 120 ? 'good' : '') + '"><b>' + (diff >= 0 ? '+' : '') + diff + '</b><span>к норме ' + norm.kcal + '</span></div>';
}
$('dayGo').onclick = buildDay;

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
  save(); renderWeight(); toast('Запись удалена');
}
$('wSave').onclick = function(){
  const kg = parseFloat($('wKg').value);
  const date = $('wDate').value || today();
  if(!kg || kg < 35 || kg > 250){ toast('Введи вес от 35 до 250 кг'); return; }
  ME.profile.weights = ME.profile.weights.filter(function(x){ return x.date !== date; });
  ME.profile.weights.push({ date:date, kg:kg });
  ME.profile.weight = kg;
  save(); $('wKg').value = '';
  fillNorm(); renderWeight(); toast('Записал: ' + kg.toFixed(1) + ' кг');
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
window.addEventListener('resize', function(){ if($('tab-weight').classList.contains('on')) drawChart(); });

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
  const list = EXERCISES.filter(function(e){ return fGroup === 'Все' || e.group === fGroup; });
  $('gymGrid').innerHTML = list.map(function(e){
    return '<article class="ecard">' +
      '<div class="ephoto"><img src="' + e.img + '" alt="' + esc(e.name) + '" loading="lazy" /><b>' + e.group + '</b>' +
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
  save(); renderHistory(); renderRecipes(); toast('Удалил из истории');
}
$('wipe').onclick = function(){
  if(!confirm('Удалить весь прогресс: взвешивания и историю блюд?')) return;
  ME.profile.weights = []; ME.profile.cooked = [];
  save(); renderAll(); toast('Данные очищены');
};

/* ================= init ================= */
function renderAll(){ renderRecipes(); renderWeight(); renderGym(); renderHistory(); }
$('wDate').value = today();
$('rateDate').value = today();
setMode('login');
(function(){
  let s = null;
  try { s = localStorage.getItem(LSS); } catch(e){}
  if(s && USERS[s]) enter(s);
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
