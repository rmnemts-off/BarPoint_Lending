/* ============================================================
   BARPOINT — система появления текста
   ТЗ «появление текста по всему лендингу», 02.08.2026.
   Референс: buckssauce.com, модуль gsapAnims в чанке 812e30c7.

   Программист не пишет анимаций: он вешает на элемент атрибут вида
   data-gsap-title-on-scroll, и текст появляется по правилам системы.
   Шесть анимаций — три текстовые (посимвольно / построчно / по словам)
   и три блочные (проявление / выезд снизу / рост из нуля).

   Запуск — IntersectionObserver, НЕ ScrollTrigger: на странице есть
   запиненные секции (команда, этапы), и scrub-трансформы на их
   содержимом сдвигают собственные замеры пина (правило записано в
   main.js). Срабатывает один раз, как в референсе.

   Зависимости: gsap 3.13 + SplitText — уже подключены в vendor.
   ============================================================ */
(function () {
  "use strict";

  var docEl = document.documentElement;
  var hasGsap = !!(window.gsap && window.SplitText);
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Без GSAP или при reduced-motion снимаем guard-класс: правило
     opacity:0 висит на html.js-reveal, и текст просто остаётся видимым.
     Ни одного inline-стиля, ни одного вызова SplitText (ТЗ §10.4). */
  if (!hasGsap || reduce) { docEl.classList.remove("js-reveal"); return; }

  /* ---------- токены движения (дословно из референса, ТЗ §2) ---------- */
  var D = {
    hover: .25, fast: .3, medium: .4, base: .5, slow: .8,
    title: .48, paragraph: .7, bigCopy: 1.25
  };
  /* bigCopy: .033, а не .035 — шаг между словами снят живьём с референса
     04.08 (34 слова, покадровая запись: ровно 33.3мс, два кадра при 60Гц). */
  var S = { text: .03, base: .05, title: .028, paragraph: .035, bigCopy: .033 };
  var E = {
    base: "power2.out", inOut: "power2.inOut", hover: "power2.inOut",
    copy: "power3.out", elastic: "elastic.out(1, 0.75)", bigCopy: "bigCopy",
    back: {
      ui: "back.out(1.2)", low: "back.out(1.4)", base: "back.out(1.7)",
      medium: "back.out(2.5)", high: "back.out(4)"
    }
  };

  /* Кривая bigCopy зарегистрирована в main.js (он грузится раньше —
     оба скрипта defer, порядок сохраняется). Свою копию ставим только
     если main.js почему-то не отработал: плагин CustomEase не тянем. */
  if (!gsap.parseEase("bigCopy")) {
    var SEG = [
      [0, 0, .084, .61, .1, 1.09, .2, 1.1],
      [.2, 1.1, .306, 1.11, .295, .978, .386, .978],
      [.386, .978, .444, .978, .477, 1, .519, 1],
      [.519, 1, .619, 1, .888, 1, 1, 1]
    ];
    gsap.registerEase("bigCopy", function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var cub = function (p0, p1, p2, p3, t) {
        var u = 1 - t;
        return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
      };
      var s = SEG[SEG.length - 1], i;
      for (i = 0; i < SEG.length; i++) { if (x <= SEG[i][6]) { s = SEG[i]; break; } }
      var lo = 0, hi = 1, t = .5;
      for (i = 0; i < 26; i++) {
        t = (lo + hi) / 2;
        if (cub(s[0], s[2], s[4], s[6], t) < x) lo = t; else hi = t;
      }
      return cub(s[1], s[3], s[5], s[7], (lo + hi) / 2);
    });
  }

  var MOBILE = 1024; // тот же порог, что у остальной адаптивности проекта
  function isMobile() { return window.innerWidth < MOBILE; }

  /* ---------- адаптивный шаг каскада (ТЗ §5) ----------
     У референса типовой заголовок ~40 знаков и выход ≈1.6 с. Русский
     текст длиннее: заголовок первого экрана — 91 знак, при том же шаге
     он играл бы 3 с. Держим ТУ ЖЕ полную длительность, подгоняя шаг под
     длину строки: до 40 знаков всё играет ровно как в оригинале (шаг
     упирается в потолок), дальше каскад ужимается, но не вырождается
     в одновременное появление — нижняя граница base/3.5. */
  var TITLE_SPAN = 1.12; // 1.6 − D.title
  function titleStagger(n, base) {
    base = base || S.title;
    return n ? gsap.utils.clamp(base / 3.5, base, TITLE_SPAN / n) : base;
  }

  /* ---------- общее завершение ----------
     SplitText.revert() возвращает исходную разметку: <span class="nw">
     в заголовке героя и <em> в финальном — на месте, узлов .char/.word/
     .line в DOM не остаётся. Инлайновый opacity:1 снимать НЕЛЬЗЯ — под
     ним лежит правило html.js-reveal […]{opacity:0}, элемент пропадёт. */
  function finish(el, sp) {
    return function () {
      if (sp) sp.revert();
      el.style.opacity = "1";
      el.style.willChange = "auto";
    };
  }

  function splitOf(el, type) {
    return SplitText.create(el, {
      type: type, linesClass: "line", wordsClass: "word", charsClass: "char"
    });
  }

  /* ---------- 1. title: заголовок посимвольно (ТЗ §3.1) ----------
     На мобильном знаки не режем вовсе — единицей становится слово
     (ТЗ §6): 91 <span> на строку там и лишний, и заметно дороже.
     Вынесено в отдельную ленту, чтобы её можно было вложить в чужую:
     карточкам услуг нужен ОДИН таймлайн на всю карточку (см. playCard). */
  function titleTl(el) {
    var mob = isMobile();
    var sp = splitOf(el, mob ? "lines,words" : "lines,words,chars");
    var units = mob ? sp.words : sp.chars;
    return gsap.timeline()
      .set(units, { opacity: 0, y: 60, scaleX: .8, scaleY: .5, transformOrigin: "50% 100%" })
      .set(el, { opacity: 1 }, "<")
      .to(units, {
        opacity: 1, y: 0, scaleX: 1, scaleY: 1,
        duration: D.title,
        stagger: titleStagger(units.length, mob ? S.base : S.title),
        ease: E.back.base,
        onComplete: finish(el, sp)
      }, "<");
  }
  function playTitle(el, delay) {
    gsap.timeline({ delay: delay }).add(titleTl(el));
  }

  /* ---------- 2. text: абзац построчно (ТЗ §3.2) ---------- */
  function playText(el, delay) {
    var sp = SplitText.create(el, { type: "lines", linesClass: "line" });
    gsap.timeline({ delay: delay })
      .set(sp.lines, { opacity: 0, yPercent: 50 })
      .set(el, { opacity: 1 }, "<")
      .to(sp.lines, {
        opacity: 1, yPercent: 0,
        duration: D.paragraph, stagger: S.paragraph, ease: E.copy,
        onComplete: finish(el, sp)
      }, "<");
  }

  /* ---------- 3. bigCopy: манифест по словам (ТЗ §3.3) ----------
     Слова вылетают снизу вытянутыми по вертикали и повёрнутыми на
     случайный угол в пределах ±30°. На мобильном приём вырождается
     в title: разлёт с поворотом на узкой колонке читается как шум.

     ПЕРЕСНЯТО ЖИВЬЁМ 04.08 с buckssauce.com/wholesale — абзац «For
     retailers and restaurants…». Разбор: SplitText на строки → слова →
     знаки, но анимируются ТОЛЬКО слова (у .char нет ни своего transform,
     ни своей opacity). Стартовое состояние каждого слова, снятое из
     матрицы: opacity 0, y +100, scaleX .5, scaleY 1.5, поворот случайный
     в ±30°. Шаг 33мс, длительность до полной остановки 650мс, кривая с
     выбросом до 1.10 на 265мс, откатом до 0.978 на 482мс и покоем с 650.
     Наши D.bigCopy = 1.25с и ease «bigCopy» дают ТУ ЖЕ кривую в тех же
     миллисекундах (сверено численно, RMS 0.0013): выброс на .20 ленты =
     250мс, откат на .386 = 483мс, дальше кривая держит единицу — то есть
     последняя половина нашей ленты уже неподвижна. Значения не трогать.

     ДВЕ ВЕЩИ, КОТОРЫЕ РАСХОДИЛИСЬ С РЕФЕРЕНСОМ И ИСПРАВЛЕНЫ 04.08:

     1. transformOrigin. Было «50% 100%» — слово росло и вращалось от
        своей нижней кромки, как маятник от подвеса. У референса замер
        даёт 42.69px / 31.5px при габарите слова 85×63, то есть РОВНО
        центр. Ставим центр явно, а не полагаемся на умолчание: GSAP
        держит transformOrigin в своём кэше на элементе, и после прежней
        версии на том же узле осталось бы старое значение.

     2. Бросок y. У референса это 100px при кегле 63px, то есть 1.587em,
        а НЕ сто пикселей как таковые. Приём вешается на два текста
        разного кегля: первый экран — 28px, финал — 48px. Фиксированные
        100px на 28px кегля дали бы бросок в 3.6 строки вместо полутора,
        и слова прилетали бы из-за края блока. Поэтому бросок считается
        от кегля самого элемента — на 63px он снова ровно 100px. */
  function bigCopyThrow(el) {
    return 1.587 * (parseFloat(getComputedStyle(el).fontSize) || 16);
  }
  function playBigCopy(el, delay) {
    if (isMobile()) return playTitle(el, delay);
    var sp = splitOf(el, "lines,words,chars");
    gsap.timeline({ delay: (delay || 0) + .1 })
      .set(sp.words, {
        opacity: 0, y: bigCopyThrow(el), scaleX: .5, scaleY: 1.5,
        rotation: "random(-30, 30)", transformOrigin: "50% 50%"
      })
      .set(el, { opacity: 1 }, "<")
      .to(sp.words, {
        opacity: 1, y: 0, scaleX: 1, scaleY: 1, rotation: 0,
        duration: D.bigCopy, stagger: S.bigCopy, ease: E.bigCopy,
        onComplete: finish(el, sp)
      }, "<");
  }

  /* ---------- 4–6. блочные: appear / slideIn / scaleUp (ТЗ §3.4–3.6) ----
     Каскад включается, только если у контейнера стоит
     data-gsap-stagger-scope — тогда единицами становятся его прямые дети. */
  var BLOCK = {
    appear:  { from: { opacity: 0 },            to: { opacity: 1 },            ease: E.base },
    slideIn: { from: { opacity: 0, y: 64 },     to: { opacity: 1, y: 0 },      ease: E.back.ui },
    scaleUp: { from: { opacity: 0, scale: 0 },  to: { opacity: 1, scale: 1 },  ease: E.back.low }
  };
  function blockPlayer(kind) {
    return function (el, delay) {
      var spec = BLOCK[kind];
      var scoped = el.hasAttribute("data-gsap-stagger-scope");
      var units = scoped ? Array.prototype.slice.call(el.children) : el;
      var vars = {}, k;
      for (k in spec.to) vars[k] = spec.to[k];
      vars.duration = D.base;
      vars.ease = spec.ease;
      if (scoped) vars.stagger = S.base;
      vars.onComplete = finish(el, null);
      var tl = gsap.timeline({ delay: delay }).set(units, spec.from);
      if (scoped) tl.set(el, { opacity: 1 }, "<"); // контейнер показываем сразу
      tl.to(units, vars, "<");
    };
  }

  /* ---------- карта атрибутов ---------- */
  var MAP = [
    ["data-gsap-title",     playTitle],
    ["data-gsap-text",      playText],
    ["data-gsap-big-copy",  playBigCopy],
    ["data-gsap-appear",    blockPlayer("appear")],
    ["data-gsap-slide-in",  blockPlayer("slideIn")],
    ["data-gsap-scale-up",  blockPlayer("scaleUp")]
  ];

  var played = new WeakSet();
  function fire(el, run) {
    if (played.has(el)) return;
    played.add(el);
    run(el, parseFloat(el.getAttribute("data-gsap-delay")) || 0);
  }

  /* ---------- карточки услуг ----------
     ПЕРЕСНЯТО ПОКАДРОВО 04.08 с buckssauce.com/wholesale (.cards-row №2,
     запись каждого кадра от срабатывания). Раньше лента была собрана по
     разбору чанка и держалась на относительных метках; клиент трижды
     сказал «всё равно не так», и замер показал, чем именно.
     ВСЕ ЧЕТЫРЕ ЧАСТИ И ИХ СМЕЩЕНИЯ — ИЗ ЗАМЕРА, не на глаз:

       0.00  панель   opacity 0→1 и scale .8→1 разом, .7с, power4.out
                      (замер: .391/.878 на 76мс, .812/.962 на 209,
                       .960/.992 на 342, единица к 542–676);
       0.00  слово    opacity 0→1, y 80→0, scale .6→1, угол случайный→±3°,
                      .8с, back.out(2.5). Выброс в замере 18.75% за край
                      (y уходит до −15 при ходе 80) — это и есть back.out
                      около 2.5;
       0.37  заголовок ТОЛЬКО прозрачность знаков, БЕЗ движения и масштаба
                      (см. подробности ниже);
       1.02  пункты   opacity 0→1 и yPercent 50→0, .68с, шаг .117.

     Смещения заданы ЧИСЛАМИ, а не метками «конец предыдущего»: у
     референса они фиксированные, а наши заголовки разной длины — на
     относительных метках список уезжал бы у каждой карточки по-своему. */
  var TITLE_AT = .37;   /* с — старт проявления заголовка панели */
  var ITEMS_AT = 1.02;  /* с — старт списка */
  function playCard(row, i) {
    var q = row.querySelector(".wcard__q");
    var panel = row.querySelector(".wcard__panel");
    var title = row.querySelector(".wcard__title");
    var items = row.querySelectorAll(".wcard__list li");
    var tl = gsap.timeline();

    if (q) {
      tl.set(q, { opacity: 0, y: 80, rotation: "random(-20, 20)", scale: .6 }, 0)
        .to(q, {
          opacity: 1, y: 0, rotation: i % 2 === 0 ? -3 : 3, scale: 1,
          duration: .8, ease: E.back.medium
        }, 0);
    }
    if (panel) {
      tl.set(panel, { opacity: 0, scale: .8 }, 0)
        .to(panel, { opacity: 1, scale: 1, duration: .7, ease: "power4.out" }, 0);
    }
    /* ЗАГОЛОВОК ПАНЕЛИ — ТОЛЬКО ПРОЯВЛЕНИЕ ПО ЗНАКАМ, БЕЗ ДВИЖЕНИЯ.
       Здесь стоял общий titleTl (знаки взлетают снизу сплющенными на
       back.out) — единственное место карточки, которое расходилось с
       референсом. Покадровый замер buckssauce (.wholesale-title):
       y всё время 0, масштаб всё время 1, меняется ТОЛЬКО прозрачность
       знаков, каскадом: на 409мс [.42 .19 0 0 0 0], на 476 [.8 .66 .49
       .29 .04 0], на 542 [1 .94 .85 .72 .56 .37], к 676 все единицы.
       Отсюда шаг ≈21мс и длительность знака ≈.25с. */
    if (title) {
      var tsp = splitOf(title, "lines,words,chars");
      tl.set(tsp.chars, { opacity: 0 }, 0)
        .set(title, { opacity: 1 }, 0)
        .to(tsp.chars, {
          opacity: 1, duration: .25, stagger: .021, ease: E.base,
          onComplete: finish(title, tsp)
        }, TITLE_AT);
    }
    /* ПУНКТЫ СПИСКА (buckssauce, li.wholesale-list-item):
         старт  opacity 0 и y = ровно половина СВОЕЙ высоты (замер: 19.5px
                при высоте пункта 39) — то есть yPercent 50; ни масштаба,
                ни поворота у пункта нет;
         длит.  680мс до покоя, шаг 117мс, кривая затухающая без выброса
                (power3.out лёг на замер: .161/.418/.687/.888 на
                33/99/199/332мс). */
    if (items.length) {
      tl.set(items, { opacity: 0, yPercent: 50 }, 0)
        .to(items, {
          opacity: 1, yPercent: 0, duration: .68, stagger: .117, ease: E.copy
        }, ITEMS_AT);
    }
    return tl;
  }

  /* ПОРОГ НАБЛЮДАТЕЛЯ — .15, И ЭТО ТОЖЕ ЗАМЕР, А НЕ НАСЛЕДСТВО.
     04.08 порог поднимали до .9, чтобы список разбирался на уже стоящей
     карточке, — казалось, что иначе анимация проходит мимо глаз. Замер
     референса это опроверг: там лента трогается, едва ряд показался
     снизу. Живьём, ряд №2 buckssauce при экране 900:
        верх 845, видно  8% — панель ещё 0 / scale .8, пункты нули;
        верх 763, видно 21% — панель уже 1, заголовок уже 1;
        верх 607, видно 44% — пункты [.6 .3 0 0 0 0];
        верх 461, видно 66% — все пункты единицы.
     То есть карточка успевает раскрыться ЗАДОЛГО до посадки, ровно как
     у нас было с порогом .15 (замер нашего шага: список идёт с 44% до
     74% видимости — сходится до процентов). Возвращено как было.
     Заодно ушла и нужда в страховках: при .15 достаточно первого же
     колбэка наблюдателя, который приходит с текущим состоянием даже
     без пересечения порога — прыжок прокрутки карточку не потеряет. */
  function initCards() {
    var rows = document.querySelectorAll(".wcards .wcard");
    Array.prototype.forEach.call(rows, function (row, i) {
      var io = new IntersectionObserver(function (entries) {
        for (var k = 0; k < entries.length; k++) {
          if (!entries[k].isIntersecting) continue;
          io.disconnect();
          if (played.has(row)) return;
          played.add(row);
          playCard(row, i);
          return;
        }
      }, { threshold: .15 });
      io.observe(row);
    });
  }

  /* ---------- ГРАБЛИ §10.2: лента команды — горизонтальный скроллер ----
     На мобильном .hteam__viewport это overflow-x:auto, а карточки лежат
     правее экрана. Наблюдатель с root:null для них не срабатывает
     НИКОГДА — все десять текстов блока так и оставались невидимыми.
     Поэтому root — ближайший прокручиваемый предок. */
  function scrollRoot(el) {
    var p = el.parentElement;
    while (p && p !== document.body) {
      var cs = getComputedStyle(p);
      if (/auto|scroll/.test(cs.overflowX) || /auto|scroll/.test(cs.overflowY)) return p;
      p = p.parentElement;
    }
    return null;
  }

  function armObserver(el, run, target) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        io.disconnect();          // один раз — поведение референса
        fire(el, run);
        return;
      }
    }, { root: scrollRoot(target || el), threshold: .25 });
    io.observe(target || el);
  }

  /* ГРАБЛИ §10.1 (снято 03.08). Здесь жила ветка armSlide: у запиненных
     блоков #coffee / #services неактивные слайды лежали под opacity:0 +
     visibility:hidden, из геометрии не выпадали, и наблюдатель считал их
     видимыми — текст третьего слайда отыгрывал вхолостую задолго до
     того, как до него долистают. Ждали не въезда в экран, а класса
     is-active. Слайдеров больше нет, узлов [data-prs-slide] в разметке
     тоже: ветка стала недостижимой и удалена вместе с ними. */

  /* ГРАБЛИ (замерено, ТЗ §13.9): LCP страницы браузер записывает не в
     момент, когда заголовок первого экрана СТАНОВИТСЯ ВИДЕН, а в момент
     SplitText.revert() — пока текст разложен по знакам, каждый .char
     это inline-block, и Chrome не собирает из них крупный текстовый
     блок-кандидат. Замер: H1 виден с 577 мс, а запись LCP — 1968 мс,
     ровно на возврате разметки. Прежняя механика .js-lines резала
     только на СТРОКИ (текст лежал прямо в блочном div.line) и разбивку
     не снимала — оттого её LCP был 576 мс. Убрать расхождение, сохранив
     посимвольный выход и чистый DOM (критерий §13.2), нельзя: это
     свойство метрики, а не скорости отрисовки. */
  function arm(el, run, onScroll) {
    if (!onScroll) { gsap.delayedCall(.1, function () { fire(el, run); }); return; }
    armObserver(el, run);
  }

  /* ---------- ГРАБЛИ §10.3: шрифты ----------
     SplitText режет строки по метрикам текущего шрифта. Разбив до
     подгрузки woff2 (в проекте их 20), получим съехавшие строки после
     подстановки. Инициализация — после document.fonts.ready, а сама
     разбивка ленивая: SplitText вызывается в момент появления элемента,
     а не на загрузке. Заодно снимается вопрос пересплита при повороте
     экрана и не держатся в DOM сотни лишних узлов. */
  function init() {
    MAP.forEach(function (m) {
      document.querySelectorAll("[" + m[0] + "]").forEach(function (el) { arm(el, m[1], false); });
      document.querySelectorAll("[" + m[0] + "-on-scroll]").forEach(function (el) { arm(el, m[1], true); });
    });
    initCards();
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(init);
  else init();
})();
