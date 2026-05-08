import { SUPPORTED_LANGUAGES } from "./data.js";
import { HEADING_RE, cleanWikiText, languageSection, languageSectionText } from "./wiktionary.js";

export const ENGLISH_POS_RE = /^(noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection|determiner|article|numeral)$/i;
export const TRANSLATION_TOP_RE = /^\{\{trans-top(?:-see)?\|([^|{}]+)(?:\|[^{}]*)?\}\}/;
export const TRANSLATION_BOTTOM_RE = /^\{\{trans-bottom/;
export const TRANSLATION_TEMPLATE_RE = /\{\{(t\+?|t-|t-check|t-needed|tt|tt\+)\|([^{}]+)\}\}/g;
export const TRANSLATION_SUBPAGE_RE = /\{\{see translation subpage(?:\|[^{}]*)?\}\}/i;
export const GENDER_RE = /^(m|f|n|c|mf|m-p|f-p|p)$/;

const LANGUAGE_CODES = Object.fromEntries(SUPPORTED_LANGUAGES.map((item) => [item.name, item.code]));

export function englishSignals(wikitext) {
  const english = languageSectionText(wikitext, "English");
  if (!english) return { hasEnglish: false, ordinaryDefinitionCount: 0, parts: [] };

  const parts = parseEnglishParts(english);
  const ordinaryDefinitionCount = parts
    .filter((part) => ENGLISH_POS_RE.test(part.pos))
    .reduce((count, part) => count + part.definitions.length, 0);

  return { hasEnglish: true, ordinaryDefinitionCount, parts };
}

export function parseEnglishEntry(term, pageWikitext, translationWikitext) {
  const english = languageSection(pageWikitext, "English");
  const sources = Array.isArray(translationWikitext) ? translationWikitext : [translationWikitext];
  const translations = mergeTranslationGroups(sources.flatMap((source) => parseEnglishTranslationGroups(source)));
  if (!translations.length) throw new Error(`No sense-level translations parsed for ${term}`);

  return {
    term,
    language: "English",
    translationGroups: translations,
    etymologyNotes: parseEtymology(english)
  };
}

export function parseEnglishTranslationGroups(wikitext) {
  return parseTranslationGroups(languageSection(wikitext, "English"));
}

export function hasEnglishTranslationSubpageReference(wikitext) {
  return TRANSLATION_SUBPAGE_RE.test(languageSection(wikitext, "English"));
}

export function parseTranslationGroups(wikitext) {
  if (typeof wikitext !== "string") throw new Error("Expected English translation wikitext");

  const groups = [];
  let currentPos = "";
  let currentSense = null;

  for (const rawLine of wikitext.split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(HEADING_RE);

    if (heading) {
      const text = cleanWikiText(heading[2]);
      if (isEnglishPartOfSpeech(text)) currentPos = text.toLowerCase();
      continue;
    }

    const top = line.match(TRANSLATION_TOP_RE);
    if (top) {
      currentSense = { gloss: cleanWikiText(top[1]), translations: {} };
      const group = groups.find((item) => item.pos === currentPos) || { pos: currentPos || "translations", senses: [] };
      if (!groups.includes(group)) groups.push(group);
      group.senses.push(currentSense);
      continue;
    }

    if (TRANSLATION_BOTTOM_RE.test(line)) currentSense = null;
    if (!currentSense) continue;

    for (const [language, code] of Object.entries(LANGUAGE_CODES)) {
      if (!line.startsWith(`* ${language}:`) && !line.startsWith(`*: ${language}:`)) continue;
      const translations = translationsFromLine(line, code);
      if (translations.length) currentSense.translations[language] = translations;
    }
  }

  return groups
    .map((group) => ({ ...group, senses: group.senses.filter((sense) => Object.keys(sense.translations).length) }))
    .filter((group) => group.senses.length);
}

function mergeTranslationGroups(groups) {
  const merged = [];

  for (const group of groups) {
    let target = merged.find((item) => item.pos === group.pos);
    if (!target) {
      target = { pos: group.pos, senses: [] };
      merged.push(target);
    }
    target.senses.push(...group.senses);
  }

  return merged;
}

function parseEnglishParts(section) {
  const parts = [];
  let current = null;

  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(HEADING_RE);

    if (heading) {
      const text = cleanWikiText(heading[2]);
      current = isEnglishPartOfSpeech(text) ? { pos: text.toLowerCase(), definitions: [] } : null;
      if (current) parts.push(current);
      continue;
    }

    if (!current || !line.startsWith("#") || /^#[:*]/.test(line)) continue;
    const definition = cleanWikiText(line.replace(/^#+\s*/, ""));
    if (definition) current.definitions.push(definition);
  }

  return parts.filter((part) => part.definitions.length);
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

function translationsFromLine(line, code) {
  const results = [];
  let match;

  while ((match = TRANSLATION_TEMPLATE_RE.exec(line))) {
    const parts = match[2].split("|").map((part) => part.trim());
    if (parts[0] !== code || !parts[1]) continue;
    const gender = parts.find((part) => GENDER_RE.test(part));
    results.push(`${parts[1]} (${code})${gender ? ` ${gender.replace("-p", "")}` : ""}`);
  }

  return results.length ? results : [...line.matchAll(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g)]
    .map((item) => `${item[2] || item[1]} (${code})`);
}

function isEnglishPartOfSpeech(value) {
  return /^(noun|verb|adjective|adverb|proper noun|pronoun|preposition|conjunction|interjection|determiner|article|numeral|phrase|proverb)$/i.test(value);
}
