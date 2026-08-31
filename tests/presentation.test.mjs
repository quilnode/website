import assert from "node:assert/strict";
import test from "node:test";
import { presentDownload } from "../src/lib/download-presentation.js";
import { parseRelease } from "../src/lib/releases.js";
import { releaseFixture } from "./fixtures.mjs";

const mac = { os: "macOS", supported: true, architecture: "unknown" };

test("a published release turns the existing button into a direct DMG link", () => {
  const release = parseRelease(releaseFixture());
  const view = presentDownload({ kind: "available", release }, mac);
  assert.equal(view.label, "Download for macOS");
  assert.equal(view.href, release.asset.url);
  assert.match(view.detail, /v1.0.0/);
  assert.match(view.detail, /Apple silicon/);
});

test("preview download consent is explicit in both button and detail", () => {
  const view = presentDownload(
    {
      kind: "available",
      release: parseRelease(releaseFixture({ preview: true })),
    },
    mac,
  );
  assert.match(view.label, /preview/);
  assert.match(view.detail, /Pre-release/);
});

test("failed checks retain a working fallback instead of claiming no release exists", () => {
  for (const state of [
    { kind: "error", reason: "rate-limit" },
    { kind: "error", reason: "timeout" },
  ]) {
    const view = presentDownload(state, mac);
    assert.equal(view.label, "Check GitHub Releases");
    assert.equal(view.href, "https://github.com/quilnode/quilnode/releases");
    assert.equal(view.detail, "Apple silicon · macOS 14+ · DMG");
    assert.equal(view.download, undefined);
    assert.equal(view.icon, "external");
    assert.match(view.announcement, /Could not check releases/);
  }
});

test("missing installer shows Available soon, not a dead download button", () => {
  const view = presentDownload({ kind: "unavailable" }, mac);
  assert.equal(view.label, "Available soon");
  assert.equal(view.disabled, true);
  assert.equal(view.href, undefined);
});

test("an announced release without its installer still shows the real version", () => {
  const view = presentDownload(
    {
      kind: "unavailable",
      release: parseRelease(releaseFixture({ assets: [] })),
    },
    mac,
  );
  assert.match(view.detail, /v1.0.0/);
  assert.equal(view.label, "Available soon");
});

test("incompatible platforms never receive a direct DMG link", () => {
  const view = presentDownload(
    { kind: "available", release: parseRelease(releaseFixture()) },
    { os: "Windows", supported: false },
  );
  assert.equal(view.href, undefined);
  assert.match(view.detail, /Windows/);
});

test("pending requests say checking, not unavailable or offline", () => {
  const view = presentDownload({ kind: "loading" }, mac);
  assert.equal(view.icon, "loading");
  assert.equal(view.disabled, true);
  assert.equal(view.href, undefined);
});
