import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const output = new URL("../dist/client/", import.meta.url);
const guide = () => readFile(new URL("guide/index.html", output), "utf8");

test("operator guidance ships as readable HTML without JavaScript", async () => {
  const html = await guide();
  assert.match(html, /<html lang="en">/);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
  assert.match(html, /<h1>Operator guide<\/h1>/);
  assert.match(html, /Alpha software/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /<script\b|onclick=|style=|<iframe\b/i);
  assert.match(
    html,
    /<summary>Full signature and package verification<\/summary>/,
  );
});

test("guide anchors are unique and every local navigation or asset target exists", async () => {
  const html = await guide();
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "Duplicate page anchor");
  for (const [, target] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (target.startsWith("#")) {
      assert.ok(ids.includes(target.slice(1)), `Missing anchor: ${target}`);
    } else if (target.startsWith("/")) {
      const path = target.slice(1).split("#")[0];
      const file = path.endsWith("/") || !path ? `${path}index.html` : path;
      assert.ok(
        (await stat(new URL(file, output))).isFile(),
        `Missing file: ${target}`,
      );
    } else {
      assert.match(
        target,
        /^https:\/\//,
        `Unexpected link protocol: ${target}`,
      );
    }
  }
});

test("guide metadata and indexing identify this guide rather than the download page", async () => {
  const html = await guide();
  assert.match(html, /<title>Operator guide — QuilNode<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/quilnode\.com\/guide\/"/);
  assert.match(
    html,
    /name="twitter:title" content="Operator guide — QuilNode"/,
  );
  assert.doesNotMatch(html, /property="og:image"|quilnode-overview\.png/);
  assert.match(
    await readFile(new URL("sitemap.xml", output), "utf8"),
    /https:\/\/quilnode\.com\/guide\//,
  );
});

test("verification instructions fail closed without teaching security bypasses", async () => {
  const html = (await guide()).replace(/\s+/g, " ");
  assert.match(html, /shasum -a 256/);
  assert.match(html, /scripts\/release\/verify-release\.sh/);
  assert.match(html, /Do not add <code>--rehearsal<\/code>/);
  assert.match(
    html,
    /not Apple Developer ID signed or Apple-notarized|not Apple-notarized/,
  );
  assert.doesNotMatch(
    html,
    /xattr\s+-|spctl\s+--master-disable|curl[^<\n]*\|[^<\n]*(?:sh|bash)/,
  );
});

test("guide source remains eligible for a manual Vercel upload", async () => {
  const rules = await readFile(
    new URL("../.vercelignore", import.meta.url),
    "utf8",
  );
  assert.ok(rules.split("\n").includes("!/guide"));
  assert.equal(
    (await stat(new URL("../guide/index.html", import.meta.url))).isFile(),
    true,
  );
  const entries = await readdir(new URL("../guide/", import.meta.url), {
    withFileTypes: true,
  });
  for (const entry of entries) {
    assert.ok(
      entry.isFile() && entry.name.endsWith(".html"),
      `Only static HTML belongs in the guide source: ${entry.name}`,
    );
  }
});
