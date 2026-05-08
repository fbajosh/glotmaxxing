import { esc, title, wiki } from "./html.js?v=missing-search-20260508";

export function foreignView(result) {
  return `
    <article>
      <h1>${esc(result.entry.term)}</h1>
      ${result.notice ? `<p class="notice">${esc(result.notice)}</p>` : ""}
      ${redirectedFrom(result.entry)}
      ${parts(result.entry.partsOfSpeech)}
      ${etymology(result.entry)}
      ${nextLanguage(result.nextLanguage)}
    </article>
  `;
}

function parts(items) {
  if (!Array.isArray(items) || !items.length) throw new Error("Foreign entry has no parts of speech");

  return items.map((part) => `
    <section class="part">
      <h3>${esc(title(part.pos))}</h3>
      ${part.formOf?.label ? `<p class="form-of">${wiki(part.formOf.label)}</p>` : ""}
      <ol>${definitions(part).map((definition) => `<li>${wiki(definition)}</li>`).join("")}</ol>
      ${alternateForms(part.alternateForms)}
    </section>
  `).join("");
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

function alternateForms(items) {
  if (!items?.length) return "";
  return `<p class="alternate-forms">Alternate forms: ${items.map(wiki).join(", ")}</p>`;
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
