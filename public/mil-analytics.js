/*! MIL Digital first-party analytics — privacy-friendly, no cookies, no fingerprinting.
 *  Records: page views, sessions, referrer/UTM, clicks & hovers on [data-analytics-id] elements
 *  (position only), element exposure, scroll depth, time per section and HTML5 video playback.
 *  Never records: typed text, form values, page text, IP address, raw mouse movement.
 *  Docs: docs/ANALYTICS.md
 */
(function () {
  "use strict";
  var w = window, d = document;
  if (w.__milAnalytics) return; // single initialisation (no double counting)
  var script = d.currentScript || d.querySelector("script[data-mil-analytics]");
  if (!script) return;

  /* ------------------------------------------------------------------ config */
  var ENDPOINT = script.getAttribute("data-endpoint") || "/api/collect";
  var CONSENT_MODE = script.getAttribute("data-consent") || "none"; // none | notice | opt-in
  var LAYOUT = script.getAttribute("data-layout") || "";
  var SESSION_TIMEOUT = 30 * 60 * 1000;
  var FLUSH_MS = 10000;
  var HOVER_MIN = 500, HOVER_MAX = 30000;
  var MAX_CLICKS = 200, MAX_HOVERS_PER_EL = 20, MAX_QUEUE = 400;
  var K = { vid: "mil_a_vid", sess: "mil_a_sess", consent: "mil_a_consent", internal: "mil_a_internal", queue: "mil_a_queue" };

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { params = { get: function () { return null; } }; }

  // Internal traffic switch: ?mil_internal=1 (persists on this browser), ?mil_internal=0 to undo.
  if (params.get("mil_internal") === "1") ls(K.internal, "1");
  if (params.get("mil_internal") === "0") ls(K.internal, null);
  if (params.get("mil_consent") === "reset") ls(K.consent, null);

  var api = {
    consent: function (granted) { setConsent(granted ? "granted" : "denied"); },
    openConsent: function () { showBanner(true); },
    visitorId: function () { return ls(K.vid); },
  };
  w.__milAnalytics = api;
  w.milAnalytics = api;

  var dnt = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || w.doNotTrack === "1";
  var framed = false;
  try { framed = w.top !== w.self; } catch (e) { framed = true; } // CMS previews / heatmap viewer
  var automated = navigator.webdriver && ls("mil_a_allow_automation") !== "1";
  if (framed || dnt || automated || ls(K.internal) === "1" || !w.JSON || !d.querySelector) return;

  /* ------------------------------------------------------------------ consent */
  var started = false;
  function setConsent(v) {
    ls(K.consent, v + "|" + Date.now());
    hideBanner();
    if (v === "granted") start();
    else stop(true);
  }
  function consentState() {
    var c = (ls(K.consent) || "").split("|");
    if (c[0] === "denied" && Date.now() - Number(c[1] || 0) > 180 * 864e5) return null; // ask again after 6 months
    return c[0] || null;
  }

  var banner;
  function hideBanner() { if (banner) { banner.remove(); banner = null; } }
  function showBanner(force) {
    if (banner || (!force && CONSENT_MODE === "none")) return;
    banner = d.createElement("div");
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Persetujuan analytics");
    banner.setAttribute("data-mil-consent", "");
    banner.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:440px;margin:0 auto 0 0;" +
      "background:#0f1d4a;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:16px 18px;" +
      "box-shadow:0 18px 40px -12px rgba(0,0,0,.45);font:400 13.5px/1.5 'SF Pro Display',system-ui,-apple-system,sans-serif";
    var notice = CONSENT_MODE === "notice";
    banner.innerHTML =
      '<p style="margin:0 0 12px">' +
      (notice
        ? "Kami memakai analytics anonim (tanpa cookie pihak ketiga) untuk memahami cara website ini digunakan. Tidak ada data pribadi atau isi formulir yang direkam."
        : "Bolehkah kami memakai analytics anonim untuk memahami cara website ini digunakan? Tidak ada data pribadi, cookie pihak ketiga, atau isi formulir yang direkam.") +
      '</p><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" data-a="1" style="cursor:pointer;border:0;border-radius:999px;padding:8px 16px;background:#02aaed;color:#fff;font:600 13px/1 inherit">' + (notice ? "Oke" : "Izinkan") + "</button>" +
      '<button type="button" data-a="0" style="cursor:pointer;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:8px 16px;background:transparent;color:#fff;font:500 13px/1 inherit">Tolak</button></div>';
    banner.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button[data-a]");
      if (b) setConsent(b.getAttribute("data-a") === "1" ? "granted" : "denied");
    });
    (d.body || d.documentElement).appendChild(banner);
  }

  /* ------------------------------------------------------------------ ids */
  function uuid() {
    if (w.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    (w.crypto || w.msCrypto).getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = [];
    for (var i = 0; i < 16; i++) h.push((b[i] + 256).toString(16).slice(1));
    return h.slice(0, 4).join("") + "-" + h.slice(4, 6).join("") + "-" + h.slice(6, 8).join("") + "-" + h.slice(8, 10).join("") + "-" + h.slice(10).join("");
  }
  function now() { return Date.now(); }

  var vid, sess, pv, seq = 0;

  function campaignFromUrl() {
    var u = {}, any = false;
    ["source", "medium", "campaign", "content", "term"].forEach(function (k) {
      var v = params.get("utm_" + k);
      if (v) { u[k] = v.slice(0, 150); any = true; }
    });
    return any ? u : null;
  }

  function loadSession() {
    var isNewVisitor = false;
    vid = ls(K.vid);
    if (!vid || !/^[0-9a-f-]{36}$/i.test(vid)) { vid = uuid(); ls(K.vid, vid); isNewVisitor = true; }
    var s = null;
    try { s = JSON.parse(ls(K.sess) || "null"); } catch (e) { s = null; }
    var utm = campaignFromUrl();
    var ref = "";
    try { if (d.referrer && new URL(d.referrer).host !== location.host) ref = d.referrer; } catch (e) { ref = ""; }
    var pclid = params.get("gclid") || params.get("msclkid") || params.get("dclid") || params.get("gbraid") || params.get("wbraid") ? 1 : 0;
    var t = now();
    // New session: none yet, 30 min inactive, or arriving with a different campaign (GA-style).
    var expired = !s || !s.id || t - (s.last || 0) > SESSION_TIMEOUT || s.vid !== vid;
    var newCampaign = s && utm && JSON.stringify(utm) !== JSON.stringify(s.utm || null);
    if (expired || newCampaign) {
      s = { id: uuid(), vid: vid, start: t, last: t, n: (s && s.vid === vid ? (s.n || 1) + 1 : isNewVisitor ? 1 : 2),
            ref: ref.slice(0, 500), utm: utm, pclid: pclid };
    }
    s.last = t;
    sess = s;
    ls(K.sess, JSON.stringify(s));
  }
  function touchSession() {
    var t = now();
    if (t - sess.last > SESSION_TIMEOUT) {
      // Came back after 30 min on the same page: new session + new page view.
      flush(true);
      sess = null;
      loadSession();
      newPageview();
      return;
    }
    if (t - sess.last > 5000) { sess.last = t; ls(K.sess, JSON.stringify(sess)); }
  }

  /* ------------------------------------------------------------------ page view state */
  function bucket() {
    var vw = w.innerWidth || d.documentElement.clientWidth;
    return vw <= 700 ? "mobile" : vw <= 1100 ? "tablet" : "desktop";
  }
  function docH() { return Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0); }

  var queue = [], vqueue = [], elementsSeen = {}, elementsToSend = [], videos = {};
  var clicks, hoversPerEl, scrollMarks, exposed;
  var activeMs, lastTick, lastInput, maxScroll, sections;

  function newPageview() {
    pv = { id: uuid(), path: location.pathname, start: now(), layout: LAYOUT, vw: w.innerWidth, vh: w.innerHeight, bucket: bucket() };
    seq = 0; clicks = 0; hoversPerEl = {}; scrollMarks = {}; exposed = {}; elementsSeen = {}; elementsToSend = [];
    activeMs = 0; lastTick = now(); lastInput = now(); maxScroll = 0; sections = {};
    Object.keys(videos).forEach(function (k) { videos[k].reset(); });
    observeExposure();
    onScroll();
  }

  function sectionOf(el) {
    var s = el && el.closest && el.closest("[data-analytics-section]");
    return s ? s.getAttribute("data-analytics-section") : null;
  }
  function describe(el) {
    var id = el.getAttribute("data-analytics-id");
    if (!elementsSeen[id]) {
      elementsSeen[id] = 1;
      elementsToSend.push({ id: id, label: (el.getAttribute("data-analytics-label") || id).slice(0, 120),
                            section: sectionOf(el), kind: el.getAttribute("data-analytics-kind") || null });
    }
    return id;
  }
  function push(ev) {
    ev.q = ++seq; ev.t = now();
    queue.push(ev);
    if (queue.length > MAX_QUEUE) queue.shift();
    if (queue.length >= 40) flush(false);
  }

  /* ------------------------------------------------------------------ transport */
  var sending = false, backoff = 0;
  function payload(evs, ves, els) {
    var vd = Object.keys(videos).map(function (k) { return videos[k].summary(); }).filter(Boolean);
    return {
      v: 1, sentAt: now(),
      s: { id: sess.id, vid: vid, start: sess.start, ret: sess.n > 1 ? 1 : 0, ref: sess.ref, utm: sess.utm, pclid: sess.pclid },
      pv: { id: pv.id, path: pv.path, start: pv.start, layout: pv.layout, vw: pv.vw, vh: pv.vh, dh: docH(), bucket: pv.bucket,
            act: Math.round(activeMs), scr: maxScroll, sec: roundMap(sections) },
      el: els, ev: evs, vd: vd, ve: ves,
    };
  }
  function roundMap(m) { var o = {}; for (var k in m) o[k] = Math.round(m[k]); return o; }

  function flush(leaving) {
    if (!started || !pv) return;
    if (sending && !leaving) return; // the next tick sends it
    tick();
    var evs = queue.splice(0, 150), ves = vqueue.splice(0, 150);
    var sentEls = elementsToSend.splice(0, elementsToSend.length);
    var body = payload(evs, ves, sentEls);
    var json = JSON.stringify(body);
    var requeue = function () {
      queue = evs.concat(queue).slice(-MAX_QUEUE);
      vqueue = ves.concat(vqueue).slice(-MAX_QUEUE);
      elementsToSend = sentEls.concat(elementsToSend);
      backoff = Math.min((backoff || 5000) * 2, 300000);
    };
    if (leaving) {
      var ok = false;
      try { ok = navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([json], { type: "application/json" })); } catch (e) { ok = false; }
      if (!ok) {
        try { fetch(ENDPOINT, { method: "POST", body: json, keepalive: json.length < 60000, headers: { "content-type": "application/json" } }); }
        catch (e) { persist(json); }
      }
      return;
    }
    sending = true;
    fetch(ENDPOINT, { method: "POST", body: json, keepalive: json.length < 60000, headers: { "content-type": "application/json" }, credentials: "same-origin" })
      .then(function (r) {
        if (r.status === 503 || r.status === 429 || r.status >= 500) requeue(); else backoff = 0;
      })
      .catch(requeue)
      .then(function () { sending = false; });
  }
  // Failed batches survive a page change and are retried on the next page load (dedup by page view + seq).
  function persist(json) {
    try {
      var q = JSON.parse(ls(K.queue) || "[]");
      q.push(json);
      ls(K.queue, JSON.stringify(q.slice(-5)));
    } catch (e) { /* storage full */ }
  }
  function retryPersisted() {
    var q;
    try { q = JSON.parse(ls(K.queue) || "[]"); } catch (e) { q = []; }
    ls(K.queue, null);
    q.forEach(function (json) {
      fetch(ENDPOINT, { method: "POST", body: json, headers: { "content-type": "application/json" } })
        .then(function (r) { if (r.status >= 500 || r.status === 429) persist(json); })
        .catch(function () { persist(json); });
    });
  }

  /* ------------------------------------------------------------------ activity / sections / scroll */
  function visible() { return d.visibilityState === "visible"; }
  function tick() {
    var t = now(), dt = t - lastTick;
    lastTick = t;
    if (!visible() || dt <= 0 || dt > 5000 || t - lastInput > 120000) return; // idle > 2 min = not active
    activeMs += dt;
    var vh = w.innerHeight;
    var secs = d.querySelectorAll("[data-analytics-section]");
    for (var i = 0; i < secs.length; i++) {
      var r = secs[i].getBoundingClientRect();
      var overlap = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      // "in view": ≥ 30% of the section visible, or it fills ≥ 50% of the screen
      if (overlap > 0 && (overlap >= r.height * 0.3 || overlap >= vh * 0.5)) {
        var id = secs[i].getAttribute("data-analytics-section");
        sections[id] = (sections[id] || 0) + dt;
      }
    }
  }
  var scrollPending = false;
  function onScroll() {
    if (scrollPending) return;
    scrollPending = true;
    (w.requestAnimationFrame || setTimeout)(function () {
      scrollPending = false;
      var h = docH();
      var pct = Math.min(100, Math.round(((w.scrollY || w.pageYOffset) + w.innerHeight) / h * 100));
      if (pct > maxScroll) maxScroll = pct;
      [25, 50, 75, 90, 100].forEach(function (m) {
        if (maxScroll >= m && !scrollMarks[m]) { scrollMarks[m] = 1; push({ k: "scroll", v: m }); }
      });
      checkPendingExposure();
    });
  }
  function input() {
    lastInput = now();
    touchSession();
  }

  /* ------------------------------------------------------------------ exposure (CTR denominator) */
  var io, pendingExposure = [];
  function shown(el) {
    var cs = w.getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.1) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function expose(el) {
    var id = describe(el);
    if (exposed[id]) return;
    exposed[id] = 1;
    push({ k: "exposure", e: id, s: sectionOf(el) });
  }
  function checkPendingExposure() {
    if (!pendingExposure.length) return;
    pendingExposure = pendingExposure.filter(function (el) {
      if (exposed[el.getAttribute("data-analytics-id")]) return false;
      var r = el.getBoundingClientRect();
      var inView = r.bottom > 0 && r.top < w.innerHeight && r.right > 0 && r.left < w.innerWidth;
      if (inView && shown(el)) { expose(el); return false; }
      return true;
    });
  }
  function observeExposure() {
    var els = d.querySelectorAll("[data-analytics-id]");
    if (io) io.disconnect();
    pendingExposure = [];
    if (!("IntersectionObserver" in w)) {
      for (var i = 0; i < els.length; i++) pendingExposure.push(els[i]);
      return;
    }
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var el = en.target;
        if (!en.isIntersecting || en.intersectionRatio < 0.5) return;
        if (shown(el)) { expose(el); io.unobserve(el); }
        else if (pendingExposure.indexOf(el) < 0) pendingExposure.push(el); // e.g. floating button not shown yet
      });
    }, { threshold: [0.5] });
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }

  /* ------------------------------------------------------------------ clicks (position only) */
  function onClick(e) {
    if (!e.isTrusted || clicks >= MAX_CLICKS) return;
    if (banner && banner.contains(e.target)) return;
    clicks++;
    input();
    var target = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
    if (!target) return;
    var el = target.closest("[data-analytics-id]");
    var secEl = target.closest("[data-analytics-section]");
    var ev = { k: "click" };
    var vw = w.innerWidth;
    ev.sx = e.clientX / vw;
    if (secEl) {
      var sr = secEl.getBoundingClientRect();
      ev.s = secEl.getAttribute("data-analytics-section");
      ev.sy = sr.height ? (e.clientY - sr.top) / sr.height : 0;
    }
    if (el) {
      var r = el.getBoundingClientRect();
      ev.e = describe(el);
      ev.rx = r.width ? (e.clientX - r.left) / r.width : 0.5;
      ev.ry = r.height ? (e.clientY - r.top) / r.height : 0.5;
      if (w.getComputedStyle(el).position === "fixed") ev.f = 1;
      // keyboard "clicks" have no coordinates
      if (e.detail === 0 && e.clientX === 0 && e.clientY === 0) { ev.rx = 0.5; ev.ry = 0.5; delete ev.sx; delete ev.sy; }
    } else if (e.detail === 0 && e.clientX === 0 && e.clientY === 0) {
      return;
    }
    push(ev);
    // Links that leave the page (WhatsApp, mail, external): send now.
    var a = target.closest("a[href]");
    if (a && (a.target === "_blank" || /^(mailto|tel):/i.test(a.getAttribute("href") || "") || a.host !== location.host)) flush(a.target !== "_blank");
  }

  /* ------------------------------------------------------------------ hover (desktop only) */
  var canHover = w.matchMedia && w.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hoverEl = null, hoverStart = 0;
  function endHover() {
    if (!hoverEl) return;
    var dur = now() - hoverStart, id = hoverEl.getAttribute("data-analytics-id");
    if (dur >= HOVER_MIN && (hoversPerEl[id] || 0) < MAX_HOVERS_PER_EL) {
      hoversPerEl[id] = (hoversPerEl[id] || 0) + 1;
      push({ k: "hover", e: describe(hoverEl), s: sectionOf(hoverEl), v: Math.min(dur, HOVER_MAX) });
    }
    hoverEl = null;
  }
  function onOver(e) {
    if (e.pointerType && e.pointerType !== "mouse") return;
    var el = e.target && e.target.closest ? e.target.closest("[data-analytics-id]") : null;
    if (el === hoverEl) return;
    endHover();
    if (el) { hoverEl = el; hoverStart = now(); }
    lastInput = now();
  }

  /* ------------------------------------------------------------------ HTML5 video */
  function trackVideo(v) {
    var host = v.closest("[data-analytics-video]") || v;
    var id = host.getAttribute("data-analytics-video") || v.getAttribute("data-analytics-video");
    if (!id || videos[id]) return;
    var st;
    function reset() {
      st = { ft: 0, imp: 0, pl: 0, w: 0, fu: 0, d: 0, c: 0, last: null, marks: {}, seekingTimer: 0, everPlayed: false, wasEnded: false };
    }
    reset();
    var vev = function (k, extra) {
      vqueue.push({ q: ++seq, t: now(), id: id, k: k, p: Math.round((v.currentTime || 0) * 1000) });
      if (vqueue.length > MAX_QUEUE) vqueue.shift();
      if (extra) flush(false);
    };
    var dur = function () { return isFinite(v.duration) && v.duration > 0 ? v.duration : 0; };
    function milestones() {
      var D = dur(), watched = st.w / 1000;
      var M = st.marks;
      if (watched >= 3 && !M.m3s) { M.m3s = 1; vev("m3s"); }
      if (watched >= 10 && !M.m10s) { M.m10s = 1; vev("m10s"); }
      // ThruPlay (Meta definition): ≥ 15 s watched, or watched to completion when the video is shorter than 15 s.
      if (!M.thruplay && (watched >= 15 || (st.c && D > 0 && D < 15))) { M.thruplay = 1; vev("thruplay"); }
      if (D > 0) {
        var p = st.fu / 1000 / D;
        [[0.25, "p25"], [0.5, "p50"], [0.75, "p75"], [0.95, "p95"]].forEach(function (m) {
          if (p >= m[0] && !M[m[1]]) { M[m[1]] = 1; vev(m[1]); }
        });
      }
    }
    v.addEventListener("loadedmetadata", function () { st.d = Math.round(dur() * 1000); }, { passive: true });
    v.addEventListener("play", function () {
      if (!st.ft) st.ft = now();
      input();
      st.d = Math.round(dur() * 1000) || st.d;
      if (!st.everPlayed || st.wasEnded) { st.pl++; vev("play"); } else vev("resume");
      st.everPlayed = true; st.wasEnded = false;
      st.last = v.currentTime;
    }, { passive: true });
    v.addEventListener("timeupdate", function () {
      if (v.paused || v.seeking) { st.last = v.currentTime; return; }
      var t = v.currentTime, delta = st.last === null ? 0 : t - st.last;
      var rate = v.playbackRate || 1;
      // only count real playback: small positive steps (seeks / jumps are excluded)
      if (delta > 0 && delta <= 1.5 * rate) {
        st.w += delta * 1000;
        if (t * 1000 > st.fu) st.fu = Math.round(t * 1000);
      }
      st.last = t;
      milestones();
    }, { passive: true });
    v.addEventListener("pause", function () { if (!v.ended && st.everPlayed) vev("pause"); st.last = v.currentTime; }, { passive: true });
    v.addEventListener("seeking", function () {
      clearTimeout(st.seekingTimer);
      st.seekingTimer = setTimeout(function () { if (st.everPlayed) vev("seek"); }, 300);
    }, { passive: true });
    v.addEventListener("seeked", function () { st.last = v.currentTime; }, { passive: true });
    v.addEventListener("ended", function () {
      var D = dur();
      if (D) st.fu = Math.max(st.fu, Math.round(D * 1000));
      st.c = 1; st.wasEnded = true;
      milestones();
      vev("complete", true);
    }, { passive: true });
    if ("IntersectionObserver" in w) {
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting && es[0].intersectionRatio >= 0.5 && !st.imp) { st.imp = 1; if (!st.ft) st.ft = now(); }
      }, { threshold: [0.5] }).observe(host);
    }
    videos[id] = {
      reset: reset,
      exit: function () { if (st.everPlayed && !st.c && !st.marks.exit) { st.marks.exit = 1; vev("exit"); } },
      summary: function () {
        if (!st.imp && !st.pl) return null;
        return { id: id, ft: st.ft || now(), imp: st.imp, pl: st.pl, w: Math.round(st.w), fu: st.fu, d: st.d || Math.round(dur() * 1000), c: st.c };
      },
    };
  }

  /* ------------------------------------------------------------------ lifecycle */
  var timer;
  function onHide() {
    if (d.visibilityState === "hidden") {
      endHover();
      flush(true);
    } else {
      lastTick = now();
      touchSession();
    }
  }
  function onPageHide() {
    endHover();
    Object.keys(videos).forEach(function (k) { videos[k].exit(); });
    flush(true);
  }
  function start() {
    if (started) return;
    started = true;
    loadSession();
    var vids = d.querySelectorAll("video");
    for (var i = 0; i < vids.length; i++) trackVideo(vids[i]);
    newPageview();
    retryPersisted();
    var opt = { passive: true, capture: true };
    d.addEventListener("click", onClick, opt);
    w.addEventListener("scroll", onScroll, { passive: true });
    w.addEventListener("resize", onScroll, { passive: true });
    if (canHover) d.addEventListener("pointerover", onOver, opt);
    ["keydown", "pointerdown", "touchstart"].forEach(function (t) { d.addEventListener(t, input, opt); });
    d.addEventListener("visibilitychange", onHide);
    w.addEventListener("pagehide", onPageHide);
    var lastFlush = now();
    timer = setInterval(function () {
      tick();
      // every FLUSH_MS while the tab is visible (page-view time & scroll stay current), slower after errors
      if (visible() && now() - lastFlush >= Math.max(FLUSH_MS, backoff)) { lastFlush = now(); flush(false); }
    }, 1000);
    // first batch quickly so the page view is counted even on very short visits
    setTimeout(function () { flush(false); }, 1500);
  }
  function stop(clear) {
    if (timer) clearInterval(timer);
    started = false;
    queue = []; vqueue = [];
    if (clear) { ls(K.vid, null); ls(K.sess, null); ls(K.queue, null); } // refusing removes the pseudonymous id
    d.removeEventListener("click", onClick, true);
    d.removeEventListener("pointerover", onOver, true);
  }

  function init() {
    var c = consentState();
    if (c === "denied") return;
    if (c === "granted" || CONSENT_MODE === "none") return start();
    if (CONSENT_MODE === "notice") { start(); showBanner(); return; }
    showBanner(); // opt-in: nothing is stored or sent until "Izinkan"
  }
  var idle = w.requestIdleCallback || function (f) { setTimeout(f, 200); };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", function () { idle(init); });
  else idle(init);
})();
