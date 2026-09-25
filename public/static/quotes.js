/* ================= ВСПЛЫВАЮЩИЕ ЦИТАТЫ =================
   • Очередь без повторов: список перемешивается алгоритмом Фишера–Йетса, цитаты
     берутся по одной, и новый круг начинается только когда показаны все.
     Очередь хранится в браузере, поэтому переживает перезагрузку страницы.
   • Тайминги настраиваются в QuoteToasts.config.
   • Подложка #qtRoot не ловит клики (pointer-events:none) — кликабельна только сама плашка.
   • Цитата не показывается поверх открытых окон, профиля, другого тоста и в фоновой вкладке.
   • На телефоне (≤900px): компактная строка над нижним меню, мелкий шрифт, максимум 2 строки,
     приоритет коротким цитатам; закрывается тапом или смахиванием; показывается реже и только
     когда пользователь ничего не делает (не печатает и не листает). */
const QuoteToasts = (function(){
  const config = {
    firstDelay: [12000, 20000],   // самая первая цитата (один раз, при первом входе)
    interval:   [15 * 60000, 25 * 60000],   // пауза между цитатами на компьютере: 15–25 минут
    intervalMobile: [30 * 60000, 45 * 60000], // на телефоне реже: 30–45 минут
    showMs:     5500,             // сколько цитата висит на экране
    showMsMobile: 4500,           // на телефоне — короче (текст тоже короче)
    idleMs:     15000,            // телефон: показываем, только если 15 с не было касаний/прокрутки/ввода
    retryMs:    8000,             // повторная попытка, если сейчас мешает окно/тост
    shortChars: 110               // на телефоне сначала берём цитаты не длиннее этого
  };
  const isMobile = function(){ return window.matchMedia('(max-width:900px)').matches; };
  // последняя активность пользователя — чтобы на телефоне не мешать, пока он пользуется дневником
  let lastActivity = Date.now();
  ['touchstart', 'pointerdown', 'keydown', 'scroll', 'wheel'].forEach(function(ev){
    window.addEventListener(ev, function(){ lastActivity = Date.now(); }, { passive:true, capture:true });
  });
  const KEY = 'wsport-quotes-v1';
  let timer = null, hideTimer = null, el = null, started = false, remainingMs = 0, shownAt = 0;

  function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ return {}; } }
  function store(s){ try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} }
  function rnd(a){ return a[0] + Math.random() * (a[1] - a[0]); }

  // Фишер–Йетс: равновероятная перестановка за O(n)
  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Следующая цитата. Круг = все цитаты по одному разу.
     queue — что осталось показать в этом круге, round — какие id входят в круг
     (если в QUOTES добавят новые цитаты, они попадут в текущий круг). */
  function next(){
    const ids = QUOTES.map(function(q){ return q.id; });
    const s = load();
    let queue = (s.queue || []).filter(function(id){ return ids.indexOf(id) >= 0; });
    const round = s.round || [];
    const fresh = ids.filter(function(id){ return round.indexOf(id) < 0; });
    if(fresh.length && round.length) queue = queue.concat(shuffle(fresh));
    let newRound = round.concat(fresh);
    if(!queue.length){
      queue = shuffle(ids);
      // стык кругов: первая цитата нового круга не совпадает с последней предыдущего
      if(queue.length > 1 && queue[0] === s.last){ const t = queue[0]; queue[0] = queue[1]; queue[1] = t; }
      newRound = ids.slice();
      s.rounds = (s.rounds || 0) + 1;
    }
    // телефон: берём первую короткую цитату из очереди (длинные остаются в очереди — без повторов)
    let pos = 0;
    if(isMobile()){
      const cap = fitChars();
      const k = queue.findIndex(function(id){ const q = QUOTES.find(function(x){ return x.id === id; }); return q && q.text.length + q.author.length + 3 <= cap; });
      if(k > 0) pos = k;
    }
    const id = queue.splice(pos, 1)[0];
    s.queue = queue; s.round = newRound; s.last = id; s.shown = (s.shown || 0) + 1;
    store(s);
    return QUOTES.find(function(q){ return q.id === id; });
  }

  /* сколько символов (цитата + « — автор») помещается в 2 строки компактной плашки на этом экране */
  function fitChars(){
    const w = Math.min(window.innerWidth, 900) - 44;       // ширина текста без отступов
    return Math.max(50, Math.min(config.shortChars + 20, Math.floor(w / 7.1) * 2 - 4));
  }
  function enabled(){ return load().off !== true; }
  function setEnabled(on){
    const s = load(); s.off = !on; store(s);
    if(on){ planNext(rnd([4000, 7000])); } else { stop(); hide(true); }
  }

  function blocked(){
    return document.hidden ||
      (isMobile() && (Date.now() - lastActivity < config.idleMs || document.body.classList.contains('kb-open'))) ||
      !document.getElementById('app') || document.getElementById('app').style.display === 'none' ||
      !!document.querySelector('.modal.on') || (typeof Chat !== 'undefined' && Chat.isOpen()) ||
      (document.getElementById('pdrawer') && document.getElementById('pdrawer').classList.contains('on')) ||
      (document.getElementById('toast') && document.getElementById('toast').classList.contains('on'));
  }

  function schedule(ms){
    clearTimeout(timer);
    if(!enabled()) return;
    timer = setTimeout(tick, ms);
  }
  /* время следующей цитаты хранится в браузере — перезагрузка страницы
     не сбрасывает паузу и не вызывает внеочередную цитату */
  function planNext(ms){ const s = load(); s.nextAt = Date.now() + ms; store(s); schedule(ms); }
  function tick(){
    if(!enabled()) return;
    if(blocked()){ schedule(config.retryMs); return; }
    show(next());
    planNext(config.showMs + rnd(isMobile() ? config.intervalMobile : config.interval));
  }

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }

  function show(q){
    if(!q) return;
    const root = document.getElementById('qtRoot');
    hide(true);
    const mob = isMobile();
    const ms = mob ? config.showMsMobile : config.showMs;
    el = document.createElement('div');
    el.setAttribute('role', 'status');
    if(mob){
      // компактная строка: цитата + автор, максимум 2 строки; тап или свайп — скрыть
      el.className = 'qt qt-mini' + (q.text.length + q.author.length + 3 > fitChars() ? ' qt-long' : '');
      el.setAttribute('aria-label', 'Цитата. Нажми или смахни, чтобы скрыть');
      el.innerHTML = '<p class="qt-line"><span class="qt-q">' + esc(q.text) + '</span> <b>— ' + esc(q.author) + '</b></p>' +
        '<i class="qt-bar" style="animation-duration:' + ms + 'ms"></i>';
      bindSwipe(el);
    } else {
      el.className = 'qt';
      el.innerHTML =
        '<span class="qt-mark" aria-hidden="true">“</span>' +
        '<div class="qt-body"><p class="qt-text">' + esc(q.text) + '</p>' +
        '<div class="qt-by"><b>' + esc(q.author) + '</b><span>' + esc(q.category) + '</span></div></div>' +
        '<button type="button" class="qt-x" aria-label="Закрыть цитату"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<i class="qt-bar" style="animation-duration:' + ms + 'ms"></i>';
      el.querySelector('.qt-x').onclick = function(){ hide(); };
      // наведение/фокус ставит таймер на паузу — можно спокойно дочитать
      el.addEventListener('mouseenter', pause); el.addEventListener('mouseleave', resume);
      el.addEventListener('focusin', pause); el.addEventListener('focusout', resume);
    }
    root.appendChild(el);
    requestAnimationFrame(function(){
      if(!el) return;
      el.classList.add('in');
      const tb = document.getElementById('tabbar');
      document.body.style.setProperty('--tabbar-h', (tb && tb.offsetHeight ? tb.offsetHeight : 0) + 'px');
      document.body.style.setProperty('--qt-h', el.offsetHeight + 'px');
      document.body.classList.add('qt-on');
    });
    remainingMs = ms; shownAt = Date.now();
    hideTimer = setTimeout(hide, remainingMs);
  }
  /* свайп в сторону (или вниз) — плашка улетает; короткий тап — сразу скрыть */
  function bindSwipe(node){
    let x0 = 0, y0 = 0, dx = 0, dy = 0, t0 = 0, drag = false, id = null;
    node.addEventListener('pointerdown', function(e){
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = dy = 0; t0 = Date.now(); drag = true;
      try { node.setPointerCapture(id); } catch(err){}
      node.classList.add('drag'); pause();
    });
    node.addEventListener('pointermove', function(e){
      if(!drag || e.pointerId !== id) return;
      dx = e.clientX - x0; dy = Math.max(0, e.clientY - y0);
      const d = Math.abs(dx) > dy ? dx : 0;
      node.style.transform = 'translate(' + d + 'px,' + (d ? 0 : dy) + 'px)';
      node.style.opacity = String(Math.max(0, 1 - Math.max(Math.abs(d), dy * 2) / 220));
    });
    const end = function(e){
      if(!drag || (e && e.pointerId !== id)) return;
      drag = false; node.classList.remove('drag');
      const dt = Math.max(1, Date.now() - t0), dist = Math.max(Math.abs(dx), dy);
      const fast = Math.abs(dx) / dt > 0.5 || dy / dt > 0.5;
      if(dist < 8 && dt < 500){ hide(); return; }                 // тап
      if(Math.abs(dx) > 70 || dy > 40 || (fast && dist > 24)){      // смахнули
        node.style.transition = 'transform .22s ease-out, opacity .22s ease-out';
        node.style.transform = Math.abs(dx) > dy ? 'translateX(' + (dx > 0 ? 120 : -120) + '%)' : 'translateY(120%)';
        node.style.opacity = '0';
        hide(false, true);
        return;
      }
      node.style.transform = ''; node.style.opacity = ''; resume();  // не дотянули — возвращаем
    };
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
  }
  function pause(){
    if(!el) return;
    clearTimeout(hideTimer);
    remainingMs = Math.max(1500, remainingMs - (Date.now() - shownAt));
    el.classList.add('paused');
  }
  function resume(){
    if(!el) return;
    shownAt = Date.now();
    el.classList.remove('paused');
    hideTimer = setTimeout(hide, remainingMs);
  }
  function hide(instant, swiped){
    clearTimeout(hideTimer);
    const node = el; el = null;
    document.body.classList.remove('qt-on');
    if(!node) return;
    if(instant === true){ node.remove(); return; }
    if(!swiped){ node.classList.remove('in'); node.classList.add('out'); }
    setTimeout(function(){ node.remove(); }, swiped ? 240 : 450);
  }
  function stop(){ clearTimeout(timer); }

  return {
    config: config,
    next: next, shuffle: shuffle,
    enabled: enabled, setEnabled: setEnabled,
    // вызывается при входе в аккаунт
    start: function(){
      if(started) return; started = true;
      const at = load().nextAt;
      if(at) schedule(Math.max(3000, at - Date.now()));   // продолжаем паузу с того места, где она была
      else planNext(rnd(config.firstDelay));
    },
    // вызывается при выходе
    stop: function(){ started = false; stop(); hide(true); },
    showNow: function(){ show(next()); }
  };
})();
