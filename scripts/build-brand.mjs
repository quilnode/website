import { readFile, writeFile, mkdir } from "node:fs/promises";

// Reuse the app's exact vector paths; only semantic colors differ.
const layers = [
  ["Network", "#22A6FF"],
  ["Nodes", "#785CFF"],
  ["Core", "#4BD478"],
  ["Q", "#F4F7FA"],
];
const groups = [];
for (const [name, color] of layers) {
  const source = await readFile(
    new URL(`../assets/brand/QuilNodeBrand${name}.svg`, import.meta.url),
    "utf8",
  );
  const paths = source.match(/<path\b[^>]*\/>/g);
  if (!paths?.length || !source.includes('width="1254" height="1254"'))
    throw new Error(`Unexpected brand layer: ${name}`);
  groups.push(
    `<g>${paths.join("").replaceAll('fill="#000000"', `fill="${color}"`)}</g>`,
  );
}
const output = new URL("../public/images/quilnode-mark.svg", import.meta.url);
await mkdir(new URL(".", output), { recursive: true });
await writeFile(
  output,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254">${groups.join("")}</svg>\n`,
);
