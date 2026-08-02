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

  /* ---------- 6.0 Шапка: чернила по фону под каждым элементом ----------
     Правка 31.07. Раньше шапка пряталась при скролле вниз и наращивала
     тёмную подложку — заказчик попросил зафиксировать её насовсем и
     сделать полностью прозрачной. Вместо подложки читаемость держат
     «чернила»: каждый помеченный data-ink элемент замеряет фон В СВОЕЙ
     точке (не в центре экрана) и переключается между тёмным и светлым.
     Учитывается ТОЛЬКО фон: background-color элементов под шапкой,
     смешанные сверху вниз до непрозрачности. Картинки и текст под
     шапкой не читаем — так просил заказчик. */
  var header = document.getElementById("header");
  var inkNodes = [].slice.call(document.querySelectorAll("[data-ink]"));

  var INK_LIGHT = [234, 228, 216]; // --bp-off-white
  var INK_DARK = [23, 20, 15];     // --bp-dark-text
  var relLum = function (c) {
    var f = function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  var contrast = function (a, b) {
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  var L_LIGHT = relLum(INK_LIGHT), L_DARK = relLum(INK_DARK);

  /* Правка 31.07 (пятая): плашки с названиями — это НАДПИСЬ поверх блока,
     а не его фон. Пока их читали наравне с фоном, пункты шапки над
     чёрной плашкой кейса вспыхивали светлым посреди светлой секции —
     заказчик просил в этот момент оставаться тёмными. Пропускаем их, и
     цвет считается по настоящей подложке секции (кремовой у кейсов,
     бордовой у команды). Список расширяемый. */
  var INK_SKIP = ".plaque";

  /* Композитный цвет фона в точке экрана. elementsFromPoint отдаёт стопку
     сверху вниз, поэтому смешиваем «по остатку прозрачности»: каждый
     следующий слой красит только то, что ещё не закрашено. */
  var bgAt = function (x, y) {
    var stack = document.elementsFromPoint(x, y);
    var r = 0, g = 0, b = 0, a = 0, i, m, ca, k;
    for (i = 0; i < stack.length && a < 0.995; i++) {
      if (header.contains(stack[i])) continue; // свою же шапку не читаем
      if (stack[i].closest && stack[i].closest(INK_SKIP)) continue;
      m = getComputedStyle(stack[i]).backgroundColor.match(/[\d.]+/g);
      if (!m) continue;
      ca = m.length > 3 ? parseFloat(m[3]) : 1;
      if (!ca) continue;
      k = (1 - a) * ca;
      r += +m[0] * k; g += +m[1] * k; b += +m[2] * k; a += k;
    }
    if (a < 0.995) { /* добираем цветом body — он лежит под всем */
      m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) || ["27", "25", "22"];
      k = 1 - a;
      r += +m[0] * k; g += +m[1] * k; b += +m[2] * k;
    }
    return [r, g, b];
  };

  var updateInk = function () {
    for (var i = 0; i < inkNodes.length; i++) {
      var el = inkNodes[i];
      var box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue; // спрятан брейкпоинтом
      /* точка замера — центр самого элемента, зажатый в границы окна:
         во время полёта знак вылезает далеко за пределы шапки */
      var x = Math.min(Math.max(box.left + box.width / 2, 1), window.innerWidth - 2);
      var y = Math.min(Math.max(box.top + box.height / 2, 1), window.innerHeight - 2);
      var lum = relLum(bgAt(x, y));
      /* выбираем то из двух начертаний, что даёт больший контраст */
      el.classList.toggle("is-on-light", contrast(lum, L_DARK) > contrast(lum, L_LIGHT));
    }
  };

  var inkQueued = false;
  function requestInk() {
    if (inkQueued) return;
    inkQueued = true;
    requestAnimationFrame(function () { inkQueued = false; updateInk(); });
  }
  window.addEventListener("scroll", requestInk, { passive: true });
  window.addEventListener("resize", requestInk);
  window.addEventListener("load", requestInk);
  requestInk();

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
            /* Подложка шапки по прогрессу полёта убрана 31.07 — шапка
               прозрачна всегда. Но знак в полёте проезжает по разным
               участкам фона, поэтому чернила пересчитываем каждый кадр. */
            requestInk();
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
    requestInk(); /* под шапкой теперь тёмная шторка меню — пересчитать */
    if (open) lenisStop(); else lenisStart();
  });
  mnav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });

  /* Табы «Бар/Кофе» удалены — услуги стали редакционным коллажем
     с прямыми якорями #services и #coffee (ТЗ4 §4) */

  /* ============================================================
     6.8 Кейсы: данные и общая логика фильтра
     ============================================================ */
  var CASES = window.BARPOINT_CASES || [];
  var CAT_LABEL = { bar: "Бар", coffee: "Кофе" };
  var activeFilter = "all";

  function logoHTML(c) {
    if (c.logoImage) {
      return '<img src="' + c.logoImage + '" alt="Логотип проекта ' + c.title + '"' +
        (c.logoDark ? ' style="background:#1B1916;padding:8px 14px;border-radius:4px"' : "") + ">";
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
        '<span class="case-card__photo"><img src="assets/img/' + c.gallery[0] + '.webp" alt="' + c.title + ' — фото проекта" loading="lazy" decoding="async"></span>' +
        '<span class="case-card__meta"><span class="cat">' + CAT_LABEL[c.category] + '</span><span class="more">смотреть →</span></span>';
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
  var railTween = null;
  var railDragMoved = false;

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
      '<span class="ccard__photo"><img src="assets/img/' + c.gallery[0] + '.webp" alt="' + c.title + ' — фото проекта" loading="lazy" decoding="async"></span>' +
      '<span class="ccard__meta"><span class="cat">' + CAT_LABEL[c.category] + '</span><span class="ccard__desc">' + c.shortDescription + "</span></span>";
    b.addEventListener("click", function () {
      if (railDragMoved) return; // это был drag, не клик
      openCase(i, b);
    });
    return b;
  }

  function buildRail() {
    var idx = visibleCaseIndices();
    var isStatic = idx.length < 4; // «кофе»: 2 кейса — статично по центру (ТЗ2 §6)
    if (railTween) { railTween.kill(); railTween = null; }
    railTrack.innerHTML = "";
    gsap.set(railTrack, { x: 0, xPercent: 0 });
    idx.forEach(function (i) { railTrack.appendChild(ccardNode(i, false)); });
    rail.classList.toggle("crail--static", isStatic);
    if (isStatic) return;
    idx.forEach(function (i) { railTrack.appendChild(ccardNode(i, true)); }); // дубль ×2
    var half = railTrack.scrollWidth / 2;
    var speed = window.innerWidth < 768 ? 30 : 50; // px/с (ТЗ2 §6)
    railTween = gsap.to(railTrack, {
      xPercent: -50, ease: "none",
      duration: half / speed, repeat: -1
    });
  }

  function setRailSpeed(scale) {
    if (railTween) gsap.to(railTween, { timeScale: scale, duration: 0.4, overwrite: true });
  }

  function initRail() {
    rail.hidden = false;
    buildRail();

    /* ТЗ3 §2.1: hover на скорость НЕ влияет — лента едет постоянно.
       Пауза остаётся только для клавиатурного фокуса и открытой модалки. */
    rail.addEventListener("focusin", function () { if (railTween) railTween.timeScale(0); });
    rail.addEventListener("focusout", function () { if (!rail.matches(":focus-within")) setRailSpeed(1); });

    /* ТЗ3 §2.2: горизонтальный жест тачпада двигает ленту;
       вертикальный скролл страницы не перехватываем */
    rail.addEventListener("wheel", function (e) {
      if (!railTween) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      var half = railTrack.scrollWidth / 2;
      var wrap = gsap.utils.wrap(0, 1);
      railTween.progress(wrap(railTween.progress() + e.deltaX / half));
    }, { passive: false });

    /* drag мышью и пальцем; клик подавляется при смещении > 7px */
    var dragX = null, prevX = 0;
    rail.addEventListener("pointerdown", function (e) {
      if (!railTween) return;
      dragX = prevX = e.clientX;
      railDragMoved = false;
      railTween.pause();
      rail.classList.add("is-dragging");
    });
    window.addEventListener("pointermove", function (e) {
      if (dragX === null || !railTween) return;
      var dx = e.clientX - prevX;
      prevX = e.clientX;
      if (Math.abs(e.clientX - dragX) > 7) railDragMoved = true;
      var half = railTrack.scrollWidth / 2;
      var wrap = gsap.utils.wrap(0, 1);
      railTween.progress(wrap(railTween.progress() - dx / half));
    }, { passive: true });
    window.addEventListener("pointerup", function () {
      if (dragX === null) return;
      dragX = null;
      rail.classList.remove("is-dragging");
      if (railTween) railTween.play();
      setTimeout(function () { railDragMoved = false; }, 0); // после click-события
    });
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
        /* плавный fade-out → пересборка → fade-in (ТЗ2 §6) */
        gsap.to(rail, {
          opacity: 0, duration: 0.25, onComplete: function () {
            buildRail();
            gsap.to(rail, { opacity: 1, duration: 0.25 });
          }
        });
      } else {
        filterGrid();
      }
      if (hasGsap) ScrollTrigger.refresh();
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
  var coverFacts = document.querySelector("[data-cover-facts]");
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
  if (hasGsap && window.Flip) gsap.registerPlugin(Flip);
  var canZoom = function () { return hasGsap && !reduceMotion && window.Flip; };

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
     Путь в пиксельных координатах контейнера; ниже 1024px выреза нет. */
  var NOTCH_W = 146, NOTCH_H = 68, NOTCH_R = 10;
  function updateCoverClip() {
    if (!cgal || !coverClip) return;
    if (window.innerWidth < 1024) { cgal.style.clipPath = "none"; return; }
    var box = cgal.getBoundingClientRect();
    var w = Math.round(box.width), h = Math.round(box.height);
    if (!w || !h) return;
    var R = NOTCH_R;
    coverClip.setAttribute("d",
      "M " + R + " " + NOTCH_H +
      " H " + (NOTCH_W - 20) +
      " Q " + (NOTCH_W - R) + " " + NOTCH_H + " " + (NOTCH_W - R) + " " + (NOTCH_H - R) +
      " V " + R +
      " Q " + (NOTCH_W - R) + " 0 " + NOTCH_W + " 0" +
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
    gsap.timeline({
      defaults: { duration: 1, ease: "power4.inOut" },
      onComplete: function () {
        galAnimating = false; galIndex = next; galFront = back;
        gsap.set(out, { autoAlpha: 0, zIndex: 0, x: 0 });
        gsap.set(inc, { zIndex: 1 });
        arrowsHidden(false);
      }
    })
      .to(out, { x: dir === 1 ? -(.1 * d) : .1 * d }, 0)
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

  function factsHTML(c, i) {
    var cols = [{ v: CAT_LABEL[c.category], c: "категория" }];
    if (c.metrics) c.metrics.forEach(function (m) { cols.push({ v: m.value, c: m.label }); });
    if (c.externalMentions) c.externalMentions.forEach(function (m) { cols.push({ v: m.value, c: m.label }); });
    cols.push({ v: caseNumber(i), c: "в портфолио" });
    return cols.slice(0, 4).map(function (col) {
      return '<div class="cfact"><p class="cfact__val">' + col.v +
        '</p><p class="cfact__cap">' + col.c + "</p></div>";
    }).join("");
  }

  /* иконка-буллет 12×12: фирменный ромб BARPOINT (тот же знак, что
     разделяет проекты в трастстрипе) */
  var BULLET = '<span class="cworks__bullet" aria-hidden="true">' +
    '<svg viewBox="0 0 12 12" focusable="false"><path d="M6 0 12 6 6 12 0 6z"/></svg></span>';

  function fillCover(i) {
    var c = CASES[i];

    /* СНАЧАЛА снимаем разбивку SplitText: revert() возвращает элементу
       ту разметку, что была на момент split, и если сделать это после
       записи нового заголовка — на экране останется предыдущий кейс */
    revertSplits();

    coverTitle.textContent = c.title;
    coverTitle.setAttribute("aria-label", c.title);
    coverSub.textContent = c.shortDescription;
    coverSub.setAttribute("aria-label", c.shortDescription);
    coverDesc.textContent = c.fullDescription;
    coverName.textContent = c.title;
    coverFacts.innerHTML = factsHTML(c, i);

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

    /* плавающий предмет — своя вырезка на каждый кейс */
    var foodSrc = c.float || "assets/img/float-hero-pour.webp";
    Array.prototype.forEach.call(cover.querySelectorAll(".cfood img"), function (im) {
      im.src = foodSrc;
    });

    /* галерея: кадры кейса + скрытый предзагрузчик */
    GAL = c.gallery.map(function (g) {
      return { src: "assets/img/" + g + ".webp", alt: c.title + " — фото проекта" };
    });
    galIndex = 0; galFront = "a"; galAnimating = false;
    applyGalImage(imgA, 0);
    applyGalImage(imgB, galWrap(1));
    if (hasGsap) {
      gsap.set(slotA, { x: 0, zIndex: 1, autoAlpha: 1 });
      gsap.set(slotB, { x: 0, zIndex: 0, autoAlpha: 0 });
      gsap.set(arrowSlots, { scale: 1 });
    }
    cgalPreload.innerHTML = GAL.map(function (g) {
      return '<img src="' + g.src + '" alt="" decoding="async">';
    }).join("");

    /* один кадр — листать нечего */
    var single = GAL.length < 2;
    Array.prototype.forEach.call(cover.querySelectorAll(".carrow"), function (b) {
      if (single) b.setAttribute("data-disabled", ""); else b.removeAttribute("data-disabled");
      b.disabled = single;
    });
  }

  /* ============================================================
     Вступительный таймлайн разворота (таблица §6.2 ТЗ)
     ============================================================ */
  function revertSplits() {
    if (splitTitle) { splitTitle.revert(); splitTitle = null; }
    if (splitSub) { splitSub.revert(); splitSub = null; }
  }

  function playCoverIntro() {
    var boxes = cover.querySelectorAll("[data-cover-box]");
    var foods = cover.querySelectorAll("[data-cover-food], [data-cover-foodmob]");
    revertSplits();

    if (!hasGsap) return;
    if (reduceMotion) {
      gsap.set([coverPattern, coverTitle, coverSub, cgal], { opacity: 1, y: 0 });
      gsap.set(boxes, { opacity: 1, y: 0, rotation: 0 });
      gsap.set(foods, { opacity: 1, scale: 1 });
      return;
    }

    var tl = gsap.timeline({ delay: COVER_DELAY / 1000 });

    gsap.set(coverPattern, { opacity: 0 });
    tl.to(coverPattern, { opacity: .1, duration: CVD.base, ease: CVE.base }, 0);

    /* заголовок — по буквам, с перелётом */
    if (window.SplitText) {
      splitTitle = new SplitText(coverTitle, { type: "lines,words,chars" });
      Array.prototype.forEach.call(coverTitle.children, function (n) { n.setAttribute("aria-hidden", "true"); });
      if (splitTitle.chars.length) {
        tl.set(splitTitle.chars, { opacity: 0, y: 60, scaleX: .8, scaleY: .5 }, 0)
          .set(coverTitle, { opacity: 1 }, "<")
          .to(splitTitle.chars, {
            opacity: 1, scaleX: 1, scaleY: 1, y: 0,
            duration: CVD.title, stagger: CVS.title, ease: CVE.backBase
          }, "<");
      }
    }

    /* галерея */
    tl.fromTo(cgal, { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: CVD.slow, ease: CVE.backLow }, 0);

    /* подзаголовок — строками снизу */
    if (window.SplitText) {
      splitSub = new SplitText(coverSub, { type: "lines" });
      Array.prototype.forEach.call(coverSub.children, function (n) { n.setAttribute("aria-hidden", "true"); });
      if (splitSub.lines.length) {
        tl.set(splitSub.lines, { opacity: 0, yPercent: 50 }, ">")
          .set(coverSub, { opacity: 1 }, "<")
          .to(splitSub.lines, {
            opacity: 1, yPercent: 0,
            duration: CVD.paragraph, stagger: CVS.paragraph, ease: CVE.copy
          }, "<");
      }
    }

    /* четыре карточки влетают снизу со случайным поворотом −30…30° */
    gsap.set(boxes, { opacity: 0, y: 100, rotation: "random(-30, 30)" });
    tl.to(boxes, {
      opacity: 1, y: 0, rotation: 0,
      duration: CVD.bigCopy, stagger: CVS.bigCopy, ease: "bigCopy"
    }, "<25%");

    /* плавающий предмет */
    gsap.set(foods, { opacity: 0, scale: 0 });
    tl.to(foods, { opacity: 1, scale: 1, duration: CVD.base, ease: CVE.backLow }, "<25%");
  }

  /* ============================================================
     Плавающий предмет: «дыхание» и ход к курсору.
     Скролл-параллакс оригинала здесь смысла не имеет — разворот
     это фиксированный слой, страница под ним заморожена, поэтому
     ScrollTrigger на предмет не вешаем.
     ============================================================ */
  var coverMouse = [];
  if (hasGsap && !reduceMotion) {
    Array.prototype.forEach.call(cover.querySelectorAll("[data-parallax-food]"), function (el) {
      var inner = el.querySelector("[data-parallax-food-inner]");
      if (!inner) return;
      /* один случайный коэффициент на элемент — им подменяется любой
         незаданный data-атрибут, поэтому амплитуда качания каждый раз своя */
      var a = +Math.random().toFixed(2);
      var ampAttr = el.getAttribute("data-parallax-float-amplitude");
      var amp = ampAttr === null ? a : parseFloat(ampAttr);
      if (amp > 0) {
        gsap.fromTo(el,
          { yPercent: -25 * amp, rotation: -5 * amp },
          {
            yPercent: 25 * amp, rotation: 5 * amp,
            duration: 3 + 2 * Math.random(), ease: "sine.inOut", repeat: -1, yoyo: true
          });
      }
      var forceAttr = el.getAttribute("data-parallax-mouse-force");
      var force = forceAttr === null ? a : parseFloat(forceAttr);
      if (force > 0) {
        coverMouse.push({
          el: el, max: 80 * force,
          qx: gsap.quickTo(inner, "x", { duration: 1.8, ease: "power1.out" }),
          qy: gsap.quickTo(inner, "y", { duration: 1.8, ease: "power1.out" })
        });
      }
    });
    if (coverMouse.length) {
      window.addEventListener("mousemove", function (ev) {
        if (!cover.classList.contains("is-open")) return;
        for (var k = 0; k < coverMouse.length; k++) {
          var t = coverMouse[k], b = t.el.getBoundingClientRect();
          var dx = ev.clientX - (b.left + b.width / 2);
          var dy = ev.clientY - (b.top + b.height / 2);
          var l = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 1000);
          var o = l * l * t.max;
          if (o > 0) { var ang = Math.atan2(dy, dx); t.qx(Math.cos(ang) * o); t.qy(Math.sin(ang) * o); }
          else { t.qx(0); t.qy(0); }
        }
      });
    }
  }

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
     Открытие / закрытие — механика прежняя (FLIP-зум)
     ============================================================ */
  /* карточка кейса i, видимая сейчас в вьюпорте (для обратного зума);
     лента дублирует карточки — берём первую, чей bbox в кадре */
  function findLiveCardImg(i) {
    var imgs = document.querySelectorAll('.ccard[data-index="' + i + '"] .ccard__photo img');
    for (var k = 0; k < imgs.length; k++) {
      var r = imgs[k].getBoundingClientRect();
      if (r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight) return imgs[k];
    }
    return null;
  }

  function makeGhost(srcImg, fromRect) {
    var ghost = srcImg.cloneNode();
    ghost.className = "cover__ghost";
    ghost.removeAttribute("loading");
    gsap.set(ghost, {
      position: "fixed", top: fromRect.top, left: fromRect.left,
      width: fromRect.width, height: fromRect.height,
      zIndex: 210, margin: 0, borderRadius: 10, objectFit: "cover"
    });
    document.body.appendChild(ghost);
    return ghost;
  }

  function openCase(i, sourceEl) {
    var wasOpen = cover.classList.contains("is-open");
    currentCase = i;
    if (wasOpen) {
      /* переключение кейса внутри разворота: перекрёстный fade ~0.3s,
         затем разворот проигрывает вступление заново */
      if (hasGsap && !reduceMotion) {
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
    if (railTween) railTween.timeScale(0); // лента на паузе при открытом развороте
    coverInner.scrollTop = 0;
    updateCoverClip();

    /* зум из карточки: клон фото летит из позиции карточки в галерею */
    var srcImg = sourceEl && sourceEl.querySelector(".ccard__photo img, .case-card__photo img");
    if (srcImg && canZoom()) {
      var ghost = makeGhost(srcImg, srcImg.getBoundingClientRect());
      gsap.set(cover, { opacity: 0 });
      requestAnimationFrame(function () {
        var state = Flip.getState(ghost);
        var f = cgal.getBoundingClientRect();
        gsap.set(ghost, { top: f.top, left: f.left, width: f.width, height: f.height });
        gsap.to(cover, { opacity: 1, duration: .35, ease: "power2.out" });
        Flip.from(state, {
          duration: .45, ease: "power3.inOut",
          onComplete: function () { ghost.remove(); gsap.set(cover, { clearProps: "opacity" }); }
        });
        playCoverIntro();
      });
    } else {
      playCoverIntro();
    }
    cover.querySelector("[data-cover-close]").focus();
  }

  function closeCover() {
    var finish = function () {
      cover.classList.remove("is-open");
      document.body.style.overflow = "";
      lenisStart();
      setRailSpeed(1);
      revertSplits();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    var target = findLiveCardImg(currentCase);
    var curImg = galImg(galFront);
    if (target && curImg && curImg.src && canZoom()) {
      /* обратный зум: текущий кадр сворачивается в карточку ленты */
      var ghost = makeGhost(curImg, cgal.getBoundingClientRect());
      var state = Flip.getState(ghost);
      var r = target.getBoundingClientRect();
      gsap.set(ghost, { top: r.top, left: r.left, width: r.width, height: r.height });
      Flip.from(state, { duration: .4, ease: "power3.inOut", onComplete: function () { ghost.remove(); } });
      gsap.to(cover, { opacity: 0, duration: .3, ease: "power2.in", onComplete: function () {
        gsap.set(cover, { clearProps: "opacity" }); finish();
      } });
    } else if (hasGsap && !reduceMotion) {
      gsap.to(cover, { opacity: 0, duration: .28, ease: "power2.in", onComplete: function () {
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

    /* --- Базовые reveal-ы (ТЗ v1): fade + сдвиг вверх --- */
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true }
      });
    });

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

    /* ============================================================
       ТЗ2 §3 — построчное появление крупных текстов (SplitText).
       mask:'lines' — «шторка», autoSplit — пересплит после догрузки
       шрифтов, анимация создаётся только внутри onSplit.
       ============================================================ */
    if (window.SplitText) {
      document.querySelectorAll(".js-lines").forEach(function (el) {
        el.style.visibility = "hidden"; // скрыт до сплита — без мигания
      });
      document.fonts.ready.then(function () {
        document.querySelectorAll(".js-lines").forEach(function (el) {
          /* ГРАБЛИ (30.07): текст героя прижат к низу экрана и целиком
             лежит НИЖЕ линии start:"top 78%" — со скролл-триггером он
             оставался невидимым до прокрутки (капс-строка не появлялась
             вовсе, была видна только янтарная линейка слева). Тексту
             первого экрана триггер не нужен — он играет сразу. */
          var inHero = !!el.closest(".hero");
          SplitText.create(el, {
            /* правка 17.07: mask:"lines" обрезал выносные элементы букв
               («у», «р», курсивные em) — анимируем без маски, ничего не режется */
            type: "lines", autoSplit: true,
            onSplit: function (self) {
              el.style.visibility = "";
              var tw = {
                yPercent: 110, opacity: 0,
                duration: 0.9, ease: "power3.out", stagger: 0.1,
                /* заголовок героя выходит после отрисовки логотипа (ТЗ4 §3.3) */
                delay: el.classList.contains("hero__title") ? 0.35 : 0
              };
              /* ГРАБЛИ: ключ scrollTrigger со значением null gsap всё равно
                 отдаёт плагину, и твин повисает в стартовом состоянии
                 (строка так и оставалась с opacity 0). Ключа быть НЕ должно. */
              if (!inHero) tw.scrollTrigger = { trigger: el, start: "top 78%", once: true };
              return gsap.from(self.lines, tw);
            }
          });
        });
        ScrollTrigger.refresh();
      });
    }

    /* Осевой параллакс старых услуг (.svc-spread) удалён вместе с их
       вёрсткой: услуги пересобраны в блоки-слайдеры (см. ниже). */

    /* Брейкпоинты — через gsap.matchMedia (ТЗ2 §7) */
    var mm = gsap.matchMedia();

    /* ============================================================
       Блоки-презентации #coffee и #services — полоса-навигация.
       Механика по референсу bonito-flakes-for-pets.com: секция пинится,
       прокрутка перелистывает пойнты, полоса у края показывает список,
       подсвечивает активный и заполняется линией-прогрессом; клик по
       пункту — переход к пойнту через Lenis.
       JS НЕ анимирует содержимое (железное правило запиненных секций):
       только считает активный индекс от progress и переставляет классы.
       ПОРЯДОК: блок создаётся ДО пинов команды и «Этапов» — обе секции
       ниже по документу, и их start считается с учётом этих пинов.
       ============================================================ */
    mm.add("(min-width: 1024px)", function () {
      var offClicks = [];
      gsap.utils.toArray("[data-pres]").forEach(function (sec) {
        var points = sec.querySelectorAll("[data-pres-point]");
        var items = sec.querySelectorAll("[data-pres-go]");
        var fill = sec.querySelector("[data-pres-fill]");
        var N = points.length;
        if (!N) return;

        var current = -1;
        function setPoint(i) {
          if (i === current) return;
          current = i;
          points.forEach(function (p, k) { p.classList.toggle("is-active", k === i); });
          items.forEach(function (b, k) {
            if (k === i) b.setAttribute("aria-current", "true");
            else b.removeAttribute("aria-current");
          });
          if (fill) fill.style.height = ((i + 1) / N * 100).toFixed(2) + "%";
          sec.classList.toggle("is-accent", points[i].hasAttribute("data-pres-accent"));
        }
        setPoint(0);

        var st = ScrollTrigger.create({
          trigger: sec, pin: true, scrub: true,
          start: "top top",
          end: function () { return "+=" + Math.round(window.innerHeight * 0.85 * N); },
          anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (self) {
            setPoint(Math.min(N - 1, Math.floor(self.progress * N)));
          },
          onLeaveBack: function () { setPoint(0); }
        });

        items.forEach(function (b) {
          function go() {
            var i = parseInt(b.dataset.presGo, 10);
            var y = st.start + (st.end - st.start) * ((i + 0.5) / N);
            if (lenis) lenis.scrollTo(y);
            else window.scrollTo(0, y);
          }
          b.addEventListener("click", go);
          offClicks.push(function () { b.removeEventListener("click", go); });
        });
      });

      return function () {
        offClicks.forEach(function (off) { off(); });
        document.querySelectorAll("[data-pres]").forEach(function (sec) {
          sec.classList.remove("is-accent");
          sec.querySelectorAll("[data-pres-point]").forEach(function (p) { p.classList.remove("is-active"); });
          sec.querySelectorAll("[data-pres-go]").forEach(function (b) { b.removeAttribute("aria-current"); });
          var f = sec.querySelector("[data-pres-fill]");
          if (f) f.style.height = "";
        });
      };
    });

    /* ============================================================
       Услуги — два блока-слайдера с вертикальной полоской.
       Референс: bonito-flakes-for-pets.com. Секция пинится, прокрутка
       перелистывает слайды, полоска подсвечивает активную точку и
       заполняется линией-прогрессом; клик по точке — переход к слайду.
       JS НЕ анимирует содержимое (правило запиненных секций): он только
       считает индекс от progress и переставляет классы.
       ПОРЯДОК: создаётся ДО пина команды — она ниже по документу.
       ============================================================ */
    mm.add("(min-width: 1024px)", function () {
      var off = [];
      gsap.utils.toArray("[data-prs]").forEach(function (sec) {
        var slides = sec.querySelectorAll("[data-prs-slide]");
        var dots = sec.querySelectorAll("[data-prs-go]");
        var fill = sec.querySelector("[data-prs-fill]");
        var N = slides.length;
        if (!N) return;

        var cur = -1;
        function show(i) {
          if (i === cur) return;
          cur = i;
          slides.forEach(function (sl, k) { sl.classList.toggle("is-active", k === i); });
          dots.forEach(function (d, k) {
            d.classList.toggle("is-current", k === i);
            d.classList.toggle("is-done", k < i);
            if (k === i) d.setAttribute("aria-current", "true");
            else d.removeAttribute("aria-current");
          });
          /* линия-прогресс: до центра активной точки */
          if (fill) fill.style.height = (N < 2 ? 100 : i / (N - 1) * 100).toFixed(2) + "%";
        }
        show(0);

        var st = ScrollTrigger.create({
          trigger: sec, pin: true, scrub: true,
          start: "top top",
          /* по ~0.8 вьюпорта на слайд; длина — функцией, поэтому
             invalidateOnRefresh обязателен */
          end: function () { return "+=" + Math.round(window.innerHeight * 0.8 * N); },
          anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (self) { show(Math.min(N - 1, Math.floor(self.progress * N))); },
          /* полоска появляется вместе с блоком и исчезает вместе с ним */
          onToggle: function (self) { sec.classList.toggle("is-live", self.isActive); },
          onLeaveBack: function () { show(0); }
        });

        dots.forEach(function (d) {
          function go() {
            var i = parseInt(d.dataset.prsGo, 10);
            var y = st.start + (st.end - st.start) * ((i + 0.5) / N);
            if (lenis) lenis.scrollTo(y);
            else window.scrollTo(0, y);
          }
          d.addEventListener("click", go);
          off.push(function () { d.removeEventListener("click", go); });
        });
      });

      return function () {
        off.forEach(function (f) { f(); });
        document.querySelectorAll("[data-prs]").forEach(function (sec) {
          sec.classList.remove("is-live");
          sec.querySelectorAll("[data-prs-slide]").forEach(function (sl) { sl.classList.remove("is-active"); });
          sec.querySelectorAll("[data-prs-go]").forEach(function (d) {
            d.classList.remove("is-current", "is-done"); d.removeAttribute("aria-current");
          });
          var f = sec.querySelector("[data-prs-fill]");
          if (f) f.style.height = "";
        });
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
            var fracEnd = (dist() + window.innerWidth) / svgW;
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
      return m ? [+m[0], +m[1], +m[2]] : [27, 25, 22];
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
        requestInk(); /* фон поехал — чернила шапки могут смениться */
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
  } else {
    /* reduced-motion или нет GSAP: показываем всё сразу */
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.style.opacity = "1"; el.style.transform = "none";
    });
  }
})();
