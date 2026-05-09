import { esc, title, wiki } from "./html.js";

export function englishView(entry, targetLanguage, preferredLanguages) {
  const availableLanguages = preferredLanguages.filter((language) => hasTranslations(entry, language));

  return `
    <article>
      <h1>${esc(entry.term)}</h1>
      ${translationTable(entry, targetLanguage)}
      ${availableTable(availableLanguages.filter((language) => language !== targetLanguage))}
      ${etymology(entry)}
    </article>
  `;
}

export function englishTarget(entry, languages, requested) {
  if (requested) {
    if (!languages.includes(requested)) throw new Error(`${requested} is not in preferred languages for ${entry.term}`);
    if (!hasTranslations(entry, requested)) throw new Error(`No ${requested} translations parsed for ${entry.term}`);
    return requested;
  }

  const language = languages.find((item) => hasTranslations(entry, item));
  if (!language) throw new Error(`No preferred translation language selected for ${entry.term}`);
  return language;
}

function translationTable(entry, language) {
  if (!Array.isArray(entry.translationGroups) || !entry.translationGroups.length) {
    throw new Error(`No sense-level translations parsed for ${entry.term}`);
  }

  if (!language) throw new Error(`No preferred translation language selected for ${entry.term}`);

  const groups = entry.translationGroups.map((group) => {
    const rows = group.senses
      .map((sense) => [sense.gloss, sense.translations?.[language] || []])
      .filter((row) => row[1].length);
    if (!rows.length) return "";

    return `
      <tr class="part-header"><th>${esc(title(group.pos))}</th><th>${esc(language)}</th></tr>
      ${rows.map(([gloss, translations]) => `
        <tr><td>${wiki(gloss)}</td><td>${translations.map(translationLink).join(", ")}</td></tr>
      `).join("")}
      <tr class="part-gap" aria-hidden="true"><td colspan="2"></td></tr>
    `;
  }).join("");

  if (!groups) throw new Error(`No ${language} sense translations parsed for ${entry.term}`);
  return `
    <table class="result-table">
      <tbody>${groups}</tbody>
    </table>
  `;
}

function translationLink(translation) {
  if (typeof translation === "string") return wiki(translation);

  if (!translation?.query) throw new Error("Linked English translation is missing a query");
  if (!translation.text) throw new Error(`Linked English translation for ${translation.query} is missing display text`);

  return `<a href="?q=${encodeURIComponent(translation.query)}" data-word-query="${esc(translation.query)}">${wiki(translation.text)}</a>${translation.qualifier ? ` ${esc(translation.qualifier)}` : ""}`;
}

function availableTable(languages) {
  if (!languages.length) return "";
  return `
    <table class="available-table">
      <thead><tr><th>Also available</th></tr></thead>
      <tbody>
        ${languages.map((language) => `
          <tr><td><button type="button" data-next-language="${esc(language)}">${esc(language)}</button></td></tr>
        `).join("")}
      </tbody>
    </table>
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

function hasTranslations(entry, language) {
  if (!Array.isArray(entry.translationGroups)) throw new Error(`Missing translation groups for ${entry.term}`);

  return entry.translationGroups.some((group) =>
    group.senses?.some((sense) => sense.translations?.[language]?.length)
  );
}
