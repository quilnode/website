import { PROJECT } from "./config.js";

const VERSION = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?)$/;
const NOT_AVAILABLE = { kind: "unavailable", reason: "unpublished" };

/** Accept only application releases and assets from the fixed project repository. */
export function parseRelease(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.draft !== false ||
    typeof value.prerelease !== "boolean"
  )
    return null;
  if (typeof value.tag_name !== "string" || value.tag_name.length > 100)
    return null;
  const match = VERSION.exec(value.tag_name);
  if (!match || !Array.isArray(value.assets)) return null;
  const published =
    typeof value.published_at === "string"
      ? Date.parse(value.published_at)
      : NaN;
  if (!Number.isFinite(published)) return null;
  const version = match[1];
  const tag = value.tag_name;
  return {
    tag,
    version,
    preview: value.prerelease || version.includes("-"),
    publishedAt: new Date(published).toISOString(),
    notesURL: `${PROJECT.releasesURL}/tag/${encodeURIComponent(tag)}`,
    asset: selectInstaller(value.assets, tag, version),
  };
}

function selectInstaller(assets, tag, version) {
  // The release packager produces an unsuffixed Apple-silicon DMG.
  // Explicit arm64 names are supported; other architectures are not inferred.
  for (const name of [
    `QuilNode-${version}-arm64.dmg`,
    `QuilNode-${version}.dmg`,
  ]) {
    const expectedURL = `${PROJECT.releasesURL}/download/${encodeURIComponent(tag)}/${name}`;
    const matches = assets.filter((asset) => asset && asset.name === name);
    if (matches.length !== 1) continue;
    const asset = matches[0];
    if (
      asset.state !== "uploaded" ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0
    )
      continue;
    if (asset.browser_download_url !== expectedURL) continue;
    return { name, url: expectedURL, size: asset.size };
  }
  return null;
}

function releaseState(release) {
  return release.asset
    ? { kind: "available", release }
    : { kind: "unavailable", reason: "no-installer", release };
}

/** Only use this fallback when GitHub has no designated stable release. */
export function selectPreviewFallback(values) {
  if (!Array.isArray(values))
    return { kind: "error", reason: "invalid-response" };
  const releases = values.map(parseRelease).filter(Boolean);
  const stable = releases.filter((release) => !release.preview);
  const candidates = stable.length ? stable : releases;
  candidates.sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  return candidates.length ? releaseState(candidates[0]) : NOT_AVAILABLE;
}

async function requestJSON(fetcher, url, signal) {
  const response = await fetcher(url, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-cache",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });
  if (response.status === 404) return { missing: true };
  if (response.status === 403 || response.status === 429)
    return { error: "rate-limit" };
  if (!response.ok) return { error: "network" };
  return { data: await response.json() };
}

/** One bounded lookup per visit, no polling, account, token, or persistent tracking. */
export async function fetchRelease({ fetcher = fetch, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  let timer;
  try {
    const lookup = async () => {
      const latest = await requestJSON(
        fetcher,
        `${PROJECT.releasesAPI}/latest`,
        controller.signal,
      );
      if (latest.error) return { kind: "error", reason: latest.error };
      if (!latest.missing) {
        const release = parseRelease(latest.data);
        return release
          ? releaseState(release)
          : { kind: "error", reason: "invalid-response" };
      }
      const list = await requestJSON(
        fetcher,
        `${PROJECT.releasesAPI}?per_page=100`,
        controller.signal,
      );
      if (list.error) return { kind: "error", reason: list.error };
      return list.missing ? NOT_AVAILABLE : selectPreviewFallback(list.data);
    };
    const deadline = new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve({ kind: "error", reason: "timeout" });
        controller.abort();
      }, timeoutMs);
    });
    return await Promise.race([lookup(), deadline]);
  } catch {
    return {
      kind: "error",
      reason: controller.signal.aborted ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timer);
  }
}

let request;
let fetchedAt = 0;
const FRESH_FOR_MS = 5 * 60 * 1000;
// Coalesce remounts and focus events; revalidate only after five minutes.
export function getRelease() {
  if (!request || Date.now() - fetchedAt > FRESH_FOR_MS) {
    fetchedAt = Date.now();
    request = fetchRelease();
  }
  return request;
}
