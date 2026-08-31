import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { parseRelease } from "../src/lib/releases.js";
import { releaseFixture } from "./fixtures.mjs";

let compiler;
let DownloadAction;
before(async () => {
  // Compile the actual JSX for markup checks; no browser, listener, or file watcher.
  compiler = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("../", import.meta.url)),
    plugins: [react()],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: "custom",
    logLevel: "error",
  });
  ({ DownloadAction } = await compiler.ssrLoadModule(
    "/src/components/DownloadAction.jsx",
  ));
});
after(async () => compiler?.close());

const mac = { os: "macOS", supported: true, architecture: "arm64" };
const render = (release, platform = mac) =>
  renderToStaticMarkup(createElement(DownloadAction, { release, platform }));

test("status text distinguishes pending, unavailable, and failed checks without moving focus", () => {
  const cases = [
    ["loading", "Checking latest version"],
    ["unavailable", "Available soon"],
    ["error", "Could not check releases"],
  ];
  for (const [kind, message] of cases) {
    const html = render({ kind });
    const status = /<p[^>]*role="status"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1];
    assert.ok(status?.includes(message));
    assert.ok(status.includes('class="visually-hidden"'));
    assert.ok(html.includes('aria-live="polite"'));
    assert.ok(html.includes('aria-atomic="true"'));
  }
});

test("download markup exposes only validated links and labels previews", () => {
  const release = parseRelease(releaseFixture({ preview: true }));
  const html = render({ kind: "available", release });
  assert.ok(html.includes(`href="${release.asset.url}"`));
  assert.ok(html.includes("Pre-release"));
  assert.ok(html.includes('aria-describedby="download-detail"'));
  assert.ok(html.includes('rel="noreferrer"'));
  const incompatible = render(
    { kind: "available", release },
    { os: "Windows", supported: false },
  );
  assert.equal(incompatible.includes(release.asset.url), false);
  assert.ok(incompatible.includes("disabled"));
});
