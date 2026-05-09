import { esc } from "./html.js";

export function aboutView(version = {}) {
  return `
    <article class="about-page">
      <h1>About</h1>

      <section class="entry-section">
        <h2>How it works</h2>
        <p>Glotmaxxing reads Wiktionary pages and routes each search through a small set of rules. It first checks whether the searched word has a strong English entry.</p>
        <p>For English entries, it shows sense-level translations into the first available preferred language. Other preferred languages with translations appear under Other translations.</p>
        <p>If the same spelling also has foreign-language entries in preferred languages, those appear under Other results.</p>
        <p>For foreign entries, it checks preferred languages in order, opens the first matching language section, follows form-of entries back to their lemma when needed, and shows that parsed result.</p>
        <p>If the same spelling exists in more preferred languages, the next available language is linked at the bottom and parsed only when opened.</p>
      </section>

      <section class="entry-section">
        <h2>Data</h2>
        <p>Dictionary data comes from <a href="https://www.wiktionary.org/" target="_blank" rel="noopener noreferrer">Wiktionary</a>. Language order and theme settings are stored locally on the device.</p>
      </section>

      ${versionSection(version)}
    </article>
  `;
}

function versionSection({ appVersion = "dev", serverVersion = null, recacheFailure = null } = {}) {
  return `
    <section class="entry-section version-section">
      <h2>Version</h2>
      <p>App version: ${esc(appVersion)}</p>
      ${serverVersionLine(appVersion, serverVersion)}
      ${recacheFailure ? `<p class="notice">Force recache failed: ${esc(recacheFailure.message || recacheFailure)}</p>` : ""}
      <p><a href="?page=about&amp;recache=1" data-action="force-recache">Force recache</a></p>
    </section>
  `;
}

function serverVersionLine(appVersion, serverVersion) {
  if (!serverVersion || serverVersion.loading) return `<p>Server app: checking...</p>`;
  if (serverVersion.failure) return `<p class="notice">Server version check failed: ${esc(serverVersion.failure.message || serverVersion.failure)}</p>`;

  const status = serverVersion.version === appVersion ? "current" : "out of sync";
  const deployedAt = serverVersion.deployedAt ? ` (${esc(serverVersion.deployedAt)})` : "";
  return `
    <p>Latest version: ${esc(serverVersion.version)}${deployedAt}</p>
    <p>Status: ${status}</p>
  `;
}
