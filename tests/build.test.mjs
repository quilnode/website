import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { contentSecurityPolicy } from "../scripts/security-policy.mjs";
import { stripPNGMetadata } from "../scripts/png-privacy.mjs";

async function publicFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.equal(
      entry.isSymbolicLink(),
      false,
      `Public symlink: ${entry.name}`,
    );
    const url = new URL(
      encodeURIComponent(entry.name) + (entry.isDirectory() ? "/" : ""),
      directory,
    );
    if (entry.isDirectory()) files.push(...(await publicFiles(url)));
    else files.push(url);
  }
  return files;
}

test("published files contain no internal documents, source maps, keys, or workstation paths", async () => {
  const files = await publicFiles(new URL("../dist/client/", import.meta.url));
  const allowed =
    /^(?:index\.html|robots\.txt|sitemap\.xml|_headers|third-party-notices\.txt|assets\/[A-Za-z0-9_-]+\.(?:js|css|woff2)|images\/[A-Za-z0-9_-]+\.(?:png|svg))$/;
  const privatePath = /\/(?:Users|home)\/[^\s/]+|[A-Z]:\\Users\\[^\s\\]+/;
  const credential =
    /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/;
  for (const file of files) {
    const name = file.pathname.split("/dist/client/").at(-1);
    assert.match(name, allowed, `Unexpected public file: ${name}`);
    assert.doesNotMatch(
      name,
      /(?:^|\/)(?:\.|tests|src|node_modules|server)(?:\/|$)/,
    );
    const source = await readFile(file, "utf8");
    assert.equal(
      privatePath.test(source),
      false,
      `Workstation path in ${name}`,
    );
    assert.equal(
      credential.test(source),
      false,
      `Credential signature in ${name}`,
    );
  }
});

test("production applies a strict policy and contains no test fixtures or developer paths", async () => {
  const html = await readFile(
    new URL("../dist/client/index.html", import.meta.url),
    "utf8",
  );
  assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(html.includes("https://api.github.com"));
  assert.equal(contentSecurityPolicy.includes("unsafe-inline"), false);
  assert.equal(contentSecurityPolicy.includes("unsafe-eval"), false);
  assert.equal(
    (await readdir(new URL("../dist/client", import.meta.url))).includes(
      "tests",
    ),
    false,
  );
  for (const name of await readdir(
    new URL("../dist/client/assets", import.meta.url),
  )) {
    if (!/\.(js|css)$/.test(name)) continue;
    const source = await readFile(
      new URL(`../dist/client/assets/${name}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /\/Users\/|TEST FIXTURES|localhost:|127\.0\.0\.1:|sourceMappingURL=/,
    );
  }
});

test("every source and deployed PNG contains only essential image chunks", async () => {
  for (const directory of ["../public/", "../dist/client/"]) {
    const files = await publicFiles(new URL(directory, import.meta.url));
    const pngs = files.filter((file) => /\.png$/i.test(file.pathname));
    assert.ok(pngs.length > 0, "Expected at least one app preview");
    for (const file of pngs) {
      const source = await readFile(file);
      assert.equal(
        source.equals(stripPNGMetadata(source)),
        true,
        "PNG metadata must be stripped before publication",
      );
    }
  }
});
