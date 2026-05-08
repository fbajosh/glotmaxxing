export function splashView({ darkMode = false } = {}) {
  const hero = darkMode ? "hero-dark.svg" : "hero-light.svg";

  return `
    <main class="splash">
      <div class="hero" aria-hidden="true"></div>
      <img src="public/assets/${hero}" alt="Wiktionary logo" class="logo" />
      <h1>Glotmaxxing</h1>
      <h2>A&nbsp;focused&nbsp;Wiktionary&nbsp;reader, presented&nbsp;by&nbsp;<a href="https://appmogged.com/">Appmogged</a></h2>
    </main>
  `;
}
