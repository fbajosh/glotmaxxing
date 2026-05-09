const HERO_SRC = "public/assets/hero.svg";
const HERO_LIGHT_COLORS = {
  "6666FF": "000066",
  "66FFFF": "000066",
  "4FFFFF": "00004F",
  "FFFFFF": "000000",
  "FFD4D4": "D40000",
  "FF5757": "570000"
};
let lightHeroSource = "";
let lightHeroRequest = null;

export function splashView({ darkMode = false } = {}) {
  return `
    <main class="splash">
      <div class="hero" aria-hidden="true"></div>
      <img src="${HERO_SRC}" alt="Wiktionary logo" class="logo" data-hero-image data-hero-mode="${darkMode ? "dark" : "light"}" />
      <h1>Glotmaxxing</h1>
      <h2>A&nbsp;focused&nbsp;Wiktionary&nbsp;reader, presented&nbsp;by&nbsp;<a href="https://appmogged.com/">Appmogged</a></h2>
    </main>
  `;
}

export function syncSplashHero(root = document) {
  const image = root.querySelector("[data-hero-image]");
  if (!image) return Promise.resolve();

  if (image.dataset.heroMode === "dark") {
    image.src = HERO_SRC;
    image.style.visibility = "";
    return Promise.resolve();
  }

  image.style.visibility = "hidden";
  return lightHeroSrc().then((source) => {
    if (image.isConnected && image.dataset.heroMode === "light") {
      image.src = source;
      image.style.visibility = "";
    }
  });
}

export function lightHeroSvg(svg) {
  return String(svg)
    .replace(/#(6666FF|66FFFF|4FFFFF|FFFFFF|FFD4D4|FF5757)\b/gi, (_, color) => `#${HERO_LIGHT_COLORS[color.toUpperCase()]}`)
    .replace(/(stroke|fill)="white"/gi, '$1="#000000"');
}

function lightHeroSrc() {
  if (lightHeroSource) return Promise.resolve(lightHeroSource);
  if (!lightHeroRequest) {
    lightHeroRequest = fetch(HERO_SRC, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Hero image failed to load: ${response.status} ${response.statusText}`);
        return response.text();
      })
      .then((svg) => {
        lightHeroSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(lightHeroSvg(svg))}`;
        return lightHeroSource;
      });
  }
  return lightHeroRequest;
}
