import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import ignore from "ignore";
import { contentSecurityPolicy } from "../scripts/security-policy.mjs";
import { shippedPackages } from "../scripts/third-party-notices.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Vercel deploys only the checked static output, without Git automation", async () => {
  const config = JSON.parse(await read("vercel.json"));
  assert.equal(config.framework, "vite");
  assert.equal(config.installCommand, "npm ci");
  assert.equal(config.buildCommand, "npm run check");
  assert.equal(config.outputDirectory, "dist/client");
  assert.equal(config.git.deploymentEnabled, false);
  assert.notEqual(config.public, true);
  assert.equal(config.rewrites, undefined);
  assert.equal(existsSync(new URL(".github/workflows", root)), false);
});

test("Vercel security headers match the production policy and static-host protections", async () => {
  const config = JSON.parse(await read("vercel.json"));
  const rule = config.headers.find((entry) => entry.source === "/(.*)");
  assert.ok(rule, "Headers must apply to every path");
  const headers = Object.fromEntries(
    rule.headers.map(({ key, value }) => [key, value]),
  );
  assert.equal(
    headers["Content-Security-Policy"],
    `${contentSecurityPolicy}; frame-ancestors 'none'`,
  );
  for (const line of (await read("public/_headers")).split("\n")) {
    const match = /^\s+([^:]+): (.+)$/.exec(line);
    if (!match) continue;
    if (match[1] === "Content-Security-Policy") {
      assert.ok(headers[match[1]].includes(match[2]));
    } else {
      assert.equal(headers[match[1]], match[2]);
    }
  }
});

// The CLI omits .gitignore from uploads; this check belongs to a local checkout.
test(
  "project metadata and secrets are excluded from Git and CLI uploads",
  {
    skip: !existsSync(new URL(".gitignore", root)),
  },
  async () => {
    for (const file of [".gitignore", ".vercelignore"]) {
      const patterns = (await read(file)).split("\n");
      for (const pattern of [
        ".vercel/",
        "node_modules/",
        "dist/",
        "*.pem",
        "*.key",
        "*.p12",
        "*.pfx",
      ]) {
        assert.ok(
          patterns.includes(pattern),
          `${file} must exclude ${pattern}`,
        );
      }
      assert.ok(patterns.some((pattern) => pattern.startsWith(".env")));
    }
  },
);

test("browser dependencies retain their license notices in the shipped site", async () => {
  const notices = await read("dist/client/third-party-notices.txt");
  const { dependencies } = JSON.parse(await read("package.json"));
  for (const name of Object.keys(dependencies)) {
    assert.ok(
      shippedPackages.includes(name),
      `Review redistribution notices for ${name}`,
    );
  }
  for (const name of shippedPackages) {
    const license = await read(`node_modules/${name}/LICENSE`);
    assert.ok(notices.includes(license.trim()), `Missing ${name} notice`);
  }
  assert.ok(
    notices.includes((await read("assets/licenses/feather.txt")).trim()),
  );
});

test("CLI uploads require an explicit source allowlist", async () => {
  const rules = (await read(".vercelignore"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  assert.equal(rules[0], "/*");
  const allowed = rules.filter((line) => line.startsWith("!"));
  assert.deepEqual(
    allowed.sort(),
    [
      "!/src",
      "!/assets",
      "!/public",
      "!/scripts",
      "!/tests",
      "!/worker",
      "!/.openai",
      "!/.openai/hosting.json",
      "!/index.html",
      "!/guide",
      "!/package.json",
      "!/package-lock.json",
      "!/vite.config.mjs",
      "!/vercel.json",
      "!/.vercelignore",
      "!/README.md",
    ].sort(),
  );
  assert.ok(
    rules.indexOf("/.openai/*") < rules.indexOf("!/.openai/hosting.json"),
  );
  assert.ok(rules.indexOf("*.md") < rules.indexOf("!/README.md"));
});

test("website source contains no internal Markdown or asset symlinks", async () => {
  const entries = await readdir(root);
  assert.deepEqual(entries.filter((entry) => /\.md$/i.test(entry)).sort(), [
    "README.md",
  ]);
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.equal(
        entry.isSymbolicLink(),
        false,
        `Source symlink: ${entry.name}`,
      );
      assert.equal(
        /\.md$/i.test(entry.name),
        false,
        `Internal document: ${entry.name}`,
      );
      if (entry.isDirectory())
        await inspect(new URL(`${encodeURIComponent(entry.name)}/`, directory));
    }
  }
  for (const directory of [
    "src/",
    "assets/",
    "public/",
    "scripts/",
    "tests/",
    "worker/",
  ]) {
    await inspect(new URL(directory, root));
  }
});

test("CLI traversal can enter every required source directory", async () => {
  const policy = ignore().add(await read(".vercelignore"));
  async function inspect(path) {
    // The CLI tests directory names without a trailing slash before descending.
    // A directory-only negation would prune the tree before its files are seen.
    assert.equal(
      policy.ignores(path),
      false,
      `Required upload excluded: ${path}`,
    );
    for (const entry of await readdir(new URL(`${path}/`, root), {
      withFileTypes: true,
    })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await inspect(child);
      else
        assert.equal(policy.ignores(child), false, `Source excluded: ${child}`);
    }
  }
  for (const path of ["src", "assets", "public", "scripts", "tests", "worker"])
    await inspect(path);
  assert.equal(policy.ignores(".openai"), false);
  assert.equal(policy.ignores(".openai/hosting.json"), false);
});

test("CLI source allowlist still excludes private and unrelated files", async () => {
  const policy = ignore().add(await read(".vercelignore"));
  for (const path of [
    ".env.local",
    ".vercel/project.json",
    ".openai/internal.json",
    "unrelated/file.txt",
    "src/.env.local",
    "src/private.pem",
    "assets/private.key",
    "public/backup.zip",
    "scripts/internal.md",
    "node_modules/package/index.js",
    "dist/client/index.html",
  ])
    assert.equal(policy.ignores(path), true, `Private upload allowed: ${path}`);
});
