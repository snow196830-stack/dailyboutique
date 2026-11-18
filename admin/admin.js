/* =========================================================
   데일리뷰티끄 — 관리자 페이지 (admin.js)
   - data/content.json 을 폼으로 그리고,
     GitHub Contents API 로 커밋해 GitHub Pages 에 반영한다.
   - 공개 코드에는 토큰·비밀번호를 넣지 않는다.
     토큰은 원장님이 최초 1회 입력 → 이 브라우저(localStorage)에만 저장.
     (선택) PIN 잠금: PBKDF2 + AES-GCM 으로 암호화 저장.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 설정 ---------- */
  var qs = new URLSearchParams(location.search);
  var OWNER = qs.get("owner") || "snow196830-stack";
  var REPO = qs.get("repo") || "dailyboutique";
  var FILE_PATH = "data/content.json";
  var BRANCH = qs.get("branch") || "main";
  var API = (qs.get("api") || "https://api.github.com").replace(/\/$/, "");
  var LIVE = qs.get("live") || ("https://" + OWNER + ".github.io/" + REPO + "/data/content.json");

  var KEY_TOKEN = "dailyboutique-admin-token";
  var KEY_TOKEN_PIN = "dailyboutique-admin-token-pin";
  var KEY_CONTENT_V = "dailyboutique-content-v";

  var state = {
    content: null,
    pristine: null,
    token: null,
    sha: null,
    dirty: false,
    saving: false,
    loadFailed: false
  };

  /* ---------- 작은 도구 ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") n.className = attrs[k];
        else if (k === "hidden") n.hidden = !!attrs[k];
        else if (k === "html") n.innerHTML = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
    }
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nowISO() { return new Date().toISOString(); }
  function fmtDate(iso) {
    if (!iso) return "기록 없음";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* ---------- content 경로 ---------- */
  function getPath(path) {
    var parts = String(path).split("."), cur = state.content;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function setPath(path, val) {
    var parts = String(path).split("."), cur = state.content;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }

  /* ---------- 상태 표시 ---------- */
  function markDirty() {
    state.dirty = true;
    setStatus("저장되지 않은 변경사항이 있습니다", "dirty");
  }
  function setStatus(msg, kind) {
    var s = $("saveStatus");
    if (!s) return;
    s.className = "savebar__status" + (kind ? " is-" + kind : "");
    s.textContent = msg;
  }
  function setConn(ok, text) {
    var d = $("connDot");
    if (d) d.className = "dot" + (ok === true ? " is-ok" : ok === "warn" ? " is-warn" : ok === false ? " is-bad" : "");
    var t = $("connText");
    if (t) t.textContent = text;
  }
  function setGateAlert(msg, kind) {
    var box = $("gateAlert");
    if (!box) return;
    box.hidden = !msg;
    box.className = "alert" + (kind ? " is-" + kind : "");
    box.textContent = msg || "";
  }

  /* ---------- 입력 요소 ---------- */
  function field(label, value, opts) {
    opts = opts || {};
    var wrap = el("label", { class: "field" });
    wrap.appendChild(el("span", { class: "field__label" }, label));
    var input;
    if (opts.type === "textarea") {
      input = el("textarea", { class: "input", rows: opts.rows || 3 });
      if (opts.placeholder) input.placeholder = opts.placeholder;
      input.value = value == null ? "" : String(value);
    } else {
      input = el("input", { class: "input", type: "text" });
      if (opts.placeholder) input.placeholder = opts.placeholder;
      input.value = value == null ? "" : String(value);
    }
    input.addEventListener("input", function () {
      if (opts.onInput) opts.onInput(input.value);
      markDirty();
    });
    wrap.appendChild(input);
    if (opts.note) wrap.appendChild(el("span", { class: "field__note" }, opts.note));
    return wrap;
  }

  function textField(label, path, opts) {
    return field(label, getPath(path), Object.assign({}, opts, {
      onInput: function (v) { setPath(path, v); }
    }));
  }

  function selectField(label, path, opts, note) {
    var wrap = el("label", { class: "field" });
    wrap.appendChild(el("span", { class: "field__label" }, label));
    var sel = el("select", { class: "input" });
    var cur = getPath(path);
    opts.forEach(function (pair) {
      var o = el("option", { value: pair[0] }, pair[1]);
      if (String(cur) === pair[0]) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      var v = sel.value;
      setPath(path, v === "true" ? true : v === "false" ? false : v);
      markDirty();
    });
    wrap.appendChild(sel);
    if (note) wrap.appendChild(el("span", { class: "field__note" }, note));
    return wrap;
  }

  /* ---------- 섹션 정의 ---------- */
  var SECTIONS = [
    {
      id: "basic",
      title: "1. 기본 · 공지",
      lead: "맨 위 공지바와 가게 기본 정보입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("상호", "site.name"));
        f.appendChild(textField("한 줄 소개", "site.tagline"));
        f.appendChild(textField("상단 공지바 문구", "notice.text", { note: "맨 위 검은 띠에 나오는 한 줄입니다. 비우면 공지바가 빈 채로 남습니다." }));
        box.appendChild(f);
      }
    },
    {
      id: "event",
      title: "2. 이벤트 배너",
      lead: "수능 이벤트처럼 기간이 정해진 이벤트입니다. ‘사용’이면 상단 공지바·시그니처·가격표에 함께 나오고, ‘사용 안 함’이면 홈페이지에서 바로 사라집니다. 종료일이 지나면 자동으로 숨겨집니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(selectField("이벤트 표시", "event.enabled", [["true", "사용 (홈페이지에 표시)"], ["false", "사용 안 함 (숨김)"]]));
        f.appendChild(textField("종료일 (YYYY-MM-DD)", "event.until", { note: "이 날이 지나면 자동으로 숨겨집니다. 계속 보이게 하려면 비우거나 날짜를 늘리세요." }));
        f.appendChild(textField("상단 공지바 태그", "event.tag", { note: "맨 위 검은 띠에서 색이 들어간 짧은 라벨입니다. (예: 수능 이벤트)" }));
        f.appendChild(textField("상단 공지바 문구", "event.barText", { note: "태그 오른쪽에 이어서 나옵니다." }));
        f.appendChild(textField("이벤트 영문 라벨", "event.label", { note: "시그니처 아래 이벤트 카드의 작은 영문 라벨입니다." }));
        f.appendChild(textField("이벤트 기간 표기", "event.period"));
        f.appendChild(textField("이벤트 제목", "event.title", { type: "textarea", rows: 2, note: "줄바꿈은 <br> 로 넣습니다." }));
        f.appendChild(textField("이벤트 설명", "event.desc", { type: "textarea", rows: 3 }));
        f.appendChild(textField("이벤트 안내 (작은 글씨)", "event.note", { type: "textarea", rows: 2 }));
        f.appendChild(textField("가격표 위 한 줄", "event.priceNote"));
        f.appendChild(textField("버튼 문구", "event.ctaText"));
        f.appendChild(selectField("버튼 링크", "event.link", [["kakao", "카카오톡 채널"], ["book-brow", "네이버 예약 · 반영구"], ["book-lash", "네이버 예약 · 속눈썹펌"], ["naver", "네이버 플레이스"], ["instagram", "인스타그램"]]));
        box.appendChild(f);
      }
    },
    {
      id: "hero",
      title: "3. 첫 화면(히어로)",
      lead: "방문자가 가장 먼저 보는 문구입니다. 줄바꿈은 &lt;br&gt; 로 넣습니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "hero.eyebrow"));
        f.appendChild(textField("큰 제목", "hero.title", { type: "textarea", rows: 2 }));
        f.appendChild(textField("소개 문단", "hero.lead", { type: "textarea", rows: 4 }));
        f.appendChild(textField("버튼 아래 안내", "hero.note"));
        var two = el("div", { class: "field field--2" });
        two.appendChild(textField("배지 숫자", "hero.badgeNum"));
        two.appendChild(textField("배지 문구", "hero.badgeTxt", { note: "<br>로 줄을 바꿀 수 있습니다." }));
        f.appendChild(two);
        box.appendChild(f);
      }
    },
    {
      id: "channels",
      title: "4. 예약 링크",
      lead: "홈페이지의 모든 예약 버튼이 이 주소로 연결됩니다. 주소를 바꾸면 사이트 전체에 바로 적용됩니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        [["카카오톡 채널", "channels.kakao"], ["네이버 예약 · 반영구", "channels.book-brow"],
         ["네이버 예약 · 속눈썹펌", "channels.book-lash"], ["네이버 플레이스", "channels.naver"],
         ["인스타그램", "channels.instagram"], ["전화 (tel: 로 시작)", "channels.phone"]].forEach(function (pair) {
          f.appendChild(textField(pair[0], pair[1]));
        });
        box.appendChild(f);
      }
    },
    {
      id: "visit",
      title: "5. 오시는 길 · 영업시간",
      lead: "‘오시는 길’ 영역에 표시됩니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("주소", "visit.address"));
        f.appendChild(textField("주소 보조 설명", "visit.addressNote"));
        f.appendChild(textField("영업시간", "visit.hours"));
        f.appendChild(textField("영업시간 보조 설명", "visit.hoursNote"));
        f.appendChild(textField("주차", "visit.parking"));
        f.appendChild(textField("도보 안내", "visit.walk", { type: "textarea", rows: 2 }));
        f.appendChild(textField("택시 안내", "visit.taxi"));
        box.appendChild(f);
      }
    },
    {
      id: "menu",
      title: "6. 시그니처 메뉴",
      lead: "카드 순서대로 홈페이지에 나옵니다. 가격을 비우면 가격 줄이 사라집니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("섹션 제목", "menu.title"));
        f.appendChild(textField("섹션 소개", "menu.lead", { type: "textarea" }));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "menu.items",
          addLabel: "+ 메뉴 추가",
          min: 1,
          factory: function () {
            return { id: "menu-" + Math.random().toString(36).slice(2, 7), label: "", name: "", desc: "", meta: "", price: "", image: "assets/menu-brow.jpg", alt: "", link: "book-brow", ctaText: "예약하기" };
          },
          title: function (it, i) { return it.name || ("메뉴 " + (i + 1)); },
          cols: [
            { k: "label", l: "영문 라벨 (예: Brow)" },
            { k: "name", l: "이름" },
            { k: "desc", l: "설명", type: "textarea" },
            { k: "meta", l: "시술 시간 (예: 시술 시간 1시간 30분)" },
            { k: "price", l: "가격 문구 (비우면 숨김)" },
            { k: "image", l: "사진 파일 (예: assets/menu-brow.jpg)" },
            { k: "link", l: "버튼 링크", type: "select", opts: [["book-brow", "네이버 예약 · 반영구"], ["book-lash", "네이버 예약 · 속눈썹펌"], ["kakao", "카카오톡 채널"], ["naver", "네이버 플레이스"]] },
            { k: "ctaText", l: "버튼 문구" }
          ]
        }));
      }
    },
    {
      id: "about",
      title: "7. 원장 소개",
      lead: "인물 사진과 소개, 네 가지 특징입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("제목", "about.title", { type: "textarea", rows: 2 }));
        f.appendChild(textField("소개 문단", "about.lead", { type: "textarea", rows: 4 }));
        f.appendChild(textField("사진 파일", "about.image"));
        f.appendChild(textField("사진 설명", "about.imageAlt"));
        f.appendChild(textField("사진 캡션", "about.caption"));
        f.appendChild(textField("인용 문구", "about.quote"));
        f.appendChild(textField("인용 출처", "about.quoteSrc"));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "about.pillars",
          addLabel: "+ 특징 추가",
          min: 1,
          factory: function () { return { title: "", desc: "" }; },
          title: function (it, i) { return it.title || ("특징 " + (i + 1)); },
          cols: [{ k: "title", l: "제목" }, { k: "desc", l: "설명", type: "textarea" }]
        }));
      }
    },
    {
      id: "reels",
      title: "8. 시술 영상(릴스)",
      lead: "순서대로 캐러셀에 나오고, 카드를 누르면 적은 주소로 이동합니다. 영상 파일은 assets/reels/ 폴더에 있어야 재생됩니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("섹션 제목", "showcase.title"));
        f.appendChild(textField("섹션 소개", "showcase.lead"));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "showcase.reels",
          addLabel: "+ 릴스 추가",
          min: 0,
          factory: function () { return { id: "reel-" + Math.random().toString(36).slice(2, 7), url: "", video: "", poster: "", title: "", desc: "" }; },
          title: function (it, i) { return it.title || ("릴스 " + (i + 1)); },
          cols: [
            { k: "title", l: "제목" },
            { k: "desc", l: "설명", type: "textarea" },
            { k: "url", l: "인스타그램 릴스 주소" },
            { k: "video", l: "영상 파일 (assets/reels/…mp4)" },
            { k: "poster", l: "썸네일 파일 (assets/reels/…jpg)" }
          ]
        }));
      }
    },
    {
      id: "gallery",
      title: "9. 비포 & 애프터 사진",
      lead: "분류는 눈썹·입술·속눈썹·공간 중 하나입니다. 사진을 누르면 적은 주소로 이동합니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("섹션 제목", "gallery.title"));
        f.appendChild(textField("섹션 소개", "gallery.lead", { type: "textarea" }));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "gallery.items",
          addLabel: "+ 사진 추가",
          min: 0,
          factory: function () { return { id: "g" + Math.random().toString(36).slice(2, 7), cat: "brow", cap: "", alt: "", image: "assets/", url: "" }; },
          title: function (it, i) { return it.cap || ("사진 " + (i + 1)); },
          cols: [
            { k: "cat", l: "분류", type: "select", opts: [["brow", "눈썹"], ["lip", "입술"], ["lash", "속눈썹"], ["studio", "공간"]] },
            { k: "cap", l: "사진 설명 (목록 아래 문구)" },
            { k: "image", l: "사진 파일" },
            { k: "url", l: "누르면 열릴 주소" },
            { k: "tag", l: "모서리 태그 (선택)" }
          ]
        }));
      }
    },
    {
      id: "price",
      title: "10. 가격표",
      lead: "두 묶음(반영구 / 속눈썹펌)으로 나옵니다. 항목을 추가·삭제할 수 있습니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("섹션 제목", "price.title"));
        f.appendChild(textField("섹션 소개", "price.lead", { type: "textarea" }));
        f.appendChild(textField("맨 아래 안내", "price.footnote", { type: "textarea" }));
        box.appendChild(f);

        var groups = getPath("price.groups") || [];
        groups.forEach(function (g, gi) {
          var gbox = el("div", { class: "group" });
          var head = el("div", { class: "group__row" });
          head.appendChild(field("묶음 이름", g.name, { onInput: function (v) { g.name = v; } }));
          head.appendChild(field("묶음 설명 (선택)", g.note || "", { onInput: function (v) { g.note = v; } }));
          gbox.appendChild(head);

          var list = el("div");
          (g.items || []).forEach(function (it, ii) {
            var row = el("div", { class: "pricerow" });
            ["name", "time", "price"].forEach(function (k) {
              var inp = el("input", { class: "input", type: "text", placeholder: { name: "시술 이름", time: "시간", price: "금액" }[k] });
              inp.value = it[k] || "";
              inp.addEventListener("input", function () { it[k] = inp.value; markDirty(); });
              row.appendChild(inp);
            });
            var del = el("button", { class: "iconbtn", type: "button", title: "삭제", "aria-label": "삭제" }, "✕");
            del.addEventListener("click", function () {
              g.items.splice(ii, 1);
              markDirty(); renderAll();
            });
            row.appendChild(del);
            list.appendChild(row);
          });
          gbox.appendChild(list);
          var add = el("button", { class: "btn btn--add", type: "button" }, "+ 항목 추가");
          add.addEventListener("click", function () {
            if (!Array.isArray(g.items)) g.items = [];
            g.items.push({ name: "", time: "", price: "" });
            markDirty(); renderAll();
          });
          gbox.appendChild(add);
          box.appendChild(gbox);
        });
      }
    },
    {
      id: "reserve",
      title: "11. 예약 안내",
      lead: "예약 영역의 제목·소개·3단계·주의 문구입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("섹션 제목", "reserve.title"));
        f.appendChild(textField("섹션 소개", "reserve.lead", { type: "textarea" }));
        f.appendChild(textField("맨 아래 안내(예약금·취소)", "reserve.note", { type: "textarea" }));
        f.appendChild(textField("숫자 영역 각주", "statsFoot", { type: "textarea", rows: 2 }));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "reserve.steps",
          addLabel: "+ 단계 추가",
          min: 1,
          factory: function () { return { title: "", desc: "" }; },
          title: function (it, i) { return it.title || ("단계 " + (i + 1)); },
          cols: [{ k: "title", l: "제목" }, { k: "desc", l: "설명", type: "textarea" }]
        }));
      }
    }
  ];

  /* ---------- 목록 편집기 ---------- */
  function listEditor(cfg) {
    var wrap = el("div", { class: "list" });
    var arr = getPath(cfg.path);
    if (!Array.isArray(arr)) {
      arr = [];
      setPath(cfg.path, arr);
    }

    arr.forEach(function (item, i) {
      var box = el("div", { class: "item" });
      var head = el("div", { class: "item__head" });
      head.appendChild(el("span", { class: "item__no" }, String(i + 1).padStart(2, "0") + ". " + (cfg.title(item, i) || "")));
      var tools = el("div", { class: "item__tools" });

      var up = el("button", { class: "iconbtn", type: "button", title: "위로", "aria-label": "위로" }, "↑");
      up.disabled = i === 0;
      up.addEventListener("click", function () {
        arr.splice(i - 1, 0, arr.splice(i, 1)[0]);
        markDirty(); renderAll();
      });
      var down = el("button", { class: "iconbtn", type: "button", title: "아래로", "aria-label": "아래로" }, "↓");
      down.disabled = i === arr.length - 1;
      down.addEventListener("click", function () {
        arr.splice(i + 1, 0, arr.splice(i, 1)[0]);
        markDirty(); renderAll();
      });
      var del = el("button", { class: "iconbtn", type: "button", title: "삭제", "aria-label": "삭제" }, "✕");
      del.addEventListener("click", function () {
        if (arr.length <= (cfg.min || 0)) {
          setStatus("최소 " + cfg.min + "개는 남겨야 합니다.", "warn");
          return;
        }
        if (!confirm("이 항목을 삭제할까요? (저장 전까지는 되돌릴 수 있습니다)")) return;
        arr.splice(i, 1);
        markDirty(); renderAll();
      });
      tools.appendChild(up); tools.appendChild(down); tools.appendChild(del);
      head.appendChild(tools);
      box.appendChild(head);

      var fields = el("div", { class: "fields" });
      cfg.cols.forEach(function (c) {
        if (c.type === "select") {
          var fw = el("label", { class: "field" });
          fw.appendChild(el("span", { class: "field__label" }, c.l));
          var sel = el("select", { class: "input" });
          c.opts.forEach(function (pair) {
            var o = el("option", { value: pair[0] }, pair[1]);
            if ((item[c.k] || "") === pair[0]) o.selected = true;
            sel.appendChild(o);
          });
          sel.addEventListener("change", function () { item[c.k] = sel.value; markDirty(); });
          fw.appendChild(sel);
          fields.appendChild(fw);
        } else if (c.type === "textarea") {
          fields.appendChild(field(c.l, item[c.k], { type: "textarea", rows: 3, onInput: function (v) { item[c.k] = v; } }));
        } else {
          fields.appendChild(field(c.l, item[c.k], { onInput: function (v) { item[c.k] = v; } }));
        }
      });
      box.appendChild(fields);
      wrap.appendChild(box);
    });

    var add = el("button", { class: "btn btn--add", type: "button" }, cfg.addLabel);
    add.addEventListener("click", function () {
      arr.push(cfg.factory());
      markDirty();
      renderAll();
      var last = $("sections").querySelector(".list:last-of-type .item:last-child");
      if (last) last.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    wrap.appendChild(add);
    return wrap;
  }

  /* ---------- 전체 렌더 ---------- */
  function renderAll() {
    var host = $("sections");
    if (!host) return;
    host.innerHTML = "";
    SECTIONS.forEach(function (sec) {
      var card = el("section", { class: "card" });
      var head = el("header", { class: "card__head" });
      var h = el("h2", null, sec.title);
      head.appendChild(h);
      var lead = el("p", { class: "card__lead" });
      lead.innerHTML = sec.lead;
      head.appendChild(lead);
      card.appendChild(head);
      try {
        sec.render(card);
      } catch (e) {
        card.appendChild(el("p", { class: "alert" }, "이 부분을 그리지 못했습니다: " + e.message));
      }
      host.appendChild(card);
    });
    updateMeta();
  }

  function updateMeta() {
    var c = state.content || {};
    var menus = (c.menu && Array.isArray(c.menu.items)) ? c.menu.items.length : 0;
    var reels = (c.showcase && Array.isArray(c.showcase.reels)) ? c.showcase.reels.length : 0;
    var photos = (c.gallery && Array.isArray(c.gallery.items)) ? c.gallery.items.length : 0;
    var meta = $("metaInfo");
    if (meta) meta.textContent = "메뉴 " + menus + " · 사진 " + photos + " · 릴스 " + reels + " · 이벤트 " + ((c.event && c.event.enabled) ? "사용" : "숨김") + " · 마지막 저장 " + fmtDate(c.updatedAt);
    var repoName = $("repoName");
    if (repoName) repoName.textContent = OWNER + "/" + REPO;
  }

  /* ---------- GitHub ---------- */
  function hdrs(token) {
    var h = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (token) h.Authorization = "Bearer " + token;
    return h;
  }
  function ghMessage(status) {
    if (status === 401) return "토큰이 유효하지 않습니다. 새 토큰으로 다시 연결해 주세요.";
    if (status === 403) return "권한이 없거나 요청 한도를 넘었습니다. 토큰의 ‘Contents: Read and write’ 권한을 확인해 주세요.";
    if (status === 404) return "저장소나 파일을 찾을 수 없습니다. 토큰의 저장소 접근 범위(" + OWNER + "/" + REPO + ")를 확인해 주세요.";
    if (status === 409) return "다른 곳에서 먼저 저장되었습니다. 다시 시도해 주세요.";
    if (status === 422) return "GitHub가 이 내용을 받아들이지 않았습니다(422). 잠시 후 다시 시도해 주세요.";
    return "GitHub 오류 (" + status + ")";
  }
  async function ghJson(url, opts) {
    var res = await fetch(url, opts);
    if (!res.ok) {
      var detail = "";
      try { var j = await res.json(); detail = j && j.message ? " — " + j.message : ""; } catch (e) {}
      var err = new Error(ghMessage(res.status) + detail);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
  async function verifyToken(token) {
    var d = await ghJson(API + "/repos/" + OWNER + "/" + REPO, { headers: hdrs(token), cache: "no-store" });
    var perm = d.permissions || {};
    if (!(perm.push || perm.admin || perm.maintain)) {
      throw new Error("이 토큰으로는 저장할 수 없습니다. Permissions → Contents: Read and write 로 다시 만들어 주세요.");
    }
    return d;
  }
  function b64encodeUtf8(str) {
    var bytes = new TextEncoder().encode(str);
    var out = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(out);
  }

  /* ---------- PIN 잠금 ---------- */
  function subtleOk() { return !!(window.crypto && window.crypto.subtle && window.isSecureContext); }
  function toB64(bytes) { return btoa(String.fromCharCode.apply(null, bytes)); }
  function fromB64(s) { var bin = atob(s); var a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  async function deriveKey(pin, salt) {
    var base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 200000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  }
  async function encryptToken(token, pin) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var key = await deriveKey(pin, salt);
    var ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(token));
    return { v: 1, salt: toB64(salt), iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
  }
  async function decryptToken(blob, pin) {
    var key = await deriveKey(pin, fromB64(blob.salt));
    var pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, key, fromB64(blob.ct));
    return new TextDecoder().decode(pt);
  }

  /* ---------- 화면 전환 ---------- */
  function showGate() {
    $("gate").hidden = false;
    $("pinGate").hidden = true;
    $("editor").hidden = true;
    $("savebar").hidden = true;
    $("lockBtn").hidden = true;
    setConn(null, "토큰 연결 전");
  }
  function showPinGate() {
    $("gate").hidden = true;
    $("pinGate").hidden = false;
    $("editor").hidden = true;
    $("savebar").hidden = true;
    $("lockBtn").hidden = true;
    setConn("warn", "PIN 잠금");
  }
  function enterEditor() {
    $("gate").hidden = true;
    $("pinGate").hidden = true;
    $("editor").hidden = false;
    $("savebar").hidden = false;
    $("lockBtn").hidden = !state.token;
    if (state.token) {
      setConn(true, "GitHub 연결됨 · 저장 가능");
      $("saveBtn").textContent = "저장 및 홈페이지 반영";
    } else {
      setConn("warn", "토큰 없이 편집 중 · 저장 불가");
      $("saveBtn").textContent = "토큰 연결하고 저장";
    }
    setStatus(state.dirty ? "저장되지 않은 변경사항이 있습니다" : "변경사항 없음", state.dirty ? "dirty" : "");
  }

  async function onConnect(ev) {
    ev.preventDefault();
    var token = $("tokenInput").value.trim();
    if (!token) { setGateAlert("토큰을 붙여넣어 주세요."); return; }
    if (!state.content || state.loadFailed) {
      setGateAlert("content.json 을 먼저 불러와야 합니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.", "warn");
      return;
    }
    setGateAlert("토큰을 확인하는 중…", "warn");
    var btn = $("gateSubmit");
    btn.disabled = true;
    try {
      var repo = await verifyToken(token);
      state.token = token;
      var remember = $("rememberToken").checked;
      var usePin = $("usePin").checked;
      if (remember && usePin) {
        if (!subtleOk()) throw new Error("이 브라우저에서는 PIN 잠금을 쓸 수 없습니다. 일반 저장을 이용해 주세요.");
        var pin = $("pinInput").value.trim();
        if (pin.length < 4) throw new Error("PIN은 4자리 이상으로 정해 주세요.");
        localStorage.setItem(KEY_TOKEN_PIN, JSON.stringify(await encryptToken(token, pin)));
        localStorage.removeItem(KEY_TOKEN);
      } else if (remember) {
        localStorage.setItem(KEY_TOKEN, token);
        localStorage.removeItem(KEY_TOKEN_PIN);
      } else {
        localStorage.removeItem(KEY_TOKEN);
        localStorage.removeItem(KEY_TOKEN_PIN);
      }
      setGateAlert("");
      enterEditor();
      setStatus(remember ? "연결되었습니다. 이제 문구를 고치고 저장하세요." : "연결되었습니다. (이 브라우저에는 저장하지 않음)", "ok");
      setConn(true, "GitHub 연결됨 · " + (repo.full_name || (OWNER + "/" + REPO)));
    } catch (err) {
      state.token = null;
      setGateAlert(err.message || String(err));
    } finally {
      btn.disabled = false;
    }
  }

  async function onPinUnlock(ev) {
    ev.preventDefault();
    var pin = $("pinUnlock").value.trim();
    var box = $("pinAlert");
    box.hidden = true;
    var raw = localStorage.getItem(KEY_TOKEN_PIN);
    if (!raw) { showGate(); return; }
    try {
      var token = await decryptToken(JSON.parse(raw), pin);
      await verifyToken(token);
      state.token = token;
      enterEditor();
      setStatus("PIN 잠금이 풀렸습니다.", "ok");
    } catch (e) {
      box.hidden = false;
      box.className = "alert";
      box.textContent = "PIN이 맞지 않거나 토큰이 만료되었습니다. 다시 시도해 주세요.";
    }
  }

  function logout() {
    if (!confirm("이 브라우저에서 토큰을 지울까요? 다시 저장하려면 토큰을 새로 넣어야 합니다.")) return;
    try {
      localStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_TOKEN_PIN);
    } catch (e) {}
    state.token = null;
    $("tokenInput").value = "";
    showGate();
    setGateAlert("토큰을 지웠습니다.", "ok");
  }

  /* ---------- 검증 · 저장 ---------- */
  function validate() {
    var p = [];
    var ch = state.content.channels || {};
    [["kakao", "카카오톡"], ["book-brow", "네이버 예약(반영구)"], ["book-lash", "네이버 예약(속눈썹펌)"],
     ["naver", "네이버 플레이스"], ["instagram", "인스타그램"]].forEach(function (pair) {
      var v = (ch[pair[0]] || "").trim();
      if (!v) p.push(pair[1] + " 주소가 비어 있습니다.");
      else if (!/^https?:\/\/\S+$/i.test(v)) p.push(pair[1] + " 주소가 http(s):// 로 시작하지 않습니다.");
    });
    var phone = (ch.phone || "").trim();
    if (phone && !/^tel:[+0-9-]+$/.test(phone)) p.push("전화 링크는 tel:050713588172 형식이어야 합니다.");
    var items = (state.content.menu && state.content.menu.items) || [];
    if (!items.length) p.push("시그니처 메뉴가 하나도 없습니다.");
    items.forEach(function (it, i) {
      if (!(it.name || "").trim()) p.push("메뉴 " + (i + 1) + "의 이름이 비어 있습니다.");
    });
    ((state.content.showcase && state.content.showcase.reels) || []).forEach(function (r, i) {
      if (r.url && !/^https?:\/\/\S+$/i.test(r.url.trim())) p.push("릴스 " + (i + 1) + "의 주소를 확인해 주세요.");
    });
    var ev = state.content.event || {};
    if (ev.enabled === true) {
      if (!(ev.title || "").trim()) p.push("이벤트 제목이 비어 있습니다. 제목을 채우거나 ‘사용 안 함’으로 바꿔 주세요.");
      if (!(ev.barText || "").trim()) p.push("이벤트 상단 공지바 문구가 비어 있습니다.");
    }
    return p;
  }

  async function fetchRemoteJson() {
    return ghJson(API + "/repos/" + OWNER + "/" + REPO + "/contents/" + FILE_PATH + "?ref=" + encodeURIComponent(BRANCH),
      { headers: hdrs(state.token), cache: "no-store" });
  }

  async function save() {
    if (state.saving) return;
    if (!state.token) {
      $("gate").hidden = false;
      $("editor").hidden = true;
      $("savebar").hidden = true;
      $("gate").scrollIntoView({ behavior: "smooth", block: "start" });
      setGateAlert("저장하려면 먼저 토큰을 연결해 주세요.", "warn");
      return;
    }
    var problems = validate();
    if (problems.length) {
      setStatus("확인해 주세요: " + problems[0] + (problems.length > 1 ? " 외 " + (problems.length - 1) + "건" : ""), "bad");
      return;
    }

    state.saving = true;
    var btn = $("saveBtn");
    btn.disabled = true;
    var oldLabel = btn.textContent;
    btn.textContent = "저장 중…";
    setStatus("GitHub에 저장하는 중…", "");

    var updatedAt = nowISO();
    state.content.updatedAt = updatedAt;
    var json = JSON.stringify(state.content, null, 2) + "\n";

    try {
      var sha = null;
      for (var attempt = 0; attempt < 2 && !sha; attempt++) {
        try {
          var remote = await fetchRemoteJson();
          sha = remote.sha;
        } catch (e) {
          if (e.status === 404) { sha = undefined; break; }
          throw e;
        }
      }

      var body = {
        message: "홈페이지 문구·가격 수정 (관리자 페이지 " + new Date().toISOString().slice(0, 10) + ")",
        content: b64encodeUtf8(json),
        branch: BRANCH
      };
      if (sha) body.sha = sha;

      var res = await fetch(API + "/repos/" + OWNER + "/" + REPO + "/contents/" + FILE_PATH, {
        method: "PUT",
        headers: Object.assign(hdrs(state.token), { "Content-Type": "application/json" }),
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        var j = null;
        try { j = await res.json(); } catch (e) {}
        throw new Error(ghMessage(res.status) + (j && j.message ? " — " + j.message : ""));
      }
      var out = await res.json();
      state.sha = out && out.content ? out.content.sha : null;
      state.pristine = clone(state.content);
      state.dirty = false;
      try { localStorage.setItem(KEY_CONTENT_V, String(Date.now())); } catch (e) {}

      setStatus("GitHub 저장 완료 · 홈페이지에 반영되는 중입니다 (보통 30~60초)…", "");
      var secs = await waitLive(updatedAt);
      if (secs) setStatus("홈페이지에 반영되었습니다 (" + secs + "초). 홈페이지를 새로고침해 확인해 보세요.", "ok");
      else setStatus("GitHub 저장은 끝났습니다. 홈페이지 반영은 아직 확인되지 않았습니다 — 1~2분 뒤 새로고침해 보세요.", "warn");
    } catch (err) {
      state.content.updatedAt = (state.pristine && state.pristine.updatedAt) || "";
      setStatus(err.message || "저장에 실패했습니다.", "bad");
    } finally {
      state.saving = false;
      btn.disabled = false;
      btn.textContent = oldLabel;
    }
  }

  async function waitLive(updatedAt) {
    for (var i = 1; i <= 20; i++) {
      await sleep(6000);
      try {
        var r = await fetch(LIVE + "?t=" + Date.now(), { cache: "no-store" });
        if (r.ok) {
          var d = await r.json();
          if (d && d.updatedAt === updatedAt) return i * 6;
        }
      } catch (e) {}
      if (i % 3 === 0) setStatus("홈페이지 반영 확인 중… (" + (i * 6) + "초)", "");
    }
    return 0;
  }

  /* ---------- 백업 · 복원 ---------- */
  function download() {
    var json = JSON.stringify(state.content, null, 2) + "\n";
    var blob = new Blob([json], { type: "application/json" });
    var a = el("a", { href: URL.createObjectURL(blob), download: "content.json" });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function upload(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        state.content = normalize(data);
        state.dirty = true;
        renderAll();
        setStatus("파일을 불러왔습니다. 내용을 확인한 뒤 ‘저장 및 홈페이지 반영’을 누르세요.", "warn");
      } catch (e) {
        setStatus("JSON 파일을 읽지 못했습니다: " + e.message, "bad");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  /* ---------- 데이터 정규화 ---------- */
  function normalize(c) {
    c = (c && typeof c === "object") ? c : {};
    ["site", "notice", "event", "hero", "visit", "channels", "menu", "about", "showcase", "gallery", "price", "reserve", "footer"]
      .forEach(function (k) {
        if (typeof c[k] !== "object" || c[k] === null) c[k] = {};
      });
    if (typeof c.event.enabled !== "boolean") {
      if (c.event.enabled === "true") c.event.enabled = true;
      else if (c.event.enabled === "false") c.event.enabled = false;
      else c.event.enabled = !!(c.event.title || "").trim();
    }
    if (typeof c.event.until !== "string") c.event.until = "";
    if (!Array.isArray(c.stats)) c.stats = [];
    if (!Array.isArray(c.menu.items)) c.menu.items = [];
    if (!Array.isArray(c.about.pillars)) c.about.pillars = [];
    if (!Array.isArray(c.showcase.reels)) c.showcase.reels = [];
    if (!Array.isArray(c.gallery.items)) c.gallery.items = [];
    if (!Array.isArray(c.price.groups)) c.price.groups = [];
    if (!Array.isArray(c.reserve.steps)) c.reserve.steps = [];
    c.price.groups.forEach(function (g) {
      if (!Array.isArray(g.items)) g.items = [];
    });
    if (typeof c.updatedAt !== "string") c.updatedAt = "";
    if (typeof c.version !== "number") c.version = 1;
    return c;
  }

  async function loadContent() {
    var res = await fetch("../" + FILE_PATH + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return normalize(await res.json());
  }

  /* ---------- 이벤트 ---------- */
  function bind() {
    $("gateForm").addEventListener("submit", onConnect);
    $("pinForm").addEventListener("submit", onPinUnlock);
    $("gateSkip").addEventListener("click", function () {
      state.token = null;
      enterEditor();
      setStatus("토큰 없이 편집 중입니다. 저장하려면 토큰을 연결해 주세요.", "warn");
    });
    $("pinReset").addEventListener("click", function () {
      localStorage.removeItem(KEY_TOKEN_PIN);
      showGate();
    });
    $("lockBtn").addEventListener("click", logout);
    $("usePin").addEventListener("change", function () {
      $("pinInput").disabled = !this.checked;
      if (this.checked) $("pinInput").focus();
    });
    $("rememberToken").addEventListener("change", function () {
      if (!this.checked) { $("usePin").checked = false; $("pinInput").disabled = true; }
    });

    $("saveBtn").addEventListener("click", save);
    $("revertBtn").addEventListener("click", function () {
      if (!state.pristine) return;
      if (!confirm("저장하지 않은 변경사항을 모두 버리고 마지막으로 불러온 상태로 돌아갈까요?")) return;
      state.content = clone(state.pristine);
      state.dirty = false;
      renderAll();
      setStatus("되돌렸습니다.", "");
    });
    $("downloadBtn").addEventListener("click", download);
    $("uploadInput").addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (f) upload(f);
      this.value = "";
    });
    $("reloadBtn").addEventListener("click", async function () {
      if (state.dirty && !confirm("저장하지 않은 변경사항이 사라집니다. 계속할까요?")) return;
      try {
        var c = await loadContent();
        state.content = c;
        state.pristine = clone(c);
        state.dirty = false;
        renderAll();
        setStatus("GitHub의 최신 내용을 다시 불러왔습니다.", "ok");
      } catch (e) {
        setStatus(e.message, "bad");
      }
    });

    window.addEventListener("beforeunload", function (e) {
      if (!state.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  async function init() {
    bind();
    try {
      state.content = await loadContent();
      state.pristine = clone(state.content);
    } catch (e) {
      state.loadFailed = true;
      document.body.insertAdjacentHTML("afterbegin", '<div class="alert" style="margin:16px">content.json 을 불러오지 못했습니다. (' + e.message + ") 페이지를 새로고침해 주세요.</div>");
      showGate();
      $("gateSkip").hidden = true;
      return;
    }
    renderAll();

    var plain = null, pinRaw = null;
    try {
      plain = localStorage.getItem(KEY_TOKEN);
      pinRaw = localStorage.getItem(KEY_TOKEN_PIN);
    } catch (e) {}

    if (plain) {
      state.token = plain;
      enterEditor();
      verifyToken(plain)
        .then(function (repo) { setConn(true, "GitHub 연결됨 · " + (repo.full_name || REPO)); })
        .catch(function () {
          state.token = null;
          setConn(false, "토큰이 만료되었습니다 — 다시 연결해 주세요");
          showGate();
          setGateAlert("저장된 토큰이 만료되었거나 권한이 없습니다. 새 토큰을 넣어 주세요.");
        });
    } else if (pinRaw) {
      showPinGate();
      setTimeout(function () { $("pinUnlock").focus(); }, 80);
    } else {
      showGate();
    }
  }

  init();
})();
