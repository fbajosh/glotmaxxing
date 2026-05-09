import { aboutView } from "./about.js";
import { SUPPORTED_LANGUAGES } from "./data.js";
import { englishTarget, englishView } from "./english.js";
import { errorView } from "./error.js";
import { foreignView } from "./foreign.js";
import { searchBar, settingsButton, esc } from "./html.js";
import { routeWord } from "./routing.js";
import { splashView } from "./splash.js";
import { APP_VERSION } from "./version.js";

const SETTINGS_KEY = "glotmaxxing.settings";
const defaults = { languages: ["", "", "", "", ""], darkMode: false };
const params = new URLSearchParams(location.search);
const app = document.querySelector("#app");
let dragState = null;
let suppressClick = false;
const state = {
  settings: loadSettings(),
  page: pageFrom(params),
  query: pageFrom(params) ? "" : params.get("q") || "",
  selectedLanguage: pageFrom(params) ? "" : params.get("tl") || "",
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
  if (languages.length > 5) throw new Error("Language settings cannot contain more than five rows");

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

  while (slots.length < 5) slots.push("");
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

function pageFrom(urlParams) {
  const page = urlParams.get("page") || "";
  if (!page) return "";
  if (page !== "about") throw new Error(`Unsupported page: ${page}`);
  return page;
}

function go(query, selectedLanguage = "") {
  const next = String(query || "").trim();
  if (!next) return;
  state.page = "";
  state.query = next;
  state.selectedLanguage = selectedLanguage;
  state.lookup = null;
  state.settingsOpen = false;

  const nextParams = new URLSearchParams({ q: next });
  if (selectedLanguage) nextParams.set("tl", selectedLanguage);
  history.pushState({}, "", `${location.pathname}?${nextParams.toString()}`);
  render();
}

function showPage(page) {
  if (page !== "about") throw new Error(`Unsupported page: ${page}`);
  state.page = page;
  state.query = "";
  state.selectedLanguage = "";
  state.lookup = null;
  state.settingsOpen = false;
  state.editing = null;
  history.pushState({}, "", `${location.pathname}?page=${page}`);
  render();
}

function render() {
  applyTheme();
  app.innerHTML = state.page === "about" ? pageView(aboutPageView()) : state.query ? wordView() : splashShell();
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
  return [state.query, preferredLanguages().join(","), state.selectedLanguage].join("|");
}

function startLookup(key) {
  state.lookup = { key, loading: true, result: null, failure: null };
  Promise.resolve().then(() => routeWord({
    query: state.query,
    preferredLanguages: preferredLanguages(),
    selectedLanguage: selectedLanguage()
  })).then((result) => {
    if (state.lookup?.key !== key) return;
    state.lookup = { key, loading: false, result, failure: null };
    render();
  }, (failure) => {
    if (state.lookup?.key !== key) return;
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
  return englishView(result.entry, target, languages);
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

function noPageView(term) {
  return `<article><h1>${esc(term)}</h1><p class="notice">No page exists in preferred languages.</p></article>`;
}

function settingsView() {
  return `
    <div class="drawer">
      <button class="close" type="button" data-action="close" aria-label="Close">&times;</button>
      <section class="drawer-section">
        <h2>Theme</h2>
      <label class="theme-toggle">
        <span>Dark mode</span>
        <input type="checkbox" data-action="dark-mode" ${state.settings.darkMode ? "checked" : ""}>
      </label>
      </section>
      <section class="drawer-section language-section">
        <h2>Language preferences</h2>
        <p>You must select at least one preferred language in addition to English. 
        You may select up to five languages. Results will appear in the order that
        you choose. You may drag languages to reorder them.</p>
      <ol class="slots">${state.settings.languages.map(slotView).join("")}</ol>
      </section>
      <section class="drawer-section glotmaxxing-section">
        <h2>Glotmaxxing</h2>
        <nav class="drawer-links" aria-label="Glotmaxxing">
          <a href="?page=about" data-action="about">About</a>
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

function slotNumber(value, label) {
  if (String(value ?? "").trim() === "") throw new Error(`Invalid ${label} slot: ${value}`);
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 0 || slot > 4) throw new Error(`Invalid ${label} slot: ${value}`);
  return slot;
}

function reorderLanguageSlots(source, target) {
  if (source === target) return;

  const slots = [...state.settings.languages];
  const [item] = slots.splice(source, 1);
  slots.splice(target, 0, item);
  state.settings.languages = slots.slice(0, 5);
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

  const next = event.target.closest?.("[data-next-language]");
  if (next) {
    go(state.query, next.dataset.nextLanguage);
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
  } else if (control.dataset.action === "force-recache") {
    event.preventDefault();
    forceRecache().catch((failure) => {
      state.recacheFailure = failure;
      render();
    });
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
  state.query = state.page ? "" : nextParams.get("q") || "";
  state.selectedLanguage = state.page ? "" : nextParams.get("tl") || "";
  state.lookup = null;
  state.settingsOpen = false;
  state.editing = null;
  render();
});

render();
