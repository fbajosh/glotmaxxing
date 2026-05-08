import { HEADING_RE, cleanWikiText, languageSection } from "./wiktionary.js";

export const FOREIGN_POS_RE = /^(noun|verb|adjective|adverb|proper noun|pronoun|preposition|conjunction|interjection|determiner|article|numeral|phrase|proverb|verb form)$/i;
export const IPA_RE = /\{\{IPA\|([^{}]+)\}\}/g;

export function parseForeignEntry(term, wikitext, language) {
  const section = languageSection(wikitext, language);
  const partsOfSpeech = parseParts(section);
  if (!partsOfSpeech.length) throw new Error(`No usable ${language} entry parsed for ${term}`);

  return {
    term,
    language,
    pronunciations: parsePronunciations(section),
    partsOfSpeech,
    etymologyNotes: parseEtymology(section)
  };
}

function parseParts(section) {
  const parts = [];
  let current = null;

  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(HEADING_RE);

    if (heading) {
      const text = cleanWikiText(heading[2]);
      current = FOREIGN_POS_RE.test(text) ? { pos: text.toLowerCase(), definitions: [] } : null;
      if (current) parts.push(current);
      continue;
    }

    if (!current || !line.startsWith("#") || /^#[:*]/.test(line)) continue;
    const definition = cleanWikiText(line.replace(/^#+\s*/, ""));
    if (definition) current.definitions.push(definition);
  }

  return parts.filter((part) => part.definitions.length);
}

function parsePronunciations(section) {
  return [...section.matchAll(IPA_RE)]
    .map((match) => match[1].split("|").find((part) => /^\/.+\/$/.test(part)))
    .filter(Boolean);
}

function parseEtymology(section) {
  const notes = [];
  let current = -1;
  let collecting = false;

  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(HEADING_RE);

    if (heading) {
      collecting = /^Etymology\b/i.test(cleanWikiText(heading[2]));
      if (collecting) notes[++current] = "";
      continue;
    }

    if (collecting && current >= 0 && line && !line.startsWith("{|") && !line.startsWith("|")) {
      const note = cleanWikiText(line);
      if (note) notes[current] += `${notes[current] ? "\n\n" : ""}${note}`;
    }
  }

  return notes.filter(Boolean);
}
