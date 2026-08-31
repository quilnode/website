import assert from "node:assert/strict";
import test from "node:test";
import { classifyPlatform, detectPlatform } from "../src/lib/platform.js";

for (const [os, hints] of [
  ["Windows", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }],
  ["Linux", { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" }],
  ["Android", { userAgent: "Mozilla/5.0 (Linux; Android 14)" }],
  [
    "iOS",
    { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" },
  ],
  [
    "iPadOS",
    {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      platform: "MacIntel",
      maxTouchPoints: 5,
    },
  ],
  ["ChromeOS", { userAgent: "Mozilla/5.0 (X11; CrOS x86_64)" }],
]) {
  test(`identifies ${os} without offering an incompatible installer`, () => {
    const value = classifyPlatform(hints);
    assert.equal(value.os, os);
    assert.equal(value.supported, false);
  });
}

test("never mistakes Safari's Intel compatibility string for actual architecture", () => {
  const platform = classifyPlatform({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    platform: "MacIntel",
  });
  assert.equal(platform.os, "macOS");
  assert.equal(platform.architecture, "unknown");
});

test("optional UA hints distinguish Intel and Apple silicon", () => {
  assert.equal(
    classifyPlatform({ platform: "macOS", architecture: "arm" }).architecture,
    "arm64",
  );
  assert.equal(
    classifyPlatform({ platform: "macOS", architecture: "x86" }).supported,
    false,
  );
  assert.equal(classifyPlatform().supported, null);
});

test("does not inspect CPU/GPU, canvas or WebGL to guess hardware", async () => {
  const result = await detectPlatform({ platform: "MacIntel" });
  assert.equal(result.architecture, "unknown");
});

test("architecture hints are bounded, optional, and failure-safe", async () => {
  for (const getHighEntropyValues of [
    async () => {
      throw new Error("denied");
    },
    () => new Promise(() => {}),
  ]) {
    const result = await detectPlatform(
      {
        platform: "MacIntel",
        userAgentData: { platform: "macOS", getHighEntropyValues },
      },
      10,
    );
    assert.equal(result.architecture, "unknown");
  }
});

test("does not request high-entropy values on other platforms", async () => {
  let calls = 0;
  await detectPlatform({
    userAgentData: {
      platform: "Windows",
      getHighEntropyValues: () => {
        calls++;
      },
    },
  });
  assert.equal(calls, 0);
});
