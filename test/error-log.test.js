import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVICE_ID_KEY,
  appendErrorLogEntry,
  clearErrorLog,
  errorLogView,
  loadErrorLog
} from "../src/error-log.js";

test("error log stores lookup failures with context", (t) => {
  silenceConsoleError(t);
  const storage = memoryStorage();
  const error = new Error("No result");
  error.code = "missingtitle";

  appendErrorLogEntry({
    description: "lookup failed",
    error,
    datetime: "2026-05-26T12:00:00.000Z",
    context: {
      appVersion: "dev",
      url: "https://example.test/?q=notaword",
      page: "",
      query: "notaword",
      selectedLanguage: "",
      resultLanguage: "",
      settings: { languages: ["Spanish"], darkMode: false }
    }
  }, { storage });

  const entries = loadErrorLog({ storage });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].datetime, "2026-05-26T12:00:00.000Z");
  assert.equal(entries[0].description, "lookup failed");
  assert.equal(entries[0].query, "notaword");
  assert.deepEqual(entries[0].settings, { languages: ["Spanish"], darkMode: false });
  assert.equal(entries[0].error.name, "Error");
  assert.equal(entries[0].error.message, "No result");
  assert.equal(entries[0].error.code, "missingtitle");
  assert.equal(entries[0].deviceId, storage.getItem(DEVICE_ID_KEY));
});

test("error log view renders exportable JSON and clear action", () => {
  const html = errorLogView([
    {
      id: "entry-1",
      deviceId: "device-1",
      datetime: "2026-05-26T12:00:00.000Z",
      description: "lookup failed",
      query: "notaword",
      error: { name: "Error", message: "No result", stack: "", code: "" }
    }
  ]);

  assert.match(html, /Error log/);
  assert.match(html, /1 entry/);
  assert.match(html, /download="glotmaxxing-error-log\.json"/);
  assert.match(html, /data-action="clear-error-log"/);
  assert.match(html, /lookup failed/);
  assert.match(html, /notaword/);
});

test("error log can be cleared", (t) => {
  silenceConsoleError(t);
  const storage = memoryStorage();

  appendErrorLogEntry({ description: "runtime error", error: new Error("boom") }, { storage });
  assert.equal(loadErrorLog({ storage }).length, 1);

  clearErrorLog({ storage });
  assert.deepEqual(loadErrorLog({ storage }), []);
});

function memoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function silenceConsoleError(t) {
  const original = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = original;
  });
}
