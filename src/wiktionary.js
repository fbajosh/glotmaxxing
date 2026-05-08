export const HEADING_RE = /^(=+)\s*(.*?)\s*\1$/;

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

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wiktionary request failed for ${page}`);

  const data = await response.json();
  if (data.error) throw new Error(`Wiktionary error for ${page}: ${data.error.info}`);
  if (!data.parse?.wikitext) throw new Error(`No wikitext returned for ${page}`);
  return data.parse.wikitext;
}

export function hasLanguageSection(wikitext, language) {
  return Boolean(sectionBounds(wikitext, language));
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

function sliceSection({ lines, start, end }) {
  return lines.slice(start + 1, end).join("\n");
}

export function cleanWikiText(value) {
  let text = String(value || "")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
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

  if (["lb", "label", "qualifier", "q"].includes(name)) return parts.slice(1).length ? `(${parts.slice(1).join(", ")})` : "";
  if (["gloss", "non-gloss definition", "ngd"].includes(name)) return parts[0] || "";
  if (["ux", "uxi", "quote", "quote-book", "quote-journal", "quote-web"].includes(name)) return "";
  if (["senseid", "syn", "ant", "hyper", "hypo", "topics", "catlangname"].includes(name)) return "";

  const explicitGloss = parts.find((part) => part.startsWith("t=") || part.startsWith("gloss="));
  if (explicitGloss) return explicitGloss.split("=").slice(1).join("=");

  return parts.filter((part) => !part.includes("=")).at(-1) || "";
}
