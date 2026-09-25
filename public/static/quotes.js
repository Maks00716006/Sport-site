/* ================= ВСПЛЫВАЮЩИЕ ЦИТАТЫ =================
   • Очередь без повторов: список перемешивается алгоритмом Фишера–Йетса, цитаты
     берутся по одной, и новый круг начинается только когда показаны все.
     Очередь хранится в браузере, поэтому переживает перезагрузку страницы.
   • Тайминги настраиваются в QuoteToasts.config.
   • Подложка #qtRoot не ловит клики (pointer-events:none) — кликабельна только сама плашка.
   • Цитата не показывается поверх открытых окон, профиля, другого тоста и в фоновой вкладке. */
const QuoteToasts = (function(){
  const config = {
    firstDelay: [12000, 20000],   // самая первая цитата (один раз, при первом входе)
    interval:   [15 * 60000, 25 * 60000],   // пауза между цитатами: случайно 15–25 минут
    showMs:     5500,             // сколько цитата висит на экране
    retryMs:    8000              // повторная попытка, если сейчас мешает окно/тост
  };
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
    const id = queue.shift();
    s.queue = queue; s.round = newRound; s.last = id; s.shown = (s.shown || 0) + 1;
    store(s);
    return QUOTES.find(function(q){ return q.id === id; });
  }

  function enabled(){ return load().off !== true; }
  function setEnabled(on){
    const s = load(); s.off = !on; store(s);
    if(on){ planNext(rnd([4000, 7000])); } else { stop(); hide(true); }
  }

  function blocked(){
    return document.hidden ||
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
    planNext(config.showMs + rnd(config.interval));
  }

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }

  function show(q){
    if(!q) return;
    const root = document.getElementById('qtRoot');
    hide(true);
    el = document.createElement('div');
    el.className = 'qt';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<span class="qt-mark" aria-hidden="true">“</span>' +
      '<div class="qt-body"><p class="qt-text">' + esc(q.text) + '</p>' +
      '<div class="qt-by"><b>' + esc(q.author) + '</b><span>' + esc(q.category) + '</span></div></div>' +
      '<button type="button" class="qt-x" aria-label="Закрыть цитату"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<i class="qt-bar" style="animation-duration:' + config.showMs + 'ms"></i>';
    root.appendChild(el);
    el.querySelector('.qt-x').onclick = function(){ hide(); };
    // наведение/фокус ставит таймер на паузу — можно спокойно дочитать
    el.addEventListener('mouseenter', pause); el.addEventListener('mouseleave', resume);
    el.addEventListener('focusin', pause); el.addEventListener('focusout', resume);
    requestAnimationFrame(function(){
      if(!el) return;
      el.classList.add('in');
      document.body.style.setProperty('--qt-h', el.offsetHeight + 'px');
      document.body.classList.add('qt-on');
    });
    remainingMs = config.showMs; shownAt = Date.now();
    hideTimer = setTimeout(hide, remainingMs);
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
  function hide(instant){
    clearTimeout(hideTimer);
    const node = el; el = null;
    document.body.classList.remove('qt-on');
    if(!node) return;
    if(instant){ node.remove(); return; }
    node.classList.remove('in'); node.classList.add('out');
    setTimeout(function(){ node.remove(); }, 450);
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
