export function releaseFixture({
  version = "1.0.0",
  preview = false,
  published = "2026-08-30T10:00:00Z",
  assets,
  ...rest
} = {}) {
  const name = `QuilNode-${version}.dmg`;
  return {
    tag_name: `v${version}`,
    draft: false,
    prerelease: preview,
    published_at: published,
    assets:
      assets === undefined
        ? [
            {
              name,
              state: "uploaded",
              size: 125_000_000,
              browser_download_url: `https://github.com/quilnode/quilnode/releases/download/v${version}/${name}`,
            },
          ]
        : assets,
    ...rest,
  };
}
