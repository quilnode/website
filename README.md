# QuilNode website

The download page for [QuilNode](https://github.com/quilnode/quilnode), a local macOS app for managing a Quilibrium node. This repository contains the website, not the application or its installers.

## Development

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Before publishing:

```sh
npm run check
npm audit
```

`check` runs formatting checks, a production build, and all regression tests. The site builds into `dist/client`. Fonts and images are self-hosted; there is no application server, database, API token, or environment-variable setup.

## Manual deployment to Vercel

Deploy from this directory with the [Vercel CLI](https://vercel.com/docs/cli/deploying-from-cli). GitHub Actions and Git-triggered deployments are not used. Pushing the source to GitHub is independent of deploying the website.

One-time account and project setup:

```sh
npx vercel login
npx vercel link
```

Select the website project when linking, or create it if needed. Do not connect a Git repository for deployments. Local project settings are saved in the ignored `.vercel/` directory; never commit account credentials.

Create a preview deployment:

```sh
npm run check
npm audit
npx vercel deploy
```

Review the returned preview URL before publishing to production:

```sh
npm run check && npm audit && npx vercel deploy --prod
```

These are manual uploads from the current working directory, including uncommitted changes. `.vercelignore` allows only the required source folders and build files; unrelated root files, internal Markdown, and credential files are excluded before upload. Directory allowlist entries have no trailing slash so the CLI can traverse them. Vercel installs the lockfile with `npm ci`, builds the site, runs all regression tests, and serves **only `dist/client`**. Formatting is checked locally before upload, not against Vercel's processed configuration. `vercel.json` supplies security headers and explicitly disables automatic Git deployments. No functions or scheduled jobs are needed.

For `quilnode.com`, add the domain to this project's Vercel settings and apply the exact DNS records Vercel provides. Preserve unrelated mail and verification records. Configure `www.quilnode.com` to redirect to the primary domain if desired. After publishing, verify HTTPS, the response headers, and the download state on the live URL. Keep Vercel build logs and source protection enabled.

## Automatic download discovery

The browser reads public GitHub Releases from **`quilnode/quilnode`**. A newly published application release does not require a website edit or redeployment.

- Prefer GitHub's designated latest full release. If none exists, select the latest published full release, or a clearly labelled prerelease when only previews exist.
- Accept only an uploaded, non-empty installer from the exact application repository and tag: `QuilNode-<version>.dmg` or `QuilNode-<version>-arm64.dmg`. Both names denote Apple silicon. Tags may have a `v` prefix.
- Show **Available soon** when no public release or matching installer exists. Never silently substitute an older installer. A network failure offers a GitHub Releases link instead.
- Use one eight-second lookup deadline and a five-minute in-memory cache. Recheck on return to the page after that interval; do not continuously poll or persist download metadata.

Platform hints are advisory. Unsupported platforms receive a compatibility explanation. Safari's `Intel Mac OS X` string does not identify Intel hardware, so Apple-silicon and macOS requirements remain visible. Optional architecture hints stay in memory and are not sent to a service.

The site validates download locations, not DMG signatures. Checksums, signatures, installation instructions, and notarization details belong with the application release.

## Structure and privacy

```text
src/components/   Page, download action, and screenshot dialog
src/hooks/        Release and platform lifecycle
src/lib/          Release validation and presentation rules
src/styles/       Page and preview styles
assets/           Original brand vectors and icon license
public/           Privacy-mode app preview and static metadata
scripts/          Asset preparation, notices, and build policy
tests/            Download, platform, publication, and build checks
worker/           Optional Sites adapter; not deployed to Vercel
```

There are no analytics, cookies, local-storage identifiers, wallet connections, or node API requests. GitHub and the website host receive ordinary network requests. Screenshot assets must use Privacy Mode and contain no operator identities or machine metadata. Export static PNGs in sRGB; the build keeps only essential image and transparency chunks, removing metadata without re-encoding pixels. Tests check both source and deployed PNGs. Browser test fixtures are development-only and are not published.

The production bundle includes `/third-party-notices.txt` with the required licenses for React, React Icons, Feather, and Inter. Research, internal plans, and audit reports belong outside this repository.

QuilNode is an independent project, not affiliated with Quilibrium.
