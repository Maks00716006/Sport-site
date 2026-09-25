/* ================= ДНЕВНИК: питание, вода, тренировки =================
   Данные хранятся в профиле пользователя (localStorage), по датам:
     ME.profile.diary['YYYY-MM-DD'] = {
       meals:   { breakfast:[], lunch:[], dinner:[], snack:[] },   // продукты
       water:   0,                                                 // мл
       workout: [ { id, name, sets:[{ reps, kg }] } ]
     }
   Продукт: { id, name, brand, grams, portion, kcal, p, f, c, src }
   Функции зависят от app.js ($, ME, save, toast, norm, today, esc, sortedW…),
   поэтому модуль только объявляет функции, а подключает их diaryInit() из app.js. */

const MEALS = [
  { id:'breakfast', label:'Завтрак', share:.25, icon:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' },
  { id:'lunch', label:'Обед', share:.35, icon:'<svg viewBox="0 0 24 24"><path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M12 3v4M8 5v2M16 5v2"/></svg>' },
  { id:'dinner', label:'Ужин', share:.25, icon:'<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>' },
  { id:'snack', label:'Перекус / другое', share:.15, icon:'<svg viewBox="0 0 24 24"><path d="M12 7c-3-3-8-1-8 4 0 4 3 9 6 9 1 0 1.5-.5 2-.5s1 .5 2 .5c3 0 6-5 6-9 0-5-5-7-8-4z"/><path d="M12 7c0-2 1-4 3-4"/></svg>' }
];
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const D_ICON = {
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  left:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  right:'<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  chart:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  dumbbell:'<svg viewBox="0 0 24 24"><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/></svg>',
  drop:'<svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  barcode:'<svg viewBox="0 0 24 24"><path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14"/></svg>',
  camera:'<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  scale:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8.5 10a4 4 0 0 1 7 0l-2 2"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>'
};

let dDate = null;            // выбранный день в дневнике
let dAnimKcal = 0;           // для плавного счётчика калорий

/* ---------- даты ---------- */
function isoDate(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function parseDate(s){ const p = s.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
function addDays(s, n){ const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); }
function mondayOf(s){ const d = parseDate(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return isoDate(d); }
function humanDate(s){
  const t = today();
  if(s === t) return 'Сегодня';
  if(s === addDays(t, -1)) return 'Вчера';
  if(s === addDays(t, 1)) return 'Завтра';
  const d = parseDate(s);
  return d.getDate() + ' ' + MONTHS[d.getMonth()];
}

/* ---------- данные ---------- */
function diaryStore(){ return ME.profile.diary || (ME.profile.diary = {}); }
function dayData(date, create){
  const st = diaryStore();
  if(!st[date]){
    if(!create) return null;
    st[date] = { meals:{ breakfast:[], lunch:[], dinner:[], snack:[] }, water:0, workout:[] };
  }
  return st[date];
}
function dayTotals(date){
  const d = dayData(date), t = { kcal:0, p:0, f:0, c:0, s:0, sUnknown:0 };
  if(!d) return t;
  MEALS.forEach(function(m){ (d.meals[m.id] || []).forEach(function(x){ t.kcal += x.kcal; t.p += x.p; t.f += x.f; t.c += x.c; if(x.s == null) t.sUnknown++; else t.s += x.s; }); });
  return t;
}
function mealTotals(d, meal){
  return (d && d.meals[meal] || []).reduce(function(t, x){ return { kcal:t.kcal + x.kcal, p:t.p + x.p, f:t.f + x.f, c:t.c + x.c, s:t.s + (x.s || 0) }; }, { kcal:0, p:0, f:0, c:0, s:0 });
}
function hasFood(date){
  const d = dayData(date);
  return !!d && MEALS.some(function(m){ return (d.meals[m.id] || []).length > 0; });
}
/* дни, в которые была записана еда — из них считается стрик */
function loggedDays(){
  if(!ME || !ME.profile.diary) return [];
  return Object.keys(ME.profile.diary).filter(hasFood).sort();
}
/* сахар может быть неизвестен (старые записи, товар без данных) — тогда «—» */
function sv(v){ return v == null || isNaN(v) ? '—' : r1(v); }
/* ориентир по сахару: ВОЗ советует добавленного сахара не больше 10% калорий (≈ 4 ккал в грамме) */
function sugarGuide(){ return Math.round((norm.kcal || 2000) * 0.10 / 4); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function r1(v){ return Math.round(v * 10) / 10; }

function addFoodToDiary(date, meal, item){
  const d = dayData(date, true);
  item.id = uid();
  d.meals[meal].push(item);
  save();
  renderDiary({ flash: item.id });
  toast('Добавил в «' + MEALS.find(function(m){ return m.id === meal; }).label + '»');
  achCheck();
}
function delFood(meal, id){
  const d = dayData(dDate); if(!d) return;
  const el = document.querySelector('[data-food="' + id + '"]');
  const done = function(){
    d.meals[meal] = d.meals[meal].filter(function(x){ return x.id !== id; });
    save(); renderDiary(); achCheck(true);
  };
  if(el){ el.classList.add('out'); setTimeout(done, 220); } else done();
}

/* ---------- отрисовка дневника ---------- */
function renderDiary(opt){
  if(!ME) return;
  opt = opt || {};
  if(!dDate) dDate = today();
  renderWeekStrip();
  renderSummary();
  renderMeals(opt.flash);
  renderWorkout(opt.flash);
  renderWater();
  $('dDateLabel').textContent = humanDate(dDate);
}

function renderWeekStrip(){
  const start = mondayOf(dDate), t = today();
  const fs = FoodStreak.get();
  $('dStreakN').textContent = fs.current;
  $('dStreakTxt').textContent = plural(fs.current, 'день', 'дня', 'дней') + ' подряд';
  $('dStreakBest').textContent = 'рекорд ' + fs.best;
  $('dStreak').classList.toggle('hot', fs.current > 0);
  let html = '';
  for(let i = 0; i < 7; i++){
    const ds = addDays(start, i), tot = dayTotals(ds).kcal;
    const pct = Math.min(100, norm.kcal ? tot / norm.kcal * 100 : 0);
    const cls = ['wday'];
    if(ds === dDate) cls.push('sel');
    if(ds === t) cls.push('today');
    if(hasFood(ds)) cls.push('logged');
    if(ds > t) cls.push('future');
    html += '<button type="button" class="' + cls.join(' ') + '" data-day="' + ds + '">' +
      '<span class="wd-n">' + WEEKDAYS[i] + '</span><b>' + parseDate(ds).getDate() + '</b>' +
      '<i class="wd-bar"><em style="height:' + pct + '%"></em></i>' +
      '<span class="wd-fire">' + FIRE + '</span></button>';
  }
  $('dWeek').innerHTML = html;
}

function renderSummary(){
  const t = dayTotals(dDate), goal = norm.kcal || 2000;
  const eaten = Math.round(t.kcal), left = goal - eaten;
  const pct = Math.min(1, eaten / goal);
  const ring = $('dRing'), C = 2 * Math.PI * 52;
  ring.style.strokeDasharray = C;
  requestAnimationFrame(function(){ ring.style.strokeDashoffset = C * (1 - pct); });
  $('dRingWrap').classList.toggle('over', left < 0);
  animateNum($('dEaten'), dAnimKcal, eaten, '', 600);
  dAnimKcal = eaten;
  $('dGoal').textContent = '/ ' + goal.toLocaleString('ru-RU') + ' ккал';
  $('dLine1').innerHTML = 'Потреблено <b>' + eaten.toLocaleString('ru-RU') + ' / ' + goal.toLocaleString('ru-RU') + ' ккал</b>';
  $('dLine2').innerHTML = left >= 0
    ? 'Осталось <b>' + left.toLocaleString('ru-RU') + ' ккал</b> до ' + goal.toLocaleString('ru-RU')
    : '<span class="over">Перебор на <b>' + (-left).toLocaleString('ru-RU') + ' ккал</b></span>';
  const mac = [['p','Белки',norm.p,'#C9F45C'],['f','Жиры',norm.f,'#5FD08C'],['c','Углеводы',norm.c,'#4C8DFF'],['s','Сахар',sugarGuide(),'#FF9AC1']];
  $('dMacros').innerHTML = mac.map(function(m){
    const v = Math.round(t[m[0]]), g = m[2] || 1, w = Math.min(100, v / g * 100);
    const sugar = m[0] === 's';
    const note = sugar
      ? (v <= g ? 'ориентир до ' + g + ' г' : 'выше ориентира на ' + (v - g) + ' г') + (t.sUnknown ? ' · без данных: ' + t.sUnknown : '')
      : (v <= g ? 'осталось ' + (g - v) + ' г' : 'сверх нормы на ' + (v - g) + ' г');
    return '<div class="dmac' + (sugar ? ' sugar' + (v > g ? ' over' : '') : '') + '"' + (sugar ? ' title="Сахар всего (включая фрукты и молоко). Ориентир ВОЗ: добавленного сахара — не больше 10% калорий."' : '') + '>' +
      '<div class="dmac-h"><span>' + m[1] + '</span><b>' + v + ' <small>' + (sugar ? 'г' : '/ ' + g + ' г') + '</small></b></div>' +
      '<i class="dmac-bar"><em style="width:' + w + '%;background:' + m[3] + '"></em></i>' +
      '<small class="dmac-l">' + note + '</small></div>';
  }).join('');
}

function foodLine(x){
  const amount = x.grams ? Math.round(x.grams) + ' г' : (x.portion || '1 порция');
  return amount + ' · Б ' + r1(x.p) + ' · Ж ' + r1(x.f) + ' · У ' + r1(x.c) + ' · Сахар ' + sv(x.s);
}
function renderMeals(flash){
  const d = dayData(dDate);
  $('dMeals').innerHTML = MEALS.map(function(m){
    const items = d ? d.meals[m.id] : [];
    const tt = mealTotals(d, m.id), rec = Math.round((norm.kcal || 2000) * m.share / 10) * 10;
    return '<div class="dcard dmeal" data-meal="' + m.id + '">' +
      '<div class="dcard-h">' +
        '<span class="dcard-ic">' + m.icon + '</span>' +
        '<div class="dcard-t"><b>' + m.label + '</b><span>' + (items.length ? Math.round(tt.kcal) + ' ккал · сахар ' + Math.round(tt.s) + ' г · ' : '') + 'рекомендуем ~' + rec + ' ккал</span></div>' +
        '<button type="button" class="dplus" aria-label="Добавить в ' + m.label + '" onclick="openFoodModal(\'' + m.id + '\')">' + D_ICON.plus + '</button>' +
      '</div>' +
      (items.length ? '<div class="dlist">' + items.map(function(x){
        return '<div class="ditem' + (x.id === flash ? ' flash' : '') + '" data-food="' + x.id + '">' +
          '<div class="ditem-t"><b>' + esc(x.name) + (x.brand && x.name.toLowerCase().indexOf(x.brand.toLowerCase()) < 0 ? ' <small>' + esc(x.brand) + '</small>' : '') + '</b><span>' + foodLine(x) + '</span></div>' +
          '<b class="ditem-k">' + Math.round(x.kcal) + '<small> ккал</small></b>' +
          '<button type="button" class="ditem-x" aria-label="Удалить" onclick="delFood(\'' + m.id + '\',\'' + x.id + '\')">' + D_ICON.x + '</button></div>';
      }).join('') + '</div>' : '') +
    '</div>';
  }).join('');
}

/* ---------- тренировка ---------- */
function setsSummary(sets){
  // группирует одинаковые подходы: 3×10 · 60 кг
  const groups = [];
  sets.forEach(function(s){
    const last = groups[groups.length - 1];
    if(last && last.reps === s.reps && last.kg === s.kg) last.n++;
    else groups.push({ n:1, reps:s.reps, kg:s.kg });
  });
  return groups.map(function(g){ return '<span>' + (g.n > 1 ? g.n + '×' : '') + g.reps + (g.kg ? ' × ' + r1(g.kg) + ' кг' : ' повт.') + '</span>'; }).join('');
}
function woVolume(w){ return w.sets.reduce(function(s, x){ return s + (x.reps || 0) * (x.kg || 0); }, 0); }
function renderWorkout(flash){
  const d = dayData(dDate), list = d ? d.workout : [];
  const vol = list.reduce(function(s, w){ return s + woVolume(w); }, 0);
  const sets = list.reduce(function(s, w){ return s + w.sets.length; }, 0);
  $('dWoSub').textContent = list.length
    ? list.length + ' ' + plural(list.length, 'упражнение', 'упражнения', 'упражнений') + ' · ' + sets + ' ' + plural(sets, 'подход', 'подхода', 'подходов') + (vol ? ' · объём ' + Math.round(vol).toLocaleString('ru-RU') + ' кг' : '')
    : 'Запиши упражнения, подходы и рабочие веса';
  $('dWoList').innerHTML = list.length ? list.map(function(w){
    return '<div class="ditem wo' + (w.id === flash ? ' flash' : '') + '" data-food="' + w.id + '">' +
      '<div class="ditem-t"><b>' + esc(w.name) + '</b><div class="wsets">' + setsSummary(w.sets) + '</div></div>' +
      '<button type="button" class="ditem-e" aria-label="Изменить" onclick="openWorkoutModal(\'' + w.id + '\')">' + D_ICON.edit + '</button>' +
      '<button type="button" class="ditem-x" aria-label="Удалить" onclick="delWorkout(\'' + w.id + '\')">' + D_ICON.x + '</button></div>';
  }).join('') : '';
  // вес тела за выбранный день + мини-график
  const w = sortedW(), onDay = w.find(function(x){ return x.date === dDate; });
  $('dBwVal').textContent = onDay ? onDay.kg.toFixed(1) + ' кг' : (w.length ? 'последний: ' + w[w.length-1].kg.toFixed(1) + ' кг' : 'ещё не записан');
  $('dBwInput').placeholder = w.length ? w[w.length-1].kg.toFixed(1) : '75.0';
  $('dSpark').innerHTML = sparkline(w.slice(-10).map(function(x){ return x.kg; }));
}
function delWorkout(id){
  const d = dayData(dDate); if(!d) return;
  const el = document.querySelector('[data-food="' + id + '"]');
  const done = function(){ d.workout = d.workout.filter(function(x){ return x.id !== id; }); save(); renderDiary(); };
  if(el){ el.classList.add('out'); setTimeout(done, 220); } else done();
}
function sparkline(vals){
  if(vals.length < 2) return '<svg viewBox="0 0 100 30"><path d="M2 20 H98" class="sp-empty"/></svg>';
  const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = (mx - mn) || 1;
  const pts = vals.map(function(v, i){ return [2 + 96 * i / (vals.length - 1), 26 - 22 * (v - mn) / rg]; });
  const line = pts.map(function(p, i){ return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  const last = pts[pts.length - 1];
  return '<svg viewBox="0 0 100 30"><path d="' + line + ' L98 30 L2 30 Z" class="sp-fill"/><path d="' + line + '" class="sp-line"/>' +
    '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.6" class="sp-dot"/></svg>';
}

/* ---------- вода ---------- */
function waterGoal(){
  const w = ME.profile.weight || 70;
  return Math.max(1500, Math.min(4000, Math.round(w * 30 / 250) * 250));   // ~30 мл на кг веса
}
function renderWater(){
  const d = dayData(dDate), ml = d ? d.water : 0, goal = waterGoal();
  const n = goal / 250, full = Math.floor(ml / 250);
  $('dWaterVal').innerHTML = '<b>' + ml.toLocaleString('ru-RU') + '</b> / ' + goal.toLocaleString('ru-RU') + ' мл';
  $('dWaterSub').textContent = ml >= goal ? 'Цель на день выполнена 🎉' : 'Осталось ' + (goal - ml).toLocaleString('ru-RU') + ' мл · ~' + Math.ceil((goal - ml) / 250) + ' ' + plural(Math.ceil((goal - ml) / 250), 'стакан', 'стакана', 'стаканов');
  $('dWaterFill').style.width = Math.min(100, ml / goal * 100) + '%';
  let g = '';
  // на сенсорных экранах стаканы — индикатор (управление кнопками −/+250 размером 44px), на ПК — кликабельные
  const tap = !window.matchMedia('(max-width:900px), (pointer:coarse)').matches;
  for(let i = 0; i < n; i++) g += tap
    ? '<button type="button" class="glass' + (i < full ? ' on' : '') + '" data-glass="' + i + '" aria-label="Стакан ' + (i+1) + '"><i></i></button>'
    : '<span class="glass' + (i < full ? ' on' : '') + '" aria-hidden="true"><i></i></span>';
  $('dGlasses').innerHTML = g;
  $('dWaterCard').classList.toggle('done', ml >= goal);
}
function setWater(ml){
  const d = dayData(dDate, true);
  d.water = Math.max(0, Math.min(6000, ml));
  save(); renderWater();
}

/* ================= ДОБАВЛЕНИЕ ЕДЫ ================= */
let fMealSel = 'breakfast', fPick = null, fOffCache = {};

function openFoodModal(meal){
  fMealSel = meal || 'breakfast';
  segSet('fMealSeg', fMealSel);
  foodTab('search');
  showPortion(null);
  $('fQ').value = '';
  $('fNotFound').style.display = 'none';
  renderLocalResults('');
  $('fOffRes').innerHTML = '';
  $('fOffStatus').textContent = '';
  $('foodModal').classList.add('on');
  setTimeout(function(){ if(window.innerWidth > 700) $('fQ').focus(); }, 80);
}
function closeFoodModal(){ Scanner.stop(); $('foodModal').classList.remove('on'); }
function foodTab(t){
  segSet('fTabs', t);
  ['search','barcode','photo','manual'].forEach(function(x){ $('fPane-' + x).style.display = x === t ? '' : 'none'; });
  if(t !== 'barcode') Scanner.stop();
  if(t === 'photo') renderVisionCfg();
}

/* ---- ручной поиск с автодополнением ---- */
function normTxt(s){ return String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9% ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function localSearch(q){
  const nq = normTxt(q);
  const recipes = ALL_RECIPES.map(function(r){ return { id:'r' + r.id, name:r.name, kcal:r.kcal, p:r.p, f:r.f, c:r.c, s:r.s, per100:false, src:'recipe', cat:r.shake ? 'Коктейль с сайта' : 'Рецепт с сайта' }; });
  const all = FOODS.concat(recipes);
  if(!nq){
    // без запроса — недавние продукты пользователя
    return recentFoods();
  }
  const words = nq.split(' ');
  return all.map(function(x){
    const n = normTxt(x.name);
    if(!words.every(function(w){ return n.indexOf(w) >= 0; })) return null;
    let score = (n.indexOf(nq) === 0 ? 0 : n.indexOf(' ' + words[0]) >= 0 || n.indexOf(words[0]) === 0 ? 1 : 2) + n.length / 100;
    if(x.cat === 'Крупы сухие') score += .6;          // сначала готовые блюда, сухие крупы — ниже
    if(x.src === 'recipe') score += .3;
    return { x:x, s:score };
  }).filter(Boolean).sort(function(a, b){ return a.s - b.s; }).slice(0, 12).map(function(o){ return o.x; });
}
function recentFoods(){
  const seen = {}, out = [];
  Object.keys(diaryStore()).sort().reverse().forEach(function(ds){
    const d = diaryStore()[ds];
    MEALS.forEach(function(m){ (d.meals[m.id] || []).slice().reverse().forEach(function(x){
      if(out.length >= 8 || seen[x.name] || !x.base) return;
      seen[x.name] = 1; out.push(Object.assign({}, x.base, { recent:true }));
    }); });
  });
  return out;
}
function hl(name, q){
  const nq = normTxt(q); if(!nq) return esc(name);
  const i = name.toLowerCase().replace(/ё/g, 'е').indexOf(nq.split(' ')[0]);
  if(i < 0) return esc(name);
  const w = nq.split(' ')[0].length;
  return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + w)) + '</mark>' + esc(name.slice(i + w));
}
function resultRow(x, q, key){
  return '<button type="button" class="fres" data-key="' + key + '">' +
    '<span class="fres-t"><b>' + hl(x.name, q) + '</b><small>' + (x.brand ? esc(x.brand) + ' · ' : '') + (x.recent ? 'недавнее · ' : '') + (x.cat ? esc(x.cat) + ' · ' : '') +
    'Б ' + x.p + ' · Ж ' + x.f + ' · У ' + x.c + ' · Сахар ' + sv(x.s) + (x.per100 ? ' на 100 г' : ' на порцию') + '</small></span>' +
    '<span class="fres-k"><b>' + Math.round(x.kcal) + '</b><small>' + (x.per100 ? 'ккал/100 г' : 'ккал/порц.') + '</small></span></button>';
}
let fLocalList = [], fOffList = [];
function renderLocalResults(q){
  fLocalList = localSearch(q);
  if(!q.trim() && !fLocalList.length){
    $('fRes').innerHTML = '<div class="fhint">Начни вводить: «гречка», «творог 5», «банан»… Подсказки появляются сразу. Магазинные продукты — кнопкой ниже.</div>';
    return;
  }
  $('fRes').innerHTML = (q.trim() ? '' : '<div class="fsub">Недавнее</div>') +
    (fLocalList.length ? fLocalList.map(function(x, i){ return resultRow(x, q, 'l' + i); }).join('')
      : '<div class="fhint">В базе сайта не нашлось «' + esc(q) + '». Найди в магазинных продуктах или добавь свой.</div>');
}

/* ---- OpenFoodFacts: база продуктов со штрих-кодами, в т.ч. российских ----
   Лимиты OFF: 15 запросов/мин на товар и 10/мин на поиск, поиск «на каждую букву» запрещён —
   поэтому поиск по магазинным товарам запускается по кнопке или Enter и кэшируется. */
const OFF = {
  fields: 'code,product_name,product_name_ru,generic_name_ru,brands,quantity,serving_quantity,nutriments,countries_tags',
  timeout: function(ms){ const c = new AbortController(); setTimeout(function(){ c.abort(); }, ms); return c.signal; },
  parse: function(p){
    if(!p) return null;
    const n = p.nutriments || {};
    let kcal = n['energy-kcal_100g'];
    if(kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
    const name = p.product_name_ru || p.product_name || p.generic_name_ru || '';
    if(kcal == null || !name) return null;
    const brand = (p.brands || '').split(',')[0].trim();
    const ru = (p.countries_tags || []).indexOf('en:russia') >= 0 || /^46\d/.test(p.code || '');
    return { id:'o' + p.code, code:p.code, name:name.trim(), brand:brand, kcal:r1(+kcal), p:r1(+(n.proteins_100g || 0)), f:r1(+(n.fat_100g || 0)), c:r1(+(n.carbohydrates_100g || 0)),
      s:(n.sugars_100g != null && n.sugars_100g !== '') ? r1(+n.sugars_100g) : null,
      per100:true, portion:Math.round(+p.serving_quantity) || 100, qty:p.quantity || '', src:'off', ru:ru, cat:ru ? 'Россия' : '' };
  },
  byBarcode: async function(code){
    const url = 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json?lc=ru&cc=ru&app_name=WSPORT&fields=' + this.fields;
    const res = await fetch(url, { signal:this.timeout(12000) });
    if(res.status === 404) return null;
    if(res.status === 429) throw new Error('rate');
    if(!res.ok) throw new Error('http ' + res.status);
    const j = await res.json();
    if(j.status !== 1 && j.status !== 'success') return null;
    return this.parse(j.product);
  },
  search: async function(q){
    const key = normTxt(q);
    if(fOffCache[key]) return fOffCache[key];
    let list = null;
    try {   // основной: Search-a-licious (полнотекстовый поиск OFF)
      const r = await fetch('https://search.openfoodfacts.org/search?q=' + encodeURIComponent(q) + '&langs=ru&page_size=24&fields=' + this.fields, { signal:this.timeout(12000) });
      if(r.ok){ const j = await r.json(); list = j.hits || j.products || []; }
      else if(r.status === 429) throw new Error('rate');
    } catch(e){ if(e.message === 'rate') throw e; }
    if(!list){   // запасной: классический поиск с фильтром по России
      const r = await fetch('https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=24&lc=ru&cc=ru&fields=' + this.fields, { signal:this.timeout(15000) });
      if(r.status === 429) throw new Error('rate');
      if(!r.ok) throw new Error('http ' + r.status);
      const j = await r.json(); list = j.products || [];
    }
    const out = list.map(this.parse.bind(this)).filter(Boolean)
      .sort(function(a, b){ return (b.ru - a.ru); });   // российские товары — первыми
    fOffCache[key] = out;
    return out;
  }
};
async function offSearch(){
  const q = $('fQ').value.trim();
  if(q.length < 2){ $('fOffStatus').textContent = 'Введи хотя бы 2 буквы.'; return; }
  $('fOffStatus').innerHTML = '<span class="spin"></span> Ищу в OpenFoodFacts…';
  $('fOffRes').innerHTML = '';
  try {
    fOffList = await OFF.search(q);
    $('fOffStatus').textContent = fOffList.length ? 'Найдено: ' + fOffList.length + (fOffList.some(function(x){ return x.ru; }) ? ' · российские товары сверху' : '') : 'Ничего не нашлось. Попробуй короче или по штрих-коду.';
    $('fOffRes').innerHTML = fOffList.map(function(x, i){ return resultRow(x, q, 'o' + i); }).join('');
  } catch(e){
    $('fOffStatus').textContent = e.message === 'rate' ? 'Слишком много запросов к базе — подожди минуту.' : 'База продуктов не ответила. Проверь интернет и попробуй ещё раз.';
  }
}

/* ---- выбор порции ---- */
function showPortion(item){
  fPick = item;
  $('fPortion').style.display = item ? '' : 'none';
  $('fMain').style.display = item ? 'none' : '';
  if(!item) return;
  $('fpName').textContent = item.name;
  $('fpBrand').textContent = [item.brand, item.qty, item.code ? 'штрих-код ' + item.code : ''].filter(Boolean).join(' · ');
  $('fpPer').textContent = item.per100
    ? 'На 100 г: ' + item.kcal + ' ккал · Б ' + item.p + ' · Ж ' + item.f + ' · У ' + item.c + ' · Сахар ' + (item.s == null ? 'нет данных' : item.s)
    : 'На 1 порцию: ' + item.kcal + ' ккал · Б ' + item.p + ' · Ж ' + item.f + ' · У ' + item.c + ' · Сахар ' + (item.s == null ? 'нет данных' : item.s);
  $('fpUnit').textContent = item.per100 ? 'г' : 'порц.';
  $('fpAmount').step = item.per100 ? 5 : 0.5;
  $('fpAmount').value = item.per100 ? (item.portion || 100) : 1;
  const chips = item.per100 ? [50, 100, 150, 200, 250].concat(item.portion && [50,100,150,200,250].indexOf(item.portion) < 0 ? [item.portion] : []) : [0.5, 1, 1.5, 2];
  $('fpChips').innerHTML = chips.sort(function(a, b){ return a - b; }).map(function(v){
    return '<button type="button" class="chip" data-v="' + v + '">' + (item.per100 ? v + ' г' : v + ' порц.') + '</button>';
  }).join('');
  updatePortion();
}
function portionCalc(){
  const a = Math.max(0, parseFloat(String($('fpAmount').value).replace(',', '.')) || 0);
  const k = fPick.per100 ? a / 100 : a;
  return { a:a, kcal:fPick.kcal * k, p:fPick.p * k, f:fPick.f * k, c:fPick.c * k, s:fPick.s == null ? null : fPick.s * k };
}
function updatePortion(){
  if(!fPick) return;
  const r = portionCalc();
  $('fpRes').innerHTML = '<div class="fpk"><b>' + Math.round(r.kcal) + '</b><span>ккал</span></div>' +
    '<div class="fpk"><b>' + r1(r.p) + '</b><span>белки</span></div><div class="fpk"><b>' + r1(r.f) + '</b><span>жиры</span></div><div class="fpk"><b>' + r1(r.c) + '</b><span>углеводы</span></div>' +
    '<div class="fpk sugar"><b>' + sv(r.s) + '</b><span>сахар' + (r.s == null ? ' · нет данных' : '') + '</span></div>';
  $('fpChips').querySelectorAll('.chip').forEach(function(c){ c.classList.toggle('on', +c.dataset.v === r.a); });
  $('fpAdd').textContent = 'Добавить в «' + MEALS.find(function(m){ return m.id === fMealSel; }).label + '»';
}
function addPicked(){
  const r = portionCalc();
  if(!r.a){ toast('Укажи количество'); return; }
  const base = Object.assign({}, fPick); delete base.recent;
  addFoodToDiary(dDate, fMealSel, {
    name:fPick.name, brand:fPick.brand || '', grams:fPick.per100 ? r.a : null,
    portion:fPick.per100 ? null : (r.a === 1 ? '1 порция' : r.a + ' ' + plural(Math.ceil(r.a), 'порция', 'порции', 'порций')),
    kcal:r1(r.kcal), p:r1(r.p), f:r1(r.f), c:r1(r.c), s:r.s == null ? null : r1(r.s), src:fPick.src, base:base
  });
  closeFoodModal();
}

/* ---- свой продукт ---- */
function addManual(){
  const name = $('fmName').value.trim();
  const g = parseFloat($('fmGrams').value) || 0;
  const vals = ['fmKcal','fmP','fmF','fmC','fmS'].map(function(id){ return Math.max(0, parseFloat(String($(id).value).replace(',', '.')) || 0); });
  const sKnown = String($('fmS').value).trim() !== '';
  if(!name){ toast('Впиши название'); return; }
  if(!vals[0]){ toast('Укажи калории'); return; }
  const per100 = segGet('fmMode') === '100';
  const k = per100 ? g / 100 : 1;
  if(per100 && !g){ toast('Укажи вес порции'); return; }
  addFoodToDiary(dDate, fMealSel, {
    name:name, brand:$('fmCode').value ? 'штрих-код ' + $('fmCode').value : '', grams:g || null, portion:g ? null : '1 порция',
    kcal:r1(vals[0] * k), p:r1(vals[1] * k), f:r1(vals[2] * k), c:r1(vals[3] * k), s:sKnown ? r1(vals[4] * k) : null, src:'manual',
    base:per100 ? { id:'m' + uid(), name:name, kcal:vals[0], p:vals[1], f:vals[2], c:vals[3], s:sKnown ? vals[4] : null, per100:true, portion:g || 100, src:'manual' } : null
  });
  closeFoodModal();
}

/* ================= СКАНЕР ШТРИХ-КОДОВ (v2) =================
   Движки распознавания (выбирается первый доступный):
     1) встроенный BarcodeDetector — Chrome на Android, Samsung Internet, Edge: быстрый, на ML-модели телефона;
     2) BarcodeDetector-полифилл на WASM-сборке zxing-cpp (пакет barcode-detector) — iPhone/Safari, Firefox, ПК;
        грузится с CDN только при первом скане (~1 МБ, дальше из кэша);
     3) запасной — JS-версия ZXing.
   Камера: задняя по умолчанию (для iPhone с несколькими объективами выбирается основной, а не широкоугольный),
   высокое разрешение, непрерывный автофокус и лёгкий зум, если телефон их поддерживает, фонарик.
   Распознаётся только центральная зона кадра под рамкой — быстрее и меньше ложных срабатываний.
   Код принимается после двух одинаковых чтений подряд и проверки контрольной цифры EAN. */
const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
function eanValid(code){
  if(!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const d = code.split('').map(Number), chk = d.pop();
  const sum = d.reverse().reduce(function(s, v, i){ return s + v * (i % 2 === 0 ? 3 : 1); }, 0);
  return (10 - sum % 10) % 10 === chk;
}
function loadScript(urls){
  return urls.reduce(function(p, u){
    return p.catch(function(){ return new Promise(function(ok, bad){
      const s = document.createElement('script'); s.src = u; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = ok; s.onerror = function(){ s.remove(); bad(new Error('load ' + u)); };
      document.head.appendChild(s);
    }); });
  }, Promise.reject());
}
const ScanEngine = {
  kind:null, det:null,
  get: async function(){
    if(this.det) return this.det;
    // 1. встроенный
    if('BarcodeDetector' in window){
      try {
        const sup = await window.BarcodeDetector.getSupportedFormats();
        const f = SCAN_FORMATS.filter(function(x){ return sup.indexOf(x) >= 0; });
        if(f.length){ this.det = new window.BarcodeDetector({ formats:f }); this.kind = 'native'; return this.det; }
      } catch(e){}
    }
    // 2. WASM-полифилл (zxing-cpp)
    const esm = ['https://cdn.jsdelivr.net/npm/barcode-detector@3/dist/es/pure.min.js',
                 'https://cdn.jsdelivr.net/npm/barcode-detector@2/dist/es/pure.min.js',
                 'https://unpkg.com/barcode-detector@2/dist/es/pure.min.js'];
    for(let i = 0; i < esm.length; i++){
      try {
        const m = await import(esm[i]);
        const BD = m.BarcodeDetector || (m.default && m.default.BarcodeDetector);
        if(BD){ this.det = new BD({ formats:SCAN_FORMATS }); this.kind = 'wasm'; return this.det; }
      } catch(e){}
    }
    // 3. JS ZXing
    await loadScript(['https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js',
                      'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js']);
    const Z = window.ZXing;
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const reader = new Z.MultiFormatReader(); reader.setHints(hints);
    this.det = { detect: async function(canvas){
      try {
        const src = new Z.HTMLCanvasElementLuminanceSource(canvas);
        const r = reader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(src)));
        return [{ rawValue:r.getText() }];
      } catch(e){ return []; }
    } };
    this.kind = 'zxing';
    return this.det;
  }
};

const Scanner = {
  stream:null, track:null, running:false, busy:false, frameId:null, cv:null, ctx:null,
  last:'', lastAt:0, t0:0, torchOn:false, hintLevel:0,
  canvas: function(){
    if(!this.cv){ this.cv = document.createElement('canvas'); this.ctx = this.cv.getContext('2d', { willReadFrequently:true }); }
    return this.cv;
  },
  pickBackCamera: async function(){
    // у iPhone/многокамерных Android: берём основную заднюю, а не «ultra wide» (она не фокусируется вблизи)
    try {
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter(function(d){ return d.kind === 'videoinput'; });
      const back = devs.filter(function(d){ return /back|rear|environment|задн|тыл/i.test(d.label); });
      const main = back.filter(function(d){ return !/ultra|wide|широк|tele|zoom|depth|macro/i.test(d.label); });
      return (main[0] || back[back.length - 1] || null);
    } catch(e){ return null; }
  },
  start: async function(){
    if(this.running) return;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      bcStatus('Камера недоступна в этом браузере. Введи цифры под штрих-кодом или сфоткай его.', 'warn'); return;
    }
    if(!window.isSecureContext){ bcStatus('Камера работает только по https. Введи код вручную.', 'warn'); return; }
    $('bcStart').disabled = true;
    bcStatus('<span class="spin"></span> Включаю камеру…');
    const base = { width:{ ideal:1920 }, height:{ ideal:1080 }, frameRate:{ ideal:30 } };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:Object.assign({ facingMode:{ ideal:'environment' } }, base) });
      // после разрешения видны названия камер — переключаемся на основную заднюю, если выбрана не она
      const cam = await this.pickBackCamera();
      const cur = this.stream.getVideoTracks()[0].getSettings().deviceId;
      if(cam && cam.deviceId && cam.deviceId !== cur){
        try {
          const s2 = await navigator.mediaDevices.getUserMedia({ audio:false, video:Object.assign({ deviceId:{ exact:cam.deviceId } }, base) });
          this.stream.getTracks().forEach(function(t){ t.stop(); }); this.stream = s2;
        } catch(e){}
      }
    } catch(e){
      $('bcStart').disabled = false;
      bcStatus(e.name === 'NotAllowedError' ? 'Нет доступа к камере — разреши его в настройках браузера или введи код вручную.'
             : e.name === 'NotFoundError' ? 'Камера не найдена. Введи цифры под штрих-кодом вручную.'
             : 'Не удалось включить камеру. Введи код вручную или сфоткай штрих-код.', 'warn');
      return;
    }
    this.track = this.stream.getVideoTracks()[0];
    await this.tuneCamera();
    const v = $('bcVideo');
    v.setAttribute('playsinline', ''); v.muted = true; v.srcObject = this.stream;
    try { await v.play(); } catch(e){}
    $('bcBox').classList.add('live');
    $('bcStart').style.display = 'none'; $('bcStart').disabled = false; $('bcStop').style.display = '';
    bcStatus('<span class="spin"></span> Загружаю распознавание…');
    try { await ScanEngine.get(); }
    catch(e){ this.stop(); bcStatus('Сканер не загрузился — проверь интернет. Пока можно ввести цифры под штрих-кодом.', 'warn'); return; }
    this.running = true; this.t0 = Date.now(); this.last = ''; this.hintLevel = 0;
    bcStatus('Идёт поиск… Наведи рамку на штрих-код');
    this.loop();
  },
  tuneCamera: async function(){
    const t = this.track; if(!t || !t.getCapabilities) { $('bcTorch').style.display = 'none'; return; }
    const c = t.getCapabilities(), adv = {};
    if(c.focusMode && c.focusMode.indexOf('continuous') >= 0) adv.focusMode = 'continuous';
    if(c.exposureMode && c.exposureMode.indexOf('continuous') >= 0) adv.exposureMode = 'continuous';
    if(c.whiteBalanceMode && c.whiteBalanceMode.indexOf('continuous') >= 0) adv.whiteBalanceMode = 'continuous';
    // лёгкий зум: можно держать телефон подальше — камера сфокусируется, а код будет крупным
    if(c.zoom && c.zoom.max >= 1.6) adv.zoom = Math.min(c.zoom.max, Math.max(c.zoom.min || 1, 1.6));
    if(Object.keys(adv).length){ try { await t.applyConstraints({ advanced:[adv] }); } catch(e){} }
    $('bcTorch').style.display = c.torch ? '' : 'none';
    this.torchOn = false; $('bcTorch').classList.remove('on');
  },
  toggleTorch: async function(){
    if(!this.track) return;
    this.torchOn = !this.torchOn;
    try { await this.track.applyConstraints({ advanced:[{ torch:this.torchOn }] }); $('bcTorch').classList.toggle('on', this.torchOn); }
    catch(e){ this.torchOn = false; }
  },
  loop: function(){
    const self = this, v = $('bcVideo');
    const next = function(){
      if(!self.running) return;
      if(v.requestVideoFrameCallback) self.frameId = v.requestVideoFrameCallback(function(){ setTimeout(tick, 60); });
      else self.frameId = setTimeout(tick, 110);
    };
    const tick = async function(){
      if(!self.running) return;
      if(self.busy || v.readyState < 2 || !v.videoWidth){ next(); return; }
      self.busy = true;
      try {
        // центральная зона кадра (как рамка на экране): 80% ширины × 45% высоты, уменьшаем до ~960px
        const vw = v.videoWidth, vh = v.videoHeight;
        const sw = Math.round(vw * .8), sh = Math.round(vh * .45);
        const sx = Math.round((vw - sw) / 2), sy = Math.round((vh - sh) / 2);
        const k = Math.min(1, 960 / sw);
        const cv = self.canvas(); cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
        self.ctx.drawImage(v, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
        const res = await ScanEngine.det.detect(cv);
        const hit = (res || []).map(function(r){ return String(r.rawValue || '').replace(/\D/g, ''); }).find(eanValid);
        if(hit){
          const now = Date.now();
          // два одинаковых чтения подряд (для встроенного детектора хватает одного)
          if(ScanEngine.kind === 'native' || (hit === self.last && now - self.lastAt < 1500)){ self.found(hit); return; }
          self.last = hit; self.lastAt = now;
          bcStatus('Вижу код — держи ровно…');
        } else {
          self.hint(cv);
        }
      } catch(e){}
      self.busy = false;
      next();
    };
    next();
  },
  hint: function(cv){
    const t = Date.now() - this.t0;
    // яркость центральной зоны — если темно, подсказываем свет/фонарик
    let dark = false;
    if(t > 2500 && t % 5 < 2){
      try {
        const d = this.ctx.getImageData(0, 0, cv.width, cv.height).data; let sum = 0, n = 0;
        for(let i = 0; i < d.length; i += 64){ sum += d[i] * .3 + d[i+1] * .59 + d[i+2] * .11; n++; }
        dark = sum / n < 55;
      } catch(e){}
    }
    const lvl = dark ? 3 : t > 12000 ? 2 : t > 5000 ? 1 : 0;
    if(lvl === this.hintLevel) return;
    this.hintLevel = lvl;
    bcStatus([
      'Идёт поиск… Наведи рамку на штрих-код',
      'Подноси ближе — штрих-код должен занять почти всю рамку',
      'Не получается? Держи телефон ровно, без бликов — или введи цифры ниже',
      'Слишком темно — включи фонарик ' + ($('bcTorch').style.display === 'none' ? 'или добавь света' : 'кнопкой ⚡')
    ][lvl]);
  },
  stop: function(){
    this.running = false; this.busy = false;
    const v = $('bcVideo');
    if(this.frameId != null){ if(v && v.cancelVideoFrameCallback) try { v.cancelVideoFrameCallback(this.frameId); } catch(e){} clearTimeout(this.frameId); this.frameId = null; }
    if(this.stream){ this.stream.getTracks().forEach(function(t){ t.stop(); }); this.stream = null; this.track = null; }
    if(v) v.srcObject = null;
    if($('bcBox')){ $('bcBox').classList.remove('live', 'hit'); $('bcStart').style.display = ''; $('bcStart').disabled = false; $('bcStop').style.display = 'none'; $('bcTorch').style.display = 'none'; }
  },
  found: function(code){
    $('bcBox').classList.add('hit');
    if(navigator.vibrate) navigator.vibrate(60);
    setTimeout(this.stop.bind(this), 350);
    $('bcCode').value = code;
    lookupBarcode(code);
  },
  fromImage: async function(file){
    bcStatus('<span class="spin"></span> Ищу штрих-код на фото…');
    try {
      const det = await ScanEngine.get();
      const bmp = await createImageBitmap(file);
      // полное фото и увеличенная середина — на случай мелкого кода
      const cv = this.canvas(), tries = [[0, 0, bmp.width, bmp.height], [bmp.width * .15, bmp.height * .25, bmp.width * .7, bmp.height * .5]];
      for(let i = 0; i < tries.length; i++){
        const r = tries[i], k = Math.min(1, 1400 / r[2]);
        cv.width = Math.round(r[2] * k); cv.height = Math.round(r[3] * k);
        this.ctx.drawImage(bmp, r[0], r[1], r[2], r[3], 0, 0, cv.width, cv.height);
        const res = await det.detect(cv);
        const hit = (res || []).map(function(x){ return String(x.rawValue || '').replace(/\D/g, ''); }).find(eanValid);
        if(hit){ $('bcCode').value = hit; lookupBarcode(hit); return; }
      }
      bcStatus('На фото штрих-код не читается. Сфоткай ближе и без бликов — или введи цифры ниже.', 'warn');
    } catch(e){ bcStatus('Не получилось прочитать фото. Введи цифры под штрих-кодом.', 'warn'); }
  }
};
function bcStatus(html, kind){ const el = $('bcStatus'); el.innerHTML = html; el.className = 'bcstatus' + (kind ? ' ' + kind : ''); }
let bcLookupBusy = false;
async function lookupBarcode(code){
  code = String(code || '').replace(/\D/g, '');
  if(!code){ bcStatus('Введи цифры под штрих-кодом.', 'warn'); $('bcCode').focus(); return; }
  if(!eanValid(code)){ bcStatus('Проверь цифры: это не штрих-код EAN-13/EAN-8 — контрольная цифра не сходится.', 'warn'); return; }
  if(bcLookupBusy) return;
  bcLookupBusy = true; $('bcFind').disabled = true;
  bcStatus('<span class="spin"></span> Ищу товар ' + code + (/^46\d/.test(code) ? ' (российский)' : '') + '…');
  try {
    const p = await OFF.byBarcode(code);
    if(p){ bcStatus('Нашёл: ' + esc(p.name), 'ok'); Scanner.stop(); showPortion(p); return; }
    barcodeNotFound(code);
  } catch(e){
    if(e.message === 'rate'){ bcStatus('Слишком много сканов подряд — подожди минуту.', 'warn'); }
    else { barcodeNotFound(code, true); }
  } finally { bcLookupBusy = false; $('bcFind').disabled = false; }
}
/* товара нет в базе (или база не ответила) — не ошибка: аккуратно переводим в текстовый поиск */
function barcodeNotFound(code, offline){
  Scanner.stop();
  toast(offline ? 'База не ответила — найди товар по названию' : 'Товар не найден, попробуйте ввести вручную');
  foodTab('search');
  $('fNotFound').innerHTML = (offline ? 'База товаров сейчас недоступна.' : 'Штрих-кода <b>' + code + '</b> пока нет в открытой базе.') +
    ' Введи название продукта — или <button type="button" class="linkbtn" id="fNfManual">добавь свой с этим штрих-кодом</button>.';
  $('fNotFound').style.display = '';
  $('fNfManual').onclick = function(){ $('fmCode').value = code; $('fmName').value = $('fQ').value; foodTab('manual'); };
  $('fQ').value = ''; renderLocalResults('');
  setTimeout(function(){ $('fQ').focus(); }, 60);
}

/* ================= РАСПОЗНАВАНИЕ ЕДЫ ПО ФОТО (Vision AI) =================
   Архитектура: VisionAI.analyze(file) → { dish, items:[{name, grams, kcal, p, f, c}], confidence, note }.
   Провайдеры:
     • openai — прямой запрос к OpenAI (модель с поддержкой изображений, по умолчанию gpt-4o-mini)
       с личным ключом пользователя. Ключ хранится только в этом браузере.
     • proxy  — свой сервер (например, Cloudflare Worker): POST { image:dataURL } → тот же JSON.
       Это безопасный вариант для продакшена — ключ не попадает в браузер.
   Чтобы добавить другого провайдера (Gemini, Claude и т. п.) — допиши функцию в VisionAI.providers. */
const VisionAI = {
  key:'wsport-vision-cfg',
  cfg: function(){ try { return JSON.parse(localStorage.getItem(this.key)) || { provider:'openai', apiKey:'', model:'gpt-4o-mini', endpoint:'' }; } catch(e){ return { provider:'openai', apiKey:'', model:'gpt-4o-mini', endpoint:'' }; } },
  saveCfg: function(c){ try { localStorage.setItem(this.key, JSON.stringify(c)); } catch(e){} },
  ready: function(){ const c = this.cfg(); return c.provider === 'proxy' ? !!c.endpoint : !!c.apiKey; },
  prompt: 'Ты нутрициолог. На фото еда. Определи каждое блюдо/продукт на тарелке, оцени вес порции в граммах по размеру посуды и приборов, ' +
    'и посчитай калории, белки, жиры, углеводы и сахар (s, граммы; сахар всего, включая натуральный) для этого веса по стандартным таблицам. Названия — на русском. ' +
    'Ответь ТОЛЬКО JSON без пояснений: {"dish":"общее название","items":[{"name":"...","grams":150,"kcal":0,"p":0,"f":0,"c":0,"s":0}],"confidence":0.0-1.0,"note":"короткое замечание, если оценка неточная"}. ' +
    'Если на фото нет еды — {"dish":"","items":[],"confidence":0,"note":"На фото не видно еды"}.',
  downscale: function(file, max){
    return new Promise(function(ok, bad){
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function(){ URL.revokeObjectURL(url); bad(new Error('image')); };
      img.src = url;
    });
  },
  providers: {
    openai: async function(dataUrl, c){
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + c.apiKey },
        body: JSON.stringify({ model:c.model || 'gpt-4o-mini', temperature:0.2, response_format:{ type:'json_object' },
          messages:[ { role:'system', content:VisionAI.prompt },
                     { role:'user', content:[ { type:'text', text:'Что на тарелке и сколько в этом КБЖУ?' }, { type:'image_url', image_url:{ url:dataUrl, detail:'low' } } ] } ] })
      });
      if(r.status === 401) throw new Error('Ключ API не подошёл — проверь его в настройках.');
      if(r.status === 429) throw new Error('Лимит запросов или баланс OpenAI исчерпан.');
      if(!r.ok) throw new Error('Сервис распознавания ответил ошибкой ' + r.status + '.');
      const j = await r.json();
      return JSON.parse(j.choices[0].message.content);
    },
    proxy: async function(dataUrl, c){
      const r = await fetch(c.endpoint, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ image:dataUrl, prompt:VisionAI.prompt }) });
      if(!r.ok) throw new Error('Сервер распознавания ответил ошибкой ' + r.status + '.');
      return r.json();
    }
  },
  analyze: async function(file){
    const c = this.cfg();
    const fn = this.providers[c.provider];
    if(!fn || !this.ready()) throw new Error('need-config');
    const dataUrl = await this.downscale(file, 1024);
    const out = await fn(dataUrl, c);
    out.items = (out.items || []).map(function(x){
      return { name:String(x.name || 'Блюдо'), grams:Math.max(0, +x.grams || 0), kcal:Math.max(0, +x.kcal || 0), p:Math.max(0, +x.p || 0), f:Math.max(0, +x.f || 0), c:Math.max(0, +x.c || 0), s:(x.s == null || x.s === '') ? null : Math.max(0, +x.s || 0) };
    });
    return out;
  }
};
let aiFile = null, aiItems = [];
function renderVisionCfg(){
  const c = VisionAI.cfg();
  segSet('aiProv', c.provider);
  $('aiKey').value = c.apiKey || ''; $('aiModel').value = c.model || 'gpt-4o-mini'; $('aiEndpoint').value = c.endpoint || '';
  $('aiKeyRow').style.display = c.provider === 'openai' ? '' : 'none';
  $('aiEpRow').style.display = c.provider === 'proxy' ? '' : 'none';
  $('aiCfg').classList.toggle('need', !VisionAI.ready());
  $('aiCfgState').textContent = VisionAI.ready() ? (c.provider === 'openai' ? 'OpenAI · ' + (c.model || 'gpt-4o-mini') : 'свой сервер') : 'не настроено';
}
function aiPreview(file){
  aiFile = file; aiItems = [];
  $('aiResult').innerHTML = '';
  if(!file){ $('aiDrop').classList.remove('has'); $('aiImg').removeAttribute('src'); return; }
  $('aiImg').src = URL.createObjectURL(file);
  $('aiDrop').classList.add('has');
  $('aiGo').disabled = false;
}
async function aiRun(){
  if(!aiFile){ toast('Сначала сфотографируй тарелку'); return; }
  if(!VisionAI.ready()){ $('aiCfg').open = true; $('aiResult').innerHTML = '<div class="fhint warn">Чтобы ИИ распознал блюдо, вставь ключ API в настройках ниже (один раз).</div>'; return; }
  $('aiDrop').classList.add('scan'); $('aiGo').disabled = true;
  $('aiResult').innerHTML = '<div class="fhint"><span class="spin"></span> ИИ смотрит на тарелку, определяет блюда и вес порции…</div>';
  try {
    const out = await VisionAI.analyze(aiFile);
    aiItems = out.items;
    if(!aiItems.length){ $('aiResult').innerHTML = '<div class="fhint warn">' + esc(out.note || 'Не удалось распознать еду. Сфоткай сверху при хорошем свете.') + '</div>'; return; }
    aiItems.forEach(function(x){ x.k = x.grams ? { kcal:x.kcal / x.grams, p:x.p / x.grams, f:x.f / x.grams, c:x.c / x.grams, s:x.s == null ? null : x.s / x.grams } : null; });
    renderAiItems(out);
  } catch(e){
    $('aiResult').innerHTML = '<div class="fhint warn">' + esc(e.message === 'need-config' ? 'Нужен ключ API — открой настройки ниже.' : e.message === 'Failed to fetch' ? 'Нет связи с сервисом распознавания.' : e.message) + '</div>';
  } finally { $('aiDrop').classList.remove('scan'); $('aiGo').disabled = false; }
}
function renderAiItems(out){
  const tot = aiItems.reduce(function(t, x){ return { kcal:t.kcal + x.kcal, p:t.p + x.p, f:t.f + x.f, c:t.c + x.c, s:t.s + (x.s || 0) }; }, { kcal:0, p:0, f:0, c:0, s:0 });
  $('aiResult').innerHTML =
    (out && out.dish ? '<div class="ai-dish"><b>' + esc(out.dish) + '</b>' + (out.confidence != null ? '<span>уверенность ' + Math.round(out.confidence * 100) + '%</span>' : '') + '</div>' : '') +
    aiItems.map(function(x, i){
      return '<div class="ai-row"><input class="ai-n" data-i="' + i + '" value="' + esc(x.name) + '" aria-label="Название" />' +
        '<label class="ai-g"><input type="number" min="0" step="5" data-i="' + i + '" value="' + Math.round(x.grams) + '" aria-label="Вес, г" /> г</label>' +
        '<span class="ai-k">' + Math.round(x.kcal) + ' ккал<br><small>Б ' + r1(x.p) + ' Ж ' + r1(x.f) + ' У ' + r1(x.c) + ' Сахар ' + sv(x.s) + '</small></span></div>';
    }).join('') +
    '<div class="ai-tot">Итого: <b>' + Math.round(tot.kcal) + ' ккал</b> · Б ' + r1(tot.p) + ' · Ж ' + r1(tot.f) + ' · У ' + r1(tot.c) + ' · Сахар ' + r1(tot.s) + '</div>' +
    (out && out.note ? '<div class="fhint">' + esc(out.note) + '</div>' : '') +
    '<button class="btn wide" type="button" id="aiAdd">Добавить в «' + MEALS.find(function(m){ return m.id === fMealSel; }).label + '»</button>';
}

/* ================= ТРЕНИРОВКА: модалка ================= */
let woEditId = null;
function openWorkoutModal(id){
  woEditId = id || null;
  const d = dayData(dDate);
  const w = id && d ? d.workout.find(function(x){ return x.id === id; }) : null;
  $('woTitle').textContent = w ? 'Изменить упражнение' : 'Добавить упражнение';
  $('woName').value = w ? w.name : '';
  $('woSets').innerHTML = '';
  (w ? w.sets : [{ reps:10, kg:'' }]).forEach(function(s){ addSetRow(s.reps, s.kg); });
  // быстрый выбор: последние упражнения пользователя
  const recent = [];
  Object.keys(diaryStore()).sort().reverse().forEach(function(ds){ (diaryStore()[ds].workout || []).forEach(function(x){ if(recent.indexOf(x.name) < 0 && recent.length < 8) recent.push(x.name); }); });
  $('woRecent').innerHTML = recent.map(function(n){ return '<button type="button" class="chip" data-n="' + esc(n) + '">' + esc(n) + '</button>'; }).join('');
  $('woRecentWrap').style.display = recent.length ? '' : 'none';
  woLastHint();
  $('woModal').classList.add('on');
  setTimeout(function(){ if(!w && window.innerWidth > 700) $('woName').focus(); }, 80);
}
function addSetRow(reps, kg){
  const n = $('woSets').children.length + 1;
  const row = document.createElement('div');
  row.className = 'setrow';
  row.innerHTML = '<span class="set-n">' + n + '</span>' +
    '<label><input type="number" inputmode="numeric" min="1" max="200" class="set-r" value="' + (reps || '') + '" placeholder="10" /><small>повт.</small></label>' +
    '<span class="set-x">×</span>' +
    '<label><input type="number" inputmode="decimal" min="0" max="500" step="0.5" class="set-k" value="' + (kg === 0 || kg ? kg : '') + '" placeholder="0" /><small>кг</small></label>' +
    '<button type="button" class="set-del" aria-label="Удалить подход">' + D_ICON.x + '</button>';
  $('woSets').appendChild(row);
}
function renumberSets(){ Array.prototype.forEach.call($('woSets').children, function(r, i){ r.querySelector('.set-n').textContent = i + 1; }); }
function woLastHint(){
  // подсказка: что было в прошлый раз в этом упражнении — чтобы видеть прогресс
  const name = normTxt($('woName').value);
  if(!name){ $('woLast').textContent = ''; return; }
  const days = Object.keys(diaryStore()).sort().reverse();
  for(let i = 0; i < days.length; i++){
    if(days[i] === dDate && !woEditId) continue;
    const w = (diaryStore()[days[i]].workout || []).find(function(x){ return normTxt(x.name) === name; });
    if(w){
      const best = Math.max.apply(null, w.sets.map(function(s){ return s.kg || 0; }));
      $('woLast').innerHTML = 'Прошлый раз (' + humanDate(days[i]).toLowerCase() + '): ' + w.sets.map(function(s){ return s.reps + (s.kg ? '×' + r1(s.kg) : ''); }).join(', ') + (best ? ' · лучший вес <b>' + r1(best) + ' кг</b>' : '');
      return;
    }
  }
  $('woLast').textContent = '';
}
function saveWorkout(){
  const name = $('woName').value.trim();
  if(!name){ toast('Выбери или впиши упражнение'); $('woName').focus(); return; }
  const sets = Array.prototype.map.call($('woSets').children, function(r){
    return { reps:Math.round(+r.querySelector('.set-r').value || 0), kg:r1(+String(r.querySelector('.set-k').value).replace(',', '.') || 0) };
  }).filter(function(s){ return s.reps > 0; });
  if(!sets.length){ toast('Добавь хотя бы один подход с повторами'); return; }
  const d = dayData(dDate, true);
  const ex = EXERCISES.find(function(e){ return normTxt(e.name) === normTxt(name); });
  let id = woEditId;
  if(id){ const w = d.workout.find(function(x){ return x.id === id; }); if(w){ w.name = name; w.sets = sets; w.exId = ex ? ex.id : null; } }
  else { id = uid(); d.workout.push({ id:id, name:name, exId:ex ? ex.id : null, sets:sets }); }
  save();
  $('woModal').classList.remove('on');
  renderDiary({ flash:id });
  toast(woEditId ? 'Упражнение обновлено' : 'Записал: ' + name);
}

/* ================= МОЙ ПРОГРЕСС ================= */
let progTab = 'body', progEx = null;
function strengthSeries(name){
  const nn = normTxt(name), out = [];
  Object.keys(diaryStore()).sort().forEach(function(ds){
    (diaryStore()[ds].workout || []).forEach(function(w){
      if(normTxt(w.name) !== nn) return;
      const best = Math.max.apply(null, w.sets.map(function(s){ return s.kg || 0; }));
      const e1rm = Math.max.apply(null, w.sets.map(function(s){ return (s.kg || 0) * (1 + (s.reps || 0) / 30); }));   // формула Эпли
      out.push({ date:ds, kg:best, e1rm:e1rm, vol:woVolume(w) });
    });
  });
  return out;
}
function loggedExercises(){
  const cnt = {};
  Object.keys(diaryStore()).forEach(function(ds){ (diaryStore()[ds].workout || []).forEach(function(w){ cnt[w.name] = (cnt[w.name] || 0) + 1; }); });
  return Object.keys(cnt).sort(function(a, b){ return cnt[b] - cnt[a]; });
}
function openProgress(tab){
  progTab = tab || 'body';
  const ex = loggedExercises();
  if(!progEx || ex.indexOf(progEx) < 0) progEx = ex[0] || null;
  $('progModal').classList.add('on');
  renderProgress();
}
function renderProgress(){
  segSet('progTabs', progTab);
  $('progExWrap').style.display = progTab === 'str' ? '' : 'none';
  const cv = $('progChart');
  if(progTab === 'body'){
    const w = sortedW();
    $('progKpis').innerHTML = w.length ? (function(){
      const first = w[0].kg, last = w[w.length-1].kg, diff = r1(last - first);
      return '<div class="kpi"><b>' + last.toFixed(1) + '</b><span>сейчас, кг</span></div>' +
        '<div class="kpi ' + (diff < 0 ? 'good' : '') + '"><b>' + (diff > 0 ? '+' : '') + diff + '</b><span>с начала, кг</span></div>' +
        '<div class="kpi"><b>' + w.length + '</b><span>замеров</span></div>';
    })() : '';
    requestAnimationFrame(function(){ drawSeries(cv, w.map(function(x){ return { d:x.date, v:x.kg }; }), 'кг', 'Запиши вес тела минимум два раза — появится график'); });
  } else {
    const ex = loggedExercises();
    $('progEx').innerHTML = ex.length ? ex.map(function(n){ return '<option' + (n === progEx ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') : '<option>Пока нет тренировок</option>';
    const s = progEx ? strengthSeries(progEx) : [];
    $('progKpis').innerHTML = s.length ? (function(){
      const best = Math.max.apply(null, s.map(function(x){ return x.kg; })), first = s[0].kg, last = s[s.length-1].kg;
      const e = Math.max.apply(null, s.map(function(x){ return x.e1rm; }));
      return '<div class="kpi"><b>' + r1(best) + '</b><span>лучший вес, кг</span></div>' +
        '<div class="kpi ' + (last > first ? 'good' : '') + '"><b>' + (last - first > 0 ? '+' : '') + r1(last - first) + '</b><span>прирост, кг</span></div>' +
        '<div class="kpi"><b>' + Math.round(e) + '</b><span>≈ разовый максимум</span></div>';
    })() : '';
    requestAnimationFrame(function(){ drawSeries(cv, s.map(function(x){ return { d:x.date, v:x.kg }; }), 'кг', progEx ? 'Запиши это упражнение хотя бы в двух тренировках — появится график' : 'Добавь упражнения в «Тренировку» — здесь появится рост рабочих весов'); });
  }
}
/* универсальный линейный график (в стиле графика веса) */
function drawSeries(cv, pts, unit, emptyText){
  const dpr = window.devicePixelRatio || 1;
  const cssW = cv.clientWidth || 500, cssH = cv.clientHeight || 220;
  cv.width = cssW * dpr; cv.height = cssH * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cssW, cssH);
  g.font = '11px Inter, sans-serif'; g.fillStyle = '#7C848E';
  if(pts.length < 2){ g.textAlign = 'center'; g.fillText(emptyText, cssW / 2, cssH / 2); return; }
  const padL = 42, padR = 14, padT = 16, padB = 28, iw = cssW - padL - padR, ih = cssH - padT - padB;
  const vals = pts.map(function(p){ return p.v; });
  let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  if(mx - mn < 2){ const c = (mx + mn) / 2; mn = c - 1; mx = c + 1; }
  const pad = (mx - mn) * .18; mn -= pad; mx += pad;
  const X = function(i){ return padL + iw * i / (pts.length - 1); }, Y = function(v){ return padT + ih * (1 - (v - mn) / (mx - mn)); };
  g.strokeStyle = '#22262C'; g.lineWidth = 1;
  for(let i = 0; i <= 3; i++){ const y = padT + ih * i / 3; g.beginPath(); g.moveTo(padL, y); g.lineTo(cssW - padR, y); g.stroke(); g.textAlign = 'right'; g.fillText((mx - (mx - mn) * i / 3).toFixed(1), padL - 8, y + 4); }
  const grad = g.createLinearGradient(0, padT, 0, padT + ih); grad.addColorStop(0, 'rgba(201,244,92,.26)'); grad.addColorStop(1, 'rgba(201,244,92,0)');
  g.beginPath(); g.moveTo(X(0), Y(vals[0])); for(let i = 1; i < pts.length; i++) g.lineTo(X(i), Y(vals[i]));
  g.lineTo(X(pts.length - 1), padT + ih); g.lineTo(X(0), padT + ih); g.closePath(); g.fillStyle = grad; g.fill();
  g.beginPath(); g.moveTo(X(0), Y(vals[0])); for(let i = 1; i < pts.length; i++) g.lineTo(X(i), Y(vals[i]));
  g.strokeStyle = '#C9F45C'; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke();
  for(let i = 0; i < pts.length; i++){ g.beginPath(); g.arc(X(i), Y(vals[i]), 4, 0, Math.PI * 2); g.fillStyle = '#0B0C0E'; g.fill(); g.strokeStyle = '#C9F45C'; g.lineWidth = 2; g.stroke(); }
  g.fillStyle = '#7C848E'; g.textAlign = 'center';
  const step = Math.ceil(pts.length / 6);
  for(let i = 0; i < pts.length; i += step) g.fillText(fmtDate(pts[i].d), X(i), cssH - 8);
}

/* ---------- вес тела из дневника ---------- */
function saveBodyWeight(){
  const kg = parseFloat(String($('dBwInput').value).replace(',', '.'));
  if(!kg || kg < 35 || kg > 250){ toast('Введи вес от 35 до 250 кг'); return; }
  ME.profile.weights = ME.profile.weights.filter(function(x){ return x.date !== dDate; });
  ME.profile.weights.push({ date:dDate, kg:kg });
  const w = sortedW(); ME.profile.weight = w[w.length-1].kg;
  save(); $('dBwInput').value = '';
  fillNorm(); renderWeight(); renderDiary();
  toast('Вес ' + kg.toFixed(1) + ' кг записан');
  achCheck();
}

/* ================= привязка событий (вызывается из app.js один раз) ================= */
function diaryInit(){
  $('dPrev').onclick = function(){ dDate = addDays(dDate, -7); renderDiary(); };
  $('dNext').onclick = function(){ dDate = addDays(dDate, 7); renderDiary(); };
  $('dToday').onclick = function(){ dDate = today(); renderDiary(); };
  $('dWeek').addEventListener('click', function(e){ const b = e.target.closest('[data-day]'); if(!b) return; dDate = b.dataset.day; renderDiary(); });
  // вода
  $('dWaterPlus').onclick = function(){ const d = dayData(dDate); setWater((d ? d.water : 0) + 250); };
  $('dWaterMinus').onclick = function(){ const d = dayData(dDate); setWater((d ? d.water : 0) - 250); };
  $('dGlasses').addEventListener('click', function(e){
    const b = e.target.closest('[data-glass]'); if(!b) return;
    const i = +b.dataset.glass, d = dayData(dDate), cur = Math.floor((d ? d.water : 0) / 250);
    setWater((i + 1 === cur ? i : i + 1) * 250);   // повторный клик по последнему стакану — убрать его
  });
  // тренировка и вес тела
  $('dWoAdd').onclick = function(){ openWorkoutModal(); };
  $('dWoProg').onclick = function(){ openProgress('str'); };
  $('dBwProg').onclick = function(){ openProgress('body'); };
  $('dBwSave').onclick = saveBodyWeight;
  $('dBwInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') saveBodyWeight(); });
  // модалка еды
  segInit('fMealSeg', function(v){ fMealSel = v; updatePortion(); const b = $('aiAdd'); if(b) b.textContent = 'Добавить в «' + MEALS.find(function(m){ return m.id === v; }).label + '»'; });
  segInit('fTabs', foodTab);
  $('fQ').addEventListener('input', function(){ if(this.value) $('fNotFound').style.display = 'none'; renderLocalResults(this.value); $('fOffRes').innerHTML = ''; $('fOffStatus').textContent = ''; });
  $('fQ').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); if(fLocalList.length && !e.shiftKey && this.value.trim()) showPortion(fLocalList[0]); else offSearch(); } });
  $('fOffBtn').onclick = offSearch;
  $('foodModal').addEventListener('click', function(e){
    const r = e.target.closest('.fres');
    if(r){ const k = r.dataset.key; showPortion(k[0] === 'l' ? fLocalList[+k.slice(1)] : fOffList[+k.slice(1)]); return; }
    const c = e.target.closest('#fpChips .chip'); if(c){ $('fpAmount').value = c.dataset.v; updatePortion(); return; }
    if(e.target.closest('#aiAdd')){
      aiItems.forEach(function(x){ addFoodToDiary(dDate, fMealSel, { name:x.name, brand:'распознано по фото', grams:x.grams || null, portion:x.grams ? null : '1 порция', kcal:r1(x.kcal), p:r1(x.p), f:r1(x.f), c:r1(x.c), s:x.s == null ? null : r1(x.s), src:'ai' }); });
      closeFoodModal();
    }
  });
  $('fpAmount').addEventListener('input', updatePortion);
  $('fpMinus').onclick = function(){ const s = fPick.per100 ? 10 : 0.5; $('fpAmount').value = Math.max(0, r1((+$('fpAmount').value || 0) - s)); updatePortion(); };
  $('fpPlus').onclick = function(){ const s = fPick.per100 ? 10 : 0.5; $('fpAmount').value = r1((+$('fpAmount').value || 0) + s); updatePortion(); };
  $('fpAdd').onclick = addPicked;
  $('fpBack').onclick = function(){ showPortion(null); };
  $('fManualLink').onclick = function(){ $('fmName').value = $('fQ').value; $('fmCode').value = ''; foodTab('manual'); };
  segInit('fmMode');
  $('fmAdd').onclick = addManual;
  $('foodClose').onclick = closeFoodModal;
  $('foodModal').addEventListener('click', function(e){ if(e.target === $('foodModal')) closeFoodModal(); });
  // штрих-код
  $('bcStart').onclick = function(){ Scanner.start(); };
  $('bcStop').onclick = function(){ Scanner.stop(); bcStatus('Камера выключена.'); };
  $('bcTorch').onclick = function(){ Scanner.toggleTorch(); };
  document.addEventListener('visibilitychange', function(){ if(document.hidden && Scanner.running){ Scanner.stop(); bcStatus('Камера выключена — вкладка была свёрнута.'); } });
  $('bcFind').onclick = function(){ lookupBarcode($('bcCode').value); };
  $('bcCode').addEventListener('keydown', function(e){ if(e.key === 'Enter') lookupBarcode(this.value); });
  $('bcFile').addEventListener('change', function(){ if(this.files[0]) Scanner.fromImage(this.files[0]); this.value = ''; });
  // фото + ИИ
  $('aiFile').addEventListener('change', function(){ aiPreview(this.files[0] || null); this.value = ''; });
  $('aiGo').onclick = aiRun;
  $('aiResult').addEventListener('input', function(e){
    const i = +e.target.dataset.i; if(isNaN(i)) return;
    const x = aiItems[i];
    if(e.target.classList.contains('ai-n')){ x.name = e.target.value; return; }
    const g = Math.max(0, +e.target.value || 0);
    if(x.k){ x.kcal = x.k.kcal * g; x.p = x.k.p * g; x.f = x.k.f * g; x.c = x.k.c * g; if(x.k.s != null) x.s = x.k.s * g; }
    x.grams = g;
    const k = e.target.closest('.ai-row').querySelector('.ai-k');
    k.innerHTML = Math.round(x.kcal) + ' ккал<br><small>Б ' + r1(x.p) + ' Ж ' + r1(x.f) + ' У ' + r1(x.c) + ' Сахар ' + sv(x.s) + '</small>';
    const tot = aiItems.reduce(function(t, y){ return { kcal:t.kcal + y.kcal, p:t.p + y.p, f:t.f + y.f, c:t.c + y.c, s:t.s + (y.s || 0) }; }, { kcal:0, p:0, f:0, c:0, s:0 });
    $('aiResult').querySelector('.ai-tot').innerHTML = 'Итого: <b>' + Math.round(tot.kcal) + ' ккал</b> · Б ' + r1(tot.p) + ' · Ж ' + r1(tot.f) + ' · У ' + r1(tot.c) + ' · Сахар ' + r1(tot.s);
  });
  segInit('aiProv', function(v){ const c = VisionAI.cfg(); c.provider = v; VisionAI.saveCfg(c); renderVisionCfg(); });
  $('aiSave').onclick = function(){
    const c = VisionAI.cfg();
    c.apiKey = $('aiKey').value.trim(); c.model = $('aiModel').value.trim() || 'gpt-4o-mini'; c.endpoint = $('aiEndpoint').value.trim();
    VisionAI.saveCfg(c); renderVisionCfg(); toast(VisionAI.ready() ? 'Распознавание настроено' : 'Настройки сохранены');
  };
  // тренировка — модалка
  $('woAddSet').onclick = function(){
    const rows = $('woSets').children, last = rows[rows.length - 1];
    addSetRow(last ? last.querySelector('.set-r').value : 10, last ? last.querySelector('.set-k').value : '');   // копия прошлого подхода
    const nr = $('woSets').lastElementChild; nr.classList.add('new');
  };
  $('woSets').addEventListener('click', function(e){
    const b = e.target.closest('.set-del'); if(!b) return;
    if($('woSets').children.length <= 1){ toast('Нужен хотя бы один подход'); return; }
    b.closest('.setrow').remove(); renumberSets();
  });
  $('woName').addEventListener('input', woLastHint);
  $('woRecent').addEventListener('click', function(e){ const c = e.target.closest('.chip'); if(!c) return; $('woName').value = c.dataset.n; woLastHint(); });
  $('woList').innerHTML = EXERCISES.map(function(e){ return '<option value="' + esc(e.name) + '">'; }).join('') +
    ['Жим лёжа','Присед','Становая тяга','Бег','Велотренажёр','Эллипс','Скакалка'].map(function(n){ return '<option value="' + n + '">'; }).join('');
  $('woSave').onclick = saveWorkout;
  // прогресс
  segInit('progTabs', function(v){ progTab = v; renderProgress(); });
  $('progEx').addEventListener('change', function(){ progEx = this.value; renderProgress(); });
  window.addEventListener('resize', function(){ if($('progModal').classList.contains('on')) renderProgress(); });
}
