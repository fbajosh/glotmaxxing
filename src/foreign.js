import { esc, title } from "./html.js";

export function foreignView(result) {
  return `
    <article>
      <h1>${esc(result.entry.term)}</h1>
      <p class="language">${esc(result.entry.language)}</p>
      ${result.notice ? `<p class="notice">${esc(result.notice)}</p>` : ""}
      ${pronunciation(result.entry)}
      ${parts(result.entry.partsOfSpeech)}
      ${nextLanguage(result.nextLanguage)}
      ${etymology(result.entry)}
    </article>
  `;
}

function parts(items) {
  if (!Array.isArray(items) || !items.length) throw new Error("Foreign entry has no parts of speech");

  return items.map((part) => `
    <section class="part">
      <h3>${esc(title(part.pos))}${part.gender ? ` <span>${esc(part.gender)}</span>` : ""}</h3>
      <ol>${definitions(part).map((definition) => `<li>${esc(definition)}</li>`).join("")}</ol>
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

function pronunciation(entry) {
  return entry.pronunciations?.length
    ? `<p class="pronunciation">${entry.pronunciations.map(esc).join(", ")}</p>`
    : "";
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
        ${entry.etymologyNotes.map((note) => `<li>${note.split("\n\n").map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</li>`).join("")}
      </ol>
    </details>
  `;
}
