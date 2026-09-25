/* ================= ДОСТИЖЕНИЯ =================
   100 достижений в 8 категориях. Каждое — объект:
     { id, cat, title, desc, goal, stat }
   stat — ключ из объекта статистики (см. achStats() в app.js),
   goal — сколько нужно набрать. Статус «получено» = stat >= goal.
   Чтобы добавить достижение — просто допиши объект в нужную серию. */

const ACH_CATS = [
  { id:'cook',    label:'Кулинарный опыт' },
  { id:'variety', label:'Разнообразие' },
  { id:'meals',   label:'Категории блюд' },
  { id:'taste',   label:'Вкус и оценки' },
  { id:'gym',     label:'Тренажёрный зал' },
  { id:'streak',  label:'Стрик питания' },
  { id:'weight',  label:'Вес и прогресс' },
  { id:'site',    label:'Использование сайта' }
];

/* векторные иконки в стиле навигации сайта (stroke 1.7, round) */
const ACH_ICON = {
  cook:'<svg viewBox="0 0 24 24"><path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M2 11h20"/><path d="M9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5"/></svg>',
  variety:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  meals:'<svg viewBox="0 0 24 24"><path d="M4 4v7a4 4 0 0 0 8 0V4"/><path d="M8 4v16"/><path d="M18 4c-1.5 2-2 4-2 6s.7 3 2 3v7"/></svg>',
  taste:'<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/></svg>',
  gym:'<svg viewBox="0 0 24 24"><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/></svg>',
  streak:'<svg viewBox="0 0 24 24"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.6 1 2.6 2.1 3.1C11 9 10.8 6 12 3z"/></svg>',
  weight:'<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/></svg>',
  site:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
};

function achSeries(cat, stat, goals, title, desc){
  return goals.map(function(g, i){
    return { id: cat + '-' + stat + '-' + g, cat: cat, stat: stat, goal: g,
             title: typeof title === 'function' ? title(g, i) : title[i], desc: desc(g) };
  });
}
function plural(n, one, few, many){
  const m10 = n % 10, m100 = n % 100;
  if(m10 === 1 && m100 !== 11) return one;
  if(m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

const ACHIEVEMENTS = [].concat(
  /* 1. Кулинарный опыт — 13 */
  achSeries('cook', 'cooks', [1,3,5,10,15,20,25,30,40,50,60,75,100],
    ['Первое блюдо','Разогрев','Пять готовок','Десятка','Уверенная рука','Домашний повар','Четверть сотни',
     'Тридцатка','Кухонный марафон','Полсотни','Шеф на районе','Мастер плиты','Сотня блюд'],
    function(g){ return 'Приготовь и отметь ' + g + ' ' + plural(g,'блюдо','блюда','блюд'); }),

  /* 2. Разнообразие — 10 */
  achSeries('variety', 'unique', [2,5,10,15,20,25,30,40,50,58],
    ['Не одно и то же','Пробую новое','Десять вкусов','Исследователь','Гурман','Широкое меню','Тридцать рецептов',
     'Коллекционер','Почти всё','Вся книга рецептов'],
    function(g){ return g === 58 ? 'Приготовь все 58 рецептов сайта, включая коктейли' : 'Приготовь ' + g + ' разных ' + plural(g,'рецепт','рецепта','рецептов'); }),

  /* 3. Категории блюд — 21 */
  achSeries('meals', 'm_breakfast', [1,10], ['Утро началось','Король завтраков'], function(g){ return 'Приготовь ' + g + ' ' + plural(g,'завтрак','завтрака','завтраков'); }),
  achSeries('meals', 'm_lunch', [1,10], ['Время обеда','Обеденный профи'], function(g){ return 'Приготовь ' + g + ' ' + plural(g,'обед','обеда','обедов'); }),
  achSeries('meals', 'm_dinner', [1,10], ['Добрый вечер','Мастер ужинов'], function(g){ return 'Приготовь ' + g + ' ' + plural(g,'ужин','ужина','ужинов'); }),
  achSeries('meals', 'm_snack', [1,10], ['Перекусим','Умный перекус'], function(g){ return 'Приготовь ' + g + ' ' + plural(g,'перекус','перекуса','перекусов'); }),
  achSeries('meals', 'k_nofire', [1,5], ['Без огня','Холодный расчёт'], function(g){ return 'Приготовь ' + g + ' ' + plural(g,'блюдо','блюда','блюд') + ' без огня'; }),
  achSeries('meals', 'k_micro', [1,5], ['Жми старт','Магия микроволновки'], function(g){ return 'Приготовь ' + g + ' ' + plural(g,'блюдо','блюда','блюд') + ' в микроволновке'; }),
  achSeries('meals', 'k_pan', [1,5], ['Одна сковорода','Сковородных дел мастер'], function(g){ return 'Приготовь ' + g + ' ' + plural(g,'блюдо','блюда','блюд') + ' на одной сковороде'; }),
  achSeries('meals', 'k_oven', [1,5], ['Жар духовки','Повелитель духовки'], function(g){ return 'Приготовь ' + g + ' ' + plural(g,'блюдо','блюда','блюд') + ' в духовке'; }),
  achSeries('meals', 'k_pot', [1,5], ['Суповой набор','Мастер кастрюли'], function(g){ return 'Приготовь ' + g + ' ' + plural(g,'блюдо','блюда','блюд') + ' в кастрюле'; }),
  [{ id:'meals-shakes-1', cat:'meals', stat:'shakes', goal:1, title:'Первый шейк', desc:'Приготовь 1 протеиновый коктейль' },
   { id:'meals-shakes-5', cat:'meals', stat:'shakes', goal:5, title:'Шейкер в руке', desc:'Приготовь 5 протеиновых коктейлей' },
   { id:'meals-shakesU-10', cat:'meals', stat:'shakesUnique', goal:10, title:'Все коктейли', desc:'Попробуй все 10 протеиновых коктейлей' }],

  /* 4. Вкус и оценки — 12 */
  [{ id:'taste-five-1', cat:'taste', stat:'fiveStars', goal:1, title:'Очень вкусно', desc:'Поставь блюду 5 звёзд' },
   { id:'taste-five-10', cat:'taste', stat:'fiveStars', goal:10, title:'Десять пятёрок', desc:'Поставь 5 звёзд 10 раз' },
   { id:'taste-five-25', cat:'taste', stat:'fiveStars', goal:25, title:'Фанат вкуса', desc:'Поставь 5 звёзд 25 раз' },
   { id:'taste-note-1', cat:'taste', stat:'notes', goal:1, title:'Заметка на полях', desc:'Оставь заметку к приготовленному блюду' },
   { id:'taste-note-5', cat:'taste', stat:'notes', goal:5, title:'Кулинарный дневник', desc:'Оставь 5 заметок к блюдам' },
   { id:'taste-note-20', cat:'taste', stat:'notes', goal:20, title:'Автор рецептов', desc:'Оставь 20 заметок к блюдам' },
   { id:'taste-fav-1', cat:'taste', stat:'favs', goal:1, title:'Любимчик', desc:'Добавь рецепт в избранное' },
   { id:'taste-fav-5', cat:'taste', stat:'favs', goal:5, title:'Своя подборка', desc:'Добавь 5 рецептов в избранное' },
   { id:'taste-fav-15', cat:'taste', stat:'favs', goal:15, title:'Личная кулинарная книга', desc:'Добавь 15 рецептов в избранное' },
   { id:'taste-critic-1', cat:'taste', stat:'lowStars', goal:1, title:'Честный критик', desc:'Поставь блюду 2 звезды или меньше' },
   { id:'taste-repeat-3', cat:'taste', stat:'maxRepeat', goal:3, title:'Любимое блюдо', desc:'Приготовь один и тот же рецепт 3 раза' },
   { id:'taste-repeat-10', cat:'taste', stat:'maxRepeat', goal:10, title:'Фирменное блюдо', desc:'Приготовь один и тот же рецепт 10 раз' }],

  /* 5. Тренажёрный зал — 13 */
  achSeries('gym', 'exSeen', [1,5,10,20,30,44],
    ['Первое упражнение','Разминка','Десять техник','Знаток зала','Тренерский взгляд','Вся база упражнений'],
    function(g){ return g === 44 ? 'Изучи технику всех 44 упражнений' : 'Изучи технику ' + g + ' ' + plural(g,'упражнения','упражнений','упражнений'); }),
  [['Грудь','Грудь колесом'],['Спина','Крепкая спина'],['Ноги','День ног'],['Плечи','Широкие плечи'],
   ['Руки','Сильные руки'],['Пресс','Кубики'],['Ягодицы','Мощный тыл']].map(function(g){
     return { id:'gym-group-' + g[0], cat:'gym', stat:'grp_' + g[0], goal:1, title:g[1], desc:'Открой технику упражнения из группы «' + g[0] + '»' };
   }),

  /* 6. Стрик питания — 10 (заработают, когда появится дневник питания) */
  achSeries('streak', 'streakBest', [1,3,7,14,21,30,60,100,180,365],
    ['Первая запись','Три дня подряд','Неделя без пропусков','Две недели','Привычка сформирована','Месяц дисциплины',
     'Два месяца','Сотня дней','Полгода','Целый год'],
    function(g){ return 'Записывай приёмы пищи ' + g + ' ' + plural(g,'день','дня','дней') + ' подряд'; }),

  /* 7. Вес и прогресс — 10 */
  achSeries('weight', 'weighIns', [1,5,10,20,50],
    ['Точка отсчёта','Контроль','Десять замеров','Системный подход','Полсотни замеров'],
    function(g){ return 'Запиши вес ' + g + ' ' + plural(g,'раз','раза','раз'); }),
  achSeries('weight', 'lost', [1,3,5], ['Минус килограмм','Минус три','Минус пять'],
    function(g){ return 'Сбрось ' + g + ' кг от первого замера'; }),
  achSeries('weight', 'gained', [1,3], ['Плюс килограмм','Плюс три на массе'],
    function(g){ return 'Набери ' + g + ' кг от первого замера'; }),

  /* 8. Использование сайта — 11 */
  achSeries('site', 'visitDays', [1,3,7,14,30,60,100],
    ['Добро пожаловать','Возвращаюсь','Неделя с WSPORT','Две недели с нами','Месяц с WSPORT','Два месяца','Сто дней'],
    function(g){ return g === 1 ? 'Войди в аккаунт' : 'Заходи на сайт ' + g + ' разных ' + plural(g,'день','дня','дней'); }),
  [{ id:'site-norm-1', cat:'site', stat:'normSaved', goal:1, title:'Норма посчитана', desc:'Сохрани норму КБЖУ в профиль' },
   { id:'site-manual-1', cat:'site', stat:'manualNorm', goal:1, title:'Свои правила', desc:'Задай норму КБЖУ вручную и сохрани' },
   { id:'site-day-1', cat:'site', stat:'daysBuilt', goal:1, title:'Меню готово', desc:'Собери готовый день питания' },
   { id:'site-day-10', cat:'site', stat:'daysBuilt', goal:10, title:'Планировщик', desc:'Собери готовый день 10 раз' }]
);

/* защита от случайной правки: достижений должно быть ровно 100, id уникальны */
if(ACHIEVEMENTS.length !== 100 || new Set(ACHIEVEMENTS.map(function(a){ return a.id; })).size !== 100){
  console.warn('ACHIEVEMENTS: ожидалось 100 уникальных, сейчас ' + ACHIEVEMENTS.length);
}
