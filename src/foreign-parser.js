import { HEADING_RE, cleanWikiText, languageSection } from "./wiktionary.js";

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
      const resolved = await resolveLemmaPart(term, part, tools.expandTemplates);
      if (resolved.pos === "verb") {
        resolved.conjugation = await conjugationChart(term, parsed.section, tools.expandTemplates);
      }
      partsOfSpeech.push(resolved);
      etymologyNotes.push(...parsed.etymologyNotes);
      continue;
    }

    const lemmaWikitext = await tools.fetchWikitext(part.formOf.lemma);
    const lemma = parseForeignSource(part.formOf.lemma, lemmaWikitext, language);
    const lemmaPart = findLemmaPart(lemma.partsOfSpeech, part.pos, part.formOf.lemma);
    const label = await formLabel(term, part, tools.expandTemplates);

    const resolved = {
      pos: displayPos(part.pos),
      formOf: { lemma: part.formOf.lemma, label },
      definitions: lemmaPart.definitions,
      alternateForms: await alternateForms(part.formOf.lemma, term, lemmaPart, tools.expandTemplates)
    };
    if (resolved.pos === "verb") {
      resolved.conjugation = await conjugationChart(part.formOf.lemma, lemma.section, tools.expandTemplates);
    }

    partsOfSpeech.push(resolved);
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
    section,
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
  const lemma = /^[a-z-]+-verb form of$/.test(template) ? parts[0] : parts[1];
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

async function conjugationChart(lemma, source, expandTemplates) {
  const section = subsection(source, "Conjugation");
  if (!section) throw new Error(`No conjugation section parsed for ${lemma}`);

  const expanded = await expandTemplates(lemma, section);
  const rows = parseWikiTableRows(expanded);
  const chart = {
    lemma,
    nonfinite: parseNonfinite(rows),
    tenses: parseFiniteTenses(rows)
  };

  if (!chart.tenses.length) throw new Error(`No indicative or subjunctive conjugation rows parsed for ${lemma}`);
  return chart;
}

function subsection(section, name) {
  const lines = section.split("\n");
  const start = lines.findIndex((line) => {
    const heading = line.trim().match(HEADING_RE);
    return heading && cleanWikiText(heading[2]).toLowerCase() === name.toLowerCase();
  });
  if (start < 0) return "";

  const level = lines[start].match(/^(=+)/)[1].length;
  const end = lines.findIndex((line, index) => {
    const heading = line.trim().match(HEADING_RE);
    return index > start && heading && heading[1].length <= level;
  });

  return lines.slice(start + 1, end < 0 ? lines.length : end).join("\n").trim();
}

function parseWikiTableRows(wikitext) {
  const rows = [];
  let current = null;
  let inTable = false;

  for (const rawLine of wikitext.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("{|")) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (line.startsWith("|}")) {
      if (current?.length) rows.push(current);
      break;
    }
    if (line.startsWith("|-")) {
      if (current?.length) rows.push(current);
      current = [];
      continue;
    }
    if (!current || !/^[!|]/.test(line)) continue;
    current.push(...parseWikiCells(line));
  }

  return rows.filter((row) => row.length);
}

function parseWikiCells(line) {
  const kind = line[0] === "!" ? "header" : "cell";
  const delimiter = kind === "header" ? "!!" : "||";
  return line.slice(1)
    .split(delimiter)
    .map((segment) => parseWikiCell(kind, segment))
    .filter((cell) => cell.text || cell.raw);
}

function parseWikiCell(kind, segment) {
  const raw = segment.trim();
  const content = cellContent(raw);
  return {
    kind,
    raw,
    content,
    classes: cellClasses(raw),
    text: cleanConjugationText(content)
  };
}

function cellContent(raw) {
  const hasCellAttributes = !raw.startsWith("<") && /\b(?:class|style|rowspan|colspan|align|scope|width|data-[\w-]+)=/i.test(raw);
  if (!hasCellAttributes) return raw;

  const separator = raw.indexOf("|");
  return separator < 0 ? "" : raw.slice(separator + 1).trim();
}

function cellClasses(raw) {
  const match = raw.match(/\bclass="([^"]+)"/i);
  return match ? match[1].split(/\s+/) : [];
}

function parseNonfinite(rows) {
  const items = [];
  let pending = "";

  for (const row of rows) {
    const label = nonfiniteLabel(row.map((cell) => cell.text).join(" "));
    const forms = row.filter((cell) => cell.kind === "cell").flatMap(formsFromCell);

    if (label) {
      pending = label;
      if (forms.length) {
        addNonfinite(items, label, forms[0]);
        pending = "";
      }
      continue;
    }

    if (pending && forms.length) {
      addNonfinite(items, pending, forms[0]);
      pending = "";
    }
  }

  return items;
}

function nonfiniteLabel(text) {
  if (/\b(?:infinitive|infinitivo)\b/i.test(text)) return "Infinitive";
  if (/\b(?:gerund|gerundio|gerúndio)\b/i.test(text)) return "Gerund";
  if (/\b(?:past participle|participio|particípio)\b/i.test(text)) return "Past participle";
  return "";
}

function addNonfinite(items, label, value) {
  if (!value || items.some((item) => item.label === label)) return;
  items.push({ label, value });
}

function parseFiniteTenses(rows) {
  const tenses = [];
  let mood = "";

  for (const row of rows) {
    const nextMood = moodFromRow(row);
    if (nextMood) {
      mood = nextMood;
      continue;
    }
    if (!["indicative", "subjunctive"].includes(mood)) continue;

    const forms = row.filter((cell) => cell.kind === "cell").map((cell) => formsFromCell(cell).join(", "));
    if (forms.length !== 6 || forms.some((form) => !form)) continue;

    const name = tenseName(row, mood);
    if (!name) continue;

    tenses.push({
      mood,
      name,
      rows: [
        { person: "1st", singular: forms[0], plural: forms[3] },
        { person: "2nd", singular: forms[1], plural: forms[4] },
        { person: "3rd", singular: forms[2], plural: forms[5] }
      ]
    });
  }

  return tenses;
}

function moodFromRow(row) {
  const text = row.map((cell) => cell.text).join(" ").toLowerCase();
  const classes = row.flatMap((cell) => cell.classes);
  if (classes.includes("roa-imperative-left-rail") && /imperative|imperativo/.test(text)) return "imperative";
  if (classes.includes("roa-indicative-left-rail") && /indicative|indicativo/.test(text)) return "indicative";
  if (classes.includes("roa-subjunctive-left-rail") && /subjunctive|subjuntivo|conjunctive|conjuntivo/.test(text)) return "subjunctive";
  return "";
}

function tenseName(row, mood) {
  const moodClass = `roa-${mood}-left-rail`;
  const header = row.find((cell) =>
    cell.kind === "header" &&
    (cell.classes.includes("roa-finite-header") || cell.classes.includes(moodClass)) &&
    !moodFromRow([cell])
  );
  return header ? normalizeTenseName(header.text) : "";
}

function normalizeTenseName(value) {
  return value
    .replace(/\s*,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formsFromCell(cell) {
  const linked = [...cell.content.matchAll(/\[\[:?([^|\]#]+)(?:#[^|\]]*)?\|([^\]]+)\]\]/g)]
    .map((match) => cleanConjugationText(match[2]))
    .filter(Boolean);
  if (linked.length) return unique(linked);

  const text = cleanConjugationText(cell.content);
  return text ? [text] : [];
}

function cleanConjugationText(value) {
  return String(value || "")
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<\/?sup[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#32;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/'''?/g, "")
    .replace(/\[\[:?([^|\]#]+)(?:#[^|\]]*)?\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[:?([^|\]#]+)(?:#[^\]]*)?\]\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
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
