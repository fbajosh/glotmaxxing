export const HEADING_RE = /^(=+)\s*(.*?)\s*\1$/;
export const WIKIMEDIA_CLIENT = "Glotmaxxing/0.1.0 (https://github.com/fbajosh/glotmaxxing)";
export const WIKI_LINK_OPEN = "\u0001";
export const WIKI_LINK_CLOSE = "\u0002";
const ETYMOLOGY_LANGUAGE_NAMES = {
  aa: "Afar",
  ab: "Abkhaz",
  af: "Afrikaans",
  ak: "Akan",
  an: "Aragonese",
  av: "Avar",
  ay: "Aymara",
  az: "Azerbaijani",
  be: "Belarusian",
  bi: "Bislama",
  bm: "Bambara",
  br: "Breton",
  ca: "Catalan",
  ce: "Chechen",
  ch: "Chamorro",
  co: "Corsican",
  cr: "Cree",
  cs: "Czech",
  cy: "Welsh",
  da: "Danish",
  de: "German",
  ee: "Ewe",
  en: "English",
  eo: "Esperanto",
  es: "Spanish",
  et: "Estonian",
  eu: "Basque",
  ff: "Fula",
  fi: "Finnish",
  fj: "Fijian",
  fo: "Faroese",
  fr: "French",
  fy: "West Frisian",
  ga: "Irish",
  gd: "Scottish Gaelic",
  gl: "Galician",
  gv: "Manx",
  ha: "Hausa",
  ho: "Hiri Motu",
  ht: "Haitian Creole",
  hu: "Hungarian",
  hz: "Herero",
  ia: "Interlingua",
  id: "Indonesian",
  ie: "Interlingue",
  ig: "Igbo",
  ik: "Inupiaq",
  io: "Ido",
  is: "Icelandic",
  it: "Italian",
  iu: "Inuktitut",
  ja: "Japanese",
  jv: "Javanese",
  kg: "Kongo",
  ki: "Kikuyu",
  kj: "Kwanyama",
  kk: "Kazakh",
  kl: "Greenlandic",
  kr: "Kanuri",
  ks: "Kashmiri",
  kw: "Cornish",
  ky: "Kyrgyz",
  la: "Latin",
  lb: "Luxembourgish",
  lg: "Luganda",
  li: "Limburgish",
  ln: "Lingala",
  lt: "Lithuanian",
  lu: "Luba-Katanga",
  lv: "Latvian",
  mg: "Malagasy",
  mh: "Marshallese",
  mi: "Māori",
  mn: "Mongolian",
  ms: "Malay",
  mt: "Maltese",
  na: "Nauruan",
  nb: "Norwegian Bokmål",
  nd: "Northern Ndebele",
  ng: "Ndonga",
  nl: "Dutch",
  nn: "Norwegian Nynorsk",
  no: "Norwegian",
  nr: "Southern Ndebele",
  nv: "Navajo",
  ny: "Chichewa",
  oc: "Occitan",
  oj: "Ojibwe",
  om: "Oromo",
  os: "Ossetian",
  pi: "Pali",
  pl: "Polish",
  pt: "Portuguese",
  qu: "Quechua",
  rm: "Romansh",
  ro: "Romanian",
  rw: "Rwanda-Rundi",
  sc: "Sardinian",
  se: "Northern Sami",
  sg: "Sango",
  sh: "Serbo-Croatian",
  sk: "Slovak",
  sl: "Slovene",
  sm: "Samoan",
  sn: "Shona",
  so: "Somali",
  sq: "Albanian",
  ss: "Swazi",
  st: "Sotho",
  su: "Sundanese",
  sv: "Swedish",
  sw: "Swahili",
  tg: "Tajik",
  tk: "Turkmen",
  tl: "Tagalog",
  tn: "Tswana",
  to: "Tongan",
  tr: "Turkish",
  ts: "Tsonga",
  tt: "Tatar",
  ty: "Tahitian",
  ug: "Uyghur",
  uz: "Uzbek",
  ve: "Venda",
  vi: "Vietnamese",
  vo: "Volapük",
  wa: "Walloon",
  wo: "Wolof",
  xh: "Xhosa",
  yi: "Yiddish",
  yo: "Yoruba",
  za: "Zhuang",
  zh: "Chinese",
  zu: "Zulu",
};

export async function fetchWikitext(page) {
  const url = new URL("https://en.wiktionary.org/w/api.php");
  url.search = new URLSearchParams({
    action: "parse",
    page,
    prop: "wikitext",
    format: "json",
    formatversion: "2",
    origin: "*"
  });

  const response = await fetch(url, { headers: wikimediaHeaders() });
  if (!response.ok) throw new Error(`Wiktionary request failed for ${page}: ${response.status} ${response.statusText}`);

  const data = await response.json();
  if (data.error) throw wiktionaryError(`Wiktionary error for ${page}: ${data.error.info}`, data.error.code);
  if (!data.parse?.wikitext) throw new Error(`No wikitext returned for ${page}`);
  return data.parse.wikitext;
}

export async function searchTitles(query, limit = 8) {
  const url = new URL("https://en.wiktionary.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    format: "json",
    formatversion: "2",
    origin: "*"
  });

  const response = await fetch(url, { headers: wikimediaHeaders() });
  if (!response.ok) throw new Error(`Wiktionary search failed for ${query}: ${response.status} ${response.statusText}`);

  const data = await response.json();
  if (data.error) throw wiktionaryError(`Wiktionary search error for ${query}: ${data.error.info}`, data.error.code);
  if (!Array.isArray(data.query?.search)) throw new Error(`No search results returned for ${query}`);
  return data.query.search.map((result) => result.title);
}

export async function expandTemplates(title, text) {
  const url = new URL("https://en.wiktionary.org/w/api.php");
  url.search = new URLSearchParams({
    action: "expandtemplates",
    title,
    text,
    prop: "wikitext",
    format: "json",
    formatversion: "2",
    origin: "*"
  });

  const response = await fetch(url, { headers: wikimediaHeaders() });
  if (!response.ok) throw new Error(`Wiktionary template expansion failed for ${title}: ${response.status} ${response.statusText}`);

  const data = await response.json();
  if (data.error) throw new Error(`Wiktionary template expansion error for ${title}: ${data.error.info}`);
  if (typeof data.expandtemplates?.wikitext !== "string") throw new Error(`No expanded template text returned for ${title}`);
  return data.expandtemplates.wikitext;
}

export function hasLanguageSection(wikitext, language) {
  return Boolean(sectionBounds(wikitext, language));
}

export function isMissingTitle(error) {
  return error?.code === "missingtitle";
}

function wikimediaHeaders() {
  const headers = { "Api-User-Agent": WIKIMEDIA_CLIENT };
  if (globalThis.process?.versions?.node) headers["User-Agent"] = WIKIMEDIA_CLIENT;
  return headers;
}

export function languageSection(wikitext, language) {
  const bounds = sectionBounds(wikitext, language);
  if (!bounds) throw new Error(`${language} section not found`);
  return sliceSection(bounds);
}

export function languageSectionText(wikitext, language) {
  const bounds = sectionBounds(wikitext, language);
  return bounds ? sliceSection(bounds) : "";
}

function sectionBounds(wikitext, language) {
  if (typeof wikitext !== "string") throw new Error(`Expected wikitext string while finding ${language}`);

  const lines = wikitext.split("\n");
  const start = lines.findIndex((line) => line.trim() === `==${language}==`);
  if (start < 0) return null;

  const end = lines.findIndex((line, index) =>
    index > start && /^==[^=].*==\s*$/.test(line.trim())
  );

  return { lines, start, end: end < 0 ? lines.length : end };
}

function wiktionaryError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sliceSection({ lines, start, end }) {
  return lines.slice(start + 1, end).join("\n");
}

export function cleanWikiText(value) {
  let text = String(value || "")
    .replace(/\[\[[^|\]#]+(?:#[^|\]]*)?\|([^\]]+)\]\]/g, `${WIKI_LINK_OPEN}$1${WIKI_LINK_CLOSE}`)
    .replace(/\[\[([^|\]#]+)(?:#[^\]]*)?\]\]/g, `${WIKI_LINK_OPEN}$1${WIKI_LINK_CLOSE}`)
    .replace(/'''?/g, "");

  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(/\{\{([^{}]+)\}\}/g, (_, body) => templateText(body));
  }

  return text
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function templateText(body) {
  const parts = body.split("|").map((part) => part.trim()).filter(Boolean);
  const name = (parts.shift() || "").toLowerCase();

  if (["lb", "label", "qualifier", "q"].includes(name)) return labelText(parts);
  if (["gl", "gloss"].includes(name)) return parts[0] ? `(${parts[0]})` : "";
  if (["non-gloss definition", "ngd"].includes(name)) return parts[0] || "";
  if (["der", "derived", "inh", "inherited", "bor", "borrowed"].includes(name)) return etymologyTerm(parts);
  if (["root", "dercat"].includes(name)) return "";
  if (name === "+obj") return objectUsage(parts.slice(1));
  if (["ux", "uxi", "quote", "quote-book", "quote-journal", "quote-web"].includes(name)) return "";
  if (["senseid", "syn", "ant", "hyper", "hypo", "topics", "catlangname"].includes(name)) return "";

  const explicitGloss = parts.find((part) => part.startsWith("t=") || part.startsWith("gloss="));
  if (explicitGloss) return explicitGloss.split("=").slice(1).join("=");

  return parts.filter((part) => !part.includes("=")).at(-1) || "";
}

function etymologyTerm(parts) {
  const sourceLanguage = ETYMOLOGY_LANGUAGE_NAMES[parts[1]] || parts[1];
  const term = parts[2];
  if (!sourceLanguage || !term) return term || "";
  return `${sourceLanguage} ${term}`;
}

function objectUsage(specs) {
  const clauses = specs.map(objectClause).filter(Boolean);
  return clauses.length ? `[${clauses.join("; or ")}]` : "";
}

function objectClause(spec) {
  const parts = spec.split(/\s+\+\s+/).map(objectPart).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return `with ${parts[0]}`;
  return `with ${parts[0]}, ${parts.slice(1).map((part) => `along with ${part}`).join(", ")}`;
}

function objectPart(value) {
  const gloss = value.match(/<([^<>]+)>/)?.[1] || "";
  const base = value.replace(/<[^<>]+>/g, "").trim();
  const alternatives = base.split("/").map(objectAtom).filter(Boolean);
  const text = alternatives.join(" or ");
  if (gloss.startsWith("q:")) return `(${gloss.slice(2)}) ${text}`;
  return gloss ? `${text} ‘${gloss}’` : text;
}

function objectAtom(value) {
  const atom = value.trim();
  const literal = atom.match(/^:+([^()]+)(?:\(([^)]+)\))?$/);
  if (literal) {
    const word = literal[1].replace(/^!/, "");
    return literal[2] ? `${word} (+ ${objectTag(literal[2])})` : word;
  }

  return objectTag(atom);
}

function objectTag(value) {
  const aliases = {
    acc: "accusative",
    dat: "dative",
    gen: "genitive",
    inf: "infinitive",
    nom: "nominative",
    ins: "instrumental",
    loc: "locative",
    part: "participle",
    dirobj: "direct object",
    indirobj: "indirect object"
  };

  return value
    .split("&")
    .map((part) => aliases[part] || part.replaceAll("-", " "))
    .join(" and ");
}

function labelText(parts) {
  const labels = parts.slice(1).filter((part) => part && part !== "_");
  return labels.length ? `(${labels.join(", ")})` : "";
}
