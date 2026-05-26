import { esc } from "./html.js";

export const ERROR_LOG_KEY = "glotmaxxing.errorLog";
export const DEVICE_ID_KEY = "glotmaxxing.deviceId";

const MAX_ENTRIES = 200;
const MAX_STACK_LENGTH = 6000;
const MAX_MESSAGE_LENGTH = 1000;

export function appendErrorLogEntry({ description, error, context = {}, datetime = new Date().toISOString() } = {}, options = {}) {
  const storage = storageFrom(options);
  const entry = errorLogEntry({ description, error, context, datetime }, storage);

  console.error(`[Glotmaxxing] ${entry.description}`, error);

  if (!storage) return entry;

  const entries = [...loadErrorLog({ storage }), entry].slice(-MAX_ENTRIES);
  if (saveErrorLog(entries, storage)) return entry;

  saveErrorLog(entries.slice(-Math.floor(MAX_ENTRIES / 4)), storage);
  return entry;
}

export function loadErrorLog(options = {}) {
  const storage = storageFrom(options);
  if (!storage) return [];

  try {
    const raw = storage.getItem(ERROR_LOG_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw);
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export function clearErrorLog(options = {}) {
  const storage = storageFrom(options);
  if (!storage) return;

  try {
    storage.removeItem(ERROR_LOG_KEY);
  } catch {
    // Logging should never become another app failure.
  }
}

export function errorLogView(entries = []) {
  const json = JSON.stringify(entries, null, 2);

  return `
    <article class="error-log-page">
      <h1>Error log</h1>
      <p class="error-log-count">${entries.length} ${entries.length === 1 ? "entry" : "entries"}</p>
      <nav class="error-log-actions" aria-label="Error log actions">
        <a href="${jsonDataUrl(json)}" download="glotmaxxing-error-log.json">Export JSON</a>
        <button type="button" data-action="clear-error-log">Clear log</button>
      </nav>
      <pre class="error-log-json">${esc(json)}</pre>
    </article>
  `;
}

function errorLogEntry({ description, error, context, datetime }, storage) {
  return {
    id: randomId(),
    deviceId: deviceId(storage),
    datetime,
    description: boundedString(description || "error", MAX_MESSAGE_LENGTH),
    ...safeContext(context),
    error: normalizeError(error)
  };
}

function safeContext(context) {
  if (!context || typeof context !== "object") return {};

  return {
    appVersion: stringOrEmpty(context.appVersion),
    url: stringOrEmpty(context.url),
    page: stringOrEmpty(context.page),
    query: stringOrEmpty(context.query),
    selectedLanguage: stringOrEmpty(context.selectedLanguage),
    resultLanguage: stringOrEmpty(context.resultLanguage),
    settings: cloneJson(context.settings)
  };
}

function normalizeError(error) {
  if (error instanceof Error) {
    return {
      name: boundedString(error.name || "Error", MAX_MESSAGE_LENGTH),
      message: boundedString(error.message || "", MAX_MESSAGE_LENGTH),
      stack: boundedString(error.stack || "", MAX_STACK_LENGTH),
      code: stringOrEmpty(error.code)
    };
  }

  if (error && typeof error === "object") {
    return {
      name: boundedString(error.name || error.constructor?.name || "Error", MAX_MESSAGE_LENGTH),
      message: boundedString(error.message || String(error), MAX_MESSAGE_LENGTH),
      stack: boundedString(error.stack || "", MAX_STACK_LENGTH),
      code: stringOrEmpty(error.code)
    };
  }

  return {
    name: "Error",
    message: boundedString(String(error ?? ""), MAX_MESSAGE_LENGTH),
    stack: "",
    code: ""
  };
}

function deviceId(storage) {
  if (!storage) return "";

  try {
    const saved = storage.getItem(DEVICE_ID_KEY);
    if (saved) return saved;

    const id = randomId();
    storage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

function saveErrorLog(entries, storage) {
  try {
    storage.setItem(ERROR_LOG_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function storageFrom({ storage } = {}) {
  if (storage) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function boundedString(value, maxLength) {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function stringOrEmpty(value) {
  return value === undefined || value === null ? "" : boundedString(value, MAX_MESSAGE_LENGTH);
}

function cloneJson(value) {
  if (value === undefined) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function jsonDataUrl(json) {
  return `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
}
