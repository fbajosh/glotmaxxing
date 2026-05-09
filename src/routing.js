import { englishSignals, hasEnglishTranslationSubpageReference, parseEnglishEntry, parseEnglishTranslationGroups } from "./english-parser.js";
import { resolveForeignEntry } from "./foreign-parser.js";
import { expandTemplates, fetchWikitext, hasLanguageSection, isMissingTitle, searchTitles } from "./wiktionary.js";

export const ENGLISH_RULES = {
  strongDefinitionMinimum: 3,
  someDefinitionMinimum: 2,
  routeToEnglish: new Set(["strong", "some"])
};

export function classifyEnglish(signals) {
  if (!signals.hasEnglish) return "none";
  if (signals.ordinaryDefinitionCount >= ENGLISH_RULES.strongDefinitionMinimum) return "strong";
  if (signals.ordinaryDefinitionCount >= ENGLISH_RULES.someDefinitionMinimum) return "some";
  return "minimal";
}

export async function routeWord({ query, preferredLanguages, selectedLanguage, tools = {} }) {
  const api = { fetchWikitext, expandTemplates, searchTitles, ...tools };
  const requestedTerm = query.trim();
  const lookup = await lookupWikitext(requestedTerm, preferredLanguages, api);
  const term = lookup.term;
  const pageWikitext = lookup.wikitext;

  const englishPresence = classifyEnglish(englishSignals(pageWikitext));
  const availableLanguages = preferredLanguages.filter((language) => hasLanguageSection(pageWikitext, language));

  if (!lookup.redirectedFrom && ENGLISH_RULES.routeToEnglish.has(englishPresence)) {
    const englishResult = await routeEnglish(term, pageWikitext, englishPresence, api);
    if (englishResult) return englishResult;
  }

  if (selectedLanguage && !availableLanguages.includes(selectedLanguage)) {
    throw new Error(`${selectedLanguage} section not available for ${term}`);
  }

  const selected = selectedLanguage || availableLanguages[0];

  if (!selected) return { kind: "none", term, englishPresence };

  return {
    kind: "entry",
    flow: "foreign",
    englishPresence,
    entry: redirectedEntry(
      await resolveForeignEntry(term, pageWikitext, selected, api),
      lookup.redirectedFrom
    ),
    availableLanguages,
    nextLanguage: availableLanguages[availableLanguages.indexOf(selected) + 1] || ""
  };
}

async function routeEnglish(term, pageWikitext, englishPresence, api) {
  try {
    parseEnglishTranslationGroups(pageWikitext);
    const needsTranslationSubpage = hasEnglishTranslationSubpageReference(pageWikitext);
    const translationSources = needsTranslationSubpage
      ? [pageWikitext, await fetchTranslationSubpage(term, api)]
      : [pageWikitext];

    return {
      kind: "entry",
      flow: "english",
      englishPresence,
      entry: parseEnglishEntry(term, pageWikitext, translationSources)
    };
  } catch (error) {
    if (isNoSenseTranslations(error, term)) return null;
    throw error;
  }
}

async function fetchTranslationSubpage(term, api) {
  try {
    return await api.fetchWikitext(`${term}/translations`);
  } catch (error) {
    if (isMissingTitle(error)) throw new Error(`No sense-level translations parsed for ${term}`);
    throw error;
  }
}

function isNoSenseTranslations(error, term) {
  return error?.message === `No sense-level translations parsed for ${term}`;
}

async function lookupWikitext(term, preferredLanguages, api) {
  try {
    return { term, wikitext: await api.fetchWikitext(term), redirectedFrom: "" };
  } catch (error) {
    if (!isMissingTitle(error)) throw error;
  }

  const titles = await api.searchTitles(term, 8);
  for (const title of titles) {
    const wikitext = await candidateWikitext(title, api);
    if (!wikitext) continue;
    if (preferredLanguages.some((language) => hasLanguageSection(wikitext, language))) {
      return { term: title, wikitext, redirectedFrom: term };
    }
  }

  throw new Error("No result");
}

async function candidateWikitext(title, api) {
  try {
    return await api.fetchWikitext(title);
  } catch (error) {
    if (isMissingTitle(error)) return "";
    throw error;
  }
}

function redirectedEntry(entry, redirectedFrom) {
  return redirectedFrom ? { ...entry, redirectedFrom } : entry;
}
