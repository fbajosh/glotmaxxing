import { esc, title, wiki } from "./html.js";

export function foreignView(result) {
  return `
    <article>
      <h1>${esc(result.entry.term)}</h1>
      ${languageLine(result.entry)}
      ${result.notice ? `<p class="notice">${esc(result.notice)}</p>` : ""}
      ${redirectedFrom(result.entry)}
      ${partsTable(result.entry.partsOfSpeech)}
      ${etymology(result.entry)}
      ${nextLanguage(result.nextLanguage)}
    </article>
  `;
}

function languageLine(entry) {
  if (!entry.language) throw new Error(`Foreign entry for ${entry.term} is missing a language`);
  return `<p class="foreign-language">${esc(entry.language)}</p>`;
}

function partsTable(items) {
  if (!Array.isArray(items) || !items.length) throw new Error("Foreign entry has no parts of speech");

  return `
    <table class="result-table foreign-table">
      <tbody>
        ${items.map((part) => `
          <tr class="part-header"><th>${esc(title(part.pos))}</th></tr>
          ${part.formOf?.label ? `<tr><td class="form-of">form: ${wiki(part.formOf.label)}</td></tr>` : ""}
          ${definitions(part).map((definition) => `
            <tr><td>${wiki(definition)}</td></tr>
          `).join("")}
          ${part.alternateForms?.length ? `<tr><td class="alternate-forms">alternate forms: ${part.alternateForms.map(wiki).join(", ")}</td></tr>` : ""}
          <tr class="part-gap" aria-hidden="true"><td></td></tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function definitions(part) {
  if (!part.pos) throw new Error("Foreign part is missing a part of speech");
  if (!Array.isArray(part.definitions) || !part.definitions.length) {
    throw new Error(`Foreign ${part.pos} entry has no definitions`);
  }
  return part.definitions;
}

function redirectedFrom(entry) {
  if (!entry.redirectedFrom) return "";
  return `<p class="redirected-from">redirected from ${differenceText(entry.redirectedFrom, entry.term)}</p>`;
}

function differenceText(source, target) {
  const sourceLetters = Array.from(source);
  const targetLetters = Array.from(target);

  return sourceLetters.map((letter, index) => {
    const rendered = esc(letter);
    return letter === targetLetters[index] ? rendered : `<u>${rendered}</u>`;
  }).join("");
}

function nextLanguage(language) {
  if (!language) return "";
  return `
    <section class="entry-section next-language">
      <button type="button" data-next-language="${esc(language)}">Next: ${esc(language)}</button>
    </section>
  `;
}

function etymology(entry) {
  if (!entry.etymologyNotes?.length) return "";
  return `
    <details class="entry-section etymology">
      <summary>Etymology</summary>
      <ol>
        ${entry.etymologyNotes.map((note) => `<li>${note.split("\n\n").map((paragraph) => `<p>${wiki(paragraph)}</p>`).join("")}</li>`).join("")}
      </ol>
    </details>
  `;
}
