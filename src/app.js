import { SUPPORTED_LANGUAGES } from "./data.js";
import { englishTarget, englishView } from "./english.js";
import { errorView } from "./error.js";
import { foreignView } from "./foreign.js?v=missing-search-20260508";
import { icons, searchBar, esc } from "./html.js";
import { routeWord } from "./routing.js?v=missing-search-20260508";
import { splashView } from "./splash.js";

const SETTINGS_KEY = "glotmaxxing.settings";
const defaults = { languages: ["Spanish", "Portuguese", "", "", ""] };
const params = new URLSearchParams(location.search);
const app = document.querySelector("#app");
let dragState = null;
let suppressClick = false;
const state = {
  settings: loadSettings(),
  query: params.get("q") || "",
  selectedLanguage: params.get("tl") || "",
  lookup: null,
  settingsOpen: false,
  editing: null
};

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return { languages: normalizeSlots(defaults.languages) };

  const saved = JSON.parse(raw);
  if (!Array.isArray(saved.languages)) throw new Error("Saved settings must include a languages array");

  return {
    languages: normalizeSlots(saved.languages)
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

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function go(query, selectedLanguage = "") {
  const next = String(query || "").trim();
  if (!next) return;
  state.query = next;
  state.selectedLanguage = selectedLanguage;
  state.lookup = null;
  state.settingsOpen = false;

  const nextParams = new URLSearchParams({ q: next });
  if (selectedLanguage) nextParams.set("tl", selectedLanguage);
  history.pushState({}, "", `${location.pathname}?${nextParams.toString()}`);
  render();
}

function render() {
  app.innerHTML = state.query ? wordView() : splashView();
}

function wordView() {
  const lookup = currentLookup();
  const content = lookup.failure
    ? failureView(state.query, lookup.failure)
    : lookup.loading
      ? loadingView(state.query)
      : resultView(lookup.result);

  return `
    <header class="topbar">
      ${searchBar(state.query)}
      <button class="icon" type="button" data-action="settings" aria-label="Settings" title="Settings">${icons.menu}</button>
    </header>
    <main class="word">${content}</main>
    ${state.settingsOpen ? settingsView() : ""}
  `;
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
      <button class="close" type="button" data-action="close" aria-label="Close">x</button>
      <ol class="slots">${state.settings.languages.map(slotView).join("")}</ol>
    </div>
  `;
}

function slotView(language, index) {
  return `
    <li data-slot="${index}">
      <button type="button" data-action="edit" data-slot="${index}">${esc(language || "Set language")}</button>
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

  const next = event.target.closest?.("[data-next-language]");
  if (next) {
    go(state.query, next.dataset.nextLanguage);
    return;
  }

  const control = event.target.closest?.("[data-action]");
  if (!control) return;

  if (control.dataset.action === "settings") {
    state.settingsOpen = true;
  } else if (control.dataset.action === "close") {
    state.settingsOpen = false;
    state.editing = null;
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
  if (!row || event.target.closest?.("form, input, datalist")) return;

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
  state.query = nextParams.get("q") || "";
  state.selectedLanguage = nextParams.get("tl") || "";
  state.lookup = null;
  state.settingsOpen = false;
  render();
});

render();
