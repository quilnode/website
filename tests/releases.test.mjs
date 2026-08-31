import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchRelease,
  parseRelease,
  selectPreviewFallback,
} from "../src/lib/releases.js";
import { releaseFixture } from "./fixtures.mjs";

test("accepts the actual release-packager DMG naming contract", () => {
  const release = parseRelease(releaseFixture());
  assert.equal(release.version, "1.0.0");
  assert.equal(release.preview, false);
  assert.equal(release.asset.name, "QuilNode-1.0.0.dmg");
  assert.equal(
    release.notesURL,
    "https://github.com/quilnode/quilnode/releases/tag/v1.0.0",
  );
});

for (const [name, change] of [
  ["draft", { draft: true }],
  ["missing draft state", { draft: undefined }],
  ["malformed tag", { tag_name: "../../other" }],
  ["HTML tag", { tag_name: "<script>alert(1)</script>" }],
  ["unbounded tag", { tag_name: "v" + "1".repeat(120) + ".0.0" }],
  ["missing publication date", { published_at: null }],
  ["invalid publication date", { published_at: "invalid" }],
  ["missing asset list", { assets: null }],
]) {
  test(`rejects ${name}`, () =>
    assert.equal(parseRelease(releaseFixture(change)), null));
}

for (const url of [
  "https://evil.example/QuilNode-1.0.0.dmg",
  "javascript:alert(1)",
  "https://github.com.evil.example/quilnode/quilnode/releases/download/v1.0.0/QuilNode-1.0.0.dmg",
  "https://github.com/other/repo/releases/download/v1.0.0/QuilNode-1.0.0.dmg",
  "https://github.com/quilnode/quilnode/releases/download/v0.9.0/QuilNode-1.0.0.dmg",
  "https://user@github.com/quilnode/quilnode/releases/download/v1.0.0/QuilNode-1.0.0.dmg",
  "https://github.com/quilnode/quilnode/releases/download/v1.0.0/QuilNode-1.0.0.dmg?redirect=evil",
]) {
  test(`rejects untrusted asset URL: ${url}`, () => {
    const raw = releaseFixture();
    raw.assets[0].browser_download_url = url;
    assert.equal(parseRelease(raw).asset, null);
  });
}

test("ignores source archives, failed uploads and zero-byte files", () => {
  for (const change of [
    { name: "Source.zip" },
    { name: "QuilNode-1.0.0-x86_64.dmg" },
    { state: "starter" },
    { size: 0 },
    { size: -1 },
    { size: "123" },
  ]) {
    const raw = releaseFixture();
    Object.assign(raw.assets[0], change);
    assert.equal(parseRelease(raw).asset, null);
  }
});

test("rejects duplicate installer names instead of choosing arbitrarily", () => {
  const raw = releaseFixture();
  raw.assets.push({ ...raw.assets[0] });
  assert.equal(parseRelease(raw).asset, null);
});

test("supports an explicitly named arm64 installer", () => {
  const raw = releaseFixture();
  raw.assets[0].name = "QuilNode-1.0.0-arm64.dmg";
  raw.assets[0].browser_download_url =
    "https://github.com/quilnode/quilnode/releases/download/v1.0.0/QuilNode-1.0.0-arm64.dmg";
  assert.ok(parseRelease(raw).asset);
});

test("prefers stable over newer preview and uses publication time", () => {
  const state = selectPreviewFallback([
    releaseFixture({
      version: "2.0.0-beta.1",
      preview: true,
      published: "2026-08-30T15:00:00Z",
    }),
    releaseFixture({ version: "1.0.0", published: "2026-08-29T15:00:00Z" }),
    releaseFixture({
      version: "1.0.1",
      published: "2026-08-30T12:00:00Z",
      created_at: "2020-01-01T00:00:00Z",
    }),
  ]);
  assert.equal(state.release.version, "1.0.1");
});

test("offers a clearly classified preview only when no stable exists", () => {
  const state = selectPreviewFallback([
    releaseFixture({ version: "1.0.0-beta.1", preview: true }),
  ]);
  assert.equal(state.kind, "available");
  assert.equal(state.release.preview, true);
});

test("does not silently downgrade when the newest release has no DMG", () => {
  const state = selectPreviewFallback([
    releaseFixture(),
    releaseFixture({
      version: "1.0.1",
      published: "2026-08-30T12:00:00Z",
      assets: [],
    }),
  ]);
  assert.equal(state.kind, "unavailable");
  assert.equal(state.release.version, "1.0.1");
});

test("handles an empty or malformed public listing", () => {
  assert.equal(selectPreviewFallback([]).kind, "unavailable");
  assert.equal(selectPreviewFallback({}).kind, "error");
});

test("fetches a designated stable release once without credentials", async () => {
  const calls = [];
  const state = await fetchRelease({
    fetcher: async (url, options) => {
      calls.push(url);
      assert.equal(options.credentials, "omit");
      assert.equal(options.referrerPolicy, "no-referrer");
      assert.equal(options.cache, "no-cache");
      assert.equal(options.headers.Authorization, undefined);
      return Response.json(releaseFixture());
    },
  });
  assert.equal(state.kind, "available");
  assert.deepEqual(calls, [
    "https://api.github.com/repos/quilnode/quilnode/releases/latest",
  ]);
});

test("accepts a designated alpha release while preserving its preview label", async () => {
  const state = await fetchRelease({
    fetcher: async () =>
      Response.json(
        releaseFixture({ version: "0.1.0-alpha.2", preview: false }),
      ),
  });
  assert.equal(state.kind, "available");
  assert.equal(state.release.version, "0.1.0-alpha.2");
  assert.equal(state.release.preview, true);
});

test("finds preview releases automatically after /latest returns 404", async () => {
  let calls = 0;
  const state = await fetchRelease({
    fetcher: async () =>
      ++calls === 1
        ? new Response(null, { status: 404 })
        : Response.json([releaseFixture({ preview: true })]),
  });
  assert.equal(state.kind, "available");
  assert.equal(state.release.preview, true);
  assert.equal(calls, 2);
});

test("an unpublished repository yields a safe fallback after at most two requests", async () => {
  let calls = 0;
  const state = await fetchRelease({
    fetcher: async () => {
      calls++;
      return new Response(null, { status: 404 });
    },
  });
  assert.equal(state.kind, "unavailable");
  assert.equal(calls, 2);
});

for (const status of [403, 429, 500]) {
  test(`HTTP ${status} does not retry or select stale data`, async () => {
    let calls = 0;
    const state = await fetchRelease({
      fetcher: async () => {
        calls++;
        return new Response(null, { status });
      },
    });
    assert.equal(state.kind, "error");
    assert.equal(calls, 1);
  });
}

test("invalid JSON and offline failures are handled", async () => {
  assert.equal(
    (await fetchRelease({ fetcher: async () => new Response("not JSON") }))
      .kind,
    "error",
  );
  assert.equal(
    (
      await fetchRelease({
        fetcher: async () => {
          throw new TypeError("offline");
        },
      })
    ).kind,
    "error",
  );
});

test("one deadline bounds the whole lookup even if transport never resolves", async () => {
  let signal;
  const state = await fetchRelease({
    timeoutMs: 10,
    fetcher: (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
  });
  assert.equal(state.reason, "timeout");
  assert.equal(signal.aborted, true);
});
