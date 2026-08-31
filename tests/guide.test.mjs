import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const output = new URL("../dist/client/", import.meta.url);
const guide = () => readFile(new URL("guide/index.html", output), "utf8");
const sectionText = (html, id) => {
  const section = new RegExp(
    `<section[^>]*aria-labelledby="${id}"[^>]*>([\\s\\S]*?)</section>`,
  ).exec(html)?.[1];
  assert.ok(section, `Missing guide section: ${id}`);
  return section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
};

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

test("every operator workflow has its own linked, named section", async () => {
  const html = await guide();
  for (const id of [
    "before-you-start",
    "download-and-verify",
    "first-open",
    "node-setup",
    "network",
    "updates",
    "recovery",
    "security",
    "troubleshooting",
  ]) {
    assert.ok(sectionText(html, id));
    assert.ok(html.includes(`href="#${id}"`), `Unlinked workflow: ${id}`);
    assert.match(html, new RegExp(`<h2 id="${id}">`));
  }
});

test("update guidance separates app approval, node policies, and interrupted operations", async () => {
  const text = sectionText(await guide(), "updates");
  for (const label of ["Manual", "Signed Stable", "Approved Dev", "Raw Dev"]) {
    assert.ok(
      text.includes(`${label}:`),
      `Undocumented update policy: ${label}`,
    );
  }
  assert.match(text, /you approve each app replacement/);
  assert.match(text, /Fully quitting QuilNode stops its update scheduler/);
  assert.match(text, /prepared candidate is not an installed update/);
  assert.match(text, /Retry automatic setup/);
  assert.match(text, /Install staged update/);
});

test("recovery guidance requires the complete pair and distinguishes verification from encryption", async () => {
  const text = sectionText(await guide(), "recovery");
  for (const file of ["config.yml", "keys.yml", "RECOVERY.txt"]) {
    assert.ok(text.includes(file), `Missing recovery-package file: ${file}`);
  }
  assert.match(text, /Verified does not mean encrypted/);
  assert.match(text, /does not encrypt the recovery folder/);
  assert.match(text, /do not run duplicate copies/);
  assert.match(text, /Do not wipe stores to restore keys/);
  assert.match(text, /Test your recovery procedure/);
});

test("security guidance preserves the local-service boundary and contact-only public fallback", async () => {
  const html = await guide();
  const security = sectionText(html, "security");
  assert.match(
    security,
    /local service and official runtime do access identity material/,
  );
  assert.match(
    security,
    /it does not encrypt files, anonymize network traffic/,
  );
  const help = sectionText(html, "troubleshooting");
  assert.match(help, /when the private form is enabled/);
  assert.match(help, /contact-only issue titled Security contact request/);
  assert.match(
    help,
    /Include no vulnerability details, logs, screenshots, or attachments/,
  );
  assert.match(help, /Never send real private keys, even in a private report/);
});
