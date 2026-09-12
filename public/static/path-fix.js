/* ================= path-fix =================
   В data.js пути к картинкам заданы абсолютно: '/static/img/...'.
   На корневом домене (Cloudflare Pages / wrangler) это работает, а на хостинге
   с подпутём (например GitHub Pages: /Sport-site/) — нет.
   Скрипт на лету делает такие пути относительными и ничего не ломает на корневом домене.
   Подключается после data.js и до app.js. */
(function () {
  var BASE = location.pathname.replace(/[^/]*$/, ''); // каталог текущей страницы
  if (BASE === '/') return; // корневой домен — абсолютные пути и так верные

  function fixOne(img) {
    var s = img.getAttribute('src');
    if (!s || s.indexOf('/static/') !== 0) return;
    img.setAttribute('src', BASE + s.slice(1));
  }
  function fixAll(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.tagName === 'IMG') { fixOne(root); return; }
    var list = root.querySelectorAll ? root.querySelectorAll('img') : [];
    for (var i = 0; i < list.length; i++) fixOne(list[i]);
  }

  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) fixAll(added[j]);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', function () { fixAll(document.body); });
})();
