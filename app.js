(() => {
  "use strict";

  /* SECURITY: the Pollinations key lives SERVER-SIDE only (POLLINATIONS_API_KEY
     env var in .env → server.js / Netlify function). Browser code never sends it.
     The flow is: proxy (/api/generate) → free tier (no key) → real error message.
     Set api AND anonEndpoint to "" to run offline Demo mode.

     AUTH: leave supabase empty → per-browser local auth (Phase-1 demo).
     Fill url + anonKey (Supabase project → Settings → API) to get cross-browser
     login, Google/Apple OAuth and history sync. Run supabase/schema.sql once.
     window.PRISMLEXI_CONFIG overrides anything here (used for testing/deploy). */
  const CONFIG = Object.assign(
    {
      api: "api/generate", // server proxy (node server.js locally, Netlify function in prod)
      anonEndpoint: "https://image.pollinations.ai", // free tier, no key, direct probe fallback
      paidEndpoint: "https://gen.pollinations.ai", // used only by the server proxy
      anonModel: "flux",
      model: "tongyi-mai/z-image-turbo",
      editModel: "kontext",
      supabase: {
        url: "https://owdrhpymnfknzzgdzcqv.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZHJocHltbmZrbnp6Z2R6Y3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjI2NzIsImV4cCI6MjEwNjIzODY3Mn0.jTaIA2iMdS9_MPkn8dMUyOxVmydhSVv7Cg4NZ_nP28Y"
      }
    },
    window.PRISMLEXI_CONFIG || {}
  );

  // Supabase client (null → local auth fallback)
  const SB = (() => {
    const c = CONFIG.supabase || {};
    if (!c.url || !c.anonKey) return null;
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.warn("PrismLexi: supabase-js not loaded — auth will show an error instead of local fallback.");
      return null;
    }
    try {
      return window.supabase.createClient(c.url, c.anonKey);
    } catch (e) {
      console.warn("PrismLexi: supabase init failed.", e);
      return null;
    }
  })();

  const CAME_FOR_RECOVERY = /type=recovery/.test(String(location.hash || ""));

  const SIZES = {
    "1/1": [1024, 1024],
    "4/5": [896, 1120],
    "16/9": [1344, 768],
    "9/16": [768, 1344]
  };

  const PREFS_KEY = "prismlexi.prefs.v1";
  const SESSION_KEY = "prismlexi.session.v1";
  const ACCOUNTS_KEY = "prismlexi.accounts.v1";
  const MAX_HISTORY = 40;

  const STATUS = [
    "Waking the diffusion engine…",
    "Parsing prompt & style tokens…",
    "Composing light and shadow…",
    "Rendering liquid detail layers…",
    "Polishing highlights…",
    "Finalizing your canvas…"
  ];

  const $ = (id) => document.getElementById(id);
  const E = {
    app: $("app"),
    sidebar: $("sidebar"),
    sideToggle: $("sideToggle"),
    sideToggleMobile: $("sideToggleMobile"),
    sideBackdrop: $("sideBackdrop"),
    clearHistory: $("clearHistory"),
    historyList: $("historyList"),
    historyEmpty: $("historyEmpty"),
    stageScroll: $("stageScroll"),
    welcome: $("welcome"),
    suggestRow: $("suggestRow"),
    viewer: $("viewer"),
    canvasCard: $("canvasCard"),
    viewerImg: $("viewerImg"),
    renderArt: $("renderArt"),
    viewerLoading: $("viewerLoading"),
    loadingStatus: $("loadingStatus"),
    loadingBar: $("loadingBar"),
    loadingPct: $("loadingPct"),
    viewerMeta: $("viewerMeta"),
    metaPrompt: $("metaPrompt"),
    metaSeed: $("metaSeed"),
    metaModel: $("metaModel"),
    metaTime: $("metaTime"),
    editToolbar: $("editToolbar"),
    btnMakeChanges: $("btnMakeChanges"),
    btnFilter: $("btnFilter"),
    btnUseBase: $("btnUseBase"),
    btnDownload: $("btnDownload"),
    btnDelete: $("btnDelete"),
    filterTray: $("filterTray"),
    attachChip: $("attachChip"),
    attachThumb: $("attachThumb"),
    attachName: $("attachName"),
    attachRemove: $("attachRemove"),
    attachBtn: $("attachBtn"),
    composer: $("composer"),
    prompt: $("prompt"),
    generateBtn: $("generateBtn"),
    styleSelect: $("styleSelect"),
    ratioSelect: $("ratioSelect"),
    qualitySelect: $("qualitySelect"),
    modelSelect: $("modelSelect"),
    promptCount: $("promptCount"),
    newChatBtn: $("newChatBtn"),
    baseNote: $("baseNote"),
    fileInput: $("fileInput"),
    toast: $("toast"),
    welcomeName: $("welcomeName"),
    topLoginBtn: $("topLoginBtn"),
    profileBtn: $("profileBtn"),
    profileWrap: $("profileWrap"),
    profileMenu: $("profileMenu"),
    avatarInitials: $("avatarInitials"),
    profileName: $("profileName"),
    profilePlan: $("profilePlan"),
    menuInitials: $("menuInitials"),
    menuName: $("menuName"),
    menuEmail: $("menuEmail"),
    miAccount: $("miAccount"),
    miCredits: $("miCredits"),
    miLogout: $("miLogout"),
    miLogoutLabel: $("miLogoutLabel"),
    authOverlay: $("authOverlay"),
    authBackdrop: $("authBackdrop"),
    authClose: $("authClose"),
    authViews: $("authViews"),
    authTabs: $("authTabs"),
    authTitle: $("authTitle"),
    authSub: $("authSub"),
    authForm: $("authForm"),
    nameGroup: $("nameGroup"),
    authName: $("authName"),
    authEmail: $("authEmail"),
    authPass: $("authPass"),
    passToggle: $("passToggle"),
    authPass2: $("authPass2"),
    emailGroup: $("emailGroup"),
    passGroup: $("passGroup"),
    pass2Group: $("pass2Group"),
    authLinks: $("authLinks"),
    forgotLink: $("forgotLink"),
    authBack: $("authBack"),
    formError: $("formError"),
    authSubmit: $("authSubmit"),
    authSubmitLabel: $("authSubmitLabel"),
    btnGoogle: $("btnGoogle"),
    btnApple: $("btnApple"),
    btnGuest: $("btnGuest"),
    accountView: $("accountView"),
    creditsView: $("creditsView"),
    acctInitials: $("acctInitials"),
    acctName: $("acctName"),
    acctEmail: $("acctEmail"),
    acctPlan: $("acctPlan"),
    acctSince: $("acctSince"),
    acctProvider: $("acctProvider"),
    acctCloseBtn: $("acctCloseBtn"),
    acctLogoutBtn: $("acctLogoutBtn"),
    upgradeBtn: $("upgradeBtn"),
    creditsCloseBtn: $("creditsCloseBtn"),
    editOverlay: $("editOverlay"),
    editBackdrop: $("editBackdrop"),
    editProject: $("editProject"),
    editPrompt: $("editPrompt"),
    editError: $("editError"),
    editSave: $("editSave"),
    editCancel: $("editCancel")
  };

  const state = {
    history: [],
    currentId: null,
    base: null,
    filter: "none",
    busy: false,
    style: "Cinematic",
    ratio: "1/1",
    quality: "High",
    model: "tongyi-mai/z-image-turbo",
    session: null,
    authMode: "login",
    lastError: "",
    editNeedsServer: false,
    editingId: null
  };

  /* ---------- utils ---------- */

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isMobile = () => window.matchMedia("(max-width: 980px)").matches;
  const currentItem = () => state.history.find((i) => i.id === state.currentId) || null;

  let toastTimer;
  function toast(msg) {
    E.toast.textContent = msg;
    E.toast.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => E.toast.classList.remove("is-show"), 2800);
  }

  function timeAgo(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }

  function autoGrow() {
    E.prompt.style.height = "auto";
    E.prompt.style.height = Math.min(170, E.prompt.scrollHeight) + "px";
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        if (file.size <= 1200000) return resolve(reader.result);
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const max = 1400;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#0b0a12";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.88));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function srcToFile(src, name) {
    const res = await fetch(src);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    return new File([blob], name || "base.jpg", { type: blob.type || "image/jpeg" });
  }

  function probeImage(src, timeout = 75000) {
    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        resolve(ok);
      };
      const guard = setTimeout(() => done(false), timeout);
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = src;
    });
  }

  /* ---------- history (per-account namespaces) ---------- */

  // Legacy global key (pre account-scoping) — migrated into the first
  // namespace that loads, then removed.
  const HISTORY_KEY = "prismlexi.history.v1";

  function historyKey() {
    const who = state.session && state.session.email ? state.session.email : "guest";
    return HISTORY_KEY + "::" + who;
  }

  function loadHistory() {
    try {
      let raw = localStorage.getItem(historyKey());
      if (raw === null) {
        const legacy = localStorage.getItem(HISTORY_KEY);
        if (legacy !== null) {
          raw = legacy;
          try {
            localStorage.setItem(historyKey(), legacy);
            localStorage.removeItem(HISTORY_KEY);
          } catch (e) {}
        }
      }
      const list = raw ? JSON.parse(raw) : [];
      state.history = Array.isArray(list) ? list.filter((i) => i && i.id) : [];
    } catch (e) {
      state.history = [];
    }
  }

  function persistHistory() {
    let list = state.history.slice(0, MAX_HISTORY);
    for (;;) {
      try {
        localStorage.setItem(historyKey(), JSON.stringify(list));
        pushHistoryRemote();
        return;
      } catch (e) {
        if (list.length > 6) list.pop();
        else {
          try {
            localStorage.removeItem(historyKey());
          } catch (e2) {}
          return;
        }
      }
    }
  }

  function reloadAccountData() {
    loadHistory();
    state.currentId = null;
    clearBase();
    renderHistory();
    if (state.history.length) showItem(state.history[0]);
    else setViewerMode("welcome");
    pullHistoryRemote();
  }

  /* Supabase history sync — debounced upsert of this account's list */
  let historyPushTimer = null;

  function pushHistoryRemote() {
    if (!SB || !state.session || !state.session.id) return;
    clearTimeout(historyPushTimer);
    historyPushTimer = setTimeout(() => {
      try {
        const res = SB.from("prismlexi_history").upsert({
          user_id: state.session.id,
          items: state.history.slice(0, MAX_HISTORY),
          updated_at: new Date().toISOString()
        });
        if (res && typeof res.then === "function") {
          res.then((r) => {
            if (r && r.error) console.warn("PrismLexi: history sync failed:", r.error.message || r.error);
          });
        }
      } catch (e) {
        console.warn("PrismLexi: history sync failed:", e);
      }
    }, 1200);
  }

  function pullHistoryRemote() {
    if (!SB || !state.session || !state.session.id) return;
    try {
      const req = SB.from("prismlexi_history").select("items").eq("user_id", state.session.id).maybeSingle();
      if (!req || typeof req.then !== "function") return;
      req.then((res) => {
        if (!res || res.error || !state.session) {
          if (res && res.error) console.warn("PrismLexi: history pull failed:", res.error.message || res.error);
          return;
        }
        const remote = res.data && Array.isArray(res.data.items)
          ? res.data.items.filter((i) => i && i.id)
          : null;

        if (!remote) {
          if (state.history.length) pushHistoryRemote(); // seed remote with local data
          return;
        }

        const remoteIds = new Set(remote.map((i) => i.id));
        const merged = remote.concat(state.history.filter((i) => !remoteIds.has(i.id))).slice(0, MAX_HISTORY);
        if (JSON.stringify(merged) === JSON.stringify(state.history)) return;

        state.history = merged;
        persistHistory();
        renderHistory();
        if (state.history.length) {
          if (!state.currentId || !state.history.some((i) => i.id === state.currentId)) showItem(state.history[0]);
        } else {
          setViewerMode("welcome");
        }
      });
    } catch (e) {
      console.warn("PrismLexi: history pull failed:", e);
    }
  }

  function loadPrefs() {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      if (prefs.collapsed && !isMobile()) E.app.classList.add("is-collapsed");
    } catch (e) {}
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ collapsed: E.app.classList.contains("is-collapsed") }));
    } catch (e) {}
  }

  function addItem(item) {
    state.history.unshift(item);
    if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
    persistHistory();
    renderHistory();
  }

  function titleCase(w) {
    return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  }

  function deriveProjectName(text) {
    const clean = String(text || "")
      .replace(/[^\w\s,-]/g, " ")
      .replace(/[,-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return "Untitled Project";
    const words = clean.split(" ").slice(0, 4);
    const name = words.map(titleCase).join(" ");
    return name.length > 42 ? name.slice(0, 42).trim() + "…" : name;
  }

  function prettyFileName(name) {
    const base = String(name || "file").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    if (!base) return "Uploaded File";
    const words = base.split(" ").slice(0, 5).map(titleCase).join(" ");
    return words.length > 42 ? words.slice(0, 42).trim() + "…" : words;
  }

  function projectFor(item) {
    if (item.project) return item.project;
    return item.type === "upload" ? prettyFileName(item.name) : deriveProjectName(item.prompt);
  }

  const PENCIL_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4.5-1L19 8.5a2.1 2.1 0 0 0-3-3L5.5 16 4 20z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14.5 7l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
  const TRASH_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5.4A1.4 1.4 0 0 1 11.4 4h1.2A1.4 1.4 0 0 1 14 5.4V7m-8 0l.9 11.2A1.8 1.8 0 0 0 8.7 20h6.6a1.8 1.8 0 0 0 1.8-1.8L18 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function renderHistory() {
    E.historyList.querySelectorAll(".history-item").forEach((n) => n.remove());
    E.historyEmpty.hidden = state.history.length > 0;

    let backfilled = false;
    state.history.forEach((item) => {
      if (!item.project) {
        item.project = projectFor(item);
        backfilled = true;
      }

      const wrap = document.createElement("div");
      wrap.className = "history-item" + (item.id === state.currentId ? " is-active" : "");
      wrap.dataset.id = item.id;

      const main = document.createElement("button");
      main.type = "button";
      main.className = "h-main";

      const thumb = document.createElement("img");
      thumb.className = "h-thumb";
      thumb.src = item.url || "";
      thumb.alt = "";
      thumb.loading = "lazy";

      const text = document.createElement("span");
      text.className = "h-text";

      const title = document.createElement("span");
      title.className = "h-title";
      title.textContent = item.project;

      const promptLine = document.createElement("span");
      promptLine.className = "h-prompt";
      promptLine.textContent = item.prompt || "Untitled render";

      const meta = document.createElement("span");
      meta.className = "h-meta";
      meta.textContent = (item.type === "upload" ? "upload" : "render") + " · " + timeAgo(item.ts || Date.now());

      text.append(title, promptLine, meta);
      main.append(thumb, text);
      main.addEventListener("click", () => selectItem(item.id));

      const actions = document.createElement("span");
      actions.className = "h-actions";

      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "h-act";
      btnEdit.title = "Rename project / edit prompt";
      btnEdit.setAttribute("aria-label", "Edit " + item.project);
      btnEdit.innerHTML = PENCIL_SVG;
      btnEdit.addEventListener("click", (e) => {
        e.stopPropagation();
        openEdit(item.id);
      });

      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "h-act danger";
      btnDel.title = "Delete project";
      btnDel.setAttribute("aria-label", "Delete " + item.project);
      btnDel.innerHTML = TRASH_SVG;
      btnDel.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteItem(item.id);
      });

      actions.append(btnEdit, btnDel);
      wrap.append(main, actions);
      E.historyList.appendChild(wrap);
    });

    if (backfilled) persistHistory();
  }

  /* ---------- viewer ---------- */

  function setViewerMode(mode) {
    if (mode === "welcome") {
      E.welcome.hidden = false;
      E.viewer.hidden = true;
      return;
    }
    E.welcome.hidden = true;
    E.viewer.hidden = false;
    E.viewer.dataset.state = mode;
    E.canvasCard.classList.toggle("is-loading", mode === "loading");
  }

  function filterClass(name) {
    return name && name !== "none" ? "filter-" + name : "";
  }

  function applyFilter(name, persist = true) {
    state.filter = name || "none";
    const cls = filterClass(state.filter);
    E.viewerImg.className = cls;
    E.renderArt.className = "art-fallback" + (cls ? " " + cls : "");
    document.querySelectorAll(".filter-pill").forEach((p) => {
      p.classList.toggle("is-active", p.dataset.filter === state.filter);
    });
    const item = currentItem();
    if (persist && item && item.id === state.currentId) {
      item.filter = state.filter;
      persistHistory();
    }
  }

  function showItem(item) {
    state.currentId = item.id;
    setViewerMode("result");

    if (item.url) {
      E.viewerImg.hidden = false;
      E.renderArt.hidden = true;
      E.viewerImg.src = item.url;
    } else {
      E.viewerImg.hidden = true;
      E.renderArt.hidden = false;
      E.renderArt.style.setProperty("--seed-hue", (item.hue || 0) + "deg");
    }

    E.viewerMeta.hidden = false;
    E.metaPrompt.textContent = item.prompt || "";
    E.metaSeed.textContent = item.type === "upload" ? "upload" : "Seed " + (item.seed || "—");
    E.metaModel.textContent = item.model || (item.type === "upload" ? item.name || "uploaded file" : "—");
    E.metaTime.textContent = item.secs ? item.secs + "s" : item.type === "upload" ? timeAgo(item.ts) : "—";

    applyFilter(item.filter || "none", false);
    renderHistory();
  }

  function selectItem(id) {
    const item = state.history.find((i) => i.id === id);
    if (!item) return;
    showItem(item);
    if (!E.prompt.value.trim() && item.type === "generated") {
      E.prompt.value = item.prompt || "";
      autoGrow();
    }
    if (isMobile()) E.app.classList.remove("mobile-open");
    E.stageScroll.scrollTop = 0;
  }

  function startProgress() {
    let progress = 0;
    let step = 0;
    E.loadingStatus.textContent = STATUS[0];
    const timer = setInterval(() => {
      progress = Math.min(96, progress + Math.random() * 8 + 3);
      E.loadingBar.style.width = progress + "%";
      E.loadingPct.textContent = Math.round(progress) + "%";
      const next = Math.min(STATUS.length - 1, Math.floor(progress / 18));
      if (next !== step) {
        step = next;
        E.loadingStatus.textContent = STATUS[step];
      }
    }, 320);
    return {
      stop() {
        clearInterval(timer);
        E.loadingBar.style.width = "100%";
        E.loadingPct.textContent = "100%";
      }
    };
  }

  /* ---------- base image ---------- */

  function setBase(base) {
    state.base = base;
    E.attachThumb.src = base.src;
    E.attachName.textContent = base.name || "base image";
    E.attachChip.hidden = false;
    E.attachBtn.classList.add("has-base");
    E.baseNote.textContent = "base · " + (base.name || "image");
    E.baseNote.classList.add("has-base");
  }

  function clearBase() {
    state.base = null;
    E.attachChip.hidden = true;
    E.attachBtn.classList.remove("has-base");
    E.baseNote.textContent = "no base image";
    E.baseNote.classList.remove("has-base");
  }

  async function useAsBase() {
    const item = currentItem();
    if (!item || !item.url) return toast("Nothing to use as a base image yet.");
    toast("Attaching base image…");
    try {
      const file = await srcToFile(item.url, item.name || "base.jpg");
      setBase({ file, src: item.url, name: file.name });
      toast("Base image attached — describe your changes");
    } catch (e) {
      console.error(e);
      toast("Couldn't attach that image — try the upload button instead.");
    }
  }

  async function makeChanges() {
    if (currentItem()) await useAsBase();
    E.prompt.placeholder = "Describe the changes you want…";
    E.prompt.focus();
    E.prompt.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Please choose an image file.");
    if (file.size > 15 * 1024 * 1024) return toast("Max upload size is 15 MB.");
    try {
      const dataUrl = await fileToDataUrl(file);
      const item = {
        id: uid(),
        type: "upload",
        url: dataUrl,
        prompt: "Uploaded · " + file.name,
        project: prettyFileName(file.name),
        name: file.name,
        ts: Date.now(),
        filter: "none"
      };
      addItem(item);
      showItem(item);
      setBase({ file, src: dataUrl, name: file.name });
      toast("Uploaded & attached as base image");
    } catch (e) {
      console.error(e);
      toast("Couldn't read that file.");
    }
    E.fileInput.value = "";
  }

  /* ---------- generation ---------- */

  function composePrompt(text) {
    return text + ", " + state.style + " style, " + state.quality.toLowerCase() + " quality";
  }

  function anonSrc(prompt, w, h, seed, model) {
    return (
      CONFIG.anonEndpoint +
      "/prompt/" +
      encodeURIComponent(prompt) +
      "?width=" + w +
      "&height=" + h +
      "&seed=" + seed +
      "&model=" + encodeURIComponent(model || CONFIG.anonModel) +
      "&nologo=true&referrer=prismlexi"
    );
  }

  async function readJson(res) {
    if (res && typeof res.json === "function") {
      try {
        return await res.json();
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function isLocalDev() {
    const h = location.hostname;
    return !h || h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
  }

  function hint(localMsg, hostedMsg) {
    return isLocalDev() ? localMsg : hostedMsg;
  }

  async function tryProxy(prompt, w, h, seed) {
    try {
      const qs = new URLSearchParams({
        prompt,
        width: String(w),
        height: String(h),
        seed: String(seed),
        model: state.model,
        referrer: "prismlexi"
      });
      const res = await fetch(CONFIG.api + "?" + qs, { headers: { Accept: "application/json" } });
      const data = await readJson(res);
      if (!data) {
        // non-JSON response (e.g. XAMPP 404 page) → no server running here
        return { unreachable: true, error: hint("local API not found (run `node server.js`)", "no generation API on this site") };
      }
      if (data.url) {
        if (await probeImage(data.url)) return { ok: true, src: data.url };
        return { error: "proxy image failed to load" };
      }
      if (data.b64) return { ok: true, src: data.b64 };
      return { error: data.error || "proxy returned no image" };
    } catch (e) {
      return { unreachable: true, error: hint("local server not running (node server.js)", "generation API unreachable") };
    }
  }

  async function textGen(text, w, h, seed) {
    state.lastError = "";
    const prompt = composePrompt(text);
    if (!CONFIG.api && !CONFIG.anonEndpoint) return ""; // demo mode

    let lastError = "";
    let proxyAnswered = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      const s = attempt === 0 ? seed : Math.floor(Math.random() * 2147483647);

      if (CONFIG.api) {
        const r = await tryProxy(prompt, w, h, s);
        if (r.ok) return r.src;
        lastError = r.error || lastError;
        if (!r.unreachable) proxyAnswered = true;
      }

      // browser-side free tier: rescues generation when the server-side fetch
      // is rate limited (datacenter IP) but the user's own IP is not
      if (CONFIG.anonEndpoint) {
        const src = anonSrc(prompt, w, h, s, attempt === 0 ? state.model : CONFIG.anonModel);
        if (await probeImage(src)) return src;
        if (!proxyAnswered) lastError = "free tier busy (rate limited) — try again shortly";
      }

      if (proxyAnswered && attempt >= 1) break;
      await sleep(700 * (attempt + 1));
    }

    state.lastError = lastError || "image service unavailable";
    return "";
  }

  async function editWithBase(text) {
    state.lastError = "";
    state.editNeedsServer = false;
    if (!CONFIG.api) {
      state.editNeedsServer = true;
      state.lastError = hint("no edit server configured — run `node server.js`", "image editing needs a server");
      return "";
    }
    try {
      const image = await fileToDataUrl(state.base.file);
      const res = await fetch(CONFIG.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, model: CONFIG.editModel, image })
      });
      const data = await readJson(res);
      if (data && data.url && (await probeImage(data.url))) return data.url;
      if (data) {
        state.lastError = data.error || "edit returned no image";
      } else {
        state.editNeedsServer = true;
        state.lastError = hint("local API not found (run `node server.js`)", "no edit API on this site");
      }
    } catch (e) {
      state.editNeedsServer = true;
      state.lastError = hint("local server not running (node server.js)", "edit API unreachable");
    }
    return "";
  }

  async function generate() {
    if (state.busy) return;
    const text = E.prompt.value.trim();
    if (!text) {
      E.composer.classList.add("is-error");
      setTimeout(() => E.composer.classList.remove("is-error"), 500);
      E.prompt.focus();
      return toast("Describe what you want to create first.");
    }

    state.busy = true;
    E.generateBtn.classList.add("is-busy");
    E.filterTray.hidden = true;
    E.btnFilter.classList.remove("is-on");

    const size = SIZES[state.ratio] || SIZES["1/1"];
    const w = size[0];
    const h = size[1];
    const seed = Math.floor(Math.random() * 2147483647);
    const started = performance.now();
    const progress = startProgress();
    setViewerMode("loading");

    let url = "";
    let usedModel = state.model;
    const demoMode = !CONFIG.api && !CONFIG.anonEndpoint;

    if (demoMode) {
      await sleep(3200);
    } else if (state.base) {
      usedModel = CONFIG.editModel + " edit";
      url = await editWithBase(text);
      if (!url) {
        toast(
          (state.editNeedsServer
            ? hint("Edit needs the local server (run `node server.js`)", "Image editing needs a server")
            : "Edit unavailable (" + (state.lastError || "unknown") + ")")             + " — generating fresh instead"
        );
        usedModel = state.model;
        state.lastError = "";
        url = await textGen(text, w, h, seed);
      }
    } else {
      url = await textGen(text, w, h, seed);
    }

    const elapsed = performance.now() - started;
    await sleep(Math.max(0, (url ? 2400 : 3200) - elapsed));
    progress.stop();

    const item = {
      id: uid(),
      type: "generated",
      prompt: text,
      project: deriveProjectName(text),
      url,
      w,
      h,
      seed,
      model: usedModel,
      style: state.style,
      ts: Date.now(),
      filter: "none",
      secs: ((performance.now() - started) / 1000).toFixed(1),
      hue: Math.floor(Math.random() * 40 - 20)
    };

    addItem(item);
    showItem(item);

    state.busy = false;
    E.generateBtn.classList.remove("is-busy");
    E.stageScroll.scrollTop = 0;

    if (url) toast("Render complete ✦");
    else if (state.lastError) toast("Generation failed — " + state.lastError);
    else toast("Demo render — start `node server.js` to go live");
  }

  /* ---------- image actions ---------- */

  async function downloadCurrent() {
    const item = currentItem();
    if (!item) return toast("Nothing to download yet.");
    if (!item.url) return toast("Demo render — nothing to download.");
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "prismlexi-" + item.id + ".jpg";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      window.open(item.url, "_blank");
    }
  }

  function deleteItem(id) {
    const idx = state.history.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const item = state.history[idx];
    if (!window.confirm('Delete project "' + projectFor(item) + '" from history?')) return;

    state.history.splice(idx, 1);
    const wasCurrent = state.currentId === id;
    if (wasCurrent) state.currentId = null;
    persistHistory();

    if (wasCurrent) {
      const next = state.history[Math.min(idx, state.history.length - 1)];
      if (next) showItem(next);
      else {
        clearBase();
        setViewerMode("welcome");
      }
    }
    renderHistory();
    toast("Project deleted");
  }

  function deleteCurrent() {
    const item = currentItem();
    if (item) deleteItem(item.id);
  }

  /* ---------- project editing ---------- */

  function openEdit(id) {
    const item = state.history.find((i) => i.id === id);
    if (!item) return;
    state.editingId = id;
    E.editProject.value = projectFor(item);
    E.editPrompt.value = item.prompt || "";
    E.editError.hidden = true;
    E.editOverlay.hidden = false;
    setTimeout(() => E.editProject.focus(), 60);
  }

  function closeEdit() {
    E.editOverlay.hidden = true;
    E.editError.hidden = true;
    state.editingId = null;
  }

  function editError(msg) {
    E.editError.textContent = msg;
    E.editError.hidden = false;
  }

  function saveEdit() {
    const item = state.history.find((i) => i.id === state.editingId);
    if (!item) return closeEdit();

    const name = E.editProject.value.trim();
    const prompt = E.editPrompt.value.trim();
    if (name.length < 2) return editError("Project name must be at least 2 characters.");
    if (name.length > 60) return editError("Project name is too long (max 60).");
    if (!prompt) return editError("Prompt can't be empty.");

    item.project = name;
    item.prompt = prompt;
    persistHistory();
    renderHistory();
    if (item.id === state.currentId) showItem(item);
    closeEdit();
    toast('Project updated ✦ "' + name + '"');
  }

  /* ---------- auth (Phase-1 client-side demo; real auth is server-side Phase 2) ---------- */

  let authBusy = false;

  const firstName = (n) => {
    const parts = (n || "").trim().split(/\s+/);
    return parts[0] || "Creator";
  };

  const initials = (n) => {
    const parts = (n || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  };

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  function providerLabel(p) {
    return p === "google" ? "Google" : p === "apple" ? "Apple" : "Email";
  }

  // Obfuscation-only FNV-1a double hash. NOT real security — replace with
  // server-side hashing + salted KDF (bcrypt/argon2) behind /api/auth in Phase 2.
  function hashPass(email, pass) {
    const a = (email + "::" + pass + "::prismlexi");
    const b = (pass + "@" + email + "::prismlexi");
    let h1 = 0x811c9dc5;
    let h2 = 0x811c9dc5;
    for (let i = 0; i < a.length; i++) {
      h1 ^= a.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193) >>> 0;
    }
    for (let i = 0; i < b.length; i++) {
      h2 ^= b.charCodeAt(i);
      h2 = Math.imul(h2, 0x01000193) >>> 0;
    }
    return ("00000000" + h1.toString(16)).slice(-8) + ("00000000" + h2.toString(16)).slice(-8);
  }

  function loadAccounts() {
    try {
      const map = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
      return map && typeof map === "object" ? map : {};
    } catch (e) {
      return {};
    }
  }

  function saveAccounts(map) {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function loadSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      return s && s.email ? s : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(s) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function updateProfileUI() {
    const s = state.session;
    const ini = s ? initials(s.name) : "✦";
    E.welcomeName.textContent = s ? firstName(s.name) : "Creator";
    E.avatarInitials.textContent = ini;
    E.menuInitials.textContent = ini;
    E.profileName.textContent = s ? firstName(s.name) : "Guest";
    E.profilePlan.textContent = s ? "✦ Free plan" : "Sign in to sync";
    E.menuName.textContent = s ? s.name : "Guest creator";
    E.menuEmail.textContent = s ? s.email : "Browsing without an account";
    E.miLogoutLabel.textContent = s ? "Log Out" : "Log In";
    E.topLoginBtn.hidden = !!s;
  }

  function fillAccountView() {
    const s = state.session;
    if (!s) return;
    E.acctInitials.textContent = initials(s.name);
    E.acctName.textContent = s.name;
    E.acctEmail.textContent = s.email;
    E.acctPlan.textContent = "✦ Free plan";
    E.acctSince.textContent = new Date(s.since).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    E.acctProvider.textContent = s.provider === "email" ? "Email & password" : providerLabel(s.provider);
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const isForm = mode === "login" || mode === "signup" || mode === "reset" || mode === "recover";
    E.authViews.hidden = !isForm;
    E.accountView.hidden = mode !== "account";
    E.creditsView.hidden = mode !== "credits";
    if (!isForm) {
      if (mode === "account") fillAccountView();
      return;
    }

    const signup = mode === "signup";
    const reset = mode === "reset";
    const recover = mode === "recover";
    const sub = reset || recover;
    E.authTabs.hidden = sub;
    E.authTabs.dataset.mode = mode;
    E.authTabs.querySelectorAll(".auth-tab").forEach((t) => {
      t.classList.toggle("is-active", t.dataset.mode === mode);
    });
    E.nameGroup.hidden = !signup;
    E.emailGroup.hidden = recover;
    E.passGroup.hidden = reset;
    E.pass2Group.hidden = !recover;
    E.authViews.classList.toggle("is-submode", sub);
    E.authLinks.hidden = !(sub || (mode === "login" && !!SB));
    E.forgotLink.hidden = mode !== "login" || !SB;
    E.authBack.hidden = !sub;

    if (reset) {
      E.authTitle.textContent = "Reset your password";
      E.authSub.textContent = "Enter your email and we'll send you a reset link.";
      E.authSubmitLabel.textContent = "Send reset link";
    } else if (recover) {
      E.authTitle.textContent = "Set a new password";
      E.authSub.textContent = "Choose a new password for your account.";
      E.authSubmitLabel.textContent = "Update password";
      E.authPass.autocomplete = "new-password";
    } else {
      E.authTitle.textContent = signup ? "Create your account" : "Welcome back";
      E.authSub.textContent = signup
        ? "Save renders, sync history and keep your credits in one place."
        : "Log in to keep your renders, history and credits in sync.";
      E.authSubmitLabel.textContent = signup ? "Create account" : "Log in";
      E.authPass.autocomplete = signup ? "new-password" : "current-password";
    }
    E.formError.hidden = true;
    E.formError.classList.remove("is-info");
    E.authForm.reset();
  }

  function openAuth(mode) {
    setAuthMode(mode || "login");
    E.authOverlay.hidden = false;
    setTimeout(() => {
      const m = state.authMode;
      const field = m === "signup" ? E.authName : m === "recover" ? E.authPass : m === "credits" || m === "account" ? null : E.authEmail;
      if (field) field.focus();
    }, 60);
  }

  function closeAuth() {
    E.authOverlay.hidden = true;
    E.formError.hidden = true;
    E.authForm.reset();
  }

  function sessionToAccount(sess) {
    const u = (sess && sess.user) || {};
    const meta = u.user_metadata || {};
    return {
      id: u.id || "",
      name: meta.full_name || meta.name || (u.email || "").split("@")[0] || "Creator",
      email: u.email || "",
      provider: (u.app_metadata && u.app_metadata.provider) || "email",
      since: Date.parse(u.created_at) || Date.now()
    };
  }

  function applySession(user) {
    const next = sessionToAccount({ user });
    const changed = !state.session || state.session.id !== next.id;
    state.session = next;
    saveSession(next);
    updateProfileUI();
    if (changed) reloadAccountData();
    if (state.authMode === "login" || state.authMode === "signup") closeAuth();
  }

  function guestReset() {
    const had = !!state.session;
    clearSession();
    state.session = null;
    updateProfileUI();
    if (had) reloadAccountData();
  }

  function supaMsg(error) {
    const m = String((error && error.message) || error || "authentication failed");
    if (m.includes("Invalid login credentials")) return "Incorrect email or password.";
    if (m.includes("already registered") || m.includes("already been registered")) return "An account already exists with that email — switch to Log in.";
    if (m.includes("Password should be at least")) return "Password must be at least 6 characters.";
    if (m.includes("rate limit") || m.includes("For security purposes")) return "Too many attempts — wait a minute and try again.";
    return m.length > 160 ? m.slice(0, 160) + "…" : m;
  }

  function signIn(acct) {
    state.session = {
      name: acct.name,
      email: acct.email,
      provider: acct.provider,
      since: acct.since
    };
    saveSession(state.session);
    updateProfileUI();
    reloadAccountData();
    closeAuth();
  }

  async function logout() {
    const was = !!state.session;
    clearSession();
    state.session = null;
    updateProfileUI();
    if (was) reloadAccountData();
    if (SB) {
      try {
        await SB.auth.signOut();
      } catch (e) {}
    }
    openAuth("login");
    toast("Logged out — see you soon");
  }

  function authError(msg) {
    E.formError.textContent = msg;
    E.formError.classList.remove("is-info");
    E.formError.hidden = false;
    E.authPass.focus();
  }

  function setAuthBusy(on, label) {
    authBusy = on;
    E.authSubmit.classList.toggle("is-busy", on);
    if (label) E.authSubmitLabel.textContent = label;
  }

  async function socialSignIn(provider) {
    // Supabase: real OAuth redirect (configure Google/Apple under Auth → Providers)
    if (SB) {
      try {
        const c = CONFIG.supabase;
        const res = await fetch(c.url + "/auth/v1/settings", { headers: { apikey: c.anonKey } });
        const s = await res.json();
        if (s && s.external && s.external[provider] === false) {
          authError(providerLabel(provider) + " sign-in isn't enabled yet — continue with email instead.");
          return;
        }
      } catch (e) {
        // couldn't verify — try OAuth anyway
      }
      try {
        const ret = await SB.auth.signInWithOAuth({
          provider,
          options: { redirectTo: window.location.origin + window.location.pathname }
        });
        if (ret && ret.error) authError(supaMsg(ret.error));
      } catch (e) {
        authError(String((e && e.message) || e));
      }
      return;
    }

    if (CONFIG.supabase && CONFIG.supabase.url && CONFIG.supabase.anonKey) {
      return authError("Sign-in couldn't load — refresh the page (Ctrl+Shift+R) and try again.");
    }

    // Local dummy accounts (demo mode only)
    const email = "you." + provider + "@prismlexi.app";
    const accounts = loadAccounts();
    let acct = accounts[email];
    if (!acct) {
      acct = {
        name: provider === "google" ? "Google Creator" : "Apple Creator",
        email,
        hash: "",
        provider,
        since: Date.now()
      };
      accounts[email] = acct;
      saveAccounts(accounts);
    }
    signIn(acct);
    toast("Signed in with " + providerLabel(provider) + " ✦");
  }

  function closeProfileMenu() {
    E.profileMenu.hidden = true;
    E.profileBtn.setAttribute("aria-expanded", "false");
  }

  function newChat() {
    E.prompt.value = "";
    autoGrow();
    updatePromptCount();
    clearBase();
    applyFilter("none", false);
    state.lastError = "";
    E.composer.classList.remove("is-error");
    setViewerMode("welcome");
    toast("Started a new chat");
    E.prompt.focus();
  }

  /* ---------- events ---------- */

  function updatePromptCount() {
    E.promptCount.textContent = E.prompt.value.length + " / 4000";
  }

  E.prompt.addEventListener("input", () => {
    autoGrow();
    updatePromptCount();
    E.composer.classList.remove("is-error");
    if (E.prompt.value.trim()) E.prompt.placeholder = "Describe an image to create…";
  });

  E.prompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      generate();
    }
  });

  E.generateBtn.addEventListener("click", generate);
  E.newChatBtn.addEventListener("click", newChat);

  E.suggestRow.addEventListener("click", (e) => {
    const chip = e.target.closest(".suggest");
    if (!chip) return;
    E.prompt.value = chip.textContent.trim();
    autoGrow();
    updatePromptCount();
    E.prompt.focus();
  });

  E.styleSelect.addEventListener("change", () => (state.style = E.styleSelect.value));
  E.qualitySelect.addEventListener("change", () => (state.quality = E.qualitySelect.value));
  E.modelSelect.addEventListener("change", () => (state.model = E.modelSelect.value));
  E.ratioSelect.addEventListener("change", () => {
    state.ratio = E.ratioSelect.value;
    E.canvasCard.style.setProperty("--stage-ratio", state.ratio);
  });

  E.attachBtn.addEventListener("click", () => E.fileInput.click());
  E.fileInput.addEventListener("change", () => handleFile(E.fileInput.files[0]));
  E.attachRemove.addEventListener("click", () => {
    clearBase();
    toast("Base image removed");
  });

  E.btnMakeChanges.addEventListener("click", makeChanges);
  E.btnUseBase.addEventListener("click", useAsBase);
  E.btnDownload.addEventListener("click", downloadCurrent);
  E.btnDelete.addEventListener("click", deleteCurrent);

  E.btnFilter.addEventListener("click", () => {
    const open = E.filterTray.hidden;
    E.filterTray.hidden = !open;
    E.btnFilter.classList.toggle("is-on", open);
  });

  E.filterTray.addEventListener("click", (e) => {
    const pill = e.target.closest(".filter-pill");
    if (!pill) return;
    applyFilter(pill.dataset.filter);
  });

  E.clearHistory.addEventListener("click", () => {
    if (!state.history.length) return toast("History is already empty.");
    if (!window.confirm("Clear all history?")) return;
    state.history = [];
    state.currentId = null;
    persistHistory();
    renderHistory();
    clearBase();
    setViewerMode("welcome");
    toast("History cleared");
  });

  E.sideToggle.addEventListener("click", () => {
    if (isMobile()) {
      E.app.classList.remove("mobile-open");
      return;
    }
    E.app.classList.toggle("is-collapsed");
    savePrefs();
  });

  E.sideToggleMobile.addEventListener("click", () => E.app.classList.add("mobile-open"));
  E.sideBackdrop.addEventListener("click", () => E.app.classList.remove("mobile-open"));

  /* ---------- auth events ---------- */

  E.authTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".auth-tab");
    if (tab && !authBusy) setAuthMode(tab.dataset.mode);
  });

  E.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (authBusy) return;
    E.formError.hidden = true;
    E.formError.classList.remove("is-info");

    const mode = state.authMode;
    const name = E.authName.value.trim();
    const email = E.authEmail.value.trim().toLowerCase();
    const pass = E.authPass.value;
    const accounts = loadAccounts();

    if (mode !== "reset" && mode !== "recover" && !validEmail(email)) return authError("That email address doesn't look right.");
    if (mode !== "reset" && pass.length < 6) return authError("Password must be at least 6 characters.");

    // ---- Supabase (cross-browser) ----
    if (SB) {
      if (mode === "reset") {
        setAuthBusy(true, "Sending link…");
        const { error } = await SB.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + location.pathname
        });
        setAuthBusy(false);
        if (error) return authError(supaMsg(error));
        E.formError.textContent = "Reset link sent to " + email + " — check inbox and spam.";
        E.formError.classList.add("is-info");
        E.formError.hidden = false;
        return;
      }

      if (mode === "recover") {
        if (pass !== E.authPass2.value) return authError("Passwords don't match.");
        setAuthBusy(true, "Saving password…");
        const { error } = await SB.auth.updateUser({ password: pass });
        setAuthBusy(false);
        if (error) return authError(supaMsg(error));
        toast("Password updated ✦");
        closeAuth();
        return;
      }

      if (mode === "signup") {
        if (name.length < 2) return authError("Please enter your full name.");
        setAuthBusy(true, "Creating account…");
        const { data, error } = await SB.auth.signUp({
          email,
          password: pass,
          options: { data: { full_name: name } }
        });
        setAuthBusy(false);
        if (error) return authError(supaMsg(error));
        if (data && data.session && data.session.user) {
          applySession(data.session.user);
          E.authForm.reset();
          toast("Account created ✦ welcome, " + firstName(name));
          return;
        }
        // email confirmation required
        E.formError.textContent = "Confirmation email sent to " + email + " — verify it, then log in.";
        E.formError.classList.add("is-info");
        E.formError.hidden = false;
        return;
      }

      setAuthBusy(true, "Signing you in…");
      const { data, error } = await SB.auth.signInWithPassword({ email, password: pass });
      setAuthBusy(false);
      if (error) return authError(supaMsg(error));
      if (data && data.user) {
        applySession(data.user);
        E.authForm.reset();
        toast("Welcome back, " + firstName(state.session ? state.session.name : name) + " ✦");
      }
      return;
    }

    if (CONFIG.supabase && CONFIG.supabase.url && CONFIG.supabase.anonKey) {
      return authError("Sign-in couldn't load — refresh the page (Ctrl+Shift+R) and try again.");
    }

    // ---- Local per-browser demo ----
    if (mode === "signup") {
      if (name.length < 2) return authError("Please enter your full name.");
      if (accounts[email]) return authError("An account already exists with that email — switch to Log in.");
      setAuthBusy(true, "Creating account…");
      await sleep(700);
      const acct = { name, email, hash: hashPass(email, pass), provider: "email", since: Date.now() };
      accounts[email] = acct;
      saveAccounts(accounts);
      setAuthBusy(false);
      signIn(acct);
      E.authForm.reset();
      toast("Account created ✦ welcome, " + firstName(name));
      return;
    }

    const acct = accounts[email];
    if (!acct) return authError("No account found with that email — switch to Sign up.");
    if (acct.provider !== "email") {
      return authError("That email is linked to " + providerLabel(acct.provider) + " — use Continue with " + providerLabel(acct.provider) + " instead.");
    }
    if (acct.hash !== hashPass(email, pass)) return authError("Incorrect password — try again.");
    setAuthBusy(true, "Signing you in…");
    await sleep(600);
    setAuthBusy(false);
    signIn(acct);
    E.authForm.reset();
    toast("Welcome back, " + firstName(acct.name) + " ✦");
  });

  E.passToggle.addEventListener("click", () => {
    const show = E.authPass.type === "password";
    E.authPass.type = show ? "text" : "password";
    E.passToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  E.btnGoogle.addEventListener("click", () => socialSignIn("google"));
  E.btnApple.addEventListener("click", () => socialSignIn("apple"));
  E.forgotLink.addEventListener("click", () => openAuth("reset"));
  E.authBack.addEventListener("click", () => openAuth("login"));
  E.btnGuest.addEventListener("click", () => {
    closeAuth();
    toast("Continuing as guest — renders stay on this device");
  });

  E.authClose.addEventListener("click", closeAuth);
  E.authBackdrop.addEventListener("click", closeAuth);
  E.acctCloseBtn.addEventListener("click", closeAuth);
  E.creditsCloseBtn.addEventListener("click", closeAuth);
  E.acctLogoutBtn.addEventListener("click", logout);
  E.upgradeBtn.addEventListener("click", () => toast("Pro plan is coming soon ✦"));
  E.topLoginBtn.addEventListener("click", () => openAuth("login"));

  E.profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = E.profileMenu.hidden;
    E.profileMenu.hidden = !open;
    E.profileBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.addEventListener("click", (e) => {
    if (!E.profileMenu.hidden && !(e.target.closest && e.target.closest(".profile-wrap"))) {
      closeProfileMenu();
    }
  });

  E.miAccount.addEventListener("click", () => {
    closeProfileMenu();
    openAuth(state.session ? "account" : "login");
  });

  E.miCredits.addEventListener("click", () => {
    closeProfileMenu();
    openAuth("credits");
  });

  E.miLogout.addEventListener("click", () => {
    closeProfileMenu();
    if (state.session) logout();
    else openAuth("login");
  });

  E.editSave.addEventListener("click", saveEdit);
  E.editCancel.addEventListener("click", closeEdit);
  E.editBackdrop.addEventListener("click", closeEdit);
  E.editProject.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    }
  });
  E.editPrompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!E.profileMenu.hidden) {
        closeProfileMenu();
        return;
      }
      if (!E.editOverlay.hidden) {
        closeEdit();
        return;
      }
      if (!E.authOverlay.hidden && !authBusy) {
        closeAuth();
        return;
      }
      E.app.classList.remove("mobile-open");
      E.filterTray.hidden = true;
      E.btnFilter.classList.remove("is-on");
    }
  });

  document.addEventListener("mousemove", (e) => {
    const x = (e.clientX / window.innerWidth - 0.5).toFixed(3);
    const y = (e.clientY / window.innerHeight - 0.5).toFixed(3);
    document.documentElement.style.setProperty("--px", x);
    document.documentElement.style.setProperty("--py", y);
  });

  /* ---------- init ---------- */

  (async () => {
    loadPrefs();

    if (SB) {
      // fast paint from our cached session, then confirm with Supabase
      try {
        const cached = loadSession();
        if (cached) state.session = cached;
        const { data } = await SB.auth.getSession();
        const sess = data && data.session;
        if (sess && sess.user) {
          state.session = sessionToAccount(sess);
          saveSession(state.session);
        } else if (cached) {
          clearSession();
          state.session = null;
        }
      } catch (e) {
        console.warn("PrismLexi: getSession failed:", e);
      }
    } else {
      state.session = loadSession();
    }

    updateProfileUI();
    loadHistory();
    E.canvasCard.style.setProperty("--stage-ratio", state.ratio);
    renderHistory();

    if (state.history.length) showItem(state.history[0]);
    else setViewerMode("welcome");

    autoGrow();

    if (!state.session) openAuth("login");
    else {
      if (SB) pullHistoryRemote();
      if (CAME_FOR_RECOVERY) openAuth("recover");
    }

    if (SB) {
      SB.auth.onAuthStateChange((event, session) => {
        try {
          if (event === "PASSWORD_RECOVERY" && session && session.user) {
            openAuth("recover");
            applySession(session.user);
            return;
          }
          if (session && session.user) applySession(session.user);
          else if (event === "SIGNED_OUT") guestReset();
        } catch (e) {
          console.warn("PrismLexi: auth state change failed:", e);
        }
      });
    }
  })();
})();
