/* =========================================================
   데일리뷰티끄 (DAILY BOUTIQUE) — app.js
   - data/content.json 의 문구·메뉴·사진·릴스·가격을 화면에 반영
   - 예약 링크(카카오톡 · 네이버 예약 · 인스타그램 · 전화) 일괄 적용
   - 갤러리 필터, 릴스 자동 캐러셀, 헤더 스크롤, 모바일 내비, 스크롤 리빌
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 1. 링크 기본값 (content.json 이 있으면 덮어쓴다) ---------- */
  var URLS = {
    kakao: "https://pf.kakao.com/_ikxhMK",
    naver: "https://naver.me/54LPjPc4",
    "book-brow": "https://booking.naver.com/booking/13/bizes/1357067/items/7426344",
    "book-lash": "https://booking.naver.com/booking/13/bizes/1357067/items/7426378",
    instagram: "https://www.instagram.com/daily_boutique_/",
    phone: "tel:050713588172"
  };

  var IG_PATH = "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 5.3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 7.4a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8Zm5.7-7.6a1.05 1.05 0 1 1-2.1 0 1.05 1.05 0 0 1 2.1 0Z";

  var CONTENT = null;
  var CONTENT_KEY = "dailyboutique-content-v";

  /* ---------- 2. 작은 도구 ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function str(v) { return (v === undefined || v === null) ? "" : String(v); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- 3. 링크 적용 ---------- */
  function applyLinks() {
    document.querySelectorAll("[data-link]").forEach(function (a) {
      var key = a.getAttribute("data-link");
      var url = URLS[key];
      if (!url) return;
      if (a.getAttribute("href") !== url) a.setAttribute("href", url);
      if (url.indexOf("http") === 0) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      } else {
        a.removeAttribute("target");
        a.removeAttribute("rel");
      }
    });
  }

  /* ---------- 4. content.json 문구 반영 ---------- */
  function getPath(path) {
    var parts = String(path).split("."), cur = CONTENT;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return null;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function applyText() {
    if (!CONTENT) return;
    document.querySelectorAll("[data-content]").forEach(function (node) {
      var val = getPath(node.getAttribute("data-content"));
      if (typeof val === "string" && val.trim() !== "") node.innerHTML = val;
    });
    document.querySelectorAll("[data-img]").forEach(function (node) {
      var val = getPath(node.getAttribute("data-img"));
      if (typeof val === "string" && val.trim() !== "" && node.getAttribute("src") !== val) node.src = val;
      var alt = getPath(node.getAttribute("data-img-alt") || "");
      if (typeof alt === "string" && alt.trim() !== "") node.alt = alt;
    });
  }

  /* ---------- 4-b. 이벤트(기간 한정) ---------- */
  function eventLive() {
    var ev = CONTENT && CONTENT.event;
    if (!ev || typeof ev !== "object") return null;
    if (ev.enabled === false || ev.enabled === "false" || ev.enabled === 0) return null;
    if (!str(ev.title).trim()) return null;
    if (ev.until) {
      /* 종료일(한국 시간 자정까지)이 지나면 자동으로 숨긴다 */
      var end = new Date(String(ev.until).trim() + "T23:59:59+09:00");
      if (!isNaN(end.getTime()) && new Date().getTime() > end.getTime()) return null;
    }
    return ev;
  }

  function buildEvent() {
    var ev = eventLive();
    var bar = document.querySelector(".util-bar");
    var barLink = document.querySelector("[data-event-bar]");
    var card = $("eventPromo");
    var priceLine = $("priceEvent");

    if (bar) bar.classList.toggle("is-event", !!ev);
    [barLink, card, priceLine].forEach(function (node) {
      if (node) node.hidden = !ev;
    });
    if (!ev) return;

    if (card) {
      var cta = card.querySelector("[data-link]");
      if (cta) cta.setAttribute("data-link", ev.link || "kakao");
    }
    if (barLink) barLink.setAttribute("data-link", ev.link || "kakao");
  }

  /* ---------- 5. 시그니처 카드 ---------- */
  function buildMenus() {
    var wrap = $("menuCards");
    if (!wrap || !CONTENT || !CONTENT.menu || !Array.isArray(CONTENT.menu.items)) return;
    var items = CONTENT.menu.items;
    if (!items.length) return;

    wrap.innerHTML = "";
    items.forEach(function (item) {
      var card = el("article", "card reveal");

      var media = el("div", "card__media");
      var img = el("img");
      img.src = item.image || "assets/menu-brow.jpg";
      img.alt = item.alt || (item.name || "");
      img.loading = "lazy";
      img.width = 640; img.height = 800;
      media.appendChild(img);

      var body = el("div", "card__body");
      body.appendChild(el("p", "card__en", item.label || ""));
      body.appendChild(el("h3", "card__name", item.name || ""));
      body.appendChild(el("p", "card__desc", item.desc || ""));
      if (item.meta) body.appendChild(el("p", "card__meta", item.meta));
      if (item.price) body.appendChild(el("p", "card__price", item.price));

      var cta = el("a", "card__link", item.ctaText || "예약하기");
      cta.setAttribute("data-link", item.link || "book-brow");
      cta.href = URLS[item.link || "book-brow"] || URLS.kakao;
      cta.target = "_blank"; cta.rel = "noopener";
      body.appendChild(cta);

      card.appendChild(media);
      card.appendChild(body);
      wrap.appendChild(card);
    });
  }

  /* ---------- 6. 원장 소개 4가지 ---------- */
  function buildPillars() {
    var wrap = $("aboutPillars");
    if (!wrap || !CONTENT || !CONTENT.about || !Array.isArray(CONTENT.about.pillars)) return;
    var list = CONTENT.about.pillars;
    if (!list.length) return;

    wrap.innerHTML = "";
    list.forEach(function (p, i) {
      var li = el("li");
      li.appendChild(el("span", "pillars__num", (i + 1 < 10 ? "0" : "") + (i + 1)));
      var box = el("div");
      box.appendChild(el("h3", null, p.title || ""));
      box.appendChild(el("p", null, p.desc || ""));
      li.appendChild(box);
      wrap.appendChild(li);
    });
  }

  /* ---------- 7. 갤러리 ---------- */
  function buildGallery() {
    var grid = $("galGrid");
    if (!grid || !CONTENT || !CONTENT.gallery || !Array.isArray(CONTENT.gallery.items)) return;
    var items = CONTENT.gallery.items;
    if (!items.length) return;

    grid.innerHTML = "";
    items.forEach(function (item) {
      var a = el("a", "gal__item reveal");
      a.setAttribute("data-cat", item.cat || "studio");
      a.href = item.url || URLS.instagram;
      a.target = "_blank"; a.rel = "noopener";

      var media = el("span", "gal__media");
      var img = el("img");
      img.src = item.image || "";
      img.alt = item.alt || item.cap || "";
      img.loading = "lazy";
      img.width = 640; img.height = 640;
      media.appendChild(img);
      if (item.tag) media.appendChild(el("span", "gal__tag", item.tag));

      a.appendChild(media);
      a.appendChild(el("span", "gal__cap", item.cap || ""));
      grid.appendChild(a);
    });
  }

  /* ---------- 8. 가격 ---------- */
  function buildPrices() {
    var wrap = $("priceGroups");
    if (!wrap || !CONTENT || !CONTENT.price || !Array.isArray(CONTENT.price.groups)) return;
    var groups = CONTENT.price.groups;
    if (!groups.length) return;

    wrap.innerHTML = "";
    groups.forEach(function (g) {
      var block = el("div", "price__block reveal");
      block.appendChild(el("h3", "price__name", g.name || ""));
      var ul = el("ul", "price__list");
      (g.items || []).forEach(function (it) {
        var li = el("li");
        li.appendChild(el("span", "price__item", it.name || ""));
        li.appendChild(el("span", "price__time", it.time || "—"));
        li.appendChild(el("span", "price__val", it.price || ""));
        ul.appendChild(li);
      });
      block.appendChild(ul);
      if (g.note) block.appendChild(el("p", "price__note", g.note));
      wrap.appendChild(block);
    });
  }

  /* ---------- 9. 예약 3단계 ---------- */
  function buildSteps() {
    var wrap = $("reserveSteps");
    if (!wrap || !CONTENT || !CONTENT.reserve || !Array.isArray(CONTENT.reserve.steps)) return;
    var steps = CONTENT.reserve.steps;
    if (!steps.length) return;

    wrap.innerHTML = "";
    steps.forEach(function (s, i) {
      var li = el("li", "reveal");
      li.appendChild(el("span", "steps__n", (i + 1 < 10 ? "0" : "") + (i + 1)));
      li.appendChild(el("h3", null, s.title || ""));
      li.appendChild(el("p", null, s.desc || ""));
      wrap.appendChild(li);
    });
  }

  /* ---------- 10. 숫자 ---------- */
  function buildStats() {
    var wrap = $("statsGrid");
    if (!wrap || !CONTENT || !Array.isArray(CONTENT.stats)) return;
    var stats = CONTENT.stats;
    if (!stats.length) return;

    wrap.innerHTML = "";
    stats.forEach(function (s) {
      var box = el("div", "stat");
      box.appendChild(el("p", "stat__num", s.num || ""));
      var label = el("p", "stat__label");
      label.innerHTML = str(s.label);
      box.appendChild(label);
      wrap.appendChild(box);
    });
  }

  /* ---------- 11. 릴스 ---------- */
  function buildReels() {
    var track = $("reelTrack");
    if (!track || !CONTENT || !Array.isArray(CONTENT.showcase && CONTENT.showcase.reels)) return;
    var reels = CONTENT.showcase.reels;
    if (!reels.length) return;

    track.innerHTML = "";
    reels.forEach(function (r, i) {
      var li = el("li", "reels__slide");
      li.setAttribute("role", "listitem");

      var a = el("a", "reel");
      a.href = r.url || URLS.instagram;
      a.target = "_blank"; a.rel = "noopener";
      a.setAttribute("aria-label", (r.title || "릴스") + " — 인스타그램에서 보기");

      var media = el("span", "reel__media");
      if (r.video) {
        var v = el("video", "reel__video");
        v.src = r.video;
        if (r.poster) v.poster = r.poster;
        v.width = 720; v.height = 1280;
        v.muted = true; v.loop = true; v.playsInline = true;
        v.preload = "metadata";
        v.setAttribute("muted", "");
        v.setAttribute("loop", "");
        v.setAttribute("playsinline", "");
        v.setAttribute("aria-hidden", "true");
        v.tabIndex = -1;
        media.appendChild(v);
      } else if (r.poster) {
        var im = el("img", "reel__poster");
        im.src = r.poster; im.alt = ""; im.loading = "lazy";
        media.appendChild(im);
      } else {
        media.appendChild(el("span", "reel__placeholder", "DAILY BOUTIQUE"));
      }
      media.appendChild(el("span", "reel__no", "REEL " + (i + 1 < 10 ? "0" : "") + (i + 1)));

      var ig = el("span", "reel__ig");
      ig.setAttribute("aria-hidden", "true");
      ig.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + IG_PATH + '"/></svg>';
      media.appendChild(ig);

      var meta = el("span", "reel__meta");
      meta.appendChild(el("span", "reel__t", r.title || ""));
      meta.appendChild(el("span", "reel__d", r.desc || ""));
      meta.appendChild(el("span", "reel__cta", "릴스 보기"));

      a.appendChild(media);
      a.appendChild(meta);
      li.appendChild(a);
      track.appendChild(li);
    });
  }

  /* ---------- 12. 헤더 · 내비 ---------- */
  var header = $("siteHeader");
  var burger = $("burger");
  var body = document.body;

  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
    var float = document.querySelector(".float-cta");
    if (float) float.classList.toggle("is-on", window.scrollY > 620);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (burger) {
    burger.addEventListener("click", function () {
      var open = body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    });
  }
  document.querySelectorAll("#gnb a").forEach(function (a) {
    a.addEventListener("click", function () {
      body.classList.remove("nav-open");
      if (burger) {
        burger.setAttribute("aria-expanded", "false");
        burger.setAttribute("aria-label", "메뉴 열기");
      }
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && body.classList.contains("nav-open")) {
      body.classList.remove("nav-open");
      if (burger) burger.setAttribute("aria-expanded", "false");
    }
  });

  /* ---------- 13. 갤러리 필터 ---------- */
  function initFilters() {
    var chips = Array.prototype.slice.call(document.querySelectorAll(".filters .chip"));
    var items = Array.prototype.slice.call(document.querySelectorAll("#galGrid .gal__item"));

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var f = chip.getAttribute("data-filter");
        chips.forEach(function (c) {
          var on = c === chip;
          c.classList.toggle("is-active", on);
          c.setAttribute("aria-selected", on ? "true" : "false");
        });
        items.forEach(function (item) {
          var show = f === "all" || item.getAttribute("data-cat") === f;
          if (show) item.removeAttribute("hidden");
          else item.setAttribute("hidden", "");
        });
      });
    });
  }

  /* ---------- 14. 스크롤 리빌 ---------- */
  var revealObserver = null;
  if ("IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          revealObserver.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
  }
  function initReveal(scope) {
    var list = Array.prototype.slice.call((scope || document).querySelectorAll(".reveal"));
    if (revealObserver) list.forEach(function (n) { revealObserver.observe(n); });
    else list.forEach(function (n) { n.classList.add("is-in"); });
  }

  /* ---------- 15. 릴스 캐러셀 ---------- */
  function initReels() {
    var root = $("reels");
    if (!root) return;
    var viewport = $("reelViewport");
    var track = $("reelTrack");
    if (!viewport || !track || !track.children.length) return;

    var slides = Array.prototype.slice.call(track.children);
    var videos = Array.prototype.slice.call(track.querySelectorAll("video"));
    var prevBtn = $("reelPrev");
    var nextBtn = $("reelNext");
    var toggleBtn = $("reelToggle");
    var dotsWrap = $("reelDots");
    var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var interval = parseInt(root.getAttribute("data-autoplay"), 10) || 5200;

    var index = 0;
    var maxIndex = Math.max(0, slides.length - 1);
    var userPaused = !!(reduce && reduce.matches);
    var hovering = false;
    var inView = false;
    var holdTimer = null;
    var timer = null;
    var frame = null;

    var dots = slides.map(function (s, i) {
      var b = el("button", "reels__dot");
      b.type = "button";
      b.setAttribute("aria-label", (i + 1) + " / " + slides.length + " 릴스");
      b.setAttribute("aria-current", i === 0 ? "true" : "false");
      b.addEventListener("click", function () { goTo(i); restart(); });
      if (dotsWrap) dotsWrap.appendChild(b);
      return b;
    });

    function step() {
      if (slides.length < 2) return 0;
      return slides[1].offsetLeft - slides[0].offsetLeft;
    }
    function positions() {
      var s = step();
      if (!s) return;
      var per = Math.max(1, Math.round(viewport.clientWidth / s));
      maxIndex = Math.max(0, slides.length - per);
    }
    function goTo(i, instant) {
      if (!maxIndex) maxIndex = slides.length - 1;
      index = Math.max(0, Math.min(maxIndex, i));
      var left = slides[index].offsetLeft - slides[0].offsetLeft;
      var smooth = !instant && !(reduce && reduce.matches);
      try { viewport.scrollTo({ left: left, behavior: smooth ? "smooth" : "auto" }); }
      catch (e) { viewport.scrollLeft = left; }
      paint();
    }
    function paint() {
      dots.forEach(function (d, i) { d.setAttribute("aria-current", i === index ? "true" : "false"); });
    }
    function isVisible(slide) {
      var start = slide.offsetLeft - slides[0].offsetLeft;
      var left = viewport.scrollLeft;
      var right = left + viewport.clientWidth;
      return start + slide.offsetWidth > left + 36 && start < right - 36;
    }
    function safePlay(v) {
      if (!v.paused) return;
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    function playVisible() {
      var run = inView && !userPaused && !document.hidden;
      videos.forEach(function (v) {
        var slide = v.closest ? v.closest(".reels__slide") : null;
        if (run && slide && isVisible(slide)) safePlay(v);
        /* 아직 메타데이터를 받는 중인 영상은 멈추지 않는다(로딩 요청이 취소되지 않도록) */
        else if (!v.paused && v.readyState >= 2) v.pause();
      });
    }
    function tick() {
      if (userPaused || hovering || !inView || document.hidden) return;
      goTo(index + 1 > maxIndex ? 0 : index + 1);
    }
    function restart() {
      if (timer) clearInterval(timer);
      timer = setInterval(tick, interval);
    }
    function setToggle() {
      if (!toggleBtn) return;
      toggleBtn.setAttribute("aria-pressed", userPaused ? "true" : "false");
      toggleBtn.setAttribute("aria-label", userPaused ? "자동 넘김 다시 시작" : "자동 넘김 멈춤");
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { goTo(index - 1 < 0 ? maxIndex : index - 1); restart(); });
    if (nextBtn) nextBtn.addEventListener("click", function () { goTo(index + 1 > maxIndex ? 0 : index + 1); restart(); });
    if (toggleBtn) toggleBtn.addEventListener("click", function () {
      userPaused = !userPaused;
      setToggle();
      playVisible();
      restart();
    });

    function hoverOn() { hovering = true; }
    function hoverOff() { hovering = false; }
    root.addEventListener("pointerenter", hoverOn);
    root.addEventListener("pointerleave", hoverOff);
    root.addEventListener("focusin", hoverOn);
    root.addEventListener("focusout", function (e) { if (!root.contains(e.relatedTarget)) hoverOff(); });
    root.addEventListener("touchstart", function () {
      hovering = true;
      if (holdTimer) clearTimeout(holdTimer);
    }, { passive: true });
    root.addEventListener("touchend", function () {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = setTimeout(hoverOff, 6000);
    }, { passive: true });

    viewport.addEventListener("scroll", function () {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        var s = step();
        if (s) {
          var i = Math.round(viewport.scrollLeft / s);
          index = Math.max(0, Math.min(maxIndex, i));
          paint();
        }
        playVisible();
      });
    }, { passive: true });

    viewport.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1 < 0 ? maxIndex : index - 1); restart(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1 > maxIndex ? 0 : index + 1); restart(); }
    });

    document.addEventListener("visibilitychange", playVisible);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { inView = en.isIntersecting; playVisible(); });
      }, { threshold: 0.12 }).observe(root);
    } else {
      inView = true;
    }

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        positions();
        goTo(index, true);
        playVisible();
      }, 180);
    });

    if (reduce && reduce.addEventListener) {
      reduce.addEventListener("change", function (e) {
        userPaused = e.matches;
        setToggle();
        playVisible();
      });
    }

    positions();
    paint();
    setToggle();
    restart();
    videos.forEach(function (v) { v.muted = true; });
    playVisible();
    setTimeout(playVisible, 600);
  }

  /* ---------- 16. content.json 로드 ---------- */
  function loadContent() {
    if (window.location.protocol === "file:") return Promise.resolve(null);
    var bust = "";
    try {
      var v = localStorage.getItem(CONTENT_KEY);
      if (v) bust = "?v=" + encodeURIComponent(v);
    } catch (e) {}
    return fetch("data/content.json" + bust, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || typeof data !== "object") throw new Error("invalid json");
        CONTENT = data;
        if (data.channels) {
          Object.keys(data.channels).forEach(function (k) {
            if (typeof data.channels[k] === "string" && data.channels[k].trim() !== "") {
              URLS[k] = data.channels[k].trim();
            }
          });
        }
        return CONTENT;
      })
      .catch(function () {
        CONTENT = null; /* 실패하면 index.html 원문 그대로 동작 */
        return null;
      });
  }

  /* ---------- 17. 시작 ---------- */
  loadContent().then(function () {
    if (CONTENT) {
      applyText();
      buildEvent();
      buildStats();
      buildMenus();
      buildPillars();
      buildGallery();
      buildPrices();
      buildSteps();
      buildReels();
    }
    applyLinks();
    initFilters();
    initReveal();
    initReels();
  });

  /* content.json 이 로드되기 전에도 링크는 기본값으로 채운다 */
  applyLinks();
})();
