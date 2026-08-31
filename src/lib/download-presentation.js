import { PROJECT } from "./config.js";

export function formatSize(bytes) {
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
}

/** The button and its explanation always derive from the same state. */
export function presentDownload(state, platform) {
  if (platform.supported === false) {
    const explanation =
      platform.architecture === "intel"
        ? "This download requires an Apple silicon Mac."
        : `You're on ${platform.os}. QuilNode runs on an Apple silicon Mac.`;
    return {
      label: "Available for macOS",
      detail: explanation,
      disabled: true,
      icon: "download",
    };
  }
  if (state.kind === "loading") {
    return {
      label: "Checking latest version…",
      detail: `${PROJECT.requirements} · DMG`,
      disabled: true,
      icon: "loading",
    };
  }
  if (state.kind === "available") {
    return {
      label: state.release.preview
        ? "Download preview for macOS"
        : "Download for macOS",
      detail: `${state.release.preview ? "Pre-release · " : ""}v${state.release.version} · ${PROJECT.requirements} · ${formatSize(state.release.asset.size)}`,
      href: state.release.asset.url,
      icon: "download",
      download: true,
    };
  }
  if (state.kind === "unavailable") {
    return {
      label: "Available soon",
      detail: `${state.release ? `v${state.release.version} · ` : ""}${PROJECT.requirements} · DMG`,
      disabled: true,
      icon: "download",
    };
  }
  return {
    label: "Check GitHub Releases",
    announcement: "Could not check releases. Check GitHub Releases",
    detail: `${PROJECT.requirements} · DMG`,
    href: PROJECT.releasesURL,
    icon: "external",
  };
}
