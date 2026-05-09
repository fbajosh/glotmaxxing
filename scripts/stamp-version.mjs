import { readdir, readFile, writeFile } from "node:fs/promises";

const version = process.argv[2];
if (!/^v\d{8}\.\d{6}$/.test(version || "")) {
  throw new Error("Usage: node scripts/stamp-version.mjs vYYYYMMDD.hhmmss");
}

const deployedAt = `${version.slice(1, 5)}-${version.slice(5, 7)}-${version.slice(7, 9)}T${version.slice(10, 12)}:${version.slice(12, 14)}:${version.slice(14, 16)}Z`;

await writeFile("src/version.js", `export const APP_VERSION = ${JSON.stringify(version)};\n`);
await writeFile("version.json", `${JSON.stringify({ version, deployedAt }, null, 2)}\n`);

const html = await readFile("index.html", "utf8");
await writeFile("index.html", html
  .replace(/(\.\/manifest\.webmanifest)(?:\?v=[^"]*)?/g, `$1?v=${version}`)
  .replace(/(\.\/src\/styles\.css)(?:\?v=[^"]*)?/g, `$1?v=${version}`)
  .replace(/(\.\/src\/app\.js)(?:\?v=[^"]*)?/g, `$1?v=${version}`));

for (const file of await readdir("src")) {
  if (!file.endsWith(".js")) continue;
  const path = `src/${file}`;
  const source = await readFile(path, "utf8");
  await writeFile(path, source.replace(/from "(\.{1,2}\/[^"]+\.js)(?:\?v=[^"]*)?"/g, `from "$1?v=${version}"`));
}
