import { searchBar } from "./html.js";

export function splashView() {
  return `
    <main class="splash">
      <div class="hero" aria-hidden="true"></div>
      <img src="public/assets/hero.svg" alt="Wiktionary logo" class="logo" />
      <h1>Glotmaxxing</h1>
      <h2>A focused Wiktionary reader, presented by Appmogged</h2>
      ${searchBar("")}
    </main>
  `;
}
