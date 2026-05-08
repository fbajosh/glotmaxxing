import { esc } from "./html.js";

const NO_SENSE_TRANSLATIONS_RE = /^No sense-level translations parsed for .+$/;
const NO_RESULT_RE = /^No result$/;

export function errorView(query, failure) {
  const message = errorMessage(failure);
  if (!message) return "";

  return `
    <article class="error-page">
      <h1>${esc(query)}</h1>
      <p class="error-message">${esc(message)}</p>
    </article>
  `;
}

function errorMessage(failure) {
  const message = failure?.message || String(failure);
  if (NO_SENSE_TRANSLATIONS_RE.test(message)) return "No sense-level translations available";
  if (NO_RESULT_RE.test(message)) return "No result";
  return "";
}
