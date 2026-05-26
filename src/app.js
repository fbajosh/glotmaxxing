import { aboutView } from "./about.js";
import { SUPPORTED_LANGUAGES } from "./data.js";
import { englishTarget, englishView } from "./english.js";
import { appendErrorLogEntry, clearErrorLog, errorLogView, loadErrorLog } from "./error-log.js";
import { errorView } from "./error.js";
import { foreignView } from "./foreign.js";
import { searchBar, settingsButton, esc } from "./html.js";
import { normalizeQuery, queryFromParams } from "./query.js";
import { routeWord } from "./routing.js";
import { splashView, syncSplashHero } from "./splash.js";
import { APP_VERSION } from "./version.js";

const SETTINGS_KEY = "glotmaxxing.settings";
const MIN_LANGUAGE_ROWS = 3;
const defaults = { languages: Array(MIN_LANGUAGE_ROWS).fill(""), darkMode: false };
const params = new URLSearchParams(location.search);
const app = document.querySelector("#app");
let dragState = null;
let suppressClick = false;
let state = null;

installGlobalErrorLogging();

const initialPage = pageFrom(params);
state = {
  settings: loadSettings(),
  page: initialPage,
  query: initialPage ? "" : queryFromParams(params),
  selectedLanguage: initialPage ? "" : params.get("tl") || "",
  resultLanguage: initialPage ? "" : params.get("rl") || "",
  lookup: null,
  serverVersion: null,
  recacheFailure: null,
  settingsOpen: false,
  editing: null
};

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return { languages: normalizeSlots(defaults.languages), darkMode: defaults.darkMode };

  const saved = JSON.parse(raw);
  if (!Array.isArray(saved.languages)) throw new Error("Saved settings must include a languages array");
  if (saved.darkMode !== undefined && typeof saved.darkMode !== "boolean") {
    throw new Error("Saved dark mode setting must be a boolean");
  }

  return {
    languages: normalizeSlots(saved.languages),
    darkMode: saved.darkMode === true
  };
}

function normalizeSlots(languages) {
  if (!Array.isArray(languages)) throw new Error("Language settings must be an array");

  const slots = [];
  const used = new Set();

  for (const value of languages) {
    if (!value) {
      slots.push("");
      continue;
    }

    const language = findLanguage(value);
    if (!language) throw new Error(`Unsupported saved language: ${value}`);
    if (used.has(language)) throw new Error(`Duplicate saved language: ${language}`);

    slots.push(language);
    used.add(language);
  }

  return displayLanguageSlots(slots);
}

function displayLanguageSlots(languages) {
  const slots = [...languages];
  while (
    slots.length > MIN_LANGUAGE_ROWS &&
    slots[slots.length - 1] === "" &&
    slots[slots.length - 2] === ""
  ) {
    slots.pop();
  }
  while (slots.length < MIN_LANGUAGE_ROWS) slots.push("");
  if (!slots.includes("")) slots.push("");
  return slots;
}

function preferredLanguages() {
  return state.settings.languages.filter(Boolean);
}

function hasPreferredLanguages() {
  return preferredLanguages().length > 0;
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function pageFrom(urlParams, pathname = location.pathname) {
  const pathPage = pathname.replace(/\/+$/, "").split("/").pop() === "errorlog" ? "errorlog" : "";
  const page = pathPage || urlParams.get("page") || "";
  if (!page) return "";
  if (page !== "about" && page !== "errorlog") throw new Error(`Unsupported page: ${page}`);
  return page;
}

function pageUrl(page) {
  if (page === "about") return `${appHomePath()}?page=about`;
  if (page === "errorlog") return `${appHomePath().replace(/\/?$/, "/")}errorlog`;
  throw new Error(`Unsupported page: ${page}`);
}

function appHomePath() {
  const withoutErrorLog = location.pathname.replace(/\/errorlog\/?$/, "/");
  if (withoutErrorLog.endsWith("/index.html")) {
    return withoutErrorLog.slice(0, -"index.html".length) || "/";
  }
  return withoutErrorLog || "/";
}

function installGlobalErrorLogging() {
  addEventListener("error", (event) => {
    logPageError({ description: "runtime error", error: event.error || event.message });
  });

  addEventListener("unhandledrejection", (event) => {
    logPageError({ description: "unhandled promise rejection", error: event.reason });
  });
}

function logPageError({ description, error }) {
  if (alreadyLogged(error)) return;
  markLogged(error);
  appendErrorLogEntry({ description, error, context: currentErrorContext() });
}

function alreadyLogged(error) {
  return Boolean(error && typeof error === "object" && error.__glotmaxxingLogged);
}

function markLogged(error) {
  if (!error || typeof error !== "object") return;

  try {
    Object.defineProperty(error, "__glotmaxxingLogged", { value: true });
  } catch {
    // Best-effort duplicate prevention only.
  }
}

function currentErrorContext() {
  const currentParams = new URLSearchParams(location.search);
  const currentPage = safePageFrom(currentParams);

  return {
    appVersion: APP_VERSION,
    url: location.href,
    page: state?.page ?? currentPage,
    query: state?.query ?? (currentPage ? "" : queryFromParams(currentParams)),
    selectedLanguage: state?.selectedLanguage ?? (currentPage ? "" : currentParams.get("tl") || ""),
    resultLanguage: state?.resultLanguage ?? (currentPage ? "" : currentParams.get("rl") || ""),
    settings: settingsForLog()
  };
}

function safePageFrom(urlParams) {
  try {
    return pageFrom(urlParams);
  } catch {
    return "";
  }
}

function settingsForLog() {
  if (state?.settings) return state.settings;

  try {
    return loadSettings();
  } catch (error) {
    return { loadFailure: error.message || String(error) };
  }
}

function go(query, selectedLanguage = "", resultLanguage = "") {
  const next = normalizeQuery(query);
  if (!next) return;
  state.page = "";
  state.query = next;
  state.selectedLanguage = selectedLanguage;
  state.resultLanguage = resultLanguage;
  state.lookup = null;
  state.settingsOpen = false;

  const nextParams = new URLSearchParams({ q: next });
  if (selectedLanguage) nextParams.set("tl", selectedLanguage);
  if (resultLanguage) nextParams.set("rl", resultLanguage);
  history.pushState({}, "", `${appHomePath()}?${nextParams.toString()}`);
  render();
}

function showPage(page) {
  if (page !== "about" && page !== "errorlog") throw new Error(`Unsupported page: ${page}`);
  state.page = page;
  state.query = "";
  state.selectedLanguage = "";
  state.resultLanguage = "";
  state.lookup = null;
  state.settingsOpen = false;
  state.editing = null;
  history.pushState({}, "", pageUrl(page));
  render();
}

function render() {
  applyTheme();
  app.innerHTML = state.page === "about"
    ? pageView(aboutPageView())
    : state.page === "errorlog"
      ? pageView(errorLogPageView())
      : state.query
        ? wordView()
        : splashShell();
  focusEditingLanguage();
  syncSplashHero(app).catch((failure) => {
    logPageError({ description: "hero image sync failed", error: failure });
    throw failure;
  });
}

function focusEditingLanguage() {
  if (state.editing === null) return;
  const input = app.querySelector(`form[data-role="language"][data-slot="${state.editing}"] input[name="language"]`);
  if (!input) return;
  input.focus();
  input.select();
}

function applyTheme() {
  document.documentElement.classList.toggle("dark", state.settings.darkMode);
  document.body.classList.toggle("dark", state.settings.darkMode);
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    state.settings.darkMode ? "#101614" : "#f4f7f5"
  );
}

function wordView() {
  if (!hasPreferredLanguages()) {
    return pageView(`
      <article>
        <h1>${esc(state.query)}</h1>
        <p class="notice">Set preferred languages to search.</p>
      </article>
    `, state.query);
  }

  const lookup = currentLookup();
  const content = lookup.failure
    ? failureView(state.query, lookup.failure)
    : lookup.loading
      ? loadingView(state.query)
      : resultView(lookup.result);

  return pageView(content, state.query);
}

function splashShell() {
  return `
    ${splashView({ darkMode: state.settings.darkMode })}
    ${bottomBar("")}
    ${state.settingsOpen ? settingsView() : ""}
  `;
}

function pageView(content, searchValue = "") {
  return `
    ${bottomBar(searchValue)}
    <main class="word">${content}</main>
    ${state.settingsOpen ? settingsView() : ""}
  `;
}

function aboutPageView() {
  ensureServerVersion();
  return aboutView({
    appVersion: APP_VERSION,
    serverVersion: state.serverVersion,
    recacheFailure: state.recacheFailure
  });
}

function bottomBar(searchValue = "") {
  return `
    <header class="bottombar search-settings">
      ${hasPreferredLanguages() ? searchBar(searchValue) : preferredLanguageButton()}
      ${settingsButton()}
    </header>
  `;
}

function preferredLanguageButton() {
  return `<button class="language-gate" type="button" data-action="settings">Set preferred languages</button>`;
}

function currentLookup() {
  const key = lookupKey();
  if (!state.lookup || state.lookup.key !== key) startLookup(key);
  return state.lookup;
}

function lookupKey() {
  return [state.query, preferredLanguages().join(","), state.selectedLanguage, state.resultLanguage].join("|");
}

function startLookup(key) {
  state.lookup = { key, loading: true, result: null, failure: null };
  Promise.resolve().then(() => routeWord({
    query: state.query,
    preferredLanguages: preferredLanguages(),
    selectedLanguage: selectedLanguage(),
    resultLanguage: resultLanguage()
  })).then((result) => {
    if (state.lookup?.key !== key) return;
    state.lookup = { key, loading: false, result, failure: null };
    render();
  }, (failure) => {
    if (state.lookup?.key !== key) return;
    logPageError({ description: "lookup failed", error: failure });
    state.lookup = { key, loading: false, result: null, failure };
    render();
  });
}

function ensureServerVersion() {
  if (state.serverVersion) return;

  state.serverVersion = { loading: true, version: "", deployedAt: "", failure: null };
  const url = new URL("./version.json", location.href);
  url.searchParams.set("v", Date.now().toString());

  fetch(url, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Version check failed: ${response.status} ${response.statusText}`);
      return response.json();
    })
    .then((data) => {
      if (!data?.version) throw new Error("Version check returned no version");
      state.serverVersion = {
        loading: false,
        version: String(data.version),
        deployedAt: String(data.deployedAt || ""),
        failure: null
      };
      if (state.page === "about") render();
    }, (failure) => {
      logPageError({ description: "version check failed", error: failure });
      state.serverVersion = { loading: false, version: "", deployedAt: "", failure };
      if (state.page === "about") render();
    });
}

async function forceRecache() {
  state.recacheFailure = null;
  const appScope = new URL("./", location.href).href;

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations
      .filter((registration) =>
        registration.scope.startsWith(appScope) ||
        serviceWorkerScriptUrls(registration).some((url) => url.includes("/glotmaxxing/"))
      )
      .map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => /glotmaxxing/i.test(key))
      .map((key) => caches.delete(key)));
  }

  const url = new URL(location.href);
  url.searchParams.set("recache", Date.now().toString());
  location.replace(url);
}

function serviceWorkerScriptUrls(registration) {
  return [registration.active, registration.installing, registration.waiting]
    .map((worker) => worker?.scriptURL || "")
    .filter(Boolean);
}

function resultView(result) {
  if (result.kind === "none") return noPageView(result.term);
  if (result.flow === "foreign") return foreignView(result);

  const languages = preferredLanguages();
  const target = englishTarget(result.entry, languages, findLanguage(state.selectedLanguage));
  return englishView(result.entry, target, languages, result.availableLanguages || []);
}

function loadingView(query) {
  return `<article><h1>${esc(query)}</h1><p class="notice">Loading Wiktionary page...</p></article>`;
}

function failureView(query, failure) {
  const handled = errorView(query, failure);
  if (handled) return handled;

  return `
    <article>
      <h1>${esc(query)}</h1>
      <p class="notice">Lookup failed.</p>
      <pre class="failure">${esc(failure.stack || failure.message || failure)}</pre>
    </article>
  `;
}

function errorLogPageView() {
  return errorLogView(loadErrorLog());
}

function noPageView(term) {
  return `<article><h1>${esc(term)}</h1><p class="notice">No page exists in preferred languages.</p></article>`;
}

function settingsView() {
  return `
    <div class="drawer">
      <section class="drawer-section">
      <button class="close" type="button" data-action="close" aria-label="Close">&times;</button>
      </section>
      <section class="drawer-section">
        <h2>Theme</h2>
      <label class="theme-toggle">
        <span>Dark mode</span>
        <input type="checkbox" data-action="dark-mode" ${state.settings.darkMode ? "checked" : ""}>
      </label>
      </section>
      <section class="drawer-section language-section">
        <h2>Language preferences</h2>
        ${hasPreferredLanguages() ? "" : `<p>You must select at least one preferred language in addition to English.</p>`}
      <ol class="slots">${state.settings.languages.map(slotView).join("")}</ol>
      </section>
      <section class="drawer-section glotmaxxing-section">
        <h2>Glotmaxxing</h2>
        <nav class="drawer-links" aria-label="Glotmaxxing">
          <a href="${esc(pageUrl("about"))}" data-action="about">About</a>
          <a href="${esc(pageUrl("errorlog"))}" data-action="error-log">Error log</a>
          <a href="https://www.wiktionary.org/" target="_blank" rel="noopener noreferrer">Wiktionary</a>
          <a href="https://github.com/fbajosh/glotmaxxing" target="_blank" rel="noopener noreferrer">Git</a>
        </nav>
      </section>
    </div>
  `;
}

function slotView(language, index) {
  return `
    <li data-slot="${index}">
      <button type="button" data-action="edit" data-slot="${index}">${esc(language || "Tap to set language")}</button>
      ${state.editing === index ? `
        <form data-role="language" data-slot="${index}">
          <input name="language" type="search" list="languages" value="${esc(language)}" placeholder="Language">
          <button type="submit">Save</button>
          <datalist id="languages">${SUPPORTED_LANGUAGES.map((item) => `<option value="${item.name}"></option>`).join("")}</datalist>
        </form>
      ` : ""}
    </li>
  `;
}

function findLanguage(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SUPPORTED_LANGUAGES.find((item) => item.name.toLowerCase() === normalized)?.name || "";
}

function selectedLanguage() {
  if (!state.selectedLanguage) return "";
  const language = findLanguage(state.selectedLanguage);
  if (!language) throw new Error(`Unsupported selected language: ${state.selectedLanguage}`);
  return language;
}

function resultLanguage() {
  if (!state.resultLanguage) return "";
  const language = findLanguage(state.resultLanguage);
  if (!language) throw new Error(`Unsupported result language: ${state.resultLanguage}`);
  return language;
}

function slotNumber(value, label) {
  if (String(value ?? "").trim() === "") throw new Error(`Invalid ${label} slot: ${value}`);
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 0 || slot >= state.settings.languages.length) {
    throw new Error(`Invalid ${label} slot: ${value}`);
  }
  return slot;
}

function reorderLanguageSlots(source, target) {
  if (source === target) return;

  const slots = [...state.settings.languages];
  const [item] = slots.splice(source, 1);
  slots.splice(target, 0, item);
  state.settings.languages = displayLanguageSlots(slots);
  state.lookup = null;
  saveSettings();
}

function clearDragTarget() {
  document.querySelectorAll(".slots li.drag-over, .slots li.dragging").forEach((row) => {
    row.classList.remove("drag-over", "dragging");
  });
}

function dragTargetAt(x, y) {
  return document.elementFromPoint(x, y)?.closest?.(".slots li") || null;
}

app.addEventListener("submit", (event) => {
  const form = event.target;
  if (!form?.matches?.("form")) return;
  event.preventDefault();

  if (form.dataset.role === "search") {
    go(new FormData(form).get("q"));
    return;
  }

  if (form.dataset.role !== "language") throw new Error(`Unhandled form role: ${form.dataset.role || "(missing)"}`);

  const slot = slotNumber(form.dataset.slot, "language");
  const submittedLanguage = new FormData(form).get("language");
  const language = findLanguage(submittedLanguage);
  if (!language) throw new Error(`Unsupported preferred language: ${submittedLanguage}`);

  state.settings.languages = state.settings.languages.map((item, index) => item === language && index !== slot ? "" : item);
  state.settings.languages[slot] = language;
  state.settings.languages = displayLanguageSlots(state.settings.languages);
  state.editing = null;
  saveSettings();
  render();
});

app.addEventListener("click", (event) => {
  if (suppressClick) {
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
    return;
  }

  if (state.settingsOpen && !event.target.closest?.(".drawer") && !event.target.closest?.('[data-action="settings"]')) {
    state.settingsOpen = false;
    state.editing = null;
    render();
    return;
  }

  const translation = event.target.closest?.("[data-translation-language]");
  if (translation) {
    go(state.query, translation.dataset.translationLanguage);
    return;
  }

  const resultLanguageControl = event.target.closest?.("[data-result-language]");
  if (resultLanguageControl) {
    go(state.query, "", resultLanguageControl.dataset.resultLanguage);
    return;
  }

  const wordQuery = event.target.closest?.("[data-word-query]");
  if (wordQuery) {
    event.preventDefault();
    go(wordQuery.dataset.wordQuery);
    return;
  }

  const control = event.target.closest?.("[data-action]");
  if (!control) return;

  if (control.dataset.action === "settings") {
    state.settingsOpen = true;
  } else if (control.dataset.action === "close") {
    state.settingsOpen = false;
    state.editing = null;
  } else if (control.dataset.action === "about") {
    event.preventDefault();
    showPage("about");
    return;
  } else if (control.dataset.action === "error-log") {
    event.preventDefault();
    showPage("errorlog");
    return;
  } else if (control.dataset.action === "force-recache") {
    event.preventDefault();
    forceRecache().catch((failure) => {
      logPageError({ description: "force recache failed", error: failure });
      state.recacheFailure = failure;
      render();
    });
    return;
  } else if (control.dataset.action === "clear-error-log") {
    clearErrorLog();
    render();
    return;
  } else if (control.dataset.action === "dark-mode") {
    state.settings.darkMode = control.checked;
    saveSettings();
  } else if (control.dataset.action === "edit") {
    state.editing = slotNumber(control.dataset.slot, "edit");
  } else {
    throw new Error(`Unhandled action: ${control.dataset.action}`);
  }

  render();
});

app.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const row = event.target.closest?.(".slots li");
  if (!row || event.target.closest?.("form, input, datalist, button")) return;

  dragState = {
    pointerId: event.pointerId,
    source: slotNumber(row.dataset.slot, "drag source"),
    target: slotNumber(row.dataset.slot, "drag target"),
    startX: event.clientX,
    startY: event.clientY,
    active: false
  };
  row.setPointerCapture(event.pointerId);
});

app.addEventListener("pointermove", (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;

  const moved = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
  if (!dragState.active && moved < 8) return;

  dragState.active = true;
  event.preventDefault();

  const target = dragTargetAt(event.clientX, event.clientY);
  if (!target) return;

  clearDragTarget();
  target.classList.add("drag-over");
  document.querySelector(`.slots li[data-slot="${dragState.source}"]`)?.classList.add("dragging");
  dragState.target = slotNumber(target.dataset.slot, "drag target");
});

app.addEventListener("pointerup", (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;

  const wasActive = dragState.active;
  if (wasActive) {
    event.preventDefault();
    reorderLanguageSlots(dragState.source, dragState.target);
    suppressClick = true;
  }

  dragState = null;
  clearDragTarget();
  if (wasActive) render();
});

app.addEventListener("pointercancel", (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  dragState = null;
  clearDragTarget();
});

addEventListener("popstate", () => {
  const nextParams = new URLSearchParams(location.search);
  state.page = pageFrom(nextParams);
  state.query = state.page ? "" : queryFromParams(nextParams);
  state.selectedLanguage = state.page ? "" : nextParams.get("tl") || "";
  state.resultLanguage = state.page ? "" : nextParams.get("rl") || "";
  state.lookup = null;
  state.settingsOpen = false;
  state.editing = null;
  render();
});

render();
