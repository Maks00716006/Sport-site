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
  toast('Добавил: ' + item.name + ' → ' + MEALS.find(function(m){ return m.id === meal; }).label);
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
  $('dDateLabel').innerHTML = esc(humanDate(dDate)) + (dDate !== today() ? ' <small>→ к сегодня</small>' : '');
  $('dDateLabel').classList.toggle('back', dDate !== today());
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
  const amount = x.grams ? Math.round(x.grams) + ' ' + unitOf(x) : (x.portion || '1 порция');
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
  const burn = list.reduce(function(s, w){ return s + woBurn(w.name, w.sets); }, 0);
  $('dWoSub').innerHTML = list.length
    ? list.length + ' ' + plural(list.length, 'упражнение', 'упражнения', 'упражнений') + ' · ' + sets + ' ' + plural(sets, 'подход', 'подхода', 'подходов') + (vol ? ' · объём ' + Math.round(vol).toLocaleString('ru-RU') + ' кг' : '') +
      (burn ? '<br><span class="woburn-sum">🔥 ≈ ' + burn + ' ккал сожжено</span>' : '')
    : 'Запиши упражнения, подходы и рабочие веса';
  $('dWoList').innerHTML = list.length ? list.map(function(w){
    return '<div class="ditem wo' + (w.id === flash ? ' flash' : '') + '" data-food="' + w.id + '">' +
      '<div class="ditem-t"><b>' + esc(w.name) + ' <small class="wkcal">≈ ' + woBurn(w.name, w.sets) + ' ккал</small></b><div class="wsets">' + w.sets.map(function(st, i){
        const k = woKind(w.name);
        return '<span><i>' + (i + 1) + '</i>' + st.reps + (k.t === 'cardio' ? ' мин' : k.t === 'time' ? ' сек' : st.kg ? ' × ' + r1(st.kg) + ' кг' : ' повт.') + '</span>'; }).join('') + '</div></div>' +
      '<button type="button" class="ditem-e" aria-label="Изменить" onclick="openWorkoutModal(\'' + w.id + '\')">' + D_ICON.edit + '</button>' +
      '<button type="button" class="ditem-x" aria-label="Удалить" onclick="delWorkout(\'' + w.id + '\')">' + D_ICON.x + '</button></div>';
  }).join('') : '';
  // вес тела за выбранный день + мини-график
  const w = sortedW(), onDay = w.find(function(x){ return x.date === dDate; });
  $('dBwVal').textContent = onDay ? onDay.kg.toFixed(1) + ' кг' : (w.length ? 'последний: ' + w[w.length-1].kg.toFixed(1) + ' кг' : 'ещё не записан');

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
  if($('bcNf')) $('bcNf').style.display = 'none';
  renderLocalResults('');
  $('fOffRes').innerHTML = '';
  $('fOffStatus').textContent = '';
  renderFAdded();
  $('foodModal').classList.add('on');
  setTimeout(function(){ if(window.innerWidth > 700) $('fQ').focus(); }, 80);
}
function closeFoodModal(){ Scanner.stop(); $('foodModal').classList.remove('on'); }
/* после добавления окно НЕ закрывается: возвращаемся к поиску (или остаёмся на фото/ручном вводе),
   сверху — что уже лежит в этом приёме пищи и кнопка «Готово» */
function foodStay(tab){
  showPortion(null);
  if(tab === 'photo' || tab === 'manual'){ foodTab(tab); }
  else {
    const cur = segGet('fTabs');
    if(cur === 'barcode'){ foodTab('barcode'); bcStatus('Добавлено ✓ Сканируй следующий товар или нажми «Готово».', 'ok'); $('bcCode').value = ''; if($('bcNf')) $('bcNf').style.display = 'none'; }
    else { foodTab('search'); $('fQ').value = ''; $('fNotFound').style.display = 'none'; renderLocalResults(''); $('fOffRes').innerHTML = ''; $('fOffStatus').textContent = ''; }
  }
  renderFAdded(true);
  const box = $('foodModal').querySelector('.sheet'); if(box) box.scrollTo({ top:0, behavior:'smooth' });
}
function renderFAdded(flash){
  const d = dayData(dDate), list = d ? d.meals[fMealSel] || [] : [];
  const el = $('fAdded');
  if(!list.length){ el.style.display = 'none'; el.innerHTML = ''; return; }
  const kcal = list.reduce(function(s, x){ return s + (+x.kcal || 0); }, 0);
  const label = MEALS.find(function(m){ return m.id === fMealSel; }).label;
  el.innerHTML = '<div class="fadded-h"><span>В «' + label + '» · <b>' + Math.round(kcal) + ' ккал</b></span>' +
      '<button type="button" class="btn sm" id="fDone">Готово</button></div>' +
    '<div class="fadded-l">' + list.map(function(x, i){
      return '<span class="fchip' + (flash && i === list.length - 1 ? ' new' : '') + '">' + esc(x.name) + ' <i>' + Math.round(x.kcal) + '</i>' +
        '<button type="button" data-del="' + x.id + '" aria-label="Убрать ' + esc(x.name) + '">&times;</button></span>';
    }).join('') + '</div>';
  el.style.display = '';
}
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
  const mine = MyBarcodes.list().map(function(x){ return Object.assign({}, x, { cat:'Мои продукты', mine:true }); });
  const all = mine.concat(FOODS, recipes);
  if(!nq){
    // без запроса — недавние продукты пользователя
    return recentFoods();
  }
  const words = nq.split(' ');
  return all.map(function(x){
    const n = normTxt(x.name), nb0 = normTxt((x.brand || '') + ' ' + x.name);
    if(!words.every(function(w){ return nb0.indexOf(w) >= 0; })) return null;
    let score = (n.indexOf(nq) === 0 ? 0 : n.indexOf(' ' + words[0]) >= 0 || n.indexOf(words[0]) === 0 ? 1 : 2) + n.length / 100;
    if(x.cat === 'Крупы сухие') score += .6;          // сначала готовые блюда, сухие крупы — ниже
    if(x.src === 'recipe') score += .3;
    if(x.mine) score -= .5;                             // свои сохранённые товары — выше
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
    'Б ' + x.p + ' · Ж ' + x.f + ' · У ' + x.c + ' · Сахар ' + sv(x.s) + (x.per100 ? ' на 100 ' + unitOf(x) : ' на порцию') + '</small></span>' +
    '<span class="fres-k"><b>' + Math.round(x.kcal) + '</b><small>' + (x.per100 ? 'ккал/100 ' + unitOf(x) : 'ккал/порц.') + '</small></span></button>';
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
/* ---- граммы или миллилитры: напитки считаем в мл (КБЖУ «на 100 мл», плотность ≈ 1) ---- */
const LIQUID_RE = /(^|[\s«"(,])(вода|минералк|газировк|сок|соки|нектар|морс|компот|молоко|кефир|ряженк|айран|тан(?![а-яёa-z])|снежок|простокваш|напиток|напитк|лимонад|кола|cola|pepsi|пепси|спрайт|sprite|фанта|fanta|энергетик|квас|пиво|вино|шампанск|чай|кофе|капучино|латте|раф(?![а-яёa-z])|какао|смузи|коктейл|бульон|питьев|water|juice|milk|drink|soda|beer|tea|coffee)/i;
function isLiquid(name){ const n = String(name || ''); return LIQUID_RE.test(n) && !/сгущ|шоколад|конфет|печень|батончик|мороже|сухое молоко|порошок|сухой|зерн|молотый|растворим/i.test(n); }
function unitOf(x){ return x && x.unit === 'ml' ? 'мл' : 'г'; }

FOODS.forEach(function(f){ if(f.cat === 'Напитки' || isLiquid(f.name)) f.unit = 'ml'; });

/* ---- варианты записи одного штрих-кода: UPC-A (12) = EAN-13 с ведущим нулём, UPC-E (8) → UPC-A ---- */
function upcEtoA(e){
  if(!/^[01]\d{7}$/.test(e)) return null;
  const d = e.slice(1, 7), ns = e[0], chk = e[7], l = d[5];
  let m;
  if(l <= '2') m = d.slice(0, 2) + l + '0000' + d.slice(2, 5);
  else if(l === '3') m = d.slice(0, 3) + '00000' + d.slice(3, 5);
  else if(l === '4') m = d.slice(0, 4) + '00000' + d[4];
  else m = d.slice(0, 5) + '0000' + l;
  return ns + m + chk;
}
function codeVariants(code){
  const out = [code];
  const add = function(c){ if(c && out.indexOf(c) < 0) out.push(c); };
  if(code.length === 12) add('0' + code);
  if(code.length === 13 && code[0] === '0') add(code.slice(1));
  if(code.length === 14 && code[0] === '0') add(code.slice(1));
  if(code.length === 8){ const a = upcEtoA(code); if(a){ add(a); add('0' + a); } }
  return out;
}
/* ---- «Мои штрих-коды»: всё, что уже находили или добавляли на этом телефоне ----
   Товар, найденный в базе, распознанный по фото этикетки или введённый вручную с кодом,
   сохраняется — следующий скан находит его мгновенно, даже без интернета. */
const MyBarcodes = {
  key:'wsport-my-barcodes-v1', max:600,
  all: function(){ try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch(e){ return {}; } },
  get: function(code){
    const a = this.all(), vs = codeVariants(code);
    for(let i = 0; i < vs.length; i++) if(a[vs[i]]) return Object.assign({}, a[vs[i]], { code:code });
    return null;
  },
  /* всё сохранённое — для поиска по названию («Мои продукты») */
  list: function(){ const a = this.all(); return Object.keys(a).map(function(k){ return a[k]; }).sort(function(x, y){ return y.at - x.at; }); },
  put: function(p){
    if(!p || !p.name || p.kcal == null) return;
    const a = this.all();
    const key = p.code || ('n:' + normTxt((p.brand ? p.brand + ' ' : '') + p.name));   // товар без штрих-кода — по названию
    a[key] = { id:'b' + key, code:p.code || '', name:p.name, brand:p.brand || '', qty:p.qty || '', kcal:p.kcal, p:p.p, f:p.f, c:p.c, s:p.s == null ? null : p.s,
      per100:true, portion:p.portion || 100, src:p.src || 'my', ru:!!p.ru, cat:p.cat || '', unit:p.unit === 'ml' ? 'ml' : 'g', at:Date.now() };
    const keys = Object.keys(a);
    if(keys.length > this.max) keys.sort(function(x, y){ return a[x].at - a[y].at; }).slice(0, keys.length - this.max).forEach(function(k){ delete a[k]; });
    try { localStorage.setItem(this.key, JSON.stringify(a)); } catch(e){}
  }
};
/* ---- USDA FoodData Central: огромная база товаров США и импорта (запасной источник) ---- */
const USDA = {
  key: function(){ return (window.WSPORT_CONFIG && window.WSPORT_CONFIG.usdaKey) || 'DEMO_KEY'; },
  byBarcode: async function(code){
    const want = code.replace(/^0+/, '');
    const r = await fetch('https://api.nal.usda.gov/fdc/v1/foods/search?api_key=' + this.key() + '&dataType=Branded&pageSize=10&query=' + encodeURIComponent(code), { signal:OFF.timeout(10000) });
    if(!r.ok) return null;
    const j = await r.json();
    const f = (j.foods || []).find(function(x){ return String(x.gtinUpc || '').replace(/^0+/, '') === want; });
    if(!f) return null;
    const nut = function(num){ const x = (f.foodNutrients || []).find(function(n){ return String(n.nutrientNumber) === num; }); return x && x.value != null ? +x.value : null; };
    let kcal = nut('208'); if(kcal == null && nut('268') != null) kcal = nut('268') / 4.184;
    if(kcal == null) return null;
    const title = String(f.description || '').toLowerCase().replace(/(^|\s)\S/g, function(t){ return t.toUpperCase(); });
    const sg = String(f.servingSizeUnit || '').toLowerCase() === 'g' ? Math.round(+f.servingSize) : 0;
    return { id:'u' + code, code:code, name:title || 'Товар ' + code, brand:f.brandName || f.brandOwner || '', qty:f.packageWeight || '',
      kcal:r1(kcal), p:r1(nut('203') || 0), f:r1(nut('204') || 0), c:r1(nut('205') || 0), s:nut('269') == null ? null : r1(nut('269')),
      per100:true, portion:sg || (/^(ml|mlt)$/i.test(String(f.servingSizeUnit || '')) ? Math.round(+f.servingSize) : 0) || 100, src:'usda', ru:false, cat:'',
      unit:(/^(ml|mlt)$/i.test(String(f.servingSizeUnit || '')) || /beverage|juice|water|milk|drink|soda|coffee|tea/i.test(String(f.brandedFoodCategory || '')) || isLiquid(title)) ? 'ml' : 'g' };
  }
};

/* ---- поиск товара по штрих-коду в интернете через ИИ с веб-поиском (сайты магазинов, каталоги) ----
   Нужен, когда товара нет в открытых базах: ИИ ищет код на сайтах и читает КБЖУ со страницы товара.
   Работает, только если ключу сайта разрешена модель с поиском (см. aiSearchPrefer в config.js). */
const WebBarcode = {
  prompt: function(code){
    return 'Найди в интернете продукт питания со штрих-кодом ' + code + ' (EAN/GTIN). Обязательно используй веб-поиск: сайты магазинов (Ozon, Wildberries, Перекрёсток, Магнит, Пятёрочка, ВкусВилл, Лента, Metro), каталоги штрих-кодов, сайт производителя. ' +
      'Нужен ТОЧНО этот штрих-код, а не похожий товар. Возьми с найденной страницы название, бренд, вес/объём и пищевую ценность НА 100 г (ккал, белки, жиры, углеводы, в т.ч. сахара). ' +
      'Если на странице КБЖУ на порцию — пересчитай на 100 г. Ничего не выдумывай: если точного совпадения по штрих-коду нет или нет КБЖУ — found:false. ' +
      'Если это напиток или жидкость (вода, сок, молоко, кефир, энергетик и т. п.) — unit "ml" и значения на 100 мл, иначе unit "g". ' +
      'Ответь ТОЛЬКО JSON без markdown: {"found":true,"barcode":"' + code + '","name":"","brand":"","qty":"","unit":"g","per100":{"kcal":0,"p":0,"f":0,"c":0,"s":null},"source":"адрес страницы"}';
  },
  byBarcode: async function(code){
    if(!(window.siteAI && window.siteAI.ready())) return null;
    const models = await window.siteAI.searchModels();
    if(!models.length) return null;
    const r = await window.siteAI.fetch({ temperature:0, messages:[{ role:'user', content:this.prompt(code) }] }, { models:models, timeout:45000 });
    if(!r.ok) return null;
    const j = await r.json();
    const m = j.choices && j.choices[0] && j.choices[0].message;
    let o; try { o = VisionAI.parseJson(m && (typeof m.content === 'string' ? m.content : (m.content || []).map(function(x){ return x.text || ''; }).join(''))); } catch(e){ return null; }
    if(!o || o.found !== true) return null;
    if(o.barcode && String(o.barcode).replace(/\D/g, '').replace(/^0+/, '') !== code.replace(/^0+/, '')) return null;   // нашёл другой товар
    const h = o.per100 || {}, n = VisionAI.num;
    const kcal = n(h.kcal);
    if(kcal == null || kcal <= 0 || kcal > 950 || !o.name) return null;
    const c = Math.max(0, n(h.c) || 0); let sg = n(h.s); if(sg != null && sg > c) sg = c;
    return { id:'w' + code, code:code, name:String(o.name).trim().slice(0, 80), brand:String(o.brand || '').trim().slice(0, 60), qty:String(o.qty || '').slice(0, 30),
      kcal:r1(kcal), p:r1(Math.max(0, n(h.p) || 0)), f:r1(Math.max(0, n(h.f) || 0)), c:r1(c), s:sg == null ? null : r1(Math.max(0, sg)),
      per100:true, portion:100, src:'web', web:String(o.source || '').slice(0, 300), ru:/^46/.test(code), cat:'',
      unit:(o.unit === 'ml' || /мл|ml|\d\s*л(?![а-яёa-z])/i.test(String(o.qty || '')) || isLiquid(o.name)) ? 'ml' : 'g' };
  }
};

const OFF = {
  fields: 'code,product_name,product_name_ru,generic_name_ru,generic_name,brands,quantity,serving_quantity,nutriments,countries_tags,categories_tags,product_quantity_unit,nutrition_data_per',
  timeout: function(ms){ const c = new AbortController(); setTimeout(function(){ c.abort(); }, ms); return c.signal; },
  /* напиток? — объём на упаковке (мл/л), единица количества, категория или название */
  liquid: function(p, name){
    if(/\d\s*(мл|ml|л|l|cl|сл)(?![а-яёa-z])/i.test(String(p.quantity || ''))) return true;
    if(/^(ml|l|cl|мл|л)$/i.test(String(p.product_quantity_unit || ''))) return true;
    if(/ml/i.test(String(p.nutrition_data_per || ''))) return true;
    if((p.categories_tags || []).some(function(t){ return /en:(beverages|waters|juices|milks|plant-based-milks|sodas|energy-drinks|drinkable-yogurts|kefirs|teas|coffees|beers|wines|nectars)/.test(t); })) return true;
    return isLiquid(name);
  },
  parse: function(p){
    if(!p) return null;
    const n = p.nutriments || {};
    const sq = +p.serving_quantity || 0;
    // значение на 100 г; если на упаковке указано только «на порцию» — пересчитываем через вес порции
    const v100 = function(k){
      const a = n[k + '_100g'];
      if(a != null && a !== '') return +a;
      const sv = n[k + '_serving'];
      return (sv != null && sv !== '' && sq > 0) ? +sv * 100 / sq : null;
    };
    let kcal = v100('energy-kcal');
    if(kcal == null){ const kj = v100('energy'); if(kj != null) kcal = kj / 4.184; }
    const name = p.product_name_ru || p.product_name || p.generic_name_ru || p.generic_name || '';
    if(kcal == null || !name) return null;
    const brand = (p.brands || '').split(',')[0].trim();
    const ru = (p.countries_tags || []).indexOf('en:russia') >= 0 || /^46\d/.test(p.code || '');
    const sug = v100('sugars');
    return { id:'o' + p.code, code:p.code, name:name.trim(), brand:brand, kcal:r1(+kcal), p:r1(v100('proteins') || 0), f:r1(v100('fat') || 0), c:r1(v100('carbohydrates') || 0),
      s:sug == null ? null : r1(sug),
      per100:true, portion:Math.round(+p.serving_quantity) || 100, qty:p.quantity || '', src:'off', ru:ru, cat:ru ? 'Россия' : '',
      unit:OFF.liquid(p, name) ? 'ml' : 'g' };
  },
  /* ищем по всем вариантам записи кода (EAN-13 / UPC-A с нулём и без). Если товар есть, но без КБЖУ —
     возвращаем { partial } с названием, чтобы подставить его при фото этикетки */
  byBarcode: async function(code){
    let partial = null;
    const vs = codeVariants(code);
    for(let i = 0; i < vs.length; i++){
      const url = 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(vs[i]) + '.json?lc=ru&cc=ru&app_name=WSPORT&fields=' + this.fields;
      const res = await fetch(url, { signal:this.timeout(12000) });
      if(res.status === 404) continue;
      if(res.status === 429) throw new Error('rate');
      if(!res.ok) throw new Error('http ' + res.status);
      const j = await res.json();
      if(j.status !== 1 && j.status !== 'success') continue;
      const p = this.parse(j.product);
      if(p){ p.code = code; return p; }
      const pr = j.product || {};
      const nm = pr.product_name_ru || pr.product_name || pr.generic_name_ru || pr.generic_name || '';
      if(nm && !partial) partial = { partial:true, code:code, name:nm.trim(), brand:(pr.brands || '').split(',')[0].trim(), qty:pr.quantity || '' };
    }
    return partial;
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
  // напитки без указанной порции — по умолчанию стакан 250 мл, а не 100
  if(item && item.per100 && item.unit === 'ml' && (!item.portion || item.portion === 100) && item.src !== 'local') item.portion = 250;
  fPick = item;
  $('fPortion').style.display = item ? '' : 'none';
  $('fMain').style.display = item ? 'none' : '';
  if(!item) return;
  $('fpName').textContent = item.name;
  $('fpBrand').textContent = [item.brand, item.qty, item.code ? 'штрих-код ' + item.code : '',
    item.src === 'web' ? 'найдено в интернете — сверь КБЖУ с упаковкой' : item.src === 'label' ? 'прочитано с этикетки' : item.src === 'usda' ? 'база USDA' :
    item.src === 'match' ? (item.note || 'похожий товар из базы') + ' — сверь с упаковкой' : item.src === 'estimate' ? 'КБЖУ примерные (по типичному составу) — сверь с упаковкой' : '',
    item.mine ? 'мои продукты' : ''].filter(Boolean).join(' · ');
  $('fpPer').textContent = item.per100
    ? 'На 100 ' + unitOf(item) + ': ' + item.kcal + ' ккал · Б ' + item.p + ' · Ж ' + item.f + ' · У ' + item.c + ' · Сахар ' + (item.s == null ? 'нет данных' : item.s)
    : 'На 1 порцию: ' + item.kcal + ' ккал · Б ' + item.p + ' · Ж ' + item.f + ' · У ' + item.c + ' · Сахар ' + (item.s == null ? 'нет данных' : item.s);
  $('fpUnit').textContent = item.per100 ? unitOf(item) : 'порц.';
  $('fpUnit').disabled = !item.per100;
  $('fpAmount').step = item.per100 ? 5 : 0.5;
  $('fpAmount').value = item.per100 ? (item.portion || 100) : 1;
  const chips = item.per100 ? [50, 100, 150, 200, 250].concat(item.portion && [50,100,150,200,250].indexOf(item.portion) < 0 ? [item.portion] : []) : [0.5, 1, 1.5, 2];
  $('fpChips').innerHTML = chips.sort(function(a, b){ return a - b; }).map(function(v){
    return '<button type="button" class="chip" data-v="' + v + '">' + (item.per100 ? v + ' ' + unitOf(item) : v + ' порц.') + '</button>';
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
    name:fPick.name, brand:fPick.brand || '', grams:fPick.per100 ? r.a : null, unit:fPick.per100 && fPick.unit === 'ml' ? 'ml' : 'g',
    portion:fPick.per100 ? null : (r.a === 1 ? '1 порция' : r.a + ' ' + plural(Math.ceil(r.a), 'порция', 'порции', 'порций')),
    kcal:r1(r.kcal), p:r1(r.p), f:r1(r.f), c:r1(r.c), s:r.s == null ? null : r1(r.s), src:fPick.src, base:base
  });
  foodStay();
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
  // ввёл КБЖУ для штрих-кода — запоминаем товар, следующий скан найдёт его сразу
  const unit = segGet('fmUnit') === 'ml' ? 'ml' : 'g';
  if($('fmCode').value && per100) MyBarcodes.put({ code:$('fmCode').value, name:name, kcal:vals[0], p:vals[1], f:vals[2], c:vals[3], s:sKnown ? vals[4] : null, portion:g || 100, src:'manual', unit:unit });
  addFoodToDiary(dDate, fMealSel, {
    name:name, brand:$('fmCode').value ? 'штрих-код ' + $('fmCode').value : '', grams:g || null, unit:unit, portion:g ? null : '1 порция',
    kcal:r1(vals[0] * k), p:r1(vals[1] * k), f:r1(vals[2] * k), c:r1(vals[3] * k), s:sKnown ? r1(vals[4] * k) : null, src:'manual',
    base:per100 ? { id:'m' + uid(), name:name, kcal:vals[0], p:vals[1], f:vals[2], c:vals[3], s:sKnown ? vals[4] : null, per100:true, portion:g || 100, src:'manual', unit:unit } : null
  });
  ['fmName','fmKcal','fmP','fmF','fmC','fmS','fmCode'].forEach(function(id){ $(id).value = ''; });
  segSet('fmUnit', 'g');
  $('fmGrams').value = 100;
  foodStay('manual');
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
  if(code.length === 8 && !eanCheck(code)){ const a = upcEtoA(code); return !!a && eanCheck(a); }   // UPC-E
  return eanCheck(code);
}
function eanCheck(code){
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
  $('bcNf').style.display = 'none';
  const found = function(p, where){ bcStatus('Нашёл' + (where ? ' (' + where + ')' : '') + ': ' + esc(p.name), 'ok'); Scanner.stop(); MyBarcodes.put(p); showPortion(p); };
  // 1) уже находили/добавляли на этом телефоне — мгновенно, без интернета
  const mine = MyBarcodes.get(code);
  if(mine){ bcLookupBusy = false; $('bcFind').disabled = false; found(mine, 'сохранён у тебя'); return; }
  bcStatus('<span class="spin"></span> Ищу товар ' + code + (/^4[6-8]\d/.test(code) ? ' (' + bcCountry(code) + ')' : '') + '…');
  let partial = null, offline = false, rate = false;
  try {
    // 2) OpenFoodFacts — мировая открытая база (в т.ч. российские товары)
    try {
      const p = await OFF.byBarcode(code);
      if(p && !p.partial){ found(p); return; }
      partial = p;
    } catch(e){ if(e.message === 'rate') rate = true; else offline = true; }
    // 3) USDA — товары США и импорт (российских там нет, поэтому коды 46x/48x не спрашиваем)
    if(!/^(46|47|48)/.test(code)){
      bcStatus('<span class="spin"></span> В OpenFoodFacts нет — ищу в базе USDA…');
      try { const u = await USDA.byBarcode(code); if(u){ if(partial && partial.name) u.name = partial.name; found(u, 'база USDA'); return; } } catch(e){}
    }
    // 4) ищем в интернете (магазины, каталоги) через ИИ с веб-поиском
    if(!offline && window.siteAI && window.siteAI.ready()){
      bcStatus('<span class="spin"></span> В открытых базах нет — ищу товар в интернете (магазины, каталоги)…');
      try {
        const w = await WebBarcode.byBarcode(code);
        if(w){ if(partial && partial.name) w.name = partial.name; w.warnWeb = true; found(w, 'найден в интернете — сверь с упаковкой'); return; }
      } catch(e){}
    }
    if(rate && !partial){ bcStatus('Слишком много сканов подряд — подожди минуту.', 'warn'); return; }
    barcodeNotFound(code, offline && !partial, partial);
  } finally { bcLookupBusy = false; $('bcFind').disabled = false; }
}
/* страна по префиксу GS1 — просто для подсказки */
function bcCountry(code){
  const p = +code.slice(0, 3);
  if(p >= 460 && p <= 469) return 'российский';
  if(p === 481) return 'белорусский'; if(p === 482) return 'украинский'; if(p === 487) return 'казахстанский';
  if(p === 470) return 'киргизский'; if(p === 478) return 'узбекский'; if(p === 486) return 'грузинский'; if(p === 485) return 'армянский'; if(p === 476) return 'азербайджанский';
  return '';
}
/* товара нет ни в одной базе — предлагаем самый надёжный путь: сфоткать этикетку, ИИ прочитает КБЖУ.
   Результат сохраняется за этим штрих-кодом, в следующий раз скан найдёт его сразу. */
let bcPending = null;
function barcodeNotFound(code, offline, partial){
  Scanner.stop();
  bcPending = { code:code, name:partial && partial.name || '', brand:partial && partial.brand || '', qty:partial && partial.qty || '' };
  bcStatus(offline ? 'База товаров сейчас не отвечает.' : (partial ? 'Нашёл «' + esc(partial.name) + '», но без КБЖУ в базе.' : 'Штрих-кода ' + code + ' нет в открытых базах.'), 'warn');
  const ai = VisionAI.ready();
  $('bcNf').innerHTML =
    '<b>' + (partial ? 'Добавим КБЖУ за 5 секунд' : 'Добавим этот товар за 5 секунд') + '</b>' +
    '<span>' + (ai ? 'Сфоткай на упаковке таблицу «Пищевая ценность» — ИИ прочитает калории, БЖУ и сахар. Товар запомнится: в следующий раз скан найдёт его сразу.'
                   : 'Впиши КБЖУ с упаковки — товар запомнится за этим штрих-кодом.') + '</span>' +
    (ai ? '<label class="btn wide bcnf-main"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Сфоткать упаковку<input id="bcLabelFile" type="file" accept="image/*" capture="environment" hidden /></label>' +
          '<label class="linkbtn bcnf-gal">или выбрать 1–3 фото из галереи (лицевая сторона + состав)<input id="bcLabelGal" type="file" accept="image/*" multiple hidden /></label>' : '') +
    '<div class="bcnf-alt"><button type="button" class="btn ghost sm" id="bcNfManual">Ввести вручную</button><button type="button" class="btn ghost sm" id="bcNfSearch">Найти по названию</button></div>';
  $('bcNf').style.display = '';
  const onPick = function(){ const f = Array.prototype.slice.call(this.files || []); this.value = ''; if(f.length) readLabel(f); };
  if($('bcLabelFile')) $('bcLabelFile').addEventListener('change', onPick);
  if($('bcLabelGal')) $('bcLabelGal').addEventListener('change', onPick);
  $('bcNfManual').onclick = function(){ $('fmCode').value = code; $('fmName').value = bcPending.name || ''; segSet('fmUnit', isLiquid(bcPending.name) ? 'ml' : 'g'); foodTab('manual'); };
  $('bcNfSearch').onclick = function(){
    foodTab('search'); $('fQ').value = bcPending.name || ''; renderLocalResults($('fQ').value);
    if(bcPending.name) offSearch(); else setTimeout(function(){ $('fQ').focus(); }, 60);
  };
  requestAnimationFrame(function(){ if($('bcNf').scrollIntoView) $('bcNf').scrollIntoView({ block:'nearest', behavior:'smooth' }); });
}
/* единица: что написано на упаковке (вес «270 г» / объём «1 л») важнее всего остального */
function labelUnit(r, nut, name){
  const q = String(r.qty || '');
  if(/\d\s*(г|гр|кг|g|kg)(?![а-яёa-z])/i.test(q)) return 'g';
  if(/\d\s*(мл|л|ml|l)(?![а-яёa-z])/i.test(q)) return 'ml';
  if(r.unit === 'ml' || r.unit === 'g') return r.unit;
  return (nut && nut.unit === 'ml') || isLiquid(name) ? 'ml' : 'g';
}
/* фото упаковки → продукт. Работает и после «штрих-кода нет в базах», и без штрих-кода вообще.
   Таблицу не разглядели, но название прочитали — ищем КБЖУ по названию. Результат сохраняется в «Мои продукты». */
async function readLabel(files){
  const pend = bcPending || { code:'', name:'', brand:'', qty:'' };
  const box = $('bcNf').style.display !== 'none' ? $('bcNf') : $('fPane-barcode');
  box.querySelectorAll('.btn,.linkbtn').forEach(function(b){ b.classList.add('busy'); });
  const st = function(t){ bcStatus('<span class="spin"></span> ' + t); };
  st('ИИ читает упаковку' + (files.length > 1 ? ' (' + files.length + ' фото)' : '') + '…');
  try {
    const r = await VisionAI.label(files);
    if(!r){ bcStatus('На фото не видно ни названия, ни таблицы КБЖУ. Сфоткай лицевую сторону и табличку «Пищевая ценность» — можно 2 фото сразу.', 'warn'); return; }
    const name = pend.name || r.name;
    let nut = r.per100, src = 'label', note = '';
    if(!nut){
      if(!name){ bcStatus('Не разглядел ни таблицу, ни название. Сфоткай ближе и ровнее, без бликов.', 'warn'); return; }
      const f = await VisionAI.byName(name, pend.brand || r.brand, st);
      if(!f){
        bcStatus('Прочитал «' + esc(name) + '», но КБЖУ не нашёл. Сфоткай табличку «Пищевая ценность» или <button type="button" class="linkbtn" id="bcToManual">введи вручную</button>.', 'warn');
        $('bcToManual').onclick = function(){ $('fmName').value = name; $('fmCode').value = pend.code || ''; segSet('fmUnit', isLiquid(name) ? 'ml' : 'g'); foodTab('manual'); };
        return;
      }
      nut = f; src = f.src;
      note = f.src === 'match' ? 'похожий товар из базы: «' + f.matched + '»' : '';
    }
    const code = pend.code || '';
    const p = { id:'b' + (code || normTxt(name)), code:code, name:name || ('Товар ' + code), brand:pend.brand || r.brand || '', qty:pend.qty || r.qty || '',
      kcal:nut.kcal, p:nut.p, f:nut.f, c:nut.c, s:nut.s, per100:true, portion:r.portion || 100, src:src, note:note, ru:/^46/.test(code), cat:'',
      unit:labelUnit(r, nut, name) };
    MyBarcodes.put(p);
    bcStatus('Готово: ' + esc(p.name) + ' — сохранил в «Мои продукты»' + (code ? ' и за штрих-кодом' : '') + '.', 'ok');
    $('bcNf').style.display = 'none';
    showPortion(p);
  } catch(e){
    bcStatus(esc(e && e.message && !/^(image|timeout)$/.test(e.message) ? e.message : 'Не получилось прочитать фото. Попробуй ещё раз.'), 'warn');
  } finally { document.querySelectorAll('#fPane-barcode .busy').forEach(function(b){ b.classList.remove('busy'); }); }
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
  site: function(){ return !!(window.siteAI && window.siteAI.ready()); },
  cfg: function(){
    const def = { provider:this.site() ? 'site' : 'openai', apiKey:'', model:'gpt-4o-mini', endpoint:'' };
    let c; try { c = JSON.parse(localStorage.getItem(this.key)) || def; } catch(e){ c = def; }
    // у сайта есть свой бесплатный ИИ — используем его, пока человек сам не вписал ключ/сервер
    if(this.site() && !c.explicit && ((c.provider === 'openai' && !c.apiKey) || (c.provider === 'proxy' && !c.endpoint))) c.provider = 'site';
    if(c.provider === 'site' && !this.site()) c.provider = 'openai';
    return c;
  },
  saveCfg: function(c){ try { localStorage.setItem(this.key, JSON.stringify(c)); } catch(e){} },
  ready: function(){ const c = this.cfg(); return c.provider === 'site' ? true : c.provider === 'proxy' ? !!c.endpoint : !!c.apiKey; },
  /* Как ИИ считает: сначала описывает, что видит (штуки, размер горок), потом вес и КБЖУ НА 100 Г по таблице,
     а итог на порцию считает уже сайт (ИИ часто ошибается в умножении, а в табличных значениях — редко). */
  prompt: [
    'Ты опытный нутрициолог. На фото — еда, чаще всего домашняя русская кухня. Задача — как можно точнее оценить, сколько человек съест.',
    'ШАГ 1. Внимательно осмотри тарелку и опиши в поле "seen": какие продукты, СКОЛЬКО ШТУК каждого штучного (котлеты, яйца, сырники, сосиски, куски хлеба, пельмени — пересчитай дважды), какую часть тарелки занимает каждый и насколько высокая горка.',
    'Считай только еду на тарелке/в руках. Напитки и продукты на фоне не считай, если их явно не едят сейчас.',
    'ШАГ 2. Оцени вес каждого продукта в граммах. Ориентиры: обычная тарелка 24–26 см, вилка ~19 см, ложка ~15 см. Полная тарелка гарнира — 250–350 г, половина тарелки горкой — 180–250 г, четверть — 80–130 г. Котлета домашняя 80–100 г, куриная грудка 150–200 г, яйцо 55 г, сырник 50 г, сосиска 50 г, кусок хлеба 25–30 г, столовая ложка соуса 15–20 г. Домашние порции обычно больше, чем кажется на фото, — не занижай.',
    'Штучные одинаковые продукты — ОДИН пункт с общим весом, в названии количество: «котлеты ×2».',
    'Напитки и жидкости (вода, сок, чай, кофе, молоко, кефир, суп-бульон в кружке): unit "ml", объём в поле grams (стакан 250 мл, кружка 300 мл), КБЖУ на 100 мл. Для остальной еды unit "g".',
    'ШАГ 3. Для каждого продукта дай КБЖУ и сахар НА 100 Г готового блюда с учётом способа приготовления (жарка — с маслом; тёртые салаты с белыми вкраплениями — с майонезом). Опорные значения на 100 г (ккал/Б/Ж/У): макароны отварные 145/5/1/29; гречка отварная 110/4/1/21; рис отварной 130/2.5/0.3/28; пюре с маслом и молоком 105/2/4/15; картофель жареный 190/3/10/22; картофель отварной 85/2/0.4/17; котлета жареная свино-говяжья 250/15/18/8; котлета куриная 190/17/10/8; куриная грудка 150/30/3/0; курица с кожей запечённая 220/24/14/0; тушёное мясо, гуляш 180/16/12/3; рыба жареная 180/18/10/5; пельмени 250/11/12/25; плов 190/7/8/22; капуста тушёная 75/2/4/8; морковь тёртая с майонезом 170/1/15/7, без заправки 35/1/0/7; салат из овощей с маслом 90/1/7/5; оливье 190/5/15/8; яйцо варёное 155/13/11/1; яичница 190/13/15/1; сырники 220/15/10/18; омлет 180/10/14/2; хлеб белый 260/8/3/50; хлеб чёрный 200/6/1.5/40; сосиски 260/11/24/2; борщ 50/2/2.5/5; овсянка на молоке 110/4/3.5/16; сметана 15% 160/3/15/3; майонез 620/1/67/3; кетчуп 100/2/0/22.',
    'Проверь: ккал ≈ 4·Б + 9·Ж + 4·У, сахар не больше углеводов.',
    'Ответь ТОЛЬКО JSON без markdown и пояснений, числа — без единиц: {"seen":"что вижу, штуки, размеры","dish":"общее название","items":[{"name":"котлеты ×2","count":2,"grams":180,"unit":"g","per100":{"kcal":250,"p":15,"f":18,"c":8,"s":1}}],"confidence":0.0-1.0,"note":"коротко, что могло сбить оценку"}.',
    'Если на фото нет еды — {"seen":"","dish":"","items":[],"confidence":0,"note":"На фото не видно еды"}.'
  ].join(' '),
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
  parseJson: function(text){
    const t = String(text || '').replace(/```(?:json)?/gi, '');
    const i = t.indexOf('{'), j = t.lastIndexOf('}');
    if(i < 0 || j <= i) throw new Error('ИИ ответил не в том формате — попробуй ещё раз.');
    return JSON.parse(t.slice(i, j + 1));
  },
  providers: {
    // бесплатный ИИ сайта (ключ в static/config.js) — ничего настраивать не нужно
    site: async function(dataUrl, c, skip){
      const models = (await window.siteAI.models(true)).filter(function(m){ return !skip || skip.indexOf(m) < 0; });
      const r = await window.siteAI.fetch({ temperature:0.2,
        messages:[ { role:'system', content:VisionAI.prompt },
                   { role:'user', content:[ { type:'text', text:'Что на тарелке и сколько в этом КБЖУ и сахара? Ответь только JSON.' }, { type:'image_url', image_url:{ url:dataUrl } } ] } ] },
        { models:models, timeout:45000 });
      if(r.status === 402 || r.status === 429) throw new Error('ИИ сейчас занят или дневной лимит закончился — попробуй чуть позже.');
      if(r.status === 401) throw new Error('ИИ сайта временно недоступен (ключ не принят).');
      if(!r.ok) throw new Error('Сервис распознавания ответил ошибкой ' + r.status + '.');
      const used = window.siteAI.lastModel;
      try {
        const j = await r.json();
        const m = j.choices && j.choices[0] && j.choices[0].message;
        const text = m && (typeof m.content === 'string' ? m.content : (m.content || []).map(function(x){ return x.text || ''; }).join(''));
        return VisionAI.parseJson(text);
      } catch(e){
        // ответ не в том формате — один раз пробуем следующую модель
        if(!skip && used && models.length > 1) return VisionAI.providers.site(dataUrl, c, [used]);
        throw e;
      }
    },
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
  // «150 г», «12,5», null → число (или null)
  num: function(v){
    if(v == null || v === '') return null;
    if(typeof v === 'number') return isFinite(v) ? v : null;
    const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  },
  /* приводим ответ ИИ в порядок: числа, пределы, сверка калорий с БЖУ */
  clean: function(items){
    const n = VisionAI.num;
    return (Array.isArray(items) ? items : []).slice(0, 12).map(function(x){
      x = x || {};
      // новый формат: КБЖУ на 100 г + вес → итог на порцию считаем сами (точнее, чем умножение у ИИ)
      const h = x.per100 || x.per_100g || x.per100g;
      if(h && typeof h === 'object'){
        const g = n(x.grams != null ? x.grams : x.weight) || 0, k = g / 100;
        const hv = function(a, b){ const v = n(h[a] != null ? h[a] : h[b]); return v == null ? null : Math.max(0, v); };
        const kc = hv('kcal', 'calories'), hp = hv('p', 'protein') || 0, hf = hv('f', 'fat') || 0, hc = hv('c', 'carbs') || 0, hs = hv('s', 'sugar');
        x = { name:x.name, count:x.count, unit:x.unit, grams:g, kcal:kc == null ? null : kc * k, p:hp * k, f:hf * k, c:hc * k, s:hs == null ? null : hs * k };
      }
      const it = { name:String(x.name || x.title || 'Блюдо').trim().slice(0, 60) || 'Блюдо',
        grams:Math.max(0, Math.min(3000, n(x.grams != null ? x.grams : x.weight) || 0)),
        kcal:Math.round(Math.max(0, n(x.kcal != null ? x.kcal : x.calories) || 0)),
        p:Math.max(0, n(x.p != null ? x.p : x.protein) || 0), f:Math.max(0, n(x.f != null ? x.f : x.fat) || 0), c:Math.max(0, n(x.c != null ? x.c : x.carbs) || 0) };
      const s = n(x.s != null ? x.s : x.sugar);
      it.s = s == null ? null : Math.max(0, s);
      const byMacro = 4 * it.p + 9 * it.f + 4 * it.c;
      if(!it.kcal && byMacro) it.kcal = Math.round(byMacro);                 // калорий нет — считаем из БЖУ
      if(it.s != null && it.s > it.c) it.s = it.c;                           // сахара не бывает больше углеводов
      // больше 9 ккал на грамм не бывает (даже у масла) — значит ИИ посчитал КБЖУ на 100 г, а не на порцию: пересчитываем
      if(it.grams && it.kcal / it.grams > 9.2){
        const k = it.grams / 100;
        it.kcal = Math.round(it.kcal * k); it.p *= k; it.f *= k; it.c *= k; if(it.s != null) it.s *= k;
        it.warn = true;
      }
      // штучные продукты: сколько штук и вес одной — чтобы можно было поправить «1 → 2 котлеты» одной кнопкой
      it.unit = (x.unit === 'ml' || (x.unit !== 'g' && isLiquid(it.name))) ? 'ml' : 'g';
      let cnt = n(x.count);
      if(cnt == null){ const m = /[×x*]\s*(\d{1,2})\s*$/i.exec(it.name); if(m) cnt = +m[1]; }
      if(cnt != null && cnt >= 1 && cnt <= 30 && Math.round(cnt) === cnt && it.grams){ it.count = cnt; it.unit = it.grams / cnt; }
      return it;
    }).filter(function(it){ return it.kcal > 0 || it.grams > 0; });
  },
  /* фото этикетки → КБЖУ на 100 г */
  labelPrompt: [
    'На фото — упаковка продукта питания (одна или несколько сторон: лицевая с названием и обратная с составом).',
    'ШАГ 1. Всегда прочитай НАЗВАНИЕ продукта (крупный текст на лицевой стороне или строка «Наименование»/название над таблицей и составом), БРЕНД и вес/объём упаковки — даже если таблицы пищевой ценности не видно.',
    'ШАГ 2. Найди таблицу «Пищевая ценность» / «Энергетическая ценность» (Nutrition facts) и прочитай значения НА 100 г (или 100 мл): ккал, белки, жиры, углеводы, в т.ч. сахара.',
    'Если указано только на порцию — пересчитай на 100 г по весу порции. Если энергия только в кДж — переведи в ккал (÷4.184). Сахар не указан — null.',
    'Если таблицы нет или цифры не читаются — "per100": null (НЕ выдумывай цифры), но название и бренд всё равно заполни.',
    'Напиток или жидкость (вода, сок, молоко, кефир, энергетик, «на 100 мл», объём в мл/л) — unit "ml", иначе "g".',
    'Ответь ТОЛЬКО JSON без markdown: {"name":"","brand":"","qty":"","unit":"g","portion":100,"per100":{"kcal":0,"p":0,"f":0,"c":0,"s":null}}.',
    'Если на фото вообще нет упаковки еды — {"name":"","per100":null}.'
  ].join(' '),
  /* nut: достаём и проверяем КБЖУ на 100 г из объекта ответа ИИ */
  nut100: function(h){
    if(!h || typeof h !== 'object') return null;
    const n = VisionAI.num;
    const kcal = n(h.kcal != null ? h.kcal : h.calories);
    if(kcal == null || kcal < 0 || kcal > 950) return null;
    const pr = n(h.p != null ? h.p : h.protein) || 0, fa = n(h.f != null ? h.f : h.fat) || 0, ca = n(h.c != null ? h.c : h.carbs) || 0;
    if(!kcal && !pr && !fa && !ca && !/вода|water/i.test(String(h._name || ''))) return null;
    let sg = n(h.s != null ? h.s : h.sugar); if(sg != null && sg > ca) sg = ca;
    return { kcal:r1(kcal), p:r1(Math.max(0, pr)), f:r1(Math.max(0, fa)), c:r1(Math.max(0, ca)), s:sg == null ? null : r1(Math.max(0, sg)) };
  },
  /* фото упаковки (1–3 снимка) → { name, brand, qty, unit, portion, per100 | null } */
  label: async function(files){
    if(!this.site()) throw new Error('ИИ сайта не настроен — введи КБЖУ вручную.');
    files = (Array.isArray(files) ? files : [files]).filter(Boolean).slice(0, 3);
    const urls = [];
    for(let i = 0; i < files.length; i++) urls.push(await this.downscale(files[i], files.length > 1 ? 1024 : 1280));   // мелкий текст — фото покрупнее
    const content = [ { type:'text', text:'Прочитай название и пищевую ценность с упаковки. Только JSON.' } ]
      .concat(urls.map(function(u){ return { type:'image_url', image_url:{ url:u } }; }));
    const models = await window.siteAI.models(true);
    const r = await window.siteAI.fetch({ temperature:0, messages:[ { role:'system', content:VisionAI.labelPrompt }, { role:'user', content:content } ] }, { models:models, timeout:50000 });
    if(r.status === 402 || r.status === 429) throw new Error('ИИ сейчас занят или дневной лимит закончился — введи КБЖУ вручную.');
    if(!r.ok) throw new Error('Сервис распознавания ответил ошибкой ' + r.status + '.');
    const j = await r.json();
    const m = j.choices && j.choices[0] && j.choices[0].message;
    const o = VisionAI.parseJson(m && (typeof m.content === 'string' ? m.content : (m.content || []).map(function(x){ return x.text || ''; }).join('')));
    if(!o) return null;
    const name = String(o.name || '').trim().slice(0, 80);
    let h = o.per100 === undefined && o.kcal != null ? o : o.per100;             // старый формат — КБЖУ прямо в корне
    if(h && typeof h === 'object') h._name = name;
    const per100 = o.found === false ? null : VisionAI.nut100(h);
    if(!name && !per100) return null;
    return { name:name, brand:String(o.brand || '').trim().slice(0, 60), qty:String(o.qty || '').slice(0, 30),
      portion:Math.min(1000, Math.max(0, Math.round(VisionAI.num(o.portion) || 0))) || 100,
      per100:per100, unit:o.unit === 'ml' ? 'ml' : o.unit === 'g' ? 'g' : '' };
  },
  /* КБЖУ по названию, когда таблицу не разглядели: база OpenFoodFacts → поиск в интернете → оценка ИИ */
  byName: async function(name, brand, status){
    const q = ((brand && normTxt(name).indexOf(normTxt(brand)) < 0 ? brand + ' ' : '') + name).trim();
    const qw = normTxt(q).split(' ').filter(function(w){ return w.length > 2 && !/^\d/.test(w); });
    // 1) открытая база: берём товар, где совпадает большинство слов названия
    try {
      status('Ищу «' + esc(q) + '» в базе товаров…');
      const list = await OFF.search(q);
      const best = list.map(function(x){
        const n = normTxt((x.brand || '') + ' ' + x.name);
        const hit = qw.filter(function(w){ return n.indexOf(w.slice(0, Math.max(4, w.length - 2))) >= 0; }).length;
        return { x:x, k:qw.length ? hit / qw.length : 0 };
      }).filter(function(o){ return o.k >= 0.6; }).sort(function(a, b){ return b.k - a.k; })[0];
      if(best) return Object.assign({}, best.x, { src:'match', matched:best.x.name });
    } catch(e){}
    // 2) интернет (модель с веб-поиском)
    try {
      const sm = await window.siteAI.searchModels();
      if(sm.length){
        status('Ищу пищевую ценность «' + esc(q) + '» в интернете…');
        const w = await VisionAI.askJson('Найди в интернете пищевую ценность продукта «' + q + '» (сайты магазинов, производителя). Возьми значения с упаковки НА 100 г/мл. ' +
          'Ответь ТОЛЬКО JSON: {"found":true,"unit":"g","per100":{"kcal":0,"p":0,"f":0,"c":0,"s":null},"source":""}. Не нашёл точный товар — {"found":false}.', sm);
        const nt = w && w.found !== false ? VisionAI.nut100(w.per100) : null;
        if(nt) return Object.assign(nt, { src:'web', unit:w.unit === 'ml' ? 'ml' : undefined });
      }
    } catch(e){}
    // 3) оценка ИИ по типичному составу
    try {
      status('Оцениваю КБЖУ «' + esc(q) + '» по типичному составу…');
      const e = await VisionAI.askJson('Продукт: «' + q + '». Если это известный товар — дай значения с его упаковки, иначе типичные для такого продукта. КБЖУ и сахар НА 100 г (для напитков — на 100 мл). ' +
        'Ответь ТОЛЬКО JSON: {"unit":"g","per100":{"kcal":0,"p":0,"f":0,"c":0,"s":0},"sure":true}. Если это не еда — {"per100":null}.');
      const nt = e ? VisionAI.nut100(e.per100) : null;
      if(nt) return Object.assign(nt, { src:'estimate', unit:e.unit === 'ml' ? 'ml' : undefined });
    } catch(e){}
    return null;
  },
  askJson: async function(prompt, models){
    const r = await window.siteAI.fetch({ temperature:0, messages:[{ role:'user', content:prompt }] }, { models:models, timeout:45000 });
    if(!r.ok) return null;
    const j = await r.json();
    const m = j.choices && j.choices[0] && j.choices[0].message;
    try { return VisionAI.parseJson(m && (typeof m.content === 'string' ? m.content : (m.content || []).map(function(x){ return x.text || ''; }).join(''))); } catch(e){ return null; }
  },
  analyze: async function(file){
    const c = this.cfg();
    const fn = this.providers[c.provider];
    if(!fn || !this.ready()) throw new Error('need-config');
    const dataUrl = await this.downscale(file, 896);   // хватает для распознавания и экономит лимит
    const out = await fn(dataUrl, c);
    out.items = VisionAI.clean(out.items);
    out.dish = out.dish ? String(out.dish).slice(0, 80) : '';
    out.note = out.note ? String(out.note).slice(0, 200) : '';
    const conf = VisionAI.num(out.confidence);
    out.confidence = conf == null ? null : Math.min(1, Math.max(0, conf > 1 ? conf / 100 : conf));
    return out;
  }
};
let aiFile = null, aiItems = [], aiRunId = 0;
function renderVisionCfg(){
  const c = VisionAI.cfg();
  if($('aiProvSite')) $('aiProvSite').style.display = VisionAI.site() ? '' : 'none';
  segSet('aiProv', c.provider);
  $('aiKey').value = c.apiKey || ''; $('aiModel').value = c.model || 'gpt-4o-mini'; $('aiEndpoint').value = c.endpoint || '';
  $('aiKeyRow').style.display = c.provider === 'openai' ? '' : 'none';
  $('aiEpRow').style.display = c.provider === 'proxy' ? '' : 'none';
  $('aiCfg').classList.toggle('need', !VisionAI.ready());
  $('aiCfgState').textContent = VisionAI.ready() ? (c.provider === 'site' ? 'бесплатный ИИ сайта' : c.provider === 'openai' ? 'OpenAI · ' + (c.model || 'gpt-4o-mini') : 'свой сервер') : 'не настроено';
}
function aiPreview(file){
  aiFile = file; aiItems = []; aiRunId++;
  $('aiGo').textContent = 'Распознать блюдо и посчитать КБЖУ'; $('aiGo').classList.remove('ghost');
  $('aiDrop').classList.remove('scan');
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
  const run = ++aiRunId, file = aiFile;
  try {
    const out = await VisionAI.analyze(file);
    if(run !== aiRunId || file !== aiFile) return;                  // пока думал, выбрали другое фото — этот ответ не нужен
    aiItems = out.items;
    if(aiItems.some(function(x){ return x.warn; })) out.note = (out.note ? out.note + ' ' : '') + 'Проверь вес — ИИ мог ошибиться.';
    if(!aiItems.length){ $('aiResult').innerHTML = '<div class="fhint warn">' + esc(out.note || 'Не удалось распознать еду. Сфоткай сверху при хорошем свете.') + '</div>'; return; }
    aiItems.forEach(function(x){ x.k = x.grams ? { kcal:x.kcal / x.grams, p:x.p / x.grams, f:x.f / x.grams, c:x.c / x.grams, s:x.s == null ? null : x.s / x.grams } : null; });
    renderAiItems(out);
    $('aiGo').textContent = 'Распознать ещё раз'; $('aiGo').classList.add('ghost');
    // на телефоне сразу показываем результат и кнопку «Добавить»
    requestAnimationFrame(function(){ const t = $('aiAdd'); if(t && t.scrollIntoView) t.scrollIntoView({ block:'nearest', behavior:'smooth' }); });
  } catch(e){
    if(run !== aiRunId) return;
    const m = e && e.message || '';
    $('aiResult').innerHTML = '<div class="fhint warn">' + esc(
      m === 'need-config' ? 'Нужен ключ API — открой настройки ниже.' :
      m === 'image' ? 'Не получилось открыть фото. Сфоткай ещё раз или выбери снимок в JPG/PNG.' :
      /Failed to fetch|NetworkError|network|Load failed/i.test(m) ? 'Нет связи с сервисом распознавания. Проверь интернет и нажми ещё раз.' :
      m === 'timeout' || (e && e.name === 'AbortError') ? 'ИИ слишком долго думал. Нажми «Распознать» ещё раз.' :
      e instanceof SyntaxError || /формате/.test(m) ? 'ИИ ответил непонятно. Нажми «Распознать» ещё раз.' : m) + '</div>';
  } finally { if(run === aiRunId){ $('aiDrop').classList.remove('scan'); $('aiGo').disabled = !aiFile; } }
}
function renderAiItems(out){
  const tot = aiItems.reduce(function(t, x){ return { kcal:t.kcal + x.kcal, p:t.p + x.p, f:t.f + x.f, c:t.c + x.c, s:t.s + (x.s || 0) }; }, { kcal:0, p:0, f:0, c:0, s:0 });
  $('aiResult').innerHTML =
    (out && out.dish ? '<div class="ai-dish"><b>' + esc(out.dish) + '</b>' + (out.confidence != null ? '<span>уверенность ' + Math.round(out.confidence * 100) + '%</span>' : '') + '</div>' : '') +
    aiItems.map(function(x, i){
      return '<div class="ai-row"><input class="ai-n" data-i="' + i + '" value="' + esc(x.name) + '" aria-label="Название" />' +
        '<span class="ai-gw"><button type="button" class="ai-gs" data-i="' + i + '" data-d="-1" aria-label="Меньше">−</button>' +
        '<label class="ai-g"><input type="number" min="0" step="5" inputmode="numeric" data-i="' + i + '" value="' + Math.round(x.grams) + '" aria-label="Количество" /> <button type="button" class="ai-u" data-i="' + i + '" aria-label="Граммы или миллилитры">' + unitOf(x) + '</button></label>' +
        '<button type="button" class="ai-gs" data-i="' + i + '" data-d="1" aria-label="Больше">+</button></span>' +
        (x.count ? '<span class="ai-cnt"><button type="button" data-i="' + i + '" data-d="-1" aria-label="На одну штуку меньше">−</button><b>' + x.count + ' шт</b><button type="button" data-i="' + i + '" data-d="1" aria-label="На одну штуку больше">+</button></span>' : '') +
        '<span class="ai-k">' + Math.round(x.kcal) + ' ккал<br><small>Б ' + r1(x.p) + ' Ж ' + r1(x.f) + ' У ' + r1(x.c) + ' Сахар ' + sv(x.s) + '</small></span></div>';
    }).join('') +
    '<div class="ai-tot">Итого: <b>' + Math.round(tot.kcal) + ' ккал</b> · Б ' + r1(tot.p) + ' · Ж ' + r1(tot.f) + ' · У ' + r1(tot.c) + ' · Сахар ' + r1(tot.s) + '</div>' +
    (out && out.note ? '<div class="fhint">' + esc(out.note) + '</div>' : '') +
    '<button class="btn wide" type="button" id="aiAdd">Добавить в «' + MEALS.find(function(m){ return m.id === fMealSel; }).label + '»</button>';
}

/* ================= ТРЕНИРОВКА: модалка =================
   • Упражнение выбирается только из базы (живой поиск по мере ввода) — никаких «Влад» в дневнике.
   • Одно упражнение = одна карточка с массивом подходов { reps, kg }.
   • «Сохранить» и ✓ у подхода записывают упражнение, но окно не закрывается: можно сразу вписать
     следующий подход или перейти к следующему упражнению. */
const WO_EXTRA = [
  ['Жим гантелей лёжа', 'Грудь', 'жим гантелей'], ['Жим гантелей на наклонной скамье', 'Верх груди', 'наклонная гантели'],
  ['Жим в тренажёре Смита', 'Грудь', 'смит'], ['Жим от груди в тренажёре', 'Грудь', 'хаммер'],
  ['Подтягивания обратным хватом', 'Спина, бицепс', 'подтягивания'], ['Подтягивания в гравитроне', 'Спина', 'гравитрон'],
  ['Тяга гантели в наклоне', 'Спина', 'тяга одной рукой'], ['Тяга горизонтального блока', 'Спина', 'тяга к поясу блок'],
  ['Пуловер с гантелью', 'Грудь, спина', 'пуловер'], ['Становая тяга сумо', 'Ноги, спина', 'сумо становая'],
  ['Фронтальные приседания', 'Квадрицепс', 'присед фронтальный'], ['Приседания в Смите', 'Ноги', 'присед смит'],
  ['Гакк-приседания', 'Квадрицепс', 'гакк присед'], ['Приседания с гантелью (гоблет)', 'Ноги', 'гоблет присед'],
  ['Приседания без веса', 'Ноги', 'присед воздушные'], ['Сведение ног в тренажёре', 'Приводящие', 'сведение ног'],
  ['Разведение ног в тренажёре', 'Ягодицы', 'разведение ног отведение'], ['Армейский жим штанги стоя', 'Плечи', 'жим стоя армейский'],
  ['Жим гантелей сидя', 'Плечи', 'жим сидя плечи'], ['Жим Арнольда', 'Плечи', 'арнольд'],
  ['Подъём гантелей на бицепс', 'Бицепс', 'бицепс гантели'], ['Подъём на бицепс на нижнем блоке', 'Бицепс', 'бицепс блок'],
  ['Разгибание руки с гантелью из-за головы', 'Трицепс', 'французский гантель'], ['Отжимания от скамьи', 'Трицепс', 'обратные отжимания'],
  ['Скручивания на верхнем блоке', 'Пресс', 'молитва скручивания блок'], ['Боковая планка', 'Косые мышцы', 'планка боковая'],
  ['Русские скручивания', 'Косые мышцы', 'твист'], ['Вакуум', 'Пресс', ''],
  ['Бёрпи', 'Всё тело', 'берпи burpee'], ['Бег', 'Кардио', 'пробежка беговая дорожка'], ['Ходьба', 'Кардио', 'дорожка шаги'],
  ['Велотренажёр', 'Кардио', 'велосипед'], ['Эллипс', 'Кардио', 'эллиптический'], ['Гребной тренажёр', 'Кардио', 'гребля'],
  ['Скакалка', 'Кардио', ''], ['Степпер', 'Кардио', 'лестница']
];
/* ---- расход калорий на тренировке ----
   Метод — METы из «Компендиума физической активности» (Ainsworth и др.), по времени под нагрузкой:
   • силовые: время подхода = повторы × 3.5 с; MET рабочей фазы зависит от типа упражнения
     (базовые на ноги 6, базовые на верх 5, изолирующие 3.5, пресс 3.8) и растёт с весом снаряда
     относительно веса тела (до +37%); для упражнений с собственным весом берётся доля веса тела;
   • отдых между подходами ≈ 90 с (+60 с на подготовку) — пульс ещё высокий, MET ≈ 2.2;
   • кардио (бег, эллипс…) — вписываются минуты; статика (планка) — секунды.
   Считаем «активные» ккал (сверх покоя): (MET − 1) × вес тела × часы. Точность ±15–20% — точнее только пульсометр. */
const WO_KINDS = [
  { re:/вакуум/, t:'time', met:2.0 },
  { re:/планк/, t:'time', met:3.8 },
  { re:/(^|\s)бег($|\s)/, t:'cardio', met:9.8 }, { re:/ходьб/, t:'cardio', met:3.8 }, { re:/велотрен/, t:'cardio', met:6.8 },
  { re:/эллипс/, t:'cardio', met:5.0 }, { re:/гребн/, t:'cardio', met:7.0 }, { re:/скакалк/, t:'cardio', met:11.8 }, { re:/степпер/, t:'cardio', met:8.8 },
  { re:/б[её]рпи/, t:'reps', met:8.0, bw:0, tempo:3 },
  { re:/подтяг/, t:'reps', met:5.0, bw:1.0 }, { re:/гравитрон/, t:'reps', met:4.5, bw:0.5 },
  { re:/брусь/, t:'reps', met:5.0, bw:0.9 }, { re:/отжиман.*скам/, t:'reps', met:4.0, bw:0.5 }, { re:/отжиман/, t:'reps', met:4.5, bw:0.65 },
  { re:/скручив|подъ[её]м ног|велосипед|ролик|русские/, t:'reps', met:3.8, bw:0 },
  { re:/присед|станов|румынск|жим ногами|выпад|гакк|сумо|тяга штанги$|классическая тяга|ягодичный мост/, t:'reps', met:6.0, bw:0.7 },
  { re:/жим|тяга|пуловер|гиперэкст/, t:'reps', met:5.0, bw:0 },
  { re:/./, t:'reps', met:3.5, bw:0 }
];
function woKind(name){ const n = normTxt(name); return WO_KINDS.find(function(k){ return k.re.test(n); }); }
function bodyW(){
  try { const w = (ME.profile.weights || []).slice().sort(function(a, b){ return a.date < b.date ? -1 : 1; }); if(w.length) return +w[w.length - 1].kg; } catch(e){}
  return (ME && ME.profile && +ME.profile.weight) || 75;
}
function woBurn(name, sets){
  const k = woKind(name), W = bodyW();
  if(!sets || !sets.length) return 0;
  let kcal = 0;
  if(k.t === 'cardio'){
    const min = sets.reduce(function(s, x){ return s + (+x.reps || 0); }, 0);
    kcal = (k.met - 1) * W * min / 60;
  } else {
    sets.forEach(function(x){
      const reps = +x.reps || 0;
      const sec = k.t === 'time' ? reps : reps * (k.tempo || 3.5);
      const load = (+x.kg || 0) + (k.bw || 0) * W;                  // снаряд + часть собственного веса
      const met = k.t === 'time' ? k.met : k.met * (1 + 0.25 * Math.min(1.5, load / W));
      kcal += (met - 1) * W * sec / 3600;
    });
    const restSec = (sets.length - 1) * 90 + 60;                    // отдых между подходами + подготовка
    kcal += 1.2 * W * restSec / 3600;                               // пульс в отдыхе ещё высокий: MET ≈ 2.2
  }
  return Math.round(kcal);
}

let woCat = null;
function woCatalog(){
  if(woCat) return woCat;
  const words = function(t){ return normTxt(t).split(' ').filter(Boolean); };
  woCat = EXERCISES.map(function(e){ return { name:e.name, hint:e.main || e.muscle || '', keys:words(e.name + ' ' + (e.alt || '')), base:1 }; })
    .concat(WO_EXTRA.map(function(x){ return { name:x[0], hint:x[1], keys:words(x[0] + ' ' + x[2]), base:0 }; }));
  // популярные сокращения
  const alias = { 'Жим штанги лёжа':'жим лежа', 'Приседания со штангой':'приседания присед', 'Классическая тяга штанги':'становая тяга', 'Подтягивания широким хватом':'турник подтягивания' };
  woCat.forEach(function(e){ if(alias[e.name]){ e.keys = e.keys.concat(words(alias[e.name])); e.alias = [normTxt(alias[e.name])]; } });
  return woCat;
}
function woFind(q){
  const qw = normTxt(q).split(' ').filter(Boolean);
  if(!qw.length) return [];
  const nq = normTxt(q);
  return woCatalog().map(function(e){
    const ok = qw.every(function(w){ return e.keys.some(function(k){ return k.indexOf(w) === 0; }); });
    if(!ok) return null;
    const n = normTxt(e.name), nw = n.split(' ');
    const aliasHit = (e.alias || []).some(function(a){ return a.indexOf(nq) === 0; });
    // точное → начинается с запроса/синонима → первое слово совпадает → запрос внутри → остальное
    const score = n === nq ? 0 : (n.indexOf(nq) === 0 || aliasHit) ? 1 : nw[0].indexOf(qw[0]) === 0 ? 2 : n.indexOf(nq) >= 0 ? 3 : 4;
    return { e:e, score:score };
  }).filter(Boolean).sort(function(a, b){ return a.score - b.score || b.e.base - a.e.base || a.e.name.length - b.e.name.length; })   // сначала упражнения из раздела «Зал»
    .slice(0, 8).map(function(x){ return x.e; });
}
function woExact(v){ const n = normTxt(v); return woCatalog().find(function(e){ return normTxt(e.name) === n; }) || null; }

let woEditId = null, woPicked = null, woLegacy = null, woDirty = false, woSugList = [], woSugI = -1;
function openWorkoutModal(id){
  woEditId = id || null; woDirty = false;
  const d = dayData(dDate);
  const w = id && d ? d.workout.find(function(x){ return x.id === id; }) : null;
  woLegacy = w && !woExact(w.name) ? w.name : null;          // старая запись со своим названием — редактировать можно
  $('woTitle').textContent = w ? 'Изменить упражнение' : 'Добавить упражнение';
  $('woName').value = w ? w.name : '';
  woPicked = w ? w.name : null;
  $('woSets').innerHTML = '';
  (w ? w.sets : [{ reps:10, kg:'' }]).forEach(function(s){ addSetRow(s.reps, s.kg, !!w); });
  // недавние — только упражнения из базы
  const recent = [];
  Object.keys(diaryStore()).sort().reverse().forEach(function(ds){ (diaryStore()[ds].workout || []).forEach(function(x){ const e = woExact(x.name); if(e && recent.indexOf(e.name) < 0 && recent.length < 8) recent.push(e.name); }); });
  $('woRecent').innerHTML = recent.map(function(n){ return '<button type="button" class="chip" data-n="' + esc(n) + '">' + esc(n) + '</button>'; }).join('');
  $('woRecentWrap').style.display = recent.length && !w ? '' : 'none';
  $('woNext').style.display = 'none';
  woHideSug(); woState(); woLastHint();
  $('woModal').classList.add('on');
  setTimeout(function(){ if(!w && window.innerWidth > 700) $('woName').focus(); }, 80);
}
/* выбранное упражнение → если сегодня оно уже записано, продолжаем ту же карточку (без дублей) */
function woPick(name){
  woPicked = name; $('woName').value = name;
  woHideSug();
  const d = dayData(dDate);
  const same = d && d.workout.find(function(x){ return normTxt(x.name) === normTxt(name) && x.id !== woEditId; });
  if(same && !woEditId){
    woEditId = same.id;
    $('woSets').innerHTML = '';
    same.sets.forEach(function(st){ addSetRow(st.reps, st.kg, true); });
    const last = same.sets[same.sets.length - 1];
    addSetRow(last ? last.reps : 10, last ? last.kg : '', false);
    toast('Продолжаем: ' + name + ' — уже ' + same.sets.length + ' ' + plural(same.sets.length, 'подход', 'подхода', 'подходов'));
  }
  $('woRecentWrap').style.display = 'none';
  woState(); woLastHint();
}
/* подписи колонок под тип упражнения: кардио — минуты, планка — секунды, без веса */
function woApplyKind(){
  const k = woPicked ? woKind(woPicked) : null;
  const noKg = k && (k.t === 'cardio' || k.t === 'time');
  $('woHR').textContent = k && k.t === 'cardio' ? 'Минуты' : k && k.t === 'time' ? 'Секунды' : 'Повторы';
  $('woHK').textContent = noKg ? '' : 'Вес, кг';
  $('woSets').classList.toggle('nokg', !!noKg);
  $('woHead').classList.toggle('nokg', !!noKg);
}
function woLiveBurn(){
  if(!woPicked){ $('woBurn').textContent = ''; return; }
  const sets = Array.prototype.map.call($('woSets').children, function(r){ return { reps:+r.querySelector('.set-r').value || 0, kg:+String(r.querySelector('.set-k').value).replace(',', '.') || 0 }; })
    .filter(function(x){ return x.reps > 0; });
  const kc = woBurn(woPicked, sets);
  const k = woKind(woPicked);
  $('woBurn').innerHTML = kc ? '🔥 ≈ <b>' + kc + ' ккал</b> сожжёшь за это упражнение <span>(при весе тела ' + r1(bodyW()) + ' кг' + (k.t === 'cardio' ? ', средний темп' : '') + ')</span>' : '';
}
function woState(){
  const v = $('woName').value.trim();
  const valid = !!woPicked && normTxt(v) === normTxt(woPicked);
  if(!valid) woPicked = null;
  const noMatch = v.length >= 2 && !valid && !woFind(v).length;
  $('woErr').style.display = noMatch ? '' : 'none';
  $('woName').classList.toggle('bad', noMatch);
  $('woName').classList.toggle('ok', valid);
  $('woClear').style.display = v ? '' : 'none';
  $('woSave').disabled = !valid;
  $('woSets').classList.toggle('locked', !valid);
  woApplyKind(); woLiveBurn();
}
function woRenderSug(){
  const v = $('woName').value;
  woSugList = (woPicked && normTxt(v) === normTxt(woPicked)) ? [] : woFind(v);
  woSugI = woSugList.length ? 0 : -1;
  if(!woSugList.length){ woHideSug(); return; }
  const nq = normTxt(v).split(' ')[0];
  $('woSug').innerHTML = woSugList.map(function(e, i){
    return '<button type="button" role="option" class="wo-opt' + (i === woSugI ? ' on' : '') + '" data-i="' + i + '"><b>' + hl(e.name, nq) + '</b>' + (e.hint ? '<small>' + esc(e.hint) + '</small>' : '') + '</button>';
  }).join('');
  $('woSug').style.display = '';
  $('woName').setAttribute('aria-expanded', 'true');
}
function woHideSug(){ $('woSug').style.display = 'none'; $('woName').setAttribute('aria-expanded', 'false'); }
function hl(t, q){
  const s = esc(t); if(!q) return s;
  const i = normTxt(t).indexOf(q);
  return i < 0 ? s : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
}
function addSetRow(reps, kg, done){
  const n = $('woSets').children.length + 1;
  const row = document.createElement('div');
  row.className = 'setrow' + (done ? ' done' : '');
  row.innerHTML = '<span class="set-n"><small>Подход</small><b>' + n + '</b></span>' +
    '<label><input type="number" inputmode="numeric" min="1" max="200" class="set-r" value="' + (reps || '') + '" placeholder="10" aria-label="Повторения" /></label>' +
    '<label><input type="number" inputmode="decimal" min="0" max="500" step="0.5" class="set-k" value="' + (kg === 0 || kg ? kg : '') + '" placeholder="0" aria-label="Вес, кг" /></label>' +
    '<button type="button" class="set-ok" aria-label="Сохранить подход"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>' +
    '<button type="button" class="set-del" aria-label="Удалить подход">' + D_ICON.x + '</button>';
  $('woSets').appendChild(row);
  return row;
}
function renumberSets(){ Array.prototype.forEach.call($('woSets').children, function(r, i){ r.querySelector('.set-n b').textContent = i + 1; }); }
function woLastHint(){
  // подсказка: что было в прошлый раз в этом упражнении — чтобы видеть прогресс
  const name = normTxt(woPicked || '');
  if(!name){ $('woLast').textContent = ''; return; }
  const days = Object.keys(diaryStore()).sort().reverse();
  for(let i = 0; i < days.length; i++){
    if(days[i] === dDate) continue;
    const w = (diaryStore()[days[i]].workout || []).find(function(x){ return normTxt(x.name) === name; });
    if(w){
      const best = Math.max.apply(null, w.sets.map(function(s){ return s.kg || 0; }));
      $('woLast').innerHTML = 'Прошлый раз (' + humanDate(days[i]).toLowerCase() + '): ' + w.sets.map(function(s){ return s.reps + (s.kg ? '×' + r1(s.kg) : ''); }).join(', ') + (best ? ' · лучший вес <b>' + r1(best) + ' кг</b>' : '');
      return;
    }
  }
  $('woLast').textContent = '';
}
/* записать упражнение (не закрывая окно). row — если нажали ✓ у конкретного подхода */
function saveWorkout(row){
  if(!woPicked){ toast('Выбери упражнение из списка'); $('woName').focus(); return false; }
  const rows = Array.prototype.slice.call($('woSets').children);
  const sets = [];
  rows.forEach(function(r){
    const reps = Math.round(+r.querySelector('.set-r').value || 0);
    if(reps > 0) sets.push({ reps:reps, kg:r1(+String(r.querySelector('.set-k').value).replace(',', '.') || 0) });
  });
  if(!sets.length){ toast('Впиши повторения хотя бы в одном подходе'); const f = rows[0] && rows[0].querySelector('.set-r'); if(f) f.focus(); return false; }
  const d = dayData(dDate, true);
  const ex = EXERCISES.find(function(e){ return normTxt(e.name) === normTxt(woPicked); });
  let w = woEditId ? d.workout.find(function(x){ return x.id === woEditId; }) : null;
  let append = false;
  if(!w){ w = d.workout.find(function(x){ return normTxt(x.name) === normTxt(woPicked); }); append = !!w; }   // то же упражнение сегодня — дописываем в ту же карточку
  const isNew = !w;
  if(w){ w.name = woPicked; w.sets = append ? w.sets.concat(sets) : sets; w.exId = ex ? ex.id : null; }
  else { w = { id:uid(), name:woPicked, exId:ex ? ex.id : null, sets:sets }; d.workout.push(w); }
  woEditId = w.id; woDirty = false;
  save();
  rows.forEach(function(r){ r.classList.toggle('done', (+r.querySelector('.set-r').value || 0) > 0); });
  renderDiary({ flash:w.id });
  achCheck();
  if(row){
    const n = rows.indexOf(row) + 1;
    toast('Подход ' + n + ' записан ✓');
    // ✓ у последнего подхода — сразу открываем строку для следующего (копия этого)
    if(row === rows[rows.length - 1]){
      const nr = addSetRow(row.querySelector('.set-r').value, row.querySelector('.set-k').value, false);
      nr.classList.add('new');
      setTimeout(function(){ const f = nr.querySelector('.set-r'); f.focus(); f.select && f.select(); }, 30);
    }
  } else {
    const kd = woKind(woPicked), tot = sets.reduce(function(a, x){ return a + x.reps; }, 0);
    toast((isNew ? 'Записал: ' : 'Сохранил: ') + woPicked + ' · ' + (kd.t === 'cardio' ? tot + ' мин' : sets.length + ' ' + plural(sets.length, 'подход', 'подхода', 'подходов')) + ' · ≈' + woBurn(woPicked, sets) + ' ккал');
  }
  $('woTitle').textContent = 'Изменить упражнение';
  $('woNext').style.display = '';
  return true;
}
function woNextExercise(){
  woEditId = null; woPicked = null; woLegacy = null; woDirty = false;
  $('woName').value = ''; $('woSets').innerHTML = ''; addSetRow(10, '', false);
  $('woTitle').textContent = 'Добавить упражнение';
  $('woNext').style.display = 'none'; $('woLast').textContent = '';
  woState(); woHideSug();
  setTimeout(function(){ $('woName').focus(); }, 30);
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
  $('dDateLabel').onclick = function(){ if(dDate !== today()){ dDate = today(); renderDiary(); } };
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
  // единицы: ручной ввод — г/мл (напиток по названию выбирается сам), экран порции — тап по «г/мл»
  let fmUnitTouched = false;
  segInit('fmUnit', function(){ fmUnitTouched = true; });
  $('fmName').addEventListener('input', function(){ if(!fmUnitTouched) segSet('fmUnit', isLiquid(this.value) ? 'ml' : 'g'); });
  $('fpUnit').onclick = function(){
    if(!fPick || !fPick.per100) return;
    fPick.unit = fPick.unit === 'ml' ? 'g' : 'ml';
    const u = unitOf(fPick);
    this.textContent = u;
    $('fpPer').textContent = $('fpPer').textContent.replace(/^На 100 (г|мл)/, 'На 100 ' + u);
    $('fpChips').querySelectorAll('.chip').forEach(function(c){ c.textContent = c.dataset.v + ' ' + u; });
  };
  // модалка еды
  segInit('fMealSeg', function(v){ fMealSel = v; renderFAdded(); updatePortion(); const b = $('aiAdd'); if(b) b.textContent = 'Добавить в «' + MEALS.find(function(m){ return m.id === v; }).label + '»'; });
  segInit('fTabs', foodTab);
  $('fQ').addEventListener('input', function(){ if(this.value) $('fNotFound').style.display = 'none'; renderLocalResults(this.value); $('fOffRes').innerHTML = ''; $('fOffStatus').textContent = ''; });
  $('fQ').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); if(fLocalList.length && !e.shiftKey && this.value.trim()) showPortion(fLocalList[0]); else offSearch(); } });
  $('fOffBtn').onclick = offSearch;
  $('foodModal').addEventListener('click', function(e){
    if(e.target.closest('#fDone')){ closeFoodModal(); return; }
    const dl = e.target.closest('#fAdded [data-del]');
    if(dl){
      const d = dayData(dDate); if(!d) return;
      const it = d.meals[fMealSel].find(function(x){ return x.id === dl.dataset.del; });
      d.meals[fMealSel] = d.meals[fMealSel].filter(function(x){ return x.id !== dl.dataset.del; });
      save(); renderDiary(); renderFAdded(); achCheck(true);
      if(it) toast('Убрал: ' + it.name);
      return;
    }
    const r = e.target.closest('.fres');
    if(r){ const k = r.dataset.key; showPortion(k[0] === 'l' ? fLocalList[+k.slice(1)] : fOffList[+k.slice(1)]); return; }
    const c = e.target.closest('#fpChips .chip'); if(c){ $('fpAmount').value = c.dataset.v; updatePortion(); return; }
    const au = e.target.closest('.ai-u');
    if(au){ const x = aiItems[+au.dataset.i]; if(x){ x.unit = x.unit === 'ml' ? 'g' : 'ml'; au.textContent = unitOf(x); } return; }
    const gs = e.target.closest('.ai-gs');
    if(gs){
      // «на глаз больше/меньше»: шаг 10 г для маленьких порций, 25 г для больших
      const gi = gs.parentNode.querySelector('.ai-g input'), g = +gi.value || 0, st = g < 100 ? 10 : 25;
      gi.value = Math.max(0, Math.round((g + st * (+gs.dataset.d)) / 5) * 5);
      gi.dispatchEvent(new Event('input', { bubbles:true }));
      return;
    }
    const cb = e.target.closest('.ai-cnt button');
    if(cb){
      const x = aiItems[+cb.dataset.i]; if(!x || !x.unit) return;
      x.count = Math.max(1, Math.min(30, x.count + (+cb.dataset.d)));
      x.name = String(x.name).replace(/\s*[×x*]\s*\d{1,2}\s*$/i, '') + (x.count > 1 ? ' ×' + x.count : '');
      const row = cb.closest('.ai-row');
      row.querySelector('.ai-n').value = x.name;
      row.querySelector('.ai-cnt b').textContent = x.count + ' шт';
      const gi = row.querySelector('.ai-g input'); gi.value = Math.round(x.unit * x.count);
      gi.dispatchEvent(new Event('input', { bubbles:true }));        // пересчёт калорий и итога
      return;
    }
    if(e.target.closest('#aiAdd')){
      const add = aiItems.filter(function(x){ return x.kcal > 0 || x.grams > 0; });
      if(!add.length){ toast('Нечего добавлять — укажи вес'); return; }
      add.forEach(function(x){
        const name = String(x.name || '').trim() || 'Блюдо';
        const item = { name:name, brand:'распознано по фото', grams:x.grams || null, unit:x.unit === 'ml' ? 'ml' : 'g', portion:x.grams ? null : '1 порция', kcal:Math.round(x.kcal), p:r1(x.p), f:r1(x.f), c:r1(x.c), s:x.s == null ? null : r1(x.s), src:'ai' };
        // база на 100 г — чтобы блюдо появилось в «Недавних» и его можно было добавить снова в пару нажатий
        if(x.grams) item.base = { id:'ai-' + name.toLowerCase(), name:name, kcal:Math.round(x.kcal / x.grams * 100), p:r1(x.p / x.grams * 100), f:r1(x.f / x.grams * 100), c:r1(x.c / x.grams * 100), s:x.s == null ? null : r1(x.s / x.grams * 100), per100:true, src:'ai', unit:item.unit };
        addFoodToDiary(dDate, fMealSel, item);
      });
      aiPreview(null); $('aiResult').innerHTML = '';
      foodStay('photo');
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
  // товар без штрих-кода (или код стёрся) — фото упаковки, ИИ читает название и КБЖУ
  $('bcPackFile').addEventListener('change', function(){
    const f = Array.prototype.slice.call(this.files || []); this.value = '';
    if(!f.length) return;
    if(!VisionAI.ready()){ bcStatus('ИИ сайта не настроен — добавь продукт вручную.', 'warn'); return; }
    bcPending = null; Scanner.stop(); $('bcNf').style.display = 'none';
    readLabel(f);
  });
  // фото + ИИ
  // сфоткал или выбрал из галереи — сразу распознаём, без лишнего нажатия
  const aiPick = function(){ const f = this.files[0] || null; this.value = ''; aiPreview(f); if(f && VisionAI.ready()) aiRun(); };
  $('aiFile').addEventListener('change', aiPick);
  if($('aiFileGal')) $('aiFileGal').addEventListener('change', aiPick);
  $('aiGo').onclick = aiRun;
  $('aiResult').addEventListener('input', function(e){
    const i = +e.target.dataset.i; if(isNaN(i)) return;
    const x = aiItems[i];
    if(e.target.classList.contains('ai-n')){ x.name = e.target.value; return; }
    const g = Math.max(0, Math.min(3000, +e.target.value || 0));
    if(!x.k && x.grams === 0 && g > 0 && x.kcal > 0){ x.grams = g; x.k = { kcal:x.kcal / g, p:x.p / g, f:x.f / g, c:x.c / g, s:x.s == null ? null : x.s / g }; }
    if(x.k){ x.kcal = x.k.kcal * g; x.p = x.k.p * g; x.f = x.k.f * g; x.c = x.k.c * g; if(x.k.s != null) x.s = x.k.s * g; }
    x.grams = g;
    if(x.count && g) x.unit = g / x.count;                           // поправил вес вручную — вес одной штуки тоже меняется
    const k = e.target.closest('.ai-row').querySelector('.ai-k');
    k.innerHTML = Math.round(x.kcal) + ' ккал<br><small>Б ' + r1(x.p) + ' Ж ' + r1(x.f) + ' У ' + r1(x.c) + ' Сахар ' + sv(x.s) + '</small>';
    const tot = aiItems.reduce(function(t, y){ return { kcal:t.kcal + y.kcal, p:t.p + y.p, f:t.f + y.f, c:t.c + y.c, s:t.s + (y.s || 0) }; }, { kcal:0, p:0, f:0, c:0, s:0 });
    $('aiResult').querySelector('.ai-tot').innerHTML = 'Итого: <b>' + Math.round(tot.kcal) + ' ккал</b> · Б ' + r1(tot.p) + ' · Ж ' + r1(tot.f) + ' · У ' + r1(tot.c) + ' · Сахар ' + r1(tot.s);
  });
  segInit('aiProv', function(v){ const c = VisionAI.cfg(); c.provider = v; c.explicit = true; VisionAI.saveCfg(c); renderVisionCfg(); });
  $('aiSave').onclick = function(){
    const c = VisionAI.cfg();
    c.apiKey = $('aiKey').value.trim(); c.model = $('aiModel').value.trim() || 'gpt-4o-mini'; c.endpoint = $('aiEndpoint').value.trim();
    VisionAI.saveCfg(c); renderVisionCfg(); toast(VisionAI.ready() ? 'Распознавание настроено' : 'Настройки сохранены');
  };
  // тренировка — модалка
  $('woAddSet').onclick = function(){
    const rows = $('woSets').children, last = rows[rows.length - 1];
    const nr = addSetRow(last ? last.querySelector('.set-r').value : 10, last ? last.querySelector('.set-k').value : '', false);   // копия прошлого подхода
    nr.classList.add('new'); woDirty = true;
  };
  $('woSets').addEventListener('click', function(e){
    const ok = e.target.closest('.set-ok');
    if(ok){ saveWorkout(ok.closest('.setrow')); return; }
    const b = e.target.closest('.set-del'); if(!b) return;
    if($('woSets').children.length <= 1){ toast('Нужен хотя бы один подход'); return; }
    b.closest('.setrow').remove(); renumberSets(); woDirty = true;
    if(woEditId) saveWorkout();                                    // удалили подход у записанного упражнения — сразу сохраняем
  });
  $('woSets').addEventListener('input', function(e){ const r = e.target.closest('.setrow'); if(r) r.classList.remove('done'); woDirty = true; woLiveBurn(); });
  // Enter в поле веса = ✓ (удобно на телефоне: «Готово» на клавиатуре)
  $('woSets').addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const r = e.target.closest('.setrow'); if(!r) return;
    if(e.target.classList.contains('set-r')) r.querySelector('.set-k').focus(); else saveWorkout(r);
  });
  // живой поиск упражнения
  $('woName').addEventListener('input', function(){
    const v = this.value;
    const ex = woExact(v);
    if(ex){ if(!woPicked || normTxt(woPicked) !== normTxt(ex.name)) woPick(ex.name); woState(); woLastHint(); return; }   // вписал точное название — как выбор из списка
    else if(!(woLegacy && normTxt(v) === normTxt(woLegacy))) woPicked = null;
    else woPicked = woLegacy;
    woRenderSug(); woState(); woLastHint();
  });
  $('woName').addEventListener('focus', function(){ if(!woPicked) woRenderSug(); });
  $('woName').addEventListener('blur', function(){ setTimeout(woHideSug, 180); });
  $('woName').addEventListener('keydown', function(e){
    if($('woSug').style.display === 'none' || !woSugList.length){ if(e.key === 'Enter'){ e.preventDefault(); if(woPicked){ const f = $('woSets').querySelector('.set-r'); if(f) f.focus(); } } return; }
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault();
      woSugI = (woSugI + (e.key === 'ArrowDown' ? 1 : -1) + woSugList.length) % woSugList.length;
      $('woSug').querySelectorAll('.wo-opt').forEach(function(o, i){ o.classList.toggle('on', i === woSugI); });
    } else if(e.key === 'Enter'){ e.preventDefault(); if(woSugI >= 0) woPick(woSugList[woSugI].name); }
    else if(e.key === 'Escape'){ woHideSug(); }
  });
  // pointerdown, чтобы выбор срабатывал раньше, чем поле потеряет фокус
  $('woSug').addEventListener('pointerdown', function(e){ const o = e.target.closest('.wo-opt'); if(!o) return; e.preventDefault(); woPick(woSugList[+o.dataset.i].name); });
  $('woSug').addEventListener('click', function(e){ const o = e.target.closest('.wo-opt'); if(o && !woPicked) woPick(woSugList[+o.dataset.i].name); });
  $('woClear').onclick = function(){ $('woName').value = ''; woPicked = null; woState(); woRenderSug(); $('woName').focus(); };
  $('woRecent').addEventListener('click', function(e){ const c = e.target.closest('.chip'); if(!c) return; woPick(c.dataset.n); });
  $('woSave').onclick = function(){ saveWorkout(null); };
  $('woNext').onclick = woNextExercise;
  // закрыли окно с несохранёнными подходами — сохраняем сами, чтобы ничего не потерять
  $('woModal').addEventListener('click', function(e){
    if((e.target === $('woModal') || e.target.closest('[data-close="woModal"]')) && woDirty && woPicked) saveWorkout(null);
  }, true);
  // прогресс
  segInit('progTabs', function(v){ progTab = v; renderProgress(); });
  $('progEx').addEventListener('change', function(){ progEx = this.value; renderProgress(); });
  window.addEventListener('resize', function(){ if($('progModal').classList.contains('on')) renderProgress(); });
}
