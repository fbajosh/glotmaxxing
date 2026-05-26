export function normalizeQuery(value) {
  return String(value ?? "").trim();
}

export function queryFromParams(urlParams) {
  return normalizeQuery(urlParams.get("q"));
}
