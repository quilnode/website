import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Site } from "../../src/components/Site.jsx";
import { parseRelease } from "../../src/lib/releases.js";
import { releaseFixture } from "../fixtures.mjs";
import "../../src/styles.css";

const states = {
  Stable: { kind: "available", release: parseRelease(releaseFixture()) },
  Preview: {
    kind: "available",
    release: parseRelease(
      releaseFixture({ version: "1.1.0-beta.1", preview: true }),
    ),
  },
  Loading: { kind: "loading" },
  Soon: { kind: "unavailable" },
  Error: { kind: "error", reason: "network" },
};
const platforms = {
  Mac: { os: "macOS", architecture: "arm64", supported: true },
  Intel: { os: "macOS", architecture: "intel", supported: false },
  Windows: { os: "Windows", supported: false },
  Linux: { os: "Linux", supported: false },
  iPhone: { os: "iOS", supported: false },
};

function Verification() {
  const [state, setState] = useState("Stable");
  const [platform, setPlatform] = useState("Mac");
  return (
    <>
      <aside
        aria-label="Test fixtures"
        style={{
          padding: 12,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          borderBottom: "1px solid #243342",
        }}
      >
        <strong>TEST FIXTURES — not live releases</strong>
        <label>
          Release{" "}
          <select
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            {Object.keys(states).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Platform{" "}
          <select
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          >
            {Object.keys(platforms).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </aside>
      <Site release={states[state]} platform={platforms[platform]} />
    </>
  );
}

createRoot(document.getElementById("root")).render(<Verification />);
