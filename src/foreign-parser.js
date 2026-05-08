import { HEADING_RE, cleanWikiText, languageSection } from "./wiktionary.js?v=missing-search-20260508";

export const FOREIGN_POS_RE = /^(noun|verb|adjective|adverb|proper noun|pronoun|preposition|conjunction|interjection|determiner|article|numeral|phrase|proverb|verb form|noun form|adjective form)$/i;
export const FORM_OF_TEMPLATE_RE = /^\{\{([^{}]*\b(?:form of|plural of|feminine of|masculine of|inflection of)[^{}]*)\}\}/i;
export const HEAD_TEMPLATE_RE = /^\{\{(?:head|[-a-z]+-(?:noun|verb|adj|adjective|adv|adverb|proper noun))\b/i;

export function parseForeignEntry(term, wikitext, language) {
  const parsed = parseForeignSource(term, wikitext, language);
  const partsOfSpeech = parsed.partsOfSpeech.filter((part) => !part.formOf);
  if (!partsOfSpeech.length) throw new Error(`No usable ${language} entry parsed for ${term}`);

  return {
    term,
    language,
    partsOfSpeech,
    etymologyNotes: parsed.etymologyNotes
  };
}

export async function resolveForeignEntry(term, wikitext, language, tools) {
  if (!tools?.fetchWikitext) throw new Error("Foreign form-of resolution requires fetchWikitext");
  if (!tools?.expandTemplates) throw new Error("Foreign form-of resolution requires expandTemplates");

  const parsed = parseForeignSource(term, wikitext, language);
  const partsOfSpeech = [];
  const etymologyNotes = [];

  for (const part of parsed.partsOfSpeech) {
    if (!part.formOf) {
      partsOfSpeech.push(await resolveLemmaPart(term, part, tools.expandTemplates));
      etymologyNotes.push(...parsed.etymologyNotes);
      continue;
    }

    const lemmaWikitext = await tools.fetchWikitext(part.formOf.lemma);
    const lemma = parseForeignSource(part.formOf.lemma, lemmaWikitext, language);
    const lemmaPart = findLemmaPart(lemma.partsOfSpeech, part.pos, part.formOf.lemma);
    const label = await formLabel(term, part, tools.expandTemplates);

    partsOfSpeech.push({
      pos: displayPos(part.pos),
      formOf: { lemma: part.formOf.lemma, label },
      definitions: lemmaPart.definitions,
      alternateForms: await alternateForms(part.formOf.lemma, term, lemmaPart, tools.expandTemplates)
    });
    etymologyNotes.push(...lemma.etymologyNotes);
  }

  if (!partsOfSpeech.length) throw new Error(`No usable ${language} entry parsed for ${term}`);

  return {
    term,
    language,
    partsOfSpeech,
    etymologyNotes: unique(etymologyNotes)
  };
}

function parseForeignSource(term, wikitext, language) {
  const section = languageSection(wikitext, language);
  const partsOfSpeech = parseParts(section);
  if (!partsOfSpeech.length) throw new Error(`No usable ${language} entry parsed for ${term}`);

  return {
    term,
    language,
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
      current = FOREIGN_POS_RE.test(text) ? { pos: displayPos(text), definitions: [], headTemplates: [] } : null;
      if (current) parts.push(current);
      continue;
    }

    if (!current) continue;
    if (HEAD_TEMPLATE_RE.test(line)) current.headTemplates.push(line);
    if (!line.startsWith("#") || /^#[:*]/.test(line)) continue;

    const body = line.replace(/^#+\s*/, "");
    const formOf = parseFormOf(body);
    if (formOf) {
      current.formOf = formOf;
      continue;
    }

    const definition = cleanWikiText(body);
    if (definition && !/^[:;]+$/.test(definition)) current.definitions.push(definition);
  }

  return parts.filter((part) => part.definitions.length || part.formOf);
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

function parseFormOf(body) {
  const match = body.match(FORM_OF_TEMPLATE_RE);
  if (!match) return null;

  const parts = match[1].split("|").map((part) => part.trim()).filter(Boolean);
  const template = parts.shift().toLowerCase();
  const lemma = template === "es-verb form of" ? parts[0] : parts[1];
  if (!lemma) throw new Error(`Form-of template missing lemma: ${body}`);

  return { lemma, body };
}

async function resolveLemmaPart(term, part, expandTemplates) {
  if (!part.definitions.length) throw new Error(`Foreign ${part.pos} entry has no definitions for ${term}`);

  return {
    pos: displayPos(part.pos),
    definitions: part.definitions,
    alternateForms: await alternateForms(term, term, part, expandTemplates)
  };
}

function findLemmaPart(parts, pos, lemma) {
  const target = displayPos(pos);
  const part = parts.find((item) => displayPos(item.pos) === target && item.definitions.length && !item.formOf);
  if (!part) throw new Error(`Lemma ${lemma} has no ${target} definitions`);
  return part;
}

async function formLabel(title, part, expandTemplates) {
  const expanded = await expandTemplates(title, part.formOf.body);
  const label = expandedText(expanded);
  const tags = grammaticalTags(part.headTemplates);
  return tags ? `${label}, ${tags}` : label;
}

async function alternateForms(title, searchedTerm, part, expandTemplates) {
  if (!part.headTemplates.length) return [];

  const expanded = await expandTemplates(title, part.headTemplates[0]);
  const text = expandedText(expanded);
  const match = text.match(/\(([^()]+)\)/);
  if (!match) return [];

  return match[1]
    .split(/\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !sameEndingTerm(item, searchedTerm));
}

function expandedText(value) {
  return cleanWikiText(
    value
      .replace(/\[\[Category:[^\]]+\]\]/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&#32;/g, " ")
      .replace(/&amp;/g, "&")
  );
}

function grammaticalTags(headTemplates) {
  const genders = headTemplates
    .flatMap((line) => [...line.matchAll(/\bg=([^|}]+)/g)].map((match) => match[1]))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace("-p", " pl"));

  return genders.join(", ");
}

function sameEndingTerm(value, term) {
  return value.split(/\s+/).at(-1)?.normalize("NFC") === term.normalize("NFC");
}

function displayPos(pos) {
  return pos.toLowerCase().replace(/\s+form$/, "");
}

function unique(items) {
  return [...new Set(items)];
}
