import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { contentSecurityPolicy } from "../scripts/security-policy.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("production analytics are pinned, website-only, and privacy bounded", async () => {
  const manifest = JSON.parse(await read("package.json"));
  assert.equal(manifest.dependencies["@vercel/analytics"], "2.0.1");

  const source = await read("src/analytics.js");
  assert.match(source, /import \{ inject \} from "@vercel\/analytics"/);
  assert.match(source, /import\.meta\.env\.PROD/);
  assert.match(source, /mode: "production"/);
  assert.doesNotMatch(source, /\btrack\s*\(/);

  assert.match(await read("src/main.jsx"), /import "\.\/analytics\.js"/);
  assert.match(
    await read("guide/index.html"),
    /<script type="module" src="\/src\/analytics\.js"><\/script>/,
  );
  assert.match(contentSecurityPolicy, /script-src 'self'/);
  assert.match(contentSecurityPolicy, /connect-src 'self'/);
});

test("both production pages load the same-origin Vercel analytics client", async () => {
  const assets = new URL("dist/client/assets/", root);
  const scripts = (await readdir(assets)).filter((name) =>
    name.endsWith(".js"),
  );
  const source = (
    await Promise.all(
      scripts.map((name) => readFile(new URL(name, assets), "utf8")),
    )
  ).join("\n");
  assert.match(source, /\/_vercel\/insights\/script\.js/);
  assert.match(source, /@vercel\/analytics/);

  for (const page of [
    "dist/client/index.html",
    "dist/client/guide/index.html",
  ]) {
    assert.match(await read(page), /<script[^>]+src="\/assets\/[^"/]+\.js"/);
  }
});
