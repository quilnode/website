import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/assets/app.js"),
    {
      ASSETS: {
        fetch: async (request) => {
          calls.push(new URL(request.url).pathname);
          return new Response("asset", { status: 200 });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("missing page routes remain 404 instead of silently serving the homepage", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(
            url.pathname === "/index.html" ? "app" : "missing",
            {
              status: url.pathname === "/index.html" ? 200 : 404,
            },
          );
        },
      },
    },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(calls, ["/flow/step-two?source=share"]);
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/missing.js", {
      headers: { accept: "text/html" },
    }),
    new Request("https://example.test/missing-page", {
      method: "HEAD",
      headers: { accept: "text/html" },
    }),
    new Request("https://example.test/api/missing", {
      headers: { accept: "application/json" },
    }),
    new Request("https://example.test/flow", {
      method: "POST",
      headers: { accept: "text/html" },
    }),
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, 1);
  }
});

test("preserves conditional cache responses and headers", async () => {
  const request = new Request("https://example.test/", {
    headers: { "If-None-Match": '"fixture"' },
  });
  const expected = new Response(null, {
    status: 304,
    headers: { ETag: '"fixture"' },
  });
  const result = await worker.fetch(request, {
    ASSETS: {
      fetch: async (received) => {
        assert.equal(received, request);
        return expected;
      },
    },
  });
  assert.equal(result, expected);
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});
