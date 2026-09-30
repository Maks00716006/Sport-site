/* ================= WSPORT: рекорды и 1ПМ, разбор дня от ментора, итоги недели/месяца, напоминания =================
   Подключается до app.js. Всё запускается из Extras.init() при входе в аккаунт. Данные хранятся в профиле:
     ME.profile.remind   = { on:true, days:[1,3,5] }   // дни тренировок: 1 = пн … 7 = вс
     ME.profile.nudges   = { date:'2026-09-30', shown:{ water:1, … }, last:ms }
     ME.profile.sumSeen  = { week:'2026-09-22', month:'2026-09' }
     день дневника: d.review = { text, hash, at }  — кэш разбора дня; упражнение: w.pr = true — рекорд */
const Extras = (function(){
  const GOAL = { cut:'сушка (снижение веса)', keep:'поддержание формы', bulk:'набор массы', mass:'набор массы', gain:'набор массы' };
  const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const MON_NOM = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const pad = function(n){ return String(n).padStart(2, '0'); };
  const nowHM = function(){ const d = new Date(); return d.getHours() + d.getMinutes() / 60; };

  /* ================= 1. СИЛА: 1ПМ и рекорды =================
     1ПМ (разовый максимум) по подходу: 1 повтор — сам вес; до 10 повторов — среднее формул Эпли и Бжицки
     (так точнее всего на средних повторах); 11–15 — Эпли; больше 15 повторов 1ПМ не считаем — слишком неточно. */
  function e1rm(kg, reps){
    kg = +kg || 0; reps = Math.round(+reps || 0);
    if(kg <= 0 || reps <= 0 || reps > 15) return 0;
    if(reps === 1) return kg;
    const ep = kg * (1 + reps / 30);
    return reps <= 10 ? (ep + kg * 36 / (37 - reps)) / 2 : ep;
  }
  function bestOf(sets){
    let e = 0, kg = 0, reps = 0;
    (sets || []).forEach(function(s){ const v = e1rm(s.kg, s.reps); if(v > e) e = v; if((+s.kg || 0) > kg || ((+s.kg || 0) === kg && s.reps > reps)){ kg = +s.kg || 0; reps = s.reps; } });
    return { e:e, kg:kg, reps:reps };
  }
  function weighted(name){ const k = woKind(name); return k.t === 'reps'; }
  /* по дням: лучший 1ПМ и лучший вес в упражнении */
  function sessions(name, until){
    const nn = normTxt(name), out = [];
    Object.keys(diaryStore()).sort().forEach(function(ds){
      if(until && ds >= until) return;
      (diaryStore()[ds].workout || []).forEach(function(w){
        if(normTxt(w.name) !== nn) return;
        const b = bestOf(w.sets);
        if(b.e > 0 || b.kg > 0) out.push({ date:ds, e1rm:b.e, kg:b.kg, reps:b.reps, vol:woVolume(w) });
      });
    });
    return out;
  }
  function priorBest(name, date){ return sessions(name, date).reduce(function(m, x){ return Math.max(m, x.e1rm); }, 0); }
  /* все рекорды: по каждому упражнению с весом — лучший 1ПМ и когда он был */
  function records(){
    const by = {};
    Object.keys(diaryStore()).sort().forEach(function(ds){
      (diaryStore()[ds].workout || []).forEach(function(w){
        if(!weighted(w.name)) return;
        const b = bestOf(w.sets); if(!b.e) return;
        const k = normTxt(w.name);
        if(!by[k] || b.e > by[k].e1rm) by[k] = { name:w.name, e1rm:b.e, date:ds, kg:b.kg, reps:b.reps, first:by[k] ? by[k].first : b.e };
        if(!by[k].first) by[k].first = b.e;
      });
    });
    return Object.keys(by).map(function(k){ return by[k]; }).sort(function(a, b){ return b.e1rm - a.e1rm; });
  }
  /* вызывается после сохранения упражнения: новый рекорд — праздничный тост и 🏆 в карточке */
  function checkPR(w, date){
    if(!w || !weighted(w.name)) return;
    const b = bestOf(w.sets), prev = priorBest(w.name, date);
    const was = !!w.pr;
    w.pr = prev > 0 && b.e > prev + 0.25;
    if(w.pr && (!was || b.e > (w.prVal || 0) + 0.25)){
      w.prVal = r1(b.e);
      setTimeout(function(){ toast('🏆 Рекорд! ' + w.name + ': 1ПМ ≈ ' + Math.round(b.e) + ' кг (+' + r1(b.e - prev) + ')'); }, 900);
    }
    if(!w.pr) delete w.prVal;
  }

  /* ================= 2. РАЗБОР ДНЯ ОТ МЕНТОРА ================= */
  let reviewBusy = false, autoTried = {};
  function dayHash(date){
    const d = dayData(date); if(!d) return '';
    const t = dayTotals(date);
    return [Math.round(t.kcal), Math.round(t.p), Math.round(t.s), d.water || 0, (d.workout || []).length,
      MEALS.map(function(m){ return (d.meals[m.id] || []).length; }).join('')].join('|');
  }
  function dayPrompt(date){
    const d = dayData(date), t = dayTotals(date), sg = Math.round((norm.kcal || 2000) * 0.10 / 4);
    const meals = MEALS.map(function(m){
      const it = (d.meals[m.id] || []);
      return it.length ? m.label + ': ' + it.map(function(x){ return x.name + (x.grams ? ' ' + Math.round(x.grams) + (x.unit === 'ml' ? ' мл' : ' г') : '') + ' (' + Math.round(x.kcal) + ' ккал)'; }).join(', ') : m.label + ': —';
    }).join('\n');
    const wo = (d.workout || []).map(function(w){ return w.name + ' ' + w.sets.map(function(s){ return s.reps + (s.kg ? '×' + s.kg : ''); }).join(','); }).join('; ');
    const burn = (d.workout || []).reduce(function(s, w){ return s + woBurn(w.name, w.sets); }, 0);
    const isToday = date === today(), hm = new Date();
    return 'Ты — ИИ-ментор фитнес-сайта WSPORT, общаешься как дружелюбный бро-тренер. Коротко разбери день питания.\n' +
      'Цель: ' + (GOAL[ME.profile.goal] || 'поддержание формы') + '. Вес тела ' + r1(bodyW()) + ' кг.\n' +
      'Норма: ' + norm.kcal + ' ккал, Б ' + norm.p + ' г, Ж ' + norm.f + ' г, У ' + norm.c + ' г. Сахар — ориентир до ' + sg + ' г.\n' +
      'Съедено: ' + Math.round(t.kcal) + ' ккал, Б ' + Math.round(t.p) + ', Ж ' + Math.round(t.f) + ', У ' + Math.round(t.c) + ', сахар ' + Math.round(t.s) + ' г' + (t.sUnknown ? ' (у ' + t.sUnknown + ' продуктов сахар неизвестен)' : '') + '.\n' +
      meals + '\n' +
      'Вода: ' + (d.water || 0) + ' из ' + waterGoal() + ' мл.\n' +
      'Тренировка: ' + (wo ? wo + ' (≈' + burn + ' ккал сожжено)' : 'не было') + '.\n' +
      (isToday ? 'Сейчас ' + pad(hm.getHours()) + ':' + pad(hm.getMinutes()) + ', день ещё идёт — если чего-то не хватает, подскажи, что съесть вечером.\n' : 'Это прошедший день — советы на следующий.\n') +
      'Ответь по-русски ровно 3 короткими строками, каждая начинается с эмодзи: «✅» — что получилось хорошо, «⚠️» — главное, что поправить (с цифрами), «👉» — конкретный совет с названиями продуктов. ' +
      'Без приветствий, заголовков и markdown. Всего не больше 60 слов. Не упрекай, поддерживай.';
  }
  async function makeReview(date, auto){
    if(reviewBusy || !(window.siteAI && siteAI.ready())) return;
    const d = dayData(date); if(!d || !hasFood(date)) return;
    reviewBusy = true; renderReview();
    try {
      const r = await siteAI.fetch({ temperature:0.5, messages:[{ role:'user', content:dayPrompt(date) }] }, { timeout:40000 });
      if(!r.ok) throw new Error(r.status === 402 || r.status === 429 ? 'limit' : 'http');
      const j = await r.json();
      const m = j.choices && j.choices[0] && j.choices[0].message;
      let text = m && (typeof m.content === 'string' ? m.content : (m.content || []).map(function(x){ return x.text || ''; }).join(''));
      text = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^#+\s*/gm, '').trim();
      if(!text) throw new Error('empty');
      d.review = { text:text.slice(0, 600), hash:dayHash(date), at:Date.now() };
      save();
    } catch(e){
      if(!auto) toast(e && e.message === 'limit' ? 'Ментор сейчас занят — попробуй чуть позже' : 'Не получилось сделать разбор — попробуй ещё раз');
    } finally { reviewBusy = false; renderReview(); }
  }
  function renderReview(){
    const el = $('dReview'); if(!el || !ME) return;
    const date = dDate, d = dayData(date);
    if(!d || !hasFood(date) || !(window.siteAI && siteAI.ready())){ el.style.display = 'none'; return; }
    const rv = d.review, stale = rv && rv.hash !== dayHash(date);
    const isToday = date === today();
    // авто-разбор: сегодня после 19:00 (или любой прошлый день с записями, который открыли), один раз
    if(!rv && !reviewBusy && !autoTried[date] && ((isToday && nowHM() >= 19) || (!isToday && date >= addDays(today(), -2)))){
      autoTried[date] = 1; setTimeout(function(){ makeReview(date, true); }, 600);
    }
    el.style.display = '';
    const body = reviewBusy ? '<p class="rv-load"><span class="spin"></span> Ментор смотрит твой день…</p>'
      : rv ? '<div class="rv-text">' + esc(rv.text).split(/\n+/).filter(Boolean).map(function(l){ return '<p>' + l + '</p>'; }).join('') + '</div>'
      : '<p class="rv-hint">' + (isToday && nowHM() < 19 ? 'Вечером ментор сам разберёт твой день. Или нажми сейчас.' : 'Короткий разбор: что получилось и что поправить.') + '</p>';
    el.innerHTML = '<div class="rv-h"><span class="rv-ic">' + (typeof SPARK !== 'undefined' ? SPARK : '✦') + '</span><b>Разбор дня</b>' +
      (reviewBusy ? '' : '<button type="button" class="linkbtn rv-btn" id="rvGo">' + (rv ? (stale ? 'Обновить' : 'Ещё раз') : 'Разобрать') + '</button>') + '</div>' + body +
      (rv && stale && !reviewBusy ? '<p class="rv-stale">Ты добавил еду после разбора — нажми «Обновить».</p>' : '');
    const b = $('rvGo'); if(b) b.onclick = function(){ makeReview(date, false); };
  }

  /* ================= 3. ИТОГИ НЕДЕЛИ И МЕСЯЦА ================= */
  let sumKind = 'week', sumOff = 1;
  function periodOf(kind, off){
    if(kind === 'week'){
      const start = addDays(mondayOf(today()), -7 * off), end = addDays(start, 6);
      const a = parseDate(start), b = parseDate(end);
      const label = off === 0 ? 'Эта неделя' : off === 1 ? 'Прошлая неделя' : a.getDate() + ' ' + MONTHS[a.getMonth()] + ' — ' + b.getDate() + ' ' + MONTHS[b.getMonth()];
      return { start:start, end:end, label:label, sub:a.getDate() + ' ' + MONTHS[a.getMonth()].slice(0, 3) + ' — ' + b.getDate() + ' ' + MONTHS[b.getMonth()].slice(0, 3) };
    }
    const t = parseDate(today()); const d = new Date(t.getFullYear(), t.getMonth() - off, 1);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const name = MON_NOM[d.getMonth()];
    return { start:isoDate(d), end:isoDate(e), label:name.charAt(0).toUpperCase() + name.slice(1) + (d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : ''), sub:off === 0 ? 'этот месяц' : off === 1 ? 'прошлый месяц' : '' };
  }
  function stats(p){
    const st = diaryStore(), t = today();
    const last = p.end < t ? p.end : t;
    let days = 0, total = 0, food = 0, kcal = 0, prot = 0, sug = 0, inNorm = 0, water = 0, waterDays = 0, wDays = 0, sets = 0, vol = 0, burn = 0;
    for(let ds = p.start; ds <= last; ds = addDays(ds, 1)){
      total++;
      const d = st[ds]; if(!d) continue;
      if(hasFood(ds)){
        const tt = dayTotals(ds);
        food++; kcal += tt.kcal; prot += tt.p; sug += tt.s;
        if(Math.abs(tt.kcal - norm.kcal) <= norm.kcal * 0.10) inNorm++;
      }
      if(d.water){ water += d.water; waterDays++; }
      if((d.workout || []).length){
        wDays++;
        d.workout.forEach(function(w){ sets += w.sets.length; vol += woVolume(w); burn += woBurn(w.name, w.sets); });
      }
      if(hasFood(ds) || d.water || (d.workout || []).length) days++;
    }
    // вес тела: первый и последний замер в периоде (или последний до него как точка отсчёта)
    const ws = (ME.profile.weights || []).slice().sort(function(a, b){ return a.date < b.date ? -1 : 1; });
    const inP = ws.filter(function(x){ return x.date >= p.start && x.date <= p.end; });
    const before = ws.filter(function(x){ return x.date < p.start; }).pop();
    const w0 = before || inP[0], w1 = inP[inP.length - 1];
    // рекорды в периоде: лучший 1ПМ в периоде выше, чем всё, что было до него
    const prs = [];
    const names = {};
    Object.keys(st).forEach(function(ds){ if(ds >= p.start && ds <= p.end) (st[ds].workout || []).forEach(function(w){ if(weighted(w.name)) names[normTxt(w.name)] = w.name; }); });
    Object.keys(names).forEach(function(k){
      const nm = names[k], all = sessions(nm);
      const inside = all.filter(function(x){ return x.date >= p.start && x.date <= p.end && x.e1rm > 0; });
      let pre = all.filter(function(x){ return x.date < p.start; }).reduce(function(m, x){ return Math.max(m, x.e1rm); }, 0);
      if(!pre && inside.length > 1) pre = inside[0].e1rm;             // истории до периода нет — сравниваем с первой тренировкой периода
      const cur = inside.reduce(function(m, x){ return Math.max(m, x.e1rm); }, 0);
      if(pre > 0 && cur > pre + 0.25) prs.push({ name:nm, from:pre, to:cur });
    });
    return { total:total, days:days, food:food, kcal:food ? kcal / food : 0, prot:food ? prot / food : 0, sug:food ? sug / food : 0, inNorm:inNorm,
      water:waterDays ? water / waterDays : 0, wDays:wDays, sets:sets, vol:vol, burn:burn,
      w0:w0 && w1 && w0 !== w1 ? w0.kg : null, w1:w1 ? w1.kg : null, prs:prs.sort(function(a, b){ return (b.to - b.from) - (a.to - a.from); }) };
  }
  function verdict(s){
    if(!s.days) return 'За этот период записей нет. Начни с малого — запиши сегодняшний завтрак.';
    const parts = [];
    if(s.food >= Math.max(1, s.total - 1)) parts.push('записывал еду почти каждый день 🔥');
    else if(s.food) parts.push('еда записана ' + s.food + ' из ' + s.total + ' дн. — попробуй не пропускать');
    if(s.food && s.inNorm >= s.food * 0.6) parts.push('калории в норме большую часть дней');
    else if(s.food && s.kcal > norm.kcal * 1.1) parts.push('в среднем выше нормы на ' + Math.round(s.kcal - norm.kcal) + ' ккал');
    else if(s.food && s.kcal < norm.kcal * 0.9) parts.push('в среднем ниже нормы на ' + Math.round(norm.kcal - s.kcal) + ' ккал');
    if(s.food && s.prot < norm.p * 0.85) parts.push('белка маловато (' + Math.round(s.prot) + ' из ' + norm.p + ' г)');
    if(s.prs.length) parts.push(s.prs.length + ' ' + plural(s.prs.length, 'новый рекорд', 'новых рекорда', 'новых рекордов') + ' 🏆');
    return parts.length ? parts.join(', ').replace(/^./, function(c){ return c.toUpperCase(); }) + '.' : 'Хорошее начало — продолжай записывать.';
  }
  function renderSummary(){
    const p = periodOf(sumKind, sumOff), s = stats(p), sg = Math.round((norm.kcal || 2000) * 0.10 / 4);
    segSet('sumKind', sumKind);
    $('sumLabel').innerHTML = '<b>' + esc(p.label) + '</b>' + (p.sub ? '<small>' + esc(p.sub) + '</small>' : '');
    $('sumNext').disabled = sumOff <= 0;
    const k = function(v, l, cls){ return '<div class="kpi' + (cls ? ' ' + cls : '') + '"><b>' + v + '</b><span>' + l + '</span></div>'; };
    const wd = s.w0 != null && s.w1 != null ? r1(s.w1 - s.w0) : null;
    $('sumKpis').innerHTML =
      k(s.food + '<small>/' + s.total + '</small>', 'дней с едой', s.food >= s.total - 1 && s.total ? 'good' : '') +
      k(s.food ? Math.round(s.kcal).toLocaleString('ru-RU') : '—', 'ккал в среднем / ' + norm.kcal, s.food && Math.abs(s.kcal - norm.kcal) <= norm.kcal * .1 ? 'good' : '') +
      k(s.food ? Math.round(s.prot) + '<small> г</small>' : '—', 'белок / ' + norm.p + ' г', s.food && s.prot >= norm.p * .9 ? 'good' : '') +
      k(s.food ? Math.round(s.sug) + '<small> г</small>' : '—', 'сахар / до ' + sg + ' г', s.food && s.sug > sg ? 'warn' : '') +
      k(s.wDays, plural(s.wDays, 'тренировка', 'тренировки', 'тренировок') + (s.sets ? ' · ' + s.sets + ' подх.' : ''), s.wDays ? 'good' : '') +
      k(s.burn ? '≈ ' + s.burn : '—', 'ккал сожжено') +
      k(s.water ? (s.water / 1000).toFixed(1) + '<small> л</small>' : '—', 'воды в день') +
      k(wd != null ? (wd > 0 ? '+' : '') + wd + '<small> кг</small>' : s.w1 != null ? r1(s.w1) + '<small> кг</small>' : '—', wd != null ? 'вес тела' : 'вес тела', '');
    $('sumPrs').innerHTML = s.prs.length ? '<div class="fsub">Рекорды</div>' + s.prs.slice(0, 5).map(function(x){
      return '<div class="sum-pr"><span>🏆 ' + esc(x.name) + '</span><b>' + Math.round(x.from) + ' → ' + Math.round(x.to) + ' кг</b></div>'; }).join('') : '';
    $('sumVerdict').textContent = verdict(s);
  }
  function openSummary(kind, off){
    sumKind = kind || 'week'; sumOff = off == null ? 1 : off;
    $('sumModal').classList.add('on');
    renderSummary();
  }
  function hasData(p){ const s = stats(p); return s.days > 0; }
  /* понедельник–среда: один раз показываем итоги прошлой недели; 1–3 число — итоги прошлого месяца */
  function autoSummary(){
    if(!ME) return;
    const seen = ME.profile.sumSeen || (ME.profile.sumSeen = {});
    const t = parseDate(today()), dow = (t.getDay() + 6) % 7;
    const pm = periodOf('month', 1), pw = periodOf('week', 1);
    let kind = null;
    if(t.getDate() <= 3 && seen.month !== pm.start && hasData(pm)) kind = 'month';
    else if(dow <= 2 && seen.week !== pw.start && hasData(pw)) kind = 'week';
    if(!kind) return;
    if(kind === 'month') seen.month = pm.start; else seen.week = pw.start;
    save();
    openSummary(kind, 1);
  }

  /* ================= 4. НАПОМИНАНИЯ =================
     Ненавязчивая плашка сверху, пока сайт открыт: не чаще раза в 30 минут, каждое — максимум раз в день,
     не поверх окон, чата и клавиатуры. (Уведомления при закрытом сайте требуют сервера — это позже.) */
  let lastAct = Date.now(), nTimer = null, nHide = null, startedAt = 0;
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function(ev){ window.addEventListener(ev, function(){ lastAct = Date.now(); }, { passive:true, capture:true }); });
  function rm(){ const r = ME.profile.remind || (ME.profile.remind = { on:true, days:[] }); if(!Array.isArray(r.days)) r.days = []; return r; }
  function nudgeState(){
    const n = ME.profile.nudges || (ME.profile.nudges = {});
    if(n.date !== today()){ n.date = today(); n.shown = {}; n.count = 0; }
    return n;
  }
  function blocked(){
    return document.hidden || !ME || !$('app') || $('app').style.display === 'none' || !!document.querySelector('.modal.on') ||
      (typeof Chat !== 'undefined' && Chat.isOpen()) || ($('pdrawer') && $('pdrawer').classList.contains('on')) ||
      document.body.classList.contains('kb-open') || document.body.classList.contains('qt-on') ||
      ($('toast') && $('toast').classList.contains('on')) || Date.now() - lastAct < 4000 || Date.now() - startedAt < 20000;
  }
  function pickNudge(){
    const t = today(), d = dayData(t), h = nowHM(), n = nudgeState(), r = rm();
    const dow = ((parseDate(t).getDay() + 6) % 7) + 1;
    const list = [];
    // день тренировки
    if(r.days.indexOf(dow) >= 0 && !(d && (d.workout || []).length) && h >= 12 && h < 22)
      list.push({ id:'train', ic:'💪', text:'Сегодня день тренировки', act:'Записать', run:function(){ dDate = today(); go('diary'); renderDiary(); openWorkoutModal(); } });
    // вода по времени дня: к 20:00 — вся норма
    const goal = waterGoal(), ml = d ? d.water || 0 : 0, exp = goal * Math.max(0, Math.min(1, (h - 8) / 12));
    if(h >= 11 && h < 22 && ml < goal && exp - ml >= 500)
      list.push({ id:'water', ic:'💧', text:'Пора пить воду: ' + ml.toLocaleString('ru-RU') + ' из ' + goal.toLocaleString('ru-RU') + ' мл', act:'+250 мл',
        run:function(){ const dd = dayData(today(), true); dd.water = Math.min(6000, (dd.water || 0) + 250); save(); if(dDate === today()) renderDiary(); toast('💧 +250 мл · ' + dd.water.toLocaleString('ru-RU') + ' из ' + goal.toLocaleString('ru-RU')); } });
    // еда
    const has = function(m){ return !!(d && (d.meals[m] || []).length); };
    const food = hasFood(t);
    if(!food && h >= 13 && h < 22)
      list.push({ id:'food', ic:'🍽', text:'Сегодня ещё ничего не записано', act:'Записать', run:function(){ dDate = today(); go('diary'); renderDiary(); openFoodModal(h < 16 ? 'lunch' : 'dinner'); } });
    else if(food && !has('dinner') && h >= 20.5 && h < 23.5)
      list.push({ id:'dinner', ic:'🌙', text:'Ты сегодня ещё не записал ужин', act:'Записать', run:function(){ dDate = today(); go('diary'); renderDiary(); openFoodModal('dinner'); } });
    else if(food && !has('lunch') && h >= 15 && h < 18)
      list.push({ id:'lunch', ic:'🥗', text:'Обед ещё не записан', act:'Записать', run:function(){ dDate = today(); go('diary'); renderDiary(); openFoodModal('lunch'); } });
    return list.filter(function(x){ return !n.shown[x.id]; })[0] || null;
  }
  function tickNudge(){
    if(!ME || !rm().on) return;
    const n = nudgeState();
    if((n.count || 0) >= 4 || Date.now() - (n.last || 0) < 30 * 60000) return;
    if(blocked()) return;
    const x = pickNudge(); if(!x) return;
    n.shown[x.id] = 1; n.count = (n.count || 0) + 1; n.last = Date.now(); save();
    showNudge(x);
  }
  function showNudge(x){
    const el = $('nudge');
    el.innerHTML = '<span class="ng-ic">' + x.ic + '</span><span class="ng-t">' + esc(x.text) + '</span>' +
      '<button type="button" class="ng-act">' + esc(x.act) + '</button><button type="button" class="ng-x" aria-label="Скрыть">&times;</button>';
    el.hidden = false;
    requestAnimationFrame(function(){ el.classList.add('in'); });
    el.querySelector('.ng-act').onclick = function(){ hideNudge(); x.run(); };
    el.querySelector('.ng-x').onclick = hideNudge;
    clearTimeout(nHide); nHide = setTimeout(hideNudge, 9000);
  }
  function hideNudge(){
    const el = $('nudge'); clearTimeout(nHide);
    el.classList.remove('in');
    setTimeout(function(){ if(!el.classList.contains('in')) el.hidden = true; }, 260);
  }
  function renderRemindSettings(){
    if(!ME || !$('rmToggle')) return;
    const r = rm();
    $('rmToggle').checked = r.on !== false;
    $('rmDays').innerHTML = WD.map(function(w, i){ return '<button type="button" class="' + (r.days.indexOf(i + 1) >= 0 ? 'on' : '') + '" data-d="' + (i + 1) + '" aria-pressed="' + (r.days.indexOf(i + 1) >= 0) + '">' + w + '</button>'; }).join('');
    $('rmDaysWrap').style.display = r.on !== false ? '' : 'none';
  }

  /* ================= запуск ================= */
  let bound = false;
  function bind(){
    if(bound) return; bound = true;
    segInit('sumKind', function(v){ sumKind = v; sumOff = 1; renderSummary(); });
    $('sumPrev').onclick = function(){ sumOff++; renderSummary(); };
    $('sumNext').onclick = function(){ if(sumOff > 0){ sumOff--; renderSummary(); } };
    $('sumOpen').onclick = function(){ openSummary('week', 0); };
    $('rmToggle').addEventListener('change', function(){ rm().on = this.checked; save(); renderRemindSettings(); toast(this.checked ? 'Напоминания включены' : 'Напоминания выключены'); if(!this.checked) hideNudge(); });
    $('rmDays').addEventListener('click', function(e){
      const b = e.target.closest('button'); if(!b) return;
      const r = rm(), d = +b.dataset.d, i = r.days.indexOf(d);
      if(i >= 0) r.days.splice(i, 1); else r.days.push(d);
      r.days.sort(); save(); renderRemindSettings();
    });
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) setTimeout(tickNudge, 3000); });
  }
  return {
    e1rm:e1rm, bestOf:bestOf, sessions:sessions, records:records, checkPR:checkPR,
    renderReview:renderReview, makeReview:makeReview, dayPrompt:dayPrompt,
    openSummary:openSummary, stats:stats, periodOf:periodOf, autoSummary:autoSummary,
    tickNudge:tickNudge, pickNudge:pickNudge, showNudge:showNudge, renderRemindSettings:renderRemindSettings,
    init:function(){
      bind(); startedAt = Date.now();
      renderRemindSettings();
      clearInterval(nTimer); nTimer = setInterval(tickNudge, 60000);
      setTimeout(tickNudge, 25000);
      setTimeout(autoSummary, 2500);
    },
    stop:function(){ clearInterval(nTimer); hideNudge(); },
    _unblock:function(){ startedAt = 0; lastAct = 0; }            // для автотестов
  };
})();
