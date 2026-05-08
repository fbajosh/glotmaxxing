import { searchBar } from "./html.js";

export function splashView() {
  return `
    <main class="splash">
      <div class="hero" aria-hidden="true"></div>
      <h1>Glotmaxxing</h1>
      ${searchBar("")}
    </main>
  `;
}
