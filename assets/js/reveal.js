/* ============================================================
   BARPOINT — система появления текста
   ТЗ «появление текста по всему лендингу», 02.08.2026.
   Референс: buckssauce.com, модуль gsapAnims в чанке 812e30c7.

   Программист не пишет анимаций: он вешает на элемент атрибут вида
   data-gsap-title-on-scroll, и текст появляется по правилам системы.
   Шесть анимаций — три текстовые (посимвольно / построчно / по словам)
   и три блочные (проявление / выезд снизу / рост из нуля).

   Запуск — IntersectionObserver, НЕ ScrollTrigger: секции #coffee и
   #services запинены, и scrub-трансформы на их содержимом сдвигают
   собственные замеры пина (правило записано в main.js). Срабатывает
   один раз, как в референсе.

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
  var S = { text: .03, base: .05, title: .028, paragraph: .035, bigCopy: .035 };
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
     (ТЗ §6): 91 <span> на строку там и лишний, и заметно дороже. */
  function playTitle(el, delay) {
    var mob = isMobile();
    var sp = splitOf(el, mob ? "lines,words" : "lines,words,chars");
    var units = mob ? sp.words : sp.chars;
    gsap.timeline({ delay: delay })
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
     в title: разлёт с поворотом на узкой колонке читается как шум. */
  function playBigCopy(el, delay) {
    if (isMobile()) return playTitle(el, delay);
    var sp = splitOf(el, "lines,words,chars");
    gsap.timeline({ delay: (delay || 0) + .1 })
      .set(sp.words, {
        opacity: 0, y: 100, scaleX: .5, scaleY: 1.5,
        rotation: "random(-30, 30)", transformOrigin: "50% 100%"
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

  /* ---------- ГРАБЛИ §10.1: слайды запиненных секций ----------
     Неактивные слайды лежат под opacity:0; visibility:hidden — из
     геометрии они НЕ выпадают, и наблюдатель считает их видимыми.
     Текст третьего слайда отыграл бы вхолостую задолго до того, как
     пользователь до него долистает. На десктопе ждём не въезда в экран,
     а появления класса is-active. Первый слайд активен изначально —
     для него ориентир прежний, въезд самой секции. */
  function armSlide(el, run, slide) {
    var section = slide.closest("[data-prs]") || slide.parentElement;
    var mo = new MutationObserver(function () {
      if (!slide.classList.contains("is-active")) return;
      mo.disconnect();
      fire(el, run);
    });
    mo.observe(section, { subtree: true, attributes: true, attributeFilter: ["class"] });
    if (slide.classList.contains("is-active")) armObserver(el, run, section);
  }

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
    var slide = el.closest("[data-prs-slide]");
    if (slide && !isMobile()) { armSlide(el, run, slide); return; }
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
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(init);
  else init();
})();
