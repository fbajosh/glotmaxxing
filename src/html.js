export const icons = {
  search: `<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg>`,
  menu: `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>`
};

export function searchBar(value) {
  return `
    <form class="search" data-role="search">
      <input name="q" type="search" value="${esc(value)}" placeholder="Search">
      <button class="icon" type="submit" aria-label="Search" title="Search">${icons.search}</button>
    </form>
  `;
}

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function title(value) {
  return String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
