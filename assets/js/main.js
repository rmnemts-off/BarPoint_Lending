/* ============================================================
   BARPOINT — интерактив и анимации
   ТЗ v1 (разделы 6–8) + ТЗ2 (Lenis, SplitText, стопка карточек,
   горизонтальная команда, лента кейсов).
   Все scroll-анимации отключаются при prefers-reduced-motion.
   ============================================================ */
(function () {
  "use strict";

  /* ТЗ4 §8.7: обновление страницы = всегда старт с самого верха,
     до инициализации GSAP/Lenis */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  if (location.hash) history.replaceState(null, "", location.pathname);

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
    /* ТЗ6 §6: ScrollTrigger не должен восстанавливать позицию скролла */
    ScrollTrigger.clearScrollMemory("manual");
  }

  /* ============================================================
     ТЗ2 §2 — Lenis: плавный инерционный скролл.
     При prefers-reduced-motion не инициализируется вовсе.
     ============================================================ */
  var lenis = null;
  if (!reduceMotion && hasGsap && window.Lenis) {
    /* ТЗ14 §5: плавность как у PINEA (у них ScrollSmoother smooth:3) —
       догон растянут до ~2.4с (было 1.15), колесо чуть «тяжелее».
       Подбор — бок-о-бок с pinea.wine: duration 2.2–2.6, wheel .85–1.0.
       Тач Lenis не трогает (по умолчанию) — оставлено. */
    lenis = new Lenis({ duration: 2.4, wheelMultiplier: 0.9, autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    /* ТЗ6 §6: Lenis мог подхватить восстановленную позицию — принудительно наверх */
    lenis.scrollTo(0, { immediate: true });
  }
  /* ТЗ6 §6: дубль сброса на load и pageshow (возврат из bfcache) */
  window.addEventListener("load", function () { window.scrollTo(0, 0); });
  window.addEventListener("pageshow", function () { window.scrollTo(0, 0); });
  function lenisStop() { if (lenis) lenis.stop(); }
  function lenisStart() { if (lenis) lenis.start(); }

  /* Якорные ссылки — через lenis.scrollTo с поправкой на шапку (ТЗ2 §2) */
  var headerH = function () { return document.getElementById("header").offsetHeight; };
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -headerH() });
      else target.scrollIntoView();
      history.pushState(null, "", id);
    });
  });

  /* ---------- 6.0 Шапка: «чернила» по фону — МЕХАНИЗМ УДАЛЁН ----------
     ПРАВКА 04.08 (вторая). Здесь жил расчёт цвета шапки: каждый элемент
     с data-ink замерял композитный фон под собой (elementsFromPoint,
     смешение слоёв по остатку прозрачности, плашки кейсов пропускались)
     и переключался между кремовым и charcoal-начертанием — тем, что даёт
     больший контраст. Пересчёт шёл на scroll, resize, load, на каждом
     кадре полёта логотипа, при открытии мобильной шторки и на смене
     фона body.

     Заказчик попросил убрать переключение: «пусть шапка всегда будет в
     своём цвете». Цвет теперь один и живёт целиком в CSS — переменная
     --hdr-ink у .header. Вместе с расчётом ушли: header, inkNodes,
     INK_LIGHT/INK_DARK, relLum, contrast, INK_SKIP, bgAt, updateInk,
     requestInk и три вызова requestInk по месту (полёт логотипа, шторка
     меню, перелив фона).

     ЦЕНА РЕШЕНИЯ — замер по всей странице шагом 40px, 1440×900: пункты
     навигации и знак уходят ниже нормы 3:1 на 1160px прокрутки из 12640,
     кнопка «Обсудить проект» — на 2760px. По-настоящему слепой участок
     один: 7600…8120, шапка идёт по кремовой карточке ленты кейсов, 1:1.
     Разбор по элементам и пути лечения — у .header в style.css.
     Вернуть: код целиком в истории git, последний коммит с ним 7fc5d36. */

  /* ---------- ТЗ4 §3: полёт логотипа из центра героя в слот шапки ---------- */
  var heroLogo = document.querySelector(".js-herologo");
  var logoSlot = document.querySelector(".header__logoslot");
  if (heroLogo && logoSlot && !reduceMotion && hasGsap) {
    var measureFlight = function () {
      var s = logoSlot.getBoundingClientRect(); // слот не трансформируется — стабильный якорь
      /* ТЗ12 §1: логотип ещё крупнее (+22% к ТЗ11) — 66vw десктоп (было 54),
         78vw мобайл (было 64), 50vw на низких экранах <760px (было 40).
         ПРАВИЛО ТЗ5 §3 в силе: логотип не касается заголовка/кнопок
         ни в одной фазе полёта — при нарушении уменьшать логотип, не текст. */
      var frac = window.innerWidth < 768 ? 0.78 : (window.innerHeight < 760 ? 0.50 : 0.66);
      /* Кап в 1000px снят 31.07: он существовал только потому, что знак был
         растром 800px и выше 1.25× начинал мылить. Теперь знак векторный
         (инлайновый SVG в шапке), предела по разрешению нет — ширину
         ограничивает только доля экрана и запретная зона ниже. */
      var startW = window.innerWidth * frac;
      /* ТЗ12 §1.2 — запретная зона считается от РЕАЛЬНОГО положения текста:
         на низких экранах логотип ужимается сам, текст не двигаем.
         Логотип центрируется на 32vh, значит его половина высоты должна
         укладываться в промежуток до верхней текстовой строки минус зазор.
         Правка 30.07: строка-eyebrow удалена — верхний текст героя теперь
         сам заголовок, замеряем по нему. */
      var heroTop = document.querySelector(".hero__title");
      if (heroTop) {
        var GAP = 28;
        var ratio = heroLogo.offsetHeight / Math.max(heroLogo.offsetWidth, 1); // h/w
        /* ГРАБЛИ: getBoundingClientRect ловит текст СМЕЩЁННЫМ интро-твином
           (SplitText + gsap.from) и даёт завышенный запас. offsetTop
           трансформы игнорирует — берём положение по цепочке offsetParent. */
        var eyeDocTop = 0, node = heroTop;
        while (node) { eyeDocTop += node.offsetTop; node = node.offsetParent; }
        var maxHalfH = (eyeDocTop - GAP) - window.innerHeight * 0.32;
        var maxW = (maxHalfH * 2) / Math.max(ratio, 0.01);
        if (maxW > 160) startW = Math.min(startW, maxW);
      }
      return {
        /* масштаб — от фактической ширины логотипа (offsetWidth без transform) */
        startScale: startW / Math.max(heroLogo.offsetWidth, 1),
        /* ТЗ5 §3: центр логотипа на 32% высоты экрана — верхняя зона,
           текстовая группа живёт ниже 52vh, зоны не пересекаются */
        startY: window.innerHeight * 0.32 - s.top - s.height / 2
      };
    };
    var fm = measureFlight();
    gsap.fromTo(heroLogo,
      { scale: function () { return fm.startScale; }, y: function () { return fm.startY; } },
      {
        scale: 1, y: 0, ease: "none",
        /* force3D: false — обязательное условие резкости (правка 31.07,
           пятая). По умолчанию GSAP пишет matrix3d, а 3D-трансформ уводит
           элемент в отдельный композитный слой: слой растрируется один раз
           и дальше тянется видеокартой, поэтому при возврате к геро знак
           разворачивался из растра размером с пристыкованный (24px) и
           выглядел «ужасно». С плоской matrix браузер перерисовывает SVG
           каждый кадр в его настоящем размере. Парная правка — снятое
           will-change: transform у .header__logo в style.css. */
        force3D: false,
        scrollTrigger: {
          start: 0,
          end: function () { return window.innerHeight * (window.innerWidth < 768 ? 0.45 : 0.6); },
          scrub: true, invalidateOnRefresh: true,
          onRefreshInit: function () { fm = measureFlight(); },
          onUpdate: function (self) {
            /* в полёте логотип не кликабелен (ТЗ4 §3.2) */
            heroLogo.style.pointerEvents = self.progress > 0.9 ? "" : "none";
            /* Здесь стоял покадровый пересчёт «чернил»: знак в полёте
               проезжает по разным участкам фона и раньше на них
               перекрашивался. Механизм снят 04.08 — цвет у шапки один. */
          }
        }
      });
    heroLogo.style.pointerEvents = "none";
  }

  /* ---------- 6.2 Маркиза: бесшовный цикл ---------- */
  var marquee = document.querySelector("[data-marquee]");
  if (marquee && !reduceMotion) {
    var baseHTML = marquee.innerHTML;
    var guard = 0;
    while (marquee.scrollWidth < window.innerWidth * 2 && guard < 12) {
      marquee.innerHTML += baseHTML;
      guard++;
    }
    marquee.innerHTML += marquee.innerHTML; // вторая идентичная половина
    marquee.style.animationDuration = (marquee.scrollWidth / 2 / 38) + "s";
  }

  /* ---------- Мобильное меню ---------- */
  var burger = document.querySelector(".burger");
  var mnav = document.getElementById("mnav");
  function closeMenu() {
    mnav.classList.remove("is-open");
    document.documentElement.classList.remove("menu-open");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Открыть меню");
    lenisStart();
  }
  burger.addEventListener("click", function () {
    var open = mnav.classList.toggle("is-open");
    /* Флаг на <html>: пока шторка открыта, знак в шапке прячется — на
       первом экране он ещё «в полёте», крупный, и ложится поверх пунктов
       меню (шапка z-100, шторка z-90). */
    document.documentElement.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    if (open) lenisStop(); else lenisStart();
  });
  mnav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });

  /* Табы «Бар/Кофе» удалены (ТЗ4 §4). Правка 03.08 (третья): деления на
     бар и кофе не осталось и в самих услугах — один блок #services. */

  /* ============================================================
     6.8 Кейсы: данные и общая логика фильтра
     ============================================================ */
  var CASES = window.BARPOINT_CASES || [];
  var CAT_LABEL = { bar: "Бар", coffee: "Кофе" };
  var activeFilter = "all";

  /* ПРАВКА 05.08: картинка ВНЕШНЕЙ карточки кейса (плашка в ленте) взята
     из отдельного поля cardImage, а не из первого кадра галереи.
     Заказчик прислал по каждому кейсу папку, где кадр «Интерьер» идёт
     именно на карточку, а нумерованные — внутрь разворота. Раньше и то,
     и другое тянулось из gallery[0], то есть первый кадр разворота был
     обязан быть и обложкой; развести их иначе было нельзя.
     Фолбэк на gallery[0] оставлен намеренно: после второго архива (06.08)
     поле стоит у двенадцати кейсов из пятнадцати, у остальных трёх
     обложкой по-прежнему служит первый кадр разворота. */
  function cardImage(c) {
    return "assets/img/" + (c.cardImage || c.gallery[0]) + ".webp";
  }

  /* Правка 05.08: рубрика на карточке. По умолчанию — название категории,
     но кейс может задать свою подпись полем categoryLabel (у Aina, Зойки,
     Sixty и Lúwo стоит «Ресторан + бар»). Сама category при этом не
     меняется: по ней собирается выборка кейсов, см. visibleCaseIndices. */
  function catLabel(c) {
    var t = c.categoryLabel || CAT_LABEL[c.category];
    /* «+» выносим в свой span: у Roslindale это волосяной штрих, и на
       кегле рубрики знак почти пропадал. Утолщение делает CSS. */
    return t.replace(/\+/g, '<span class="cat__plus">+</span>');
  }

  function logoHTML(c) {
    if (c.logoImage) {
      return '<img src="' + c.logoImage + '" alt="Логотип проекта ' + c.title + '"' +
        (c.logoDark ? ' style="background:#101111;padding:8px 14px;border-radius:4px"' : "") + ">";
    }
    var cls = c.logoStyle === "grotesk" ? "tlogo tlogo--grotesk" : "tlogo";
    return '<span class="' + cls + '">' + c.title + "</span>";
  }
  /* Плашка над карточкой кейса (правка 02.08): название набирается не
     копперплейтом, а СВОИМ начертанием заведения — тот же приём, что в
     трастстрипе после шапки. Знак — обычная картинка, уже в нужном
     цвете (файлы -light.png). CSS-маску с заливкой currentColor брать
     НЕЛЬЗЯ: маска — ресурс с ограничением по origin, и при открытии
     страницы через file:// (а заказчик смотрит именно так) каждый файл
     для браузера чужой origin — маска не применяется и знак пропадает
     целиком. Знак Invasion цветной (белый + фирменный циан) и лежит
     отдельным файлом со снятой чёрной подложкой.
     Где знака нет (Sixty, Duran Bar, Buro Tsum) — имя набрано контрастной
     антиквой смешанным регистром, ровно как в презентации. */
  function plaqueHTML(c) {
    var m = c.mark;
    if (!m) return '<span class="plaque"><span>' + c.title + "</span></span>";
    if (m.type === "antiqua") {
      return '<span class="plaque"><span class="pmark-type">' + c.title + "</span></span>";
    }
    /* без loading="lazy": знак — это НАЗВАНИЕ кейса, пустая плашка до
       догрузки читается как поломка. Все девять файлов вместе — 128 КБ,
       и лента переиспользует их на дублях карточек. */
    var mark = '<img class="pmark-img" src="' + m.img + '" alt="" style="--ar:' + m.ar +
      ";--k:" + m.k + '" decoding="async">';
    return '<span class="plaque" role="img" aria-label="' + c.title + '">' + mark +
      (m.suffix ? '<span class="pmark-suffix">' + m.suffix + "</span>" : "") + "</span>";
  }

  function visibleCaseIndices() {
    var idx = [];
    CASES.forEach(function (c, i) {
      if (activeFilter === "all" || c.category === activeFilter) idx.push(i);
    });
    return idx;
  }
  function siblingCase(current, dir) {
    var idx = visibleCaseIndices();
    var pos = idx.indexOf(current);
    if (pos === -1) return current;
    return idx[(pos + dir + idx.length) % idx.length];
  }

  /* ---------- Режим A (reduced-motion): статичная сетка-fallback ---------- */
  var grid = document.querySelector("[data-cases-grid]");
  function buildGrid() {
    grid.hidden = false;
    CASES.forEach(function (c, i) {
      var card = document.createElement("button");
      card.className = "case-card";
      card.type = "button";
      card.dataset.category = c.category;
      card.setAttribute("aria-haspopup", "dialog");
      card.setAttribute("aria-label", "Кейс " + c.title + " — подробнее");
      card.innerHTML =
        '<span class="case-card__logo">' + logoHTML(c) + "</span>" +
        '<span class="case-card__photo"><img src="' + cardImage(c) + '" alt="' + c.title + ' — фото проекта" loading="lazy" decoding="async"></span>' +
        '<span class="case-card__meta"><span class="cat">' + catLabel(c) + '</span><span class="more">смотреть →</span></span>';
      card.addEventListener("click", function () { openCase(i, card); });
      grid.appendChild(card);
    });
  }
  function filterGrid() {
    grid.querySelectorAll(".case-card").forEach(function (card) {
      card.hidden = activeFilter !== "all" && card.dataset.category !== activeFilter;
    });
  }

  /* ---------- Режим B (ТЗ2 §6): бесконечная лента с drag ---------- */
  var rail = document.querySelector("[data-crail]");
  var railTrack = document.querySelector("[data-crail-track]");
  var railDragMoved = false;

  /* ---- физика ленты (правка 03.08, вторая: один в один лента отзывов
     buckssauce — там gsap.ticker + Draggable, и разобранная модель такая).

     У ленты есть СКОРОСТЬ, и кадр считает одно из трёх:
       жест (палец/тачпад) — кадр не вмешивается вообще, ленту ведёт сам
                             жест 1:1, а скорость берётся из dx/dt;
       выбег после броска  — остаток скорости сверх автопроката затухает
                             (RAIL_DECAY за кадр + линейное RAIL_PULL) и
                             лента доезжает, сходясь к автопрокату;
       свободный ход       — скорость подтягивается к автопрокату долей
                             RAIL_TAKEUP за кадр.
     Направление автопроката — знак последнего заметного движения жеста:
     свайпнул вправо — лента и дальше едет вправо.

     ГЛАВНОЕ ОТЛИЧИЕ ОТ ПРЕЖНЕЙ ВЕРСИИ: у ленты не осталось пауз по
     наведению и по фокусу. Именно focusin/focusout её и заклинивали —
     см. комментарий в initRail. */
  var railPos = 0;       // отрисованное смещение трека, px
  var railVel = 0;       // текущая скорость, px/с
  var railAim = 0;       // скорость автопроката, к которой всё сходится
  var railExtra = 0;     // остаток броска сверх автопроката (выбег)
  var railFling = false; // идёт выбег после отпускания
  var railDir = -1;      // сторона автопроката: −1 влево, +1 вправо
  var railHalf = 0;      // период ленты (один набор карточек), px
  var railHeld = false;  // палец (или жест тачпада) ведёт ленту
  var railGain = 1;      // 0 — автопрокат выключен (открыт разворот)
  var railLive = true;   // лента в кадре
  var railWheelT = null; // таймер «жест тачпада ещё идёт»
  var railGestT = 0;     // performance.now() прошлого события жеста

  var RAIL_DRIFT = 40;     // px/с — скорость автопроката (у buckssauce 28)
  var RAIL_MAXV = 2000;    // px/с — потолок скорости броска
  var RAIL_TAKEUP = 0.05;  // доля подтяжки к автопрокату за кадр
  var RAIL_DECAY = 0.96;   // затухание выбега за кадр (при 60 fps)
  var RAIL_PULL = 0.015;   // добавочное линейное стягивание выбега к нулю
  var RAIL_SNAP = 2;       // px/с — ниже этого выбег обнуляется

  function ccardNode(i, isDup) {
    var c = CASES[i];
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ccard";
    b.dataset.index = i;
    if (isDup) { b.setAttribute("aria-hidden", "true"); b.tabIndex = -1; }
    else {
      b.setAttribute("aria-haspopup", "dialog");
      b.setAttribute("aria-label", "Кейс " + c.title + " — подробнее");
    }
    /* Правка 31.07: бейдж с метрикой («2 млн → 5 млрд» у PIMS и Landy)
       с фото снят — цифры остаются в развороте кейса. Откат: вернуть
       var badge = … и подстановку badge после <img>. */
    b.innerHTML =
      plaqueHTML(c) +
      '<span class="ccard__photo"><img src="' + cardImage(c) + '" alt="' + c.title + ' — фото проекта" loading="lazy" decoding="async"></span>' +
      '<span class="ccard__meta"><span class="cat">' + catLabel(c) + '</span><span class="ccard__desc">' + c.shortDescription + "</span></span>";
    b.addEventListener("click", function () {
      if (railDragMoved) return; // это был drag, не клик
      openCase(i, b);
    });
    return b;
  }

  function buildRail() {
    var idx = visibleCaseIndices();
    var isStatic = idx.length < 4; // «кофе»: 2 кейса — статично по центру (ТЗ2 §6)
    railTrack.innerHTML = "";
    railPos = railExtra = 0;
    railFling = false;
    railDir = -1;
    railVel = railAim = railDir * RAIL_DRIFT;
    railTrack.style.transform = "";
    idx.forEach(function (i) { railTrack.appendChild(ccardNode(i, false)); });
    rail.classList.toggle("crail--static", isStatic);
    if (isStatic) { railHalf = 0; return; }
    idx.forEach(function (i) { railTrack.appendChild(ccardNode(i, true)); }); // дубль ×2
    railMeasure();
  }

  /* Период ленты — это ОДИН набор карточек ВМЕСТЕ с зазором, который стоит
     между набором и его дублем. scrollWidth считает n−1 зазор на 2n карточек,
     поэтому просто /2 давало недостачу в ползазора и микрорывок на стыке. */
  function railMeasure() {
    if (rail.classList.contains("crail--static")) { railHalf = 0; return; }
    var gap = parseFloat(getComputedStyle(railTrack).columnGap) || 0;
    railHalf = (railTrack.scrollWidth + gap) / 2;
  }

  function railWrap() {
    if (!railHalf) return;
    while (railPos <= -railHalf) railPos += railHalf;
    while (railPos > 0) railPos -= railHalf;
  }

  function railRender() {
    railTrack.style.transform = "translate3d(" + railPos.toFixed(2) + "px,0,0)";
  }

  /* Один шаг жеста: лента идёт за пальцем 1:1 (никакого догоняющего
     сглаживания — оно и давало ощущение «отстаёт»), а скорость берётся из
     dx/dt с потолком ±RAIL_MAXV — ровно как Draggable считает deltaX у
     ленты отзывов buckssauce. Сторону автопроката задаёт последнее
     заметное движение: остановился пальцем перед отпусканием — лента
     поедет туда же, куда её вели, а не рванёт обратно. */
  function railStep(dx) {
    var now = performance.now();
    var dt = Math.max(now - railGestT, 16);
    railGestT = now;
    var v = dx / dt * 1000;
    if (v > RAIL_MAXV) v = RAIL_MAXV; else if (v < -RAIL_MAXV) v = -RAIL_MAXV;
    if (Math.abs(v) > 0.5) railDir = v > 0 ? 1 : -1;
    railVel = railAim = v;
    railPos += dx;
    railWrap();
    railRender();
  }

  function railGrab() {
    railHeld = true;
    railFling = false;
    railExtra = 0;
    railGestT = performance.now();
  }

  /* Отпускание жеста — общее для пальца и тачпада: то, что лента набрала
     сверх автопроката, становится выбегом и затухает в кадре. */
  function railRelease() {
    if (railWheelT !== null) { clearTimeout(railWheelT); railWheelT = null; }
    railHeld = false;
    railAim = railDir * RAIL_DRIFT * railGain;
    railExtra = railVel - railAim;
    railFling = true;
  }

  function railFrame(_time, deltaMs) {
    if (!railHalf || railHeld) return; // под жестом позицию ведёт сам жест
    if (!railLive) return;             // за кадром лента стоит
    var s = deltaMs / 1000;
    if (s <= 0) return;
    if (s > 0.05) s = 0.05; // вернулись во вкладку — не улетать на секунды кадра
    railAim = railDir * RAIL_DRIFT * railGain;
    if (railFling) {
      railExtra *= Math.pow(RAIL_DECAY, 60 * s);
      railExtra += (0 - railExtra) * RAIL_PULL;
      railVel = railAim + railExtra;
      if (Math.abs(railExtra) < RAIL_SNAP) { railExtra = 0; railVel = railAim; railFling = false; }
    } else {
      railVel += (railAim - railVel) * RAIL_TAKEUP;
      /* при выключенном автопрокате (открыт разворот, railGain 0) подтяжка
         гонит скорость к нулю лишь асимптотически — лента вечно ползла бы
         на сотые пикселя и писала transform каждый кадр под анимациями
         разворота. Ниже порога — честный ноль */
      if (!railAim && Math.abs(railVel) < RAIL_SNAP) railVel = 0;
    }
    if (!railVel) return; // стоим — кадру нечего писать
    railPos += railVel * s;
    railWrap();
    railRender();
  }

  function setRailSpeed(scale) { railGain = scale; }

  /* Прогрев обложек (правка 06.08, вторая). Карточки лежат с loading="lazy",
     и при автопрокате браузер брался за каждую обложку ровно в момент,
     когда та подъезжала к кадру: загрузка и декод 200–350-КБ вебпов
     падали прямо на движение — лента вздрагивала. Как только лента впервые
     оказалась у экрана, снимаем lazy у всех её картинок разом: они успевают
     доехать, пока лента ещё только въезжает в кадр. Смена loading на eager
     у отложенной картинки запускает загрузку сразу — это по спецификации.
     После пересборки фильтром карточки снова с lazy, но URL уже в кэше. */
  var railWarmed = false;
  function warmRailImages() {
    if (railWarmed) return;
    railWarmed = true;
    Array.prototype.forEach.call(railTrack.querySelectorAll("img[loading=lazy]"),
      function (img) { img.loading = "eager"; });
  }

  function initRail() {
    rail.hidden = false;
    buildRail();
    gsap.ticker.add(railFrame);

    if (window.IntersectionObserver) {
      railLive = false;
      new IntersectionObserver(function (es) {
        railLive = es[0].isIntersecting;
        if (railLive) warmRailImages();
      }, { rootMargin: "160px 0px" }).observe(rail);
    } else {
      warmRailImages();
    }

    var rz;
    window.addEventListener("resize", function () {
      clearTimeout(rz);
      rz = setTimeout(function () { railMeasure(); railWrap(); }, 150);
    });

    /* ГРАБЛИ (правка 03.08, вторая). Здесь стояла пара
         rail.addEventListener("focusin",  () => setRailSpeed(0));
         rail.addEventListener("focusout", () => { if (!rail.matches(":focus-within")) setRailSpeed(1); });
       и это была та самая «лента встала и больше не едет»:
         — клик по карточке даёт ей фокус, то есть автопрокат выключался
           при любом открытии кейса, а не только при обходе с клавиатуры;
         — closeCover сначала зовёт setRailSpeed(1), а сразу за ним
           lastFocus.focus() — фокус возвращается на карточку, focusin
           снова гасит ленту, и она стоит уже навсегда;
         — на самом focusout ещё держится :focus-within (новый элемент
           фокуса на этот момент не проставлен), так что уход табом из
           ленты тоже оставлял railGain === 0 без единого шанса на возврат.
       У ленты отзывов buckssauce пауз нет вообще — ни по hover, ни по
       фокусу. Оставляем ровно одну (railGain в openCase/closeCover): при
       открытом развороте лента не видна, зато обратный FLIP-зум приезжает
       в неподвижную карточку. Откат: вернуть две строки выше. */

    /* ТЗ3 §2.2: горизонтальный жест тачпада двигает ленту;
       вертикальный скролл страницы не перехватываем.
       Тачпад присылает и собственную инерцию, поэтому жест считается
       законченным только через 90 мс тишины — тогда лента подхватывает
       накопленную скорость и доезжает уже своей. */
    rail.addEventListener("wheel", function (e) {
      if (!railHalf) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (railWheelT === null) railGrab(); else clearTimeout(railWheelT);
      railStep(-e.deltaX);
      railWheelT = setTimeout(railRelease, 90);
    }, { passive: false });

    /* drag мышью и пальцем; клик подавляется при смещении > 7px */
    var dragId = null, dragFrom = 0, prevX = 0;
    rail.addEventListener("pointerdown", function (e) {
      if (!railHalf || dragId !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragId = e.pointerId;
      dragFrom = prevX = e.clientX;
      railDragMoved = false;
      railGrab();
      rail.classList.add("is-dragging");
    });
    window.addEventListener("pointermove", function (e) {
      if (dragId === null || e.pointerId !== dragId) return;
      railStep(e.clientX - prevX);
      prevX = e.clientX;
      if (Math.abs(e.clientX - dragFrom) > 7) railDragMoved = true;
    }, { passive: true });
    function endDrag(e) {
      if (dragId === null || (e && e.pointerId !== dragId)) return;
      dragId = null;
      rail.classList.remove("is-dragging");
      railRelease();
      setTimeout(function () { railDragMoved = false; }, 0); // после click-события
    }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  /* Выбор режима кейсов */
  var railMode = !reduceMotion && hasGsap;
  if (railMode) initRail(); else buildGrid();

  /* Фильтр Все / Бар / Кофе */
  document.querySelectorAll(".cases-filter button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".cases-filter button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", "true");
      activeFilter = b.dataset.filter;
      if (railMode) {
        /* плавный fade-out → пересборка → fade-in (ТЗ2 §6).
           ПРАВКА 06.08 (вторая): ScrollTrigger.refresh() переехал сюда из
           хвоста обработчика. Раньше пересчёт (десятки миллисекунд на всю
           страницу) дёргался в один кадр со СТАРТОМ фейда — анимация
           начиналась с затыка, — и мерил ещё СТАРУЮ ленту: статичный режим
           («Кофе» — две карточки по центру) меняет высоту блока уже после.
           Теперь пересчёт идёт между фейдами, пока лента невидима, и по
           уже пересобранной раскладке. overwrite: быстрые клики по
           фильтрам иначе копили встречные твины прозрачности. */
        gsap.to(rail, {
          opacity: 0, duration: 0.25, overwrite: true, onComplete: function () {
            buildRail();
            ScrollTrigger.refresh();
            gsap.to(rail, { opacity: 1, duration: 0.25, overwrite: true });
          }
        });
      } else {
        filterGrid();
        if (hasGsap) ScrollTrigger.refresh();
      }
    });
  });

  /* ============================================================
     РАЗВОРОТ КЕЙСА — по ТЗ «переработка разворота кейса BARPOINT
     по структуре Bucks Sauce» (эталон block_3.html).

     Открытие и закрытие остались прежними: FLIP-зум из карточки
     ленты, остановка Lenis и ленты, focus-trap, Esc, возврат
     фокуса. Переписано всё, что происходит ВНУТРИ разворота:
     галерея из двух слоёв-слотов, стрелки, уезжающие в scale 0,
     свайп с порогом 40px, вступительный таймлайн со случайным
     поворотом карточек, ховер главной кнопки и плавающий предмет.
     ============================================================ */
  var cover = document.querySelector("[data-cover]");
  var coverInner = document.querySelector("[data-cover-inner]");
  var coverGrid = document.querySelector("[data-cover-grid]");
  var coverPattern = document.querySelector("[data-cover-pattern]");
  var coverTitle = document.querySelector("[data-cover-title]");
  var coverSub = document.querySelector("[data-cover-sub]");
  var coverDesc = document.querySelector("[data-cover-desc]");
  var coverWorks = document.querySelector("[data-cover-works]");
  var coverWorksBox = document.querySelector("[data-cover-worksbox]");
  var coverName = document.querySelector("[data-cover-name]");
  var coverCount = document.querySelector("[data-cover-count]");
  var coverClip = document.querySelector("[data-cover-clip]");
  var cgal = document.querySelector("[data-cgal]");
  var cgalStage = document.querySelector("[data-cgal-stage]");
  var cgalPreload = document.querySelector("[data-cgal-preload]");
  var slotA = cgalStage.querySelector('[data-slot="a"]');
  var slotB = cgalStage.querySelector('[data-slot="b"]');
  var imgA = slotA.querySelector("img");
  var imgB = slotB.querySelector("img");
  var arrowSlots = cover.querySelectorAll("[data-arrow-slot]");
  var currentCase = -1;
  var lastFocus = null;
  var preloadTimer = null;
  var coverClosing = false; /* идёт fade закрытия — см. openCase/closeCover */
  /* Плагин Flip отсюда убран вместе с перелётом фото (правка 06.08) —
     подробности у openCase. */

  /* ---------- токены движения (дословно из системы оригинала) ---------- */
  var CVD = { base: .5, slow: .8, title: .48, paragraph: .7, bigCopy: 1.25 };
  var CVS = { title: .028, paragraph: .035, bigCopy: .035 };
  var CVE = {
    base: "power2.out", hover: "power2.inOut", copy: "power3.out",
    backLow: "back.out(1.4)", backBase: "back.out(1.7)", backMed: "back.out(2.5)"
  };
  var COVER_DELAY = 100; /* мс */

  /* Кривая «bigCopy» из системы движения оригинала. Плагин CustomEase
     в vendor не тянем: кривая ровно одна, и разобрать её путь
     "M0,0 C0.084,0.61 0.1,1.09 0.2,1.1 …" на четыре кубических сегмента
     дешевле, чем добавлять ещё один файл на страницу. y ищется по x
     бисекцией — значения совпадают с CustomEase до 1e-7. */
  var BIGCOPY = [
    [0, 0, .084, .61, .1, 1.09, .2, 1.1],
    [.2, 1.1, .306, 1.11, .295, .978, .386, .978],
    [.386, .978, .444, .978, .477, 1, .519, 1],
    [.519, 1, .619, 1, .888, 1, 1, 1]
  ];
  function cubicAt(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }
  function bigCopyEase(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var s = BIGCOPY[BIGCOPY.length - 1], i;
    for (i = 0; i < BIGCOPY.length; i++) {
      if (x <= BIGCOPY[i][6]) { s = BIGCOPY[i]; break; }
    }
    var lo = 0, hi = 1, t = .5;
    for (i = 0; i < 26; i++) {
      t = (lo + hi) / 2;
      if (cubicAt(s[0], s[2], s[4], s[6], t) < x) lo = t; else hi = t;
    }
    return cubicAt(s[1], s[3], s[5], s[7], (lo + hi) / 2);
  }
  if (hasGsap) gsap.registerEase("bigCopy", bigCopyEase);

  /* ---------- вырез под крестик в левом верхнем углу галереи ----------
     Путь в пиксельных координатах контейнера; ниже 1024px выреза нет.

     ПРАВКА 04.08 — вырез 146×68 → 78×78 (просьба клиента: «продли картинку
     и обрежь её примерно там, где начинается кругляшок, чтобы не было
     непонятного пустого пространства»).
     Считано, а не подобрано: крестик — круг 60px, посаженный абсолютно на
     .cover в (14, 14); левый верхний угол галереи стоит на (10, 10) из-за
     полей .cover__inner, поэтому В КООРДИНАТАХ ГАЛЕРЕИ круг занимает
     4…64 по обеим осям. Прежний вырез был 146 в ширину — то есть справа
     от кнопки зияли 82px пустоты, а снизу оставалось всего 4px. Теперь
     вырез квадратный, 78×78: те же 14px воздуха вокруг круга с каждой
     стороны, что и слева-сверху, и ни пикселем больше.

     ПРАВКА 06.08 (клиент: «расстояние справа от крестика до картинки
     должно быть таким же, как снизу»). Обещанных 14px справа не было:
     вертикальная кромка выреза шла по x = NOTCH_W − R, то есть радиус
     скругления съедал 10 из 14 и картинка подходила к кнопке на 4px, а
     снизу честно отступала на 14. Замером по самому пути: кромка справа
     стояла на 68, снизу на 78. Теперь вертикаль идёт по x = NOTCH_W,
     вогнутый угол скругляется около точки (NOTCH_W, NOTCH_H), а верхний
     угол выреза отведён наружу — зазор справа и снизу по 14px.
     Клип общий на все кейсы — числа тут одни, картинки разные. */
  var NOTCH_W = 78, NOTCH_H = 78, NOTCH_R = 10;
  function updateCoverClip() {
    if (!cgal || !coverClip) return;
    if (window.innerWidth < 1024) { cgal.style.clipPath = "none"; return; }
    var box = cgal.getBoundingClientRect();
    var w = Math.round(box.width), h = Math.round(box.height);
    if (!w || !h) return;
    var R = NOTCH_R;
    coverClip.setAttribute("d",
      "M " + R + " " + NOTCH_H +
      " H " + (NOTCH_W - R) +
      " Q " + NOTCH_W + " " + NOTCH_H + " " + NOTCH_W + " " + (NOTCH_H - R) +
      " V " + R +
      " Q " + NOTCH_W + " 0 " + (NOTCH_W + R) + " 0" +
      " H " + (w - R) +
      " Q " + w + " 0 " + w + " " + R +
      " V " + (h - R) +
      " Q " + w + " " + h + " " + (w - R) + " " + h +
      " H " + R +
      " Q 0 " + h + " 0 " + (h - R) +
      " V " + (NOTCH_H + R) +
      " Q 0 " + NOTCH_H + " " + R + " " + NOTCH_H + " Z");
    cgal.style.clipPath = "url(#coverClip)";
  }
  window.addEventListener("resize", updateCoverClip);

  /* номер кейса в ленте АКТИВНОГО фильтра: 01…13 */
  function caseNumber(i) {
    var idx = visibleCaseIndices();
    var pos = idx.indexOf(i);
    var n = (pos === -1 ? i : pos) + 1;
    return (n < 10 ? "0" : "") + n;
  }

  /* ============================================================
     Галерея: подмена двух слоёв-слотов. Входящий кадр едет на
     полную ширину, уходящий — только на 10% в противоположную
     сторону: это и даёт эффект глубины.
     ============================================================ */
  var GAL = [];
  var galIndex = 0, galFront = "a", galAnimating = false;
  var galTl = null;   /* живой таймлайн подмены: гасится при смене кейса */
  var SWIPE_PX = 40;

  function galWrap(i) { return (i + GAL.length) % GAL.length; }
  function galSlot(k) { return k === "a" ? slotA : slotB; }
  function galImg(k) { return k === "a" ? imgA : imgB; }
  function applyGalImage(img, i) { img.src = GAL[i].src; img.alt = GAL[i].alt; }

  function arrowsHidden(hidden) {
    if (!hasGsap || reduceMotion) return;
    gsap.to(arrowSlots, {
      scale: hidden ? 0 : 1, duration: .3,
      ease: hidden ? "power2.in" : CVE.backMed, overwrite: "auto"
    });
  }

  function galGo(dir) {
    if (galAnimating || GAL.length < 2) return;
    var next = galWrap(galIndex + dir);
    var back = galFront === "a" ? "b" : "a";
    applyGalImage(galImg(back), next);

    var out = galSlot(galFront), inc = galSlot(back);
    var d = cgalStage.getBoundingClientRect().width;

    if (!hasGsap || reduceMotion) {           /* мгновенная подмена */
      if (hasGsap) {
        gsap.set(out, { autoAlpha: 0, zIndex: 0 });
        gsap.set(inc, { x: 0, autoAlpha: 1, zIndex: 1 });
      } else {
        out.style.opacity = "0"; inc.style.opacity = "1";
      }
      galIndex = next; galFront = back;
      return;
    }

    galAnimating = true;
    arrowsHidden(true);
    gsap.set(out, { x: 0, zIndex: 1, autoAlpha: 1 });
    gsap.set(inc, { x: dir === 1 ? d : -d, zIndex: 2, autoAlpha: 1 });
    /* ПРАВКА 05.08 — кривая и длительность подмены кадров (клиент: «картинки
       между собой прерывисто меняются»).
       Было: duration 1, ease power4.inOut. Замер хода входящего слоя
       покадрово показал, ЧТО именно рвалось, и это не подтормаживание —
       кадры ровные, самый долгий 28мс, картинки к моменту клика уже
       скачаны и декодированы (предзагрузчик отрабатывает при открытии):
          280мс от старта — пройдено 3% пути (кадр стоит на месте);
          410…550мс       — пройдено 50% (рывок);
          550…880мс       — оставшиеся 13% (доползание).
       t⁴ на ОБОИХ концах даёт мёртвую зону на входе: человек жмёт стрелку,
       треть секунды не происходит ничего, потом кадр проскакивает.
       Стало: power2.out — движение начинается сразу на полной скорости и
       плавно тормозит к месту, мёртвой зоны нет вовсе. Пиковая скорость
       всего вдвое выше средней (у power4.inOut было в разы), поэтому
       «проскока» тоже нет. Длительность 1 → .85с: на 90% пути кадр
       приходит за 580мс, остальное — мягкая доводка. */
    galTl = gsap.timeline({
      defaults: { duration: .85, ease: "power2.out" },
      onComplete: function () {
        galTl = null;
        galAnimating = false; galIndex = next; galFront = back;
        gsap.set(out, { autoAlpha: 0, zIndex: 0, x: 0 });
        gsap.set(inc, { zIndex: 1 });
        arrowsHidden(false);
      }
    });
    galTl.to(out, { x: dir === 1 ? -(.1 * d) : .1 * d }, 0)
      .to(inc, { x: 0 }, 0);
  }

  cover.querySelector("[data-photo-prev]").addEventListener("click", function () { galGo(-1); });
  cover.querySelector("[data-photo-next]").addEventListener("click", function () { galGo(1); });

  /* свайп: только касанием, порог 40px; ось определяется по первому
     смещению больше 6px — вертикальный жест не перехватываем */
  var galTouch = null;
  cgalStage.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    galTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null };
  }, { passive: true });
  cgalStage.addEventListener("touchmove", function (e) {
    if (!galTouch) return;
    var dx = e.touches[0].clientX - galTouch.x, dy = e.touches[0].clientY - galTouch.y;
    if (!galTouch.axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      galTouch.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
  }, { passive: true });
  cgalStage.addEventListener("touchend", function (e) {
    if (!galTouch) return;
    var dx = e.changedTouches[0].clientX - galTouch.x;
    if (galTouch.axis === "x" && Math.abs(dx) > SWIPE_PX) galGo(dx < 0 ? 1 : -1);
    galTouch = null;
  }, { passive: true });

  /* ============================================================
     Наполнение разворота
     ============================================================ */
  var splitTitle = null, splitSub = null;
  var titleIsMark = false;   /* заголовок сейчас картинка-знак, а не текст */

  /* Карточка «Факты» снята по правке 03.08 — функция factsHTML удалена,
     метрики и externalMentions в data.js остались на будущее. */

  /* Заголовок разворота — тем же начертанием, что и плашка в ленте:
     где есть знак заведения, ставим его картинкой, где знака нет
     (Sixty, Duran Bar, Buro Tsum) — имя набирается антиквой.
     Возвращает true, если заголовок оказался картинкой: тогда во
     вступлении его нельзя резать SplitText на буквы. */
  function fillTitle(c) {
    var m = c.mark;
    coverTitle.setAttribute("aria-label", c.title);
    if (m && m.img) {
      coverTitle.classList.remove("cinfo__title--type");
      coverTitle.classList.add("cinfo__title--mark");
      coverTitle.innerHTML = '<img class="cinfo__mark" src="' + m.img +
        '" alt="" style="--ar:' + m.ar + ";--k:" + m.k + '" decoding="async">';
      return true;
    }
    /* знака нет — имя набирается антиквой смешанным регистром, ровно
       как на плашке в ленте и как в презентации (стр. 20, 22, 23) */
    coverTitle.classList.remove("cinfo__title--mark");
    coverTitle.classList.add("cinfo__title--type");
    coverTitle.textContent = c.title;
    return false;
  }

  /* Иконка-буллет 12×12. ПРАВКА 06.08: был фирменный ромб (тот же знак,
     что разделяет проекты в трастстрипе), заказчик попросил кружки.
     Диаметр 9, а не 12 по габариту поля: ромб с диагоналями 12 занимает
     72 единицы площади, круг того же охвата вышел бы заметно тяжелее —
     у ромба углы оптически не считаются, у круга считается вся масса.
     В трастстрипе ромб остался, там его никто не трогал. */
  var BULLET = '<span class="cworks__bullet" aria-hidden="true">' +
    '<svg viewBox="0 0 12 12" focusable="false"><circle cx="6" cy="6" r="4.5"/></svg></span>';

  function fillCover(i) {
    var c = CASES[i];

    /* СНАЧАЛА снимаем разбивку SplitText: revert() возвращает элементу
       ту разметку, что была на момент split, и если сделать это после
       записи нового заголовка — на экране останется предыдущий кейс */
    revertSplits();

    titleIsMark = fillTitle(c);
    coverSub.textContent = c.shortDescription;
    coverSub.setAttribute("aria-label", c.shortDescription);
    coverDesc.textContent = c.fullDescription;
    coverName.textContent = c.title;

    /* «Что сделали»: пока заказчик не прислал финальные формулировки,
       поле works может отсутствовать — тогда карточка просто не
       рендерится, заглушками её не заполняем (ТЗ §5.2) */
    if (c.works && c.works.length) {
      coverWorksBox.hidden = false;
      coverWorks.innerHTML = c.works.map(function (w) {
        return "<li>" + BULLET + '<span class="cworks__text">' + w + "</span></li>";
      }).join("");
    } else {
      coverWorksBox.hidden = true;
      coverWorks.innerHTML = "";
    }

    /* счётчик кейсов «08 / 13» */
    coverCount.textContent = caseNumber(i) + " / " + visibleCaseIndices().length;

    /* Правка 05.08: подстановка вырезки плавающего предмета удалена вместе
       с самим предметом (просьба заказчика — «модельки летающие не нужны
       нигде»). Отсюда же ушло поле float у всех тринадцати кейсов в
       data.js; файлы assets/img/float-*.webp на диске оставлены. */

    /* галерея: кадры кейса + скрытый предзагрузчик */
    GAL = c.gallery.map(function (g) {
      return { src: "assets/img/" + g + ".webp", alt: c.title + " — фото проекта" };
    });
    galIndex = 0; galFront = "a"; galAnimating = false;
    if (hasGsap) {
      /* ПРАВКА 06.08 (вторая): смена кейса могла прийтись на середину
         подмены кадров — недобитый таймлайн galGo доигрывал за кроссфейдом,
         и его onComplete перетирал только что расставленные слоты (наверх
         всплывал слот B с кадром прошлого кейса, стрелки застревали в
         scale 0 до конца его arrowsHidden). Гасим таймлайн и твины стрелок
         ДО расстановки, потом ставим чистые состояния. */
      if (galTl) { galTl.kill(); galTl = null; }
      gsap.killTweensOf(arrowSlots);
    }
    applyGalImage(imgA, 0);
    applyGalImage(imgB, galWrap(1));
    if (hasGsap) {
      gsap.set(slotA, { x: 0, zIndex: 1, autoAlpha: 1 });
      gsap.set(slotB, { x: 0, zIndex: 0, autoAlpha: 0 });
      gsap.set(arrowSlots, { scale: 1 });
    }
    /* ПРАВКА 06.08: догрузка остальных кадров отложена до конца вступления.
       Кадры из архива заказчика (правка 05.08) весят 200–350КБ против
       прежних 40–130, и четыре таких загрузки с декодированием, запущенные
       ровно в момент перелёта, отбирали у него кадры. Первые два кадра тут
       ни при чём — они уже стоят в слотах A и B и грузятся в любом случае;
       откладывается третий и дальше, до которых человек доберётся никак не
       раньше, чем долистает до них.
       ПРАВКА 06.08 (вторая): штатно предзагрузчик будит onComplete
       вступления (раньше жёсткий таймер 1200мс стрелял ровно под влёт
       нижних блоков). Таймер остался страховкой для веток, где вступление
       не играется или гасится на середине: reduced-motion, закрытие и
       переоткрытие до конца интро. */
    if (preloadTimer) clearTimeout(preloadTimer);
    cgalPreload.innerHTML = "";
    preloadTimer = setTimeout(preloadGallery, 2600);

    /* один кадр — листать нечего */
    var single = GAL.length < 2;
    Array.prototype.forEach.call(cover.querySelectorAll(".carrow"), function (b) {
      if (single) b.setAttribute("data-disabled", ""); else b.removeAttribute("data-disabled");
      b.disabled = single;
    });
  }

  /* Догрузка кадров 3+ текущего кейса (см. комментарий в fillCover).
     Зовут двое — onComplete вступления и страховочный таймер; guard по
     firstChild не даёт второму вызову перезалить уже стоящие картинки. */
  function preloadGallery() {
    if (preloadTimer) { clearTimeout(preloadTimer); preloadTimer = null; }
    if (cgalPreload.firstChild) return;
    cgalPreload.innerHTML = GAL.map(function (g) {
      return '<img src="' + g.src + '" alt="" decoding="async">';
    }).join("");
  }

  /* ============================================================
     Вступительный таймлайн разворота (таблица §6.2 ТЗ)
     ============================================================ */
  function revertSplits() {
    if (splitTitle) { splitTitle.revert(); splitTitle = null; }
    if (splitSub) { splitSub.revert(); splitSub = null; }
  }

  /* ПРАВКА 06.08: разбивка текста вынута из playCoverIntro в отдельный шаг.
     SplitText перестраивает разметку заголовка и подзаголовка и заставляет
     браузер пересчитать раскладку — работа не бесплатная, а делалась она
     первой строкой вступления, то есть ровно в том кадре, где стартовал
     перелёт клона. Теперь openCase зовёт prepareCoverIntro сразу после
     .is-open, а сам перелёт начинается уже со следующего кадра.
     Вызов оставлен и внутри playCoverIntro — на случай, когда вступление
     играется само по себе (переключение кейса стрелками внутри разворота).

     ПРАВКА 06.08 (вторая): здесь же — СТАРТОВЫЕ состояния вступления.
     Раньше текст прятали set-ы внутри самого таймлайна, а у того delay
     100мс, и скрывающий set подзаголовка вообще стоял ПОСЛЕ твина галереи
     (">", 0.8с). Итог на замере (perf_cases.py): подзаголовок виден с
     первого кадра, на 0.87с исчезает и выезжает заново — «текст под
     логотипом появляется дважды»; у текстовых заголовков (Poison Drop,
     YUMMS) те же 100мс мигала целая строка до нарезки на буквы.
     Теперь всё прячется синхронно, в том же кадре, где разворот стал
     display:block, — до первого пейнта, глазу нечему мигать. */
  var introPrepared = false;
  var introTl = null;   /* живое вступление: гасится при закрытии/смене кейса */

  function prepareCoverIntro() {
    revertSplits();
    introPrepared = true;
    if (!hasGsap || reduceMotion) return;
    if (window.SplitText) {
      if (!titleIsMark) {
        splitTitle = new SplitText(coverTitle, { type: "lines,words,chars" });
        Array.prototype.forEach.call(coverTitle.children, function (n) { n.setAttribute("aria-hidden", "true"); });
      }
      splitSub = new SplitText(coverSub, { type: "lines" });
      Array.prototype.forEach.call(coverSub.children, function (n) { n.setAttribute("aria-hidden", "true"); });
    }
    /* стартовые состояния — до первого кадра (см. комментарий выше) */
    gsap.set(coverPattern, { opacity: 0 });
    if (titleIsMark) {
      gsap.set(coverTitle, { opacity: 0, y: 60, scaleX: .8, scaleY: .5 });
    } else if (splitTitle && splitTitle.chars.length) {
      gsap.set(splitTitle.chars, { opacity: 0, y: 60, scaleX: .8, scaleY: .5 });
      /* прошлый кейс мог быть знаком: его твин оставил на заголовке свои
         инлайновые y/scale — возвращаем узлу нейтраль, буквы едут сами */
      gsap.set(coverTitle, { opacity: 1, y: 0, scaleX: 1, scaleY: 1 });
    }
    if (splitSub && splitSub.lines.length) {
      gsap.set(splitSub.lines, { opacity: 0, yPercent: 50 });
      gsap.set(coverSub, { opacity: 1 });
    }
    gsap.set(cgal, { opacity: 0, y: 40 });
    gsap.set(cover.querySelectorAll("[data-cover-box]"), { opacity: 0, y: 100, rotation: "random(-30, 30)" });
  }

  function playCoverIntro() {
    var boxes = cover.querySelectorAll("[data-cover-box]");
    if (!introPrepared) prepareCoverIntro();
    introPrepared = false;

    if (!hasGsap) return;
    if (introTl) { introTl.kill(); introTl = null; }
    if (reduceMotion) {
      gsap.set([coverPattern, coverTitle, coverSub, cgal], { opacity: 1, y: 0 });
      gsap.set(boxes, { opacity: 1, y: 0, rotation: 0 });
      return;
    }

    /* ПРАВКА 06.08 (вторая) — хореография уплотнена (клиент: «текст внизу
       появляется не сразу»). Раньше подзаголовок ждал конца твина галереи
       (метка ">", 0.8с), блоки шли за ним на "<25%" — низ разворота
       пустовал больше секунды (замер: строка-перелистывание видима только
       к 1.13с, список — позже). Теперь всё внахлёст, абсолютными метками:
       заголовок и галерея с нуля, подзаголовок догоняет на .3, блоки на
       .5 — рисунок тот же (сверху вниз), но без мёртвых пауз. Сами
       длительности, кривые и порядок — из системы движения, не тронуты.
       Стартовые состояния уже стоят (prepareCoverIntro), поэтому в ленте
       одни .to — set-ов, способных мигнуть текстом, внутри больше нет.
       onComplete будит предзагрузчик кадров: раньше тот стрелял по таймеру
       на 1.2с — ровно под влёт блоков. */
    var tl = introTl = gsap.timeline({
      delay: COVER_DELAY / 1000,
      onComplete: function () { introTl = null; preloadGallery(); }
    });

    tl.to(coverPattern, { opacity: .1, duration: CVD.base, ease: CVE.base }, 0);

    /* Заголовок. Текстовый порезан SplitText и выводится по буквам; знак
       заведения — картинка, резать нечего, поэтому он входит целиком
       тем же движением, что и буквы (правка 03.08). */
    if (titleIsMark) {
      tl.to(coverTitle, { opacity: 1, y: 0, scaleX: 1, scaleY: 1,
        duration: CVD.title, ease: CVE.backBase }, 0);
    } else if (splitTitle && splitTitle.chars.length) {
      tl.to(splitTitle.chars, {
        opacity: 1, scaleX: 1, scaleY: 1, y: 0,
        duration: CVD.title, stagger: CVS.title, ease: CVE.backBase
      }, 0);
    }

    /* галерея */
    tl.to(cgal, { opacity: 1, y: 0, duration: CVD.slow, ease: CVE.backLow }, 0);

    /* подзаголовок — строками снизу */
    if (splitSub && splitSub.lines.length) {
      tl.to(splitSub.lines, {
        opacity: 1, yPercent: 0,
        duration: CVD.paragraph, stagger: CVS.paragraph, ease: CVE.copy
      }, .3);
    }

    /* четыре карточки влетают снизу со случайным поворотом −30…30° */
    tl.to(boxes, {
      opacity: 1, y: 0, rotation: 0,
      duration: CVD.bigCopy, stagger: CVS.bigCopy, ease: "bigCopy"
    }, .5);

    /* Правка 05.08: вход плавающего предмета удалён вместе с ним самим. */
  }

  /* ПЛАВАЮЩИЙ ПРЕДМЕТ УДАЛЁН ЦЕЛИКОМ (05.08, просьба заказчика: «модельки
     летающие не нужны нигде»). Здесь жили две механики: бесконечное
     «дыхание» (качание по yPercent ±25·amp с поворотом ±5°, своя случайная
     амплитуда и длительность на каждый экземпляр) и ход к курсору —
     обработчик mousemove на window, который тянул вырезку к указателю с
     силой, спадающей квадратично до нуля на 1000px.
     Удалены обе, вместе с обработчиком: без него на mousemove больше не
     висит расчёт по всем предметам на каждое движение мыши.
     Разметка снята в index.html, поле float — в data.js, стили .cfood /
     .cbox__food / .cinfo__foodmob — в style.css. Файлы вырезок
     assets/img/float-*.webp на диске оставлены. */

  /* ============================================================
     Ховер главной кнопки: подложка с перелётом + подмена слоёв
     подписи и иконки. Дублируется на focusin/focusout, иначе
     кнопка «мертва» при управлении с клавиатуры.
     ============================================================ */
  if (hasGsap) {
    Array.prototype.forEach.call(cover.querySelectorAll("[data-btn]"), function (root) {
      var bg = root.querySelector("[data-button-bg]");
      var first = root.querySelectorAll("[data-text-first]");
      var second = root.querySelectorAll("[data-text-second]");
      var icoFirst = root.querySelectorAll("[data-right-icon-first]");
      var icoSecond = root.querySelectorAll("[data-right-icon-second]");
      var EASE_TEXT_IN = "back.out(3)", EASE_ICON_IN = "back.out(2)";
      var from = null, tlIn = null, tlOut = null;

      if (second.length) gsap.set(second, { y: 16, opacity: 0 });
      if (icoFirst.length) gsap.set(icoFirst, { transformOrigin: "center right" });
      if (icoSecond.length) gsap.set(icoSecond, { scale: 0, x: -16, opacity: 0, transformOrigin: "center left" });

      /* исходные цвета снимаем при первом наведении: до открытия
         разворот в display:none и мерить нечего */
      function readColors() {
        if (from) return from;
        var cs = getComputedStyle(cover);
        from = {
          bg: bg ? getComputedStyle(bg).backgroundColor : "",
          color: getComputedStyle(root).color,
          bgTo: cs.getPropertyValue("--cv-bg").trim(),
          colorTo: cs.getPropertyValue("--cv-fg").trim()
        };
        return from;
      }

      function enter() {
        if (reduceMotion) return;
        var f = readColors();
        if (tlOut) tlOut.kill();
        tlIn = gsap.timeline({ defaults: { overwrite: "auto" } });
        if (bg) {
          tlIn.to(bg, { scale: 1.025, duration: .35, ease: CVE.backBase }, 0)
            .to(bg, { scale: 1, duration: .35, ease: CVE.backMed }, .315)
            .to(bg, { backgroundColor: f.bgTo, duration: .3, ease: "power2.out" }, 0)
            .to(root, { color: f.colorTo, duration: .3, ease: "power2.out" }, 0);
        }
        if (first.length) tlIn.to(first, { opacity: 0, y: -16, duration: .35, ease: CVE.hover }, 0);
        if (second.length) tlIn.to(second, { opacity: 1, y: 0, duration: .35, ease: EASE_TEXT_IN }, .14);
        if (icoFirst.length) tlIn.to(icoFirst, { x: 16, opacity: 0, scale: 0, duration: .35, ease: CVE.hover }, 0);
        if (icoSecond.length) tlIn.to(icoSecond, { scale: 1, x: 0, y: 0, opacity: 1, duration: .35, ease: EASE_ICON_IN }, .14);
      }
      function leave() {
        if (reduceMotion || !from) return;
        if (tlIn) tlIn.kill();
        tlOut = gsap.timeline({ defaults: { overwrite: "auto" } });
        if (bg) {
          tlOut.to(bg, { scale: 1, duration: .35, ease: CVE.backBase }, 0)
            .to(bg, { backgroundColor: from.bg, duration: .3, ease: "power2.out" }, 0)
            .to(root, { color: from.color, duration: .3, ease: "power2.out" }, 0);
        }
        if (first.length) tlOut.to(first, { opacity: 1, y: 0, duration: .35, ease: EASE_TEXT_IN }, .14);
        if (second.length) tlOut.to(second, { opacity: 0, y: 16, duration: .35, ease: CVE.hover }, 0);
        if (icoFirst.length) tlOut.to(icoFirst, { scale: 1, x: 0, y: 0, opacity: 1, duration: .35, ease: EASE_ICON_IN }, .14);
        if (icoSecond.length) tlOut.to(icoSecond, { scale: 0, x: -16, opacity: 0, duration: .35, ease: CVE.hover }, 0);
      }
      root.addEventListener("pointerenter", enter);
      root.addEventListener("pointerleave", leave);
      root.addEventListener("focusin", enter);
      root.addEventListener("focusout", leave);
    });
  }

  /* ============================================================
     Открытие / закрытие разворота
     ============================================================
     ПРАВКА 06.08 — ПЕРЕЛЁТ ФОТО УБРАН ЦЕЛИКОМ (просьба заказчика:
     «пусть картинки просто будут на своём месте и всё»).

     Здесь жил FLIP-зум: при открытии клон фото карточки отрывался от
     ленты и летел в галерею разворота, при закрытии — обратно. Механика
     держалась на том, что обложка карточки и первый кадр разворота —
     ОДНА картинка: обе брались из gallery[0], поэтому подмену клона на
     живую картинку никто не замечал. После правки 05.08 обложка задана
     отдельным полем cardImage, кадры у шести кейсов разные, и перелёт
     стал показывать не тот кадр: обложка с интерьером долетала до
     галереи и на глазах менялась на первый кадр разворота.

     Разделение теперь честное и без переходов: кадр с интерьером живёт
     только на карточке в ленте, кадры галереи — только внутри разворота.
     Открытие и закрытие — простое проявление и угасание всего разворота,
     вступление (заголовок, галерея, карточки) играется как играло.

     Вернуть зум — придётся снова свести обложку и первый кадр к одной
     картинке, иначе подмена вылезет тем же способом. Вместе с механикой
     сняты: клоны .cover__ghost со стилем в style.css, поиск видимой
     карточки в ленте findLiveCardImg и плагин Flip (тег скрипта в
     index.html; сам файл assets/vendor/Flip.min.js оставлен). */

  function openCase(i, sourceEl) {
    /* ПРАВКА 06.08 (вторая): клик по карточке, пока разворот ещё ДОЗАКРЫВАЕТСЯ
       (fade 0.28с), раньше попадал в ветку «открыт» — кроссфейд играл под
       уходящим слоем, finish() закрытия добегал и прятал разворот: клик
       просто съедался. Пока идёт закрытие, разворот считается закрытым и
       открывается заново; его fromTo с overwrite глушит встречный твин
       закрытия вместе с finish(). */
    var wasOpen = cover.classList.contains("is-open") && !coverClosing;
    /* повторный клик по тому же кейсу (даблклик, единственный кейс в
       фильтре) — кроссфейд в самого себя только моргал бы сеткой */
    if (wasOpen && i === currentCase) return;
    coverClosing = false;
    currentCase = i;
    if (wasOpen) {
      /* переключение кейса внутри разворота: перекрёстный fade ~0.3s,
         затем разворот проигрывает вступление заново */
      if (hasGsap && !reduceMotion) {
        /* вступление прошлого кейса могло ещё идти — двум таймлайнам на
           одних узлах (блоки, галерея) нельзя жить одновременно */
        if (introTl) { introTl.kill(); introTl = null; }
        gsap.to(coverGrid, {
          opacity: 0, duration: .28, ease: "power1.out", overwrite: true,
          onComplete: function () {
            fillCover(i);
            gsap.set(coverGrid, { opacity: 1 });
            updateCoverClip();
            playCoverIntro();
          }
        });
      } else {
        fillCover(i);
      }
      return;
    }
    lastFocus = sourceEl || document.activeElement;
    fillCover(i);
    cover.classList.add("is-open");
    document.body.style.overflow = "hidden";
    lenisStop();
    setRailSpeed(0); // лента на паузе при открытом развороте
    coverInner.scrollTop = 0;
    updateCoverClip();

    /* ПРАВКА 06.08: разбивку заголовка и подзаголовка на буквы и строки
       делаем ЗДЕСЬ, до первого кадра вступления. Раньше она шла первой
       строкой playCoverIntro — то есть SplitText перестраивал разметку
       двух блоков и пересчитывал раскладку в том же кадре, где движение
       уже началось; на замере это стабильно давало один кадр в 33мс на
       старте, и вступление начиналось с заминки. Резать раньше нельзя:
       до .is-open разворот display:none, и строки посчитались бы не по
       той ширине. */
    prepareCoverIntro();

    /* разворот просто проявляется — фото никуда не летит. overwrite: на
       мгновенном закрыть-открыть здесь мог остаться встречный твин
       закрытия, и два твина спорили бы за opacity всего слоя */
    if (hasGsap && !reduceMotion) {
      gsap.fromTo(cover, { opacity: 0 }, {
        opacity: 1, duration: .3, ease: "power2.out", overwrite: true,
        onComplete: function () { gsap.set(cover, { clearProps: "opacity" }); }
      });
    }
    playCoverIntro();
    cover.querySelector("[data-cover-close]").focus();
  }

  function closeCover() {
    /* ПРАВКА 06.08 (вторая): гасим всё, что могло ещё идти. Вступление —
       иначе его твины доигрывали за кадром и дрались с вступлением
       следующего открытия (замер ловил влёт блоков от ЧУЖОГО таймлайна).
       Кроссфейд смены кейса — иначе его onComplete после закрытия
       перезаполнял разворот, а сетка оставалась полупрозрачной. */
    if (hasGsap) {
      if (introTl) { introTl.kill(); introTl = null; }
      gsap.killTweensOf(coverGrid);
      gsap.set(coverGrid, { clearProps: "opacity" });
    }
    var finish = function () {
      coverClosing = false;
      cover.classList.remove("is-open");
      document.body.style.overflow = "";
      lenisStart();
      setRailSpeed(1);
      revertSplits();
      /* preventScroll обязателен: .crail — overflow:hidden, но скроллить
         его программно браузеру никто не мешает, и обычный focus() на
         уехавшую карточку сдвигал ленте scrollLeft — карточки вставали
         со смещением, которое ничем уже не сбрасывалось. */
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    if (hasGsap && !reduceMotion) {
      coverClosing = true;
      gsap.to(cover, { opacity: 0, duration: .28, ease: "power2.in", overwrite: true,
        onComplete: function () {
          gsap.set(cover, { clearProps: "opacity" }); finish();
        } });
    } else {
      finish();
    }
  }

  cover.querySelector("[data-cover-close]").addEventListener("click", closeCover);
  Array.prototype.forEach.call(cover.querySelectorAll("[data-case-prev]"), function (b) {
    b.addEventListener("click", function () { openCase(siblingCase(currentCase, -1)); });
  });
  Array.prototype.forEach.call(cover.querySelectorAll("[data-case-next]"), function (b) {
    b.addEventListener("click", function () { openCase(siblingCase(currentCase, 1)); });
  });

  /* «Обсудить проект» — закрываем разворот и плавно уходим к форме */
  cover.querySelector("[data-cover-cta]").addEventListener("click", function () {
    var target = document.querySelector("#contact");
    closeCover();
    if (!target) return;
    /* ждём обратный зум (0.4s), иначе Lenis стартует под закрывающимся слоем */
    setTimeout(function () {
      if (lenis) lenis.scrollTo(target, { offset: -headerH() });
      else target.scrollIntoView({ behavior: "smooth" });
    }, 420);
  });

  document.addEventListener("keydown", function (e) {
    if (!cover.classList.contains("is-open")) return;
    if (e.key === "Escape") closeCover();
    /* стрелки клавиатуры листают ФОТО (кейсы — кнопками в ячейке «Действие») */
    if (e.key === "ArrowLeft") galGo(-1);
    if (e.key === "ArrowRight") galGo(1);
    if (e.key === "Tab") { // focus trap
      var f = cover.querySelectorAll("button:not([disabled]), a, [tabindex]");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });


  /* ---------- 6.7 Карточки-сценарии ----------
     Скрипта здесь больше нет: по правке 29.07 наведение убрано целиком,
     все три карточки всегда в насыщенном состоянии, описание видно
     постоянно. Блок статичен и живёт на одном CSS. */

  /* ---------- 6.14 FAQ: один открытый вопрос за раз ---------- */
  var faq = document.querySelector("[data-faq]");
  if (faq) {
    faq.querySelectorAll("details").forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (d.open) faq.querySelectorAll("details[open]").forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  }

  /* ---------- 6.15 Форма заявки ---------- */
  var form = document.querySelector("[data-lead-form]");
  if (form) {
    var phoneInput = form.elements.phone;
    phoneInput.addEventListener("input", function () {
      var d = phoneInput.value.replace(/\D/g, "");
      if (!d) { phoneInput.value = ""; return; }
      if (d[0] === "8") d = "7" + d.slice(1);
      if (d[0] !== "7") d = "7" + d;
      d = d.slice(0, 11);
      var out = "+7";
      if (d.length > 1) out += " (" + d.slice(1, 4);
      if (d.length > 4) out += ") " + d.slice(4, 7);
      if (d.length > 7) out += "-" + d.slice(7, 9);
      if (d.length > 9) out += "-" + d.slice(9, 11);
      phoneInput.value = out;
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      var nameField = form.elements.name.closest(".field");
      var nameBad = !form.elements.name.value.trim();
      nameField.classList.toggle("is-invalid", nameBad);
      if (nameBad) ok = false;
      var phoneField = phoneInput.closest(".field");
      var phoneBad = phoneInput.value.replace(/\D/g, "").length !== 11;
      phoneField.classList.toggle("is-invalid", phoneBad);
      if (phoneBad) ok = false;
      /* чекбокс согласия 152-ФЗ обязателен (ТЗ v1 §6.15, возврат по ТЗ5 §7) */
      var consent = form.elements.consent;
      var consentErr = document.querySelector("[data-consent-err]");
      if (consentErr) consentErr.style.display = consent.checked ? "none" : "block";
      if (!consent.checked) ok = false;
      if (!ok) return;

      /* ТЗ10 §4: форма упрощена — только имя и телефон */
      var lead = {
        name: form.elements.name.value.trim(),
        phone: phoneInput.value.trim(),
        page: location.href,
        ts: new Date().toISOString()
      };
      try {
        var leads = JSON.parse(localStorage.getItem("bp_leads") || "[]");
        leads.push(lead);
        localStorage.setItem("bp_leads", JSON.stringify(leads));
      } catch (err) { /* приватный режим */ }

      var cfg = window.BARPOINT_CONFIG || {};
      var successBox = document.querySelector("[data-form-success]");
      /* Правка 31.07 (пятая): экран благодарности — одна строка, пояснение
         и кнопка-дублёр в Telegram убраны из разметки. Ветка ниже осталась
         рабочей и включится сама, если элементы вернуть: она молча
         пропускается, когда их нет. */
      var successText = document.querySelector("[data-success-text]");
      var tgBtn = document.querySelector("[data-success-tg]");

      function showSuccess(viaEndpoint) {
        form.classList.add("is-hidden");
        successBox.classList.add("is-visible");
        if (!viaEndpoint && cfg.telegram && successText && tgBtn) {
          successText.textContent = "Чтобы мы точно её получили, продублируйте заявку нам в Telegram — текст уже подготовлен.";
          var text = encodeURIComponent(
            "Заявка с сайта BARPOINT\nИмя: " + lead.name + "\nТелефон: " + lead.phone);
          tgBtn.href = "https://t.me/" + cfg.telegram + "?text=" + text;
          tgBtn.style.display = "inline-flex";
        }
      }

      if (cfg.endpoint) {
        fetch(cfg.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lead)
        }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          showSuccess(true);
        }).catch(function () { showSuccess(false); });
      } else {
        showSuccess(false);
      }
    });
  }

  /* ============================================================
     Скролл-анимации (ТЗ v1 раздел 8 + ТЗ2 §3–5)
     ============================================================ */
  if (!reduceMotion && hasGsap) {

    /* Базовые reveal-ы [data-reveal] удалены (ТЗ «появление текста»
       §8): их работу забрала система атрибутов data-gsap-* —
       assets/js/reveal.js. */

    /* --- Hero: параллакс фона --- */
    /* Правка 30.07: строка-eyebrow удалена вместе с её интро-твином.
       Весь текст героя (заголовок + капс-строка) выходит построчно
       через SplitText ниже — отдельное интро больше не нужно. */
    gsap.to("[data-hero-media] img", {
      yPercent: 12, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });

    /* 6.4 Философия и её зум-твин УДАЛЕНЫ по ТЗ14 §3 */

    /* enterRise удалён (ТЗ5 §6): scrub-трансформы на контенте запиненных
       секций сдвигали замеры пина и давали пустые чёрные кадры.
       ПРАВИЛО: никогда не анимировать по скроллу элементы запиненной
       секции вне её собственного pin-таймлайна. Плавные стыки теперь
       делает body-механика смены фона (ТЗ5 §5, ниже). */

    /* ============================================================
       ТЗ5 §5 — плавная смена цвета интерфейса (механика PINEA):
       цветовые секции прозрачны (класс bgflow на <html>), цвет живёт
       на <body> с CSS-transition и переключается по скроллу.
       ============================================================ */
    document.documentElement.classList.add("bgflow");
    /* Секции с data-bg-pin ведут фон САМИ и в обеих ветках отданы
       gsap.matchMedia (десктоп — две фазы у сцены, мобайл — штатный
       триггер ниже). Пропускаем их здесь ВСЕГДА: снимок ширины на
       старте здесь был бы багом — после ресайза десктоп→мобайл секция
       осталась бы вообще без триггера фона (тёмный фон под тёмным
       текстом). */
    /* САМ ЦИКЛ [data-bg] ПЕРЕЕХАЛ В КОНЕЦ — он обязан создаваться после
       всех пинов (иначе координаты считаются без пин-спейсеров). */

    /* Построчный выход .js-lines (ТЗ2 §3) удалён по ТЗ «появление
       текста» §8. Заголовки первого экрана и финала теперь ведёт
       assets/js/reveal.js: первый — посимвольно (data-gsap-title),
       второй — по словам (data-gsap-big-copy-on-scroll). Там же и
       ожидание document.fonts.ready, ради которого этот блок жил. */

    /* Осевой параллакс старых услуг (.svc-spread) удалён вместе с их
       вёрсткой. Правка 03.08 (третья): следом удалены и сменившие его
       блоки-слайдеры #coffee / #services — услуги пересобраны в карточки
       .wcard. Их собственная механика — стопка, см. ниже. */

    /* Брейкпоинты — через gsap.matchMedia (ТЗ2 §7) */
    var mm = gsap.matchMedia();

    /* ============================================================
       УСЛУГИ — СТОПКА КАРТОЧЕК (правка 03.08, четвёртая)
       Референс: buckssauce.com/wholesale, чанк 600d175e16e55ce6.js,
       модуль 83386. Перенесены и механика, и обе константы (64 и 115.2);
       единственная правка — ограничитель, см. ниже.

       Контейнер [data-wcards] высотой в экран пинится, ряды из него
       вываливаются наружу (overflow: visible) и по скрабу наезжают друг
       на друга. Шаг i делает две вещи одновременно:
         — ряды с i-го и дальше уезжают вверх так, чтобы ряд i встал
           ровно на WC_TOP·i от верха стопки;
         — все ряды до i-го уползают ещё на WC_SHIFT вверх.
       Ряд непрозрачен и стоит в position:relative, поэтому очередной
       закрывает предыдущие, оставляя сверху полоску в WC_TOP.

       Значения y — функции: их пересчитывает invalidateOnRefresh после
       ресайза и подгрузки шрифтов. offsetTop берётся у неподвижной
       раскладки и трансформами не портится.

       ЕДИНСТВЕННОЕ ОТСТУПЛЕНИЕ ОТ РЕФЕРЕНСА — и оно вынужденное.
       У референса карточек три, и полоска нарастает без оглядки: 64·i.
       У нас их семь, и на седьмом шаге верх ряда ушёл бы на 64·6 = 384px
       вниз — вместе с высотой ряда это 950px, то есть ниже кромки экрана,
       и хвост списка обрезало бы. Поэтому нарастание ограничено сверху
       через stepCap(): после его порога очередной ряд встаёт на то же
       место, что и предыдущий. Порог считается из живых замеров (сколько полосок
       помещается над самым высоким рядом), при трёх карточках формула
       даёт ровно поведение референса. Сползание предыдущих рядов на
       WC_SHIFT не ограничено ничем — стопка над рядом остаётся живой.

       ГРАБЛИ §10.1 (правило записано ниже, у пина команды): анимировать
       по скроллу содержимое запиненной секции можно ТОЛЬКО её
       собственным пин-таймлайном. Здесь так и есть — этот таймлайн
       единственный, кто трогает .wcard. Появление внутри карточки
       (playCard в reveal.js) идёт по IntersectionObserver, без скролла,
       и работает с другими свойствами других узлов — не конфликтует.
       ============================================================ */
    var WC_TOP = 64;      /* px — полоска, на которую встаёт очередной ряд */
    var WC_SHIFT = 115.2; /* px — насколько уползают все предыдущие за шаг */
    /* Длина хвоста в долях шага — см. подробности у самого хвоста, ниже.
       .35 выбрано по скорости, а не на глаз: на шаге предыдущие ряды
       ползут 115.2px за целый рост ряда прокрутки (это 0.17 от скорости
       пальца), после открепления страница едет 1:1. Хвост на .35 даёт
       0.48 — ровно посередине, поэтому и вход в хвост, и выход из него в
       обычную прокрутку идут без скачка скорости. Больше — стопка на
       хвосте начнёт «залипать», меньше — дёрнет. */
    var WC_TAIL = 0.35;
    /* ПАУЗ МЕЖДУ ШАГАМИ ЗДЕСЬ НЕТ И БЫТЬ НЕ ДОЛЖНО (правка 04.08, вторая).
       В первом заходе они стояли: по .22 доли шага перед каждым движением,
       чтобы карточка «постояла открытой». Клиент их забраковал сразу —
       при паузах прокрутка идёт рывками: блок едет, замирает, снова едет.
       Причина в том, что scrub привязывает ленту к колесу жёстко: пауза в
       ленте — это отрезок прокрутки, на котором на экране НЕ МЕНЯЕТСЯ
       НИЧЕГО, и рука такое читает не как акцент, а как подвисание.
       У референса лента сплошная и линейная, и именно поэтому она гладкая.
       Читаемость карточки держится не паузой, а ростом ряда (100vh − 220
       в style.css): встав на место, карточка занимает экран целиком.
       Если снова захочется акцента — это НЕ пауза, а ease на самих шагах
       (например "power1.in" у входящего ряда): скорость меняется плавно,
       и остановки не возникает. */
    mm.add("(min-width: 1024px)", function () {
      var stack = document.querySelector("[data-wcards]");
      if (!stack) return;
      var rows = gsap.utils.toArray(".wcard", stack);
      if (rows.length < 2) return;

      /* сколько полосок влезает над самым высоким рядом, см. комментарий */
      var stepCap = function () {
        var tallest = 0, i;
        for (i = 0; i < rows.length; i++) tallest = Math.max(tallest, rows[i].offsetHeight);
        var fits = Math.floor((window.innerHeight - WC_TOP - tallest) / WC_TOP);
        return Math.max(1, Math.min(rows.length - 1, fits));
      };

      /* ---------- высота коробки стопки (правка 03.08, ритм стыков) ----------
         В CSS коробка ростом в экран — так у референса (h-screen). У него
         ряд почти во весь экран и хвоста под ним нет; у нас ряд ~500px, и
         под последней карточкой оставалось 143px пустой коробки. Вместе с
         паддингами это давало на стыке «Услуги → Кейсы» 303px пустоты
         против 160 на всех прочих стыках (замер 1440×900).
         Считаем конечное состояние: верх ряда i внутри стопки в конце
         таймлайна = WC_TOP·min(i,cap) − WC_SHIFT·(n−1−i) — своя полоска
         минус сползание на каждом последующем шаге. Берём самый нижний
         край и по нему ставим высоту.
         min-height из CSS (880px) обязателен к сбросу: он сильнее height
         и вернул бы коробке прежний рост.
         Ряды при этом НЕ сожмутся: у флекс-элемента min-height: auto,
         то есть не ниже своего содержимого, — они как переполняли коробку,
         так и переполняют (на том и держится вся стопка).

         ГРАБЛИ (стоили одного захода). Высоту НЕЛЬЗЯ ставить инлайном на
         сам stack и НЕЛЬЗЯ считать на onRefreshInit:
           — пин запоминает cssText элемента в момент создания и на каждом
             refresh откатывает его к этому снимку, затирая инлайновую
             высоту. Поэтому пишем в CSS-переменную на <html> — её пин не
             трогает (в style.css: height: var(--wc-stack-h, auto));
           — onRefreshInit срабатывает ДО отката пина, то есть на ещё
             зафиксированной раскладке: после ресайза 1440→1920 ряды там
             меряются по старой ширине. Считаем на событии "revert" — пины
             уже откачены, замеры ScrollTrigger ещё впереди.
         Симптом, если сделать неправильно: на 1920×1080 коробка остаётся
         с числом от 1440×900, последняя карточка вылезает за неё, и стык
         «Услуги → Кейсы» схлопывается со 160 до 32px. */
      var fitStack = function () {
        var cap = stepCap(), n = rows.length, deepest = 0, i, top;
        for (i = 1; i < n; i++) {
          top = WC_TOP * Math.min(i, cap) - WC_SHIFT * (n - 1 - i);
          deepest = Math.max(deepest, top + rows[i].offsetHeight);
        }
        /* хвост уводит всю стопку ещё на WC_SHIFT вверх (см. ниже), значит
           и конечный низ последней карточки на столько же выше. Не вычесть
           — под ней осталась бы дыра ровно в эти 115px */
        deepest -= WC_SHIFT;
        /* выше экрана нельзя: коробку пинит ScrollTrigger, и у слишком
           высокой низ последней карточки ушёл бы под кромку */
        document.documentElement.style.setProperty(
          "--wc-stack-h", Math.min(deepest, window.innerHeight - WC_TOP) + "px");
      };
      fitStack();
      ScrollTrigger.addEventListener("revert", fitStack);

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: stack,
          start: "top-=" + WC_TOP + "px top",
          end: function () { return "+=" + (rows.length - 1 + WC_TAIL) * rows[0].offsetHeight; },
          pin: true, scrub: true, invalidateOnRefresh: true
        }
      });

      for (var i = 1; i < rows.length; i++) {
        /* var, а не let: замыкание на шаге собираем сами */
        (function (i) {
          tl.to(rows.slice(i), {
            y: function () { return -rows[i].offsetTop + WC_TOP * Math.min(i, stepCap()); },
            ease: "none", duration: 1
          });
          tl.to(rows.slice(0, i), { y: "-=" + WC_SHIFT, ease: "none", duration: 1 }, "<");
        })(i);
      }

      /* ХВОСТ СТОПКИ (правка 04.08, третья — просьба клиента: «предпоследний
         и последний блоки должны пролистаться чуть выше»).
         Раньше последний ряд доезжал до места ровно в тот кадр, когда пин
         отпускал секцию: постоять ему было негде, и подняться выше — тоже.
         Здесь после всех шагов вся стопка целиком уходит ещё на WC_SHIFT —
         тем же сползанием, каким на каждом шаге уползают предыдущие ряды,
         — и только после этого секция открепляется. Последняя карточка
         поднимается с 192 до 77 от верха экрана, предпоследняя уходит выше
         кромки, заодно освобождая шапку от обрезанных полосок.
         Это ДВИЖЕНИЕ, а не пауза: на хвосте на экране всё время что-то
         едет, поэтому прерывистости, из-за которой сняли паузы, тут нет.
         WC_TAIL учтён в end, так что 1 доля ленты = один рост ряда
         прокрутки и на хвосте, и на шагах — скорость на стыке не прыгает.
         Хвост учитывает и fitStack (см. выше): без вычета WC_SHIFT под
         последней карточкой осталась бы дыра в те же 115px. */
      tl.to(rows, { y: "-=" + WC_SHIFT, ease: "none", duration: WC_TAIL });

      /* уход на мобильную ветку — снять навязанный рост, там стопки нет */
      return function () {
        ScrollTrigger.removeEventListener("revert", fitStack);
        document.documentElement.style.removeProperty("--wc-stack-h");
      };
    });

    /* ============================================================
       ТЗ2 §5 — команда: закреплённая горизонтальная прокрутка (десктоп)
       ============================================================ */
    mm.add("(min-width: 1024px)", function () {
      var section = document.querySelector("[data-hteam]");
      var track = document.querySelector("[data-hteam-track]");
      if (!section || !track) return;
      /* ТЗ16 §5: конец проезда — центр ПОСЛЕДНЕЙ станции совпадает с
         центром вьюпорта (раньше track.scrollWidth − innerWidth гнал трек
         до правого края с хвостом, и Гордышев проскакивал левее центра) */
      var lastStation = track.querySelector("[data-hstation]:last-of-type");
      var dist = function () {
        return lastStation.offsetLeft + lastStation.offsetWidth / 2 - window.innerWidth / 2;
      };

      var tween = gsap.to(track, {
        x: function () { return -dist(); },
        ease: "none",
        scrollTrigger: {
          trigger: section, pin: true, scrub: 1,
          start: "top top",
          end: function () { return "+=" + dist(); },
          invalidateOnRefresh: true
          /* onEnter/onLeaveBack декоров удалены — floats убраны по ТЗ16 §2 */
        }
      });

      /* Правка 03.08: проезд НЕ обрывается вместе с пином.
         Пин отпускает секцию ровно тогда, когда последняя станция встала
         в центр экрана, — и раньше в этот момент трек замирал, а страница
         уезжала к следующему блоку с застывшими карточками. Теперь на
         отрезке «пин кончился → секция ушла вверх» трек продолжает идти
         влево: оставшиеся лица и подписи под ними доезжают до кромки,
         пока снизу поднимается следующий блок.

         Отдельный твин работает по xPercent, а НЕ по x, и это важно:
         GSAP складывает обе составляющие в один transform, поэтому он не
         конфликтует с основным твином, который держит x = −dist(). Если
         вести оба по x, второй на прогрессе 0 сбрасывал бы позицию
         первого во время самого проезда. */
      /* Ход выхода задан явно, а не «остатком трека»: после центровки
         последней станции справа от неё остаётся только паддинг (замер на
         1440: трек 3570, проезд 2505, экран 1440 — остаток отрицательный).
         0.4 экрана хватает, чтобы карточки заметно продолжили уходить
         влево и при этом не улетели за кромку раньше самой секции. */
      var exitDist = function () { return window.innerWidth * 0.4; };
      gsap.to(track, {
        xPercent: function () {
          var w = track.offsetWidth;
          return w ? -100 * exitDist() / w : 0;
        },
        ease: "none",
        scrollTrigger: {
          trigger: section, scrub: 1,
          /* границы берём прямо у пина: строковый «top top-=dist» здесь
             считается по распорке пина и прибавляет проезд ВТОРОЙ раз —
             замер показал старт на 2505px позже, чем нужно */
          start: function () { return tween.scrollTrigger.end; },
          end: function () { return tween.scrollTrigger.end + window.innerHeight; },
          invalidateOnRefresh: true,
          refreshPriority: -1   /* пересчитываться после пина, чтобы .end был свежим */
        }
      });

      /* ТЗ6 §3: подсветка пути с мягким градиентным хвостом — маска-
         прямоугольник с fade-краем едет по X вместе с прогрессом.
         Правка 31.07 (пятая), два изменения против ТЗ16 §5.3:
         (1) линия теперь длиннее трека на ширину экрана, поэтому доля
             считается от ПОЛНОЙ ширины SVG (трек + экран), а не от трека;
         (2) заказчик просил, чтобы к концу проезда линия была СПЛОШНОЙ
             до правой кромки. Раньше к кромке приходил мягкий хвост и
             последняя треть экрана оставалась притушенной. Теперь к
             кромке подводится конец СПЛОШНОЙ части (первые 86% маски),
             а сам хвост уезжает уже за экран. */
      var MASK_W = 1725;          // ширина прямоугольника-маски в юнитах viewBox
      var MASK_SOLID = MASK_W * 0.86; // до этой точки маска непрозрачна (см. glowFade)
      gsap.to("[data-hteam-glowmask]", {
        attr: {
          x: function () {
            /* ГРАБЛИ: здесь нельзя брать track.scrollWidth. Линия —
               абсолютно позиционированный ребёнок трека, и теперь она
               ШИРЕ него на экран, поэтому scrollWidth уже включает эту
               добавку и удвоил бы её. offsetWidth — чистая layout-ширина
               трека, переполнение детьми в неё не входит. */
            var svgW = track.offsetWidth + window.innerWidth;
            /* + exitDist(): трек едет ещё и после пина (см. твин выше), и
               без этой добавки конец сплошной части уезжал бы влево вместе
               с линией — правый край подсветки тух на самом выходе */
            var fracEnd = (dist() + exitDist() + window.innerWidth) / svgW;
            return 1500 * fracEnd - MASK_SOLID;
          }
        },
        ease: "none",
        scrollTrigger: {
          trigger: section, start: "top top", scrub: 1,
          end: function () { return "+=" + dist(); },
          invalidateOnRefresh: true
        }
      });

      /* Костыльный bg-твин конца проезда удалён (ТЗ5 §5.4):
         затемнение стыка команда → этика теперь делает body-переход */

      /* Правка 31.07 (четвёртая): анимация «проявления» станции УДАЛЕНА.
         Была: фото открывалось снизу вверх (clipPath inset(100% 0 0 0)),
         следом всплывали плашка, роль и регалии (opacity + y). Заказчик:
         «убери анимацию появления фотографий… пусть просто справа
         появляются» — движение станции теперь целиком даёт горизонтальный
         проезд трека, отдельного въезда у карточки нет.
         Откат: вернуть таймлайн из ревизии 55 (см. память проекта). */

      /* лёгкий параллакс фото внутри рамки */
      gsap.utils.toArray(".hstation__photo img").forEach(function (img) {
        gsap.set(img, { scale: 1.15 });
        gsap.fromTo(img, { xPercent: -6 }, {
          xPercent: 6, ease: "none",
          scrollTrigger: {
            trigger: img.closest(".hstation"), containerAnimation: tween,
            start: "left right", end: "right left", scrub: true
          }
        });
      });

      /* параллакс декоров .hteam__float удалён по ТЗ16 §2 */
    });
    /* <1024px: нативный свайп со scroll-snap — без JS (ТЗ2 §5) */

    /* Секция «Как мы работаем» (.steps) удалена по просьбе заказчика
       29.07 — вместе с её пином, стеком карточек и парящими бокалами. */

    /* ГРАБЛИ: этот цикл ОБЯЗАН идти ПОСЛЕ создания всех пинов — иначе
       секции ниже первого пина получают координаты без пин-спейсеров
       (у #team start был 4167 вместо 13392), и refresh() их не чинит.
       Триггером берём спейсер: коробка самой запиненной секции — один
       вьюпорт, а на экране она держится всю длину пина, из-за чего
       при прокрутке ВВЕРХ фон переключался не там. */
    /* ============================================================
       ПЛАВНОЕ ПЕРЕТЕКАНИЕ ФОНА (референс pinea.wine)
       Было: цвет переключался скачком в одной точке, а CSS-переход
       .6s размазывал его во времени. На длинной прокрутке это читалось
       как линия — цвет менялся «сам по себе», не связанный со скроллом.
       Стало: цвет ИНТЕРПОЛИРУЕТСЯ вместе со скроллом. Пока секция
       поднимается снизу вверх на высоту экрана, фон перетекает из цвета
       предыдущей секции в свой; к моменту, когда секция заняла экран,
       перетекание закончено.
       Кривая — smoothstep (плавный старт, плавный финиш), а не прямая:
       у прямой видно, где перетекание началось и где кончилось.
       Окно перехода — 0.75 экрана, и оно ЗАКАНЧИВАЕТСЯ за 0.1 экрана до
       того, как секция займёт экран целиком: к моменту, когда новый блок
       встал на место, цвет уже свой. Нижняя граница окна прижата к
       предыдущему стыку — иначе на коротких секциях (кейсы — примерно
       один экран) перетекание начиналось бы сразу после предыдущего и
       блок не успевал побыть в своём цвете.
       ============================================================ */
    var bgStops = [];
    var bgSections = [];
    document.querySelectorAll("[data-bg]").forEach(function (sec) {
      if (!sec.hasAttribute("data-bg-pin")) bgSections.push(sec);
    });

    var hexToRgb = function (hex) {
      var h = hex.replace("#", "");
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    /* стартовый цвет — тот, что стоит на body в CSS */
    var bgStart = (function () {
      var m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
      return m ? [+m[0], +m[1], +m[2]] : [16, 17, 17]; /* charcoal, как в CSS */
    })();

    var measureBg = function () {
      var vh = window.innerHeight;
      var from = bgStart, prevEnd = -1e9;
      bgStops = [];
      for (var i = 0; i < bgSections.length; i++) {
        var sec = bgSections[i];
        /* ГРАБЛИ (те же, что были у прежнего цикла): у запиненной секции
           собственная коробка во время пина стоит на месте, её
           getBoundingClientRect врёт. Меряем по пин-спейсеру — он всегда
           в нормальном потоке. */
        var box = sec.closest(".pin-spacer") || sec;
        var top = box.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
        var y1 = top - vh * 0.12;
        var y0 = Math.max(y1 - vh * 0.8, prevEnd + vh * 0.1);
        if (y0 >= y1) y0 = y1 - 1;
        bgStops.push({ y0: y0, y1: y1, from: from, to: hexToRgb(sec.dataset.bg) });
        from = hexToRgb(sec.dataset.bg);
        prevEnd = y1;
      }
    };

    var lastBg = "";
    var paintBg = function () {
      if (!bgStops.length) return;
      var y = window.scrollY || window.pageYOffset;
      var col = bgStops[0].from, s, t;
      for (var i = 0; i < bgStops.length; i++) {
        s = bgStops[i];
        if (y >= s.y1) { col = s.to; continue; }   // стык пройден — цвет секции
        if (y <= s.y0) break;                      // ещё не начали — держим предыдущий
        t = (y - s.y0) / (s.y1 - s.y0);
        t = t * t * (3 - 2 * t);                   // smoothstep, см. комментарий выше
        col = [
          s.from[0] + (s.to[0] - s.from[0]) * t,
          s.from[1] + (s.to[1] - s.from[1]) * t,
          s.from[2] + (s.to[2] - s.from[2]) * t
        ];
        break;
      }
      var css = "rgb(" + Math.round(col[0]) + "," + Math.round(col[1]) + "," + Math.round(col[2]) + ")";
      if (css !== lastBg) {
        lastBg = css;
        document.body.style.backgroundColor = css;
        /* здесь был пересчёт «чернил» шапки — механизм снят 04.08 */
      }
    };

    measureBg();
    paintBg();
    /* один сквозной триггер на всю страницу: его onUpdate идёт в общем
       такте ScrollTrigger, а значит синхронно с Lenis */
    ScrollTrigger.create({ start: 0, end: "max", onUpdate: paintBg, onRefresh: paintBg });
    ScrollTrigger.addEventListener("refresh", function () { measureBg(); paintBg(); });

    /* refresh после полной загрузки: пины не должны давать CLS (ТЗ2 §7) */
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });

    /* ============================================================
       ПУСТОЙ ХВОСТ ПОД КОНТАКТАМИ (правка 31.07, седьмая)
       Заказчик: в самом низу страницы сверху подглядывал блок команды,
       а карточка формы стояла не по центру экрана. Добавляем ровно
       столько пустоты, сколько нужно ОБОИМ условиям (берём максимум):
       — центр карточки в центре окна: значит, от центра карточки до конца
         документа должно остаться ровно пол-экрана;
       — низ последней строки блока команды выше верхней кромки.
       Условия совпадают на высоких окнах и расходятся примерно ниже 870px:
       там контакты начинаются слишком близко под командой, и одним лишь
       отступом СНИЗУ обоих не добиться — выигрывает уход текста.
       В CSS это не выразить: нужны и высота окна, и высота карточки.
       Считается после того, как ScrollTrigger расставит пин-спейсеры, —
       они дают почти всю высоту документа.
       ============================================================ */
    var tail = document.querySelector("[data-final-tail]");
    var tailCard = document.querySelector(".form-card");
    var teamSec = document.querySelector("[data-hteam]");
    /* Положение документа по цепочке offsetParent. ГРАБЛИ (те же, что у
       полёта логотипа): getBoundingClientRect ловит элемент смещённым
       твином — карточку двигает reveal на 26px, — а offsetTop трансформы
       игнорирует. */
    var docTopOf = function (el) {
      var y = 0, n = el;
      while (n) { y += n.offsetTop; n = n.offsetParent; }
      return y;
    };
    /* Нижняя кромка САМОГО НИЗКОГО текста блока команды в координатах
       документа — в тот момент, когда проезд закончился. Тогда секция
       стоит у нижнего края своего пин-спейсера, а вертикальная раскладка
       внутри неё за время проезда не меняется (едет только трек по X),
       поэтому смещение текста от верха секции можно замерить где угодно.
       На мобильном пина нет — спейсером служит сама секция, и формула
       вырождается в её обычное положение. */
    var teamTextBottom = function () {
      if (!teamSec) return -1e9;
      var secTop = teamSec.getBoundingClientRect().top, low = 0;
      var nodes = teamSec.querySelectorAll(".hstation__creds, .hstation--intro .h2");
      for (var i = 0; i < nodes.length; i++) {
        var b = nodes[i].getBoundingClientRect();
        if (b.width && b.bottom - secTop > low) low = b.bottom - secTop;
      }
      var spacer = teamSec.closest(".pin-spacer") || teamSec;
      return docTopOf(spacer) + spacer.offsetHeight - teamSec.offsetHeight + low;
    };
    if (tail && tailCard) {
      var lastTail = -1;
      var sizeTail = function () {
        tail.style.height = "0px"; /* меряем документ без самого хвоста */
        var docH = document.documentElement.scrollHeight;
        var vh = window.innerHeight;
        /* сколько нужно, чтобы центр карточки совпал с центром экрана */
        var forCenter = docTopOf(tailCard) + tailCard.offsetHeight / 2 + vh / 2 - docH;
        /* сколько нужно, чтобы последняя строка блока команды ушла выше
           верхней кромки. На окнах ниже ~870px эти два требования расходятся
           (контакты начинаются слишком близко под командой), и тогда решает
           второе: заказчик жаловался именно на подглядывающий текст. */
        var forHide = teamTextBottom() - (docH - vh);
        var need = Math.max(0, Math.round(Math.max(forCenter, forHide)));
        tail.style.height = need + "px";
        /* высота документа изменилась — триггерам нужен пересчёт. Сравнение
           с прошлым значением обрывает рекурсию: второй проход даёт то же
           число и refresh больше не вызывается. */
        if (need !== lastTail) {
          lastTail = need;
          ScrollTrigger.refresh();
        }
      };
      /* на время замеров ScrollTrigger хвост убираем, иначе он войдёт в
         собственный расчёт; сам замер — уже после refresh, отложенно,
         чтобы не вызывать refresh изнутри refresh */
      ScrollTrigger.addEventListener("refreshInit", function () { tail.style.height = "0px"; });
      ScrollTrigger.addEventListener("refresh", function () { requestAnimationFrame(sizeTail); });
      window.addEventListener("resize", sizeTail);
      window.addEventListener("load", sizeTail);
      sizeTail();
    }
  }
  /* Ветки else здесь больше нет: при reduced-motion и без GSAP текст
     показывать вручную не нужно — reveal.js просто снимает с <html>
     guard-класс js-reveal, на котором висит правило opacity:0. */
})();
