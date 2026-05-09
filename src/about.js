export function aboutView() {
  return `
    <article class="about-page">
      <h1>About</h1>

      <section class="entry-section">
        <h2>How it works</h2>
        <p>Glotmaxxing reads Wiktionary pages and routes each search through a small set of rules. It first checks whether the searched word has a strong English entry.</p>
        <p>For English entries, it shows sense-level translations into the first available preferred language. Other preferred languages with translations appear under Also available.</p>
        <p>For foreign entries, it checks preferred languages in order, opens the first matching language section, follows form-of entries back to their lemma when needed, and shows that parsed result.</p>
        <p>If the same spelling exists in more preferred languages, the next available language is linked at the bottom and parsed only when opened.</p>
      </section>

      <section class="entry-section">
        <h2>Data</h2>
        <p>Dictionary data comes from <a href="https://www.wiktionary.org/" target="_blank" rel="noopener noreferrer">Wiktionary</a>. Language order and theme settings are stored locally in this browser.</p>
      </section>

      <section class="entry-section">
        <p>v0.1.1</p>
      </section>
    </article>
  `;
}
