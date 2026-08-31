import { FiExternalLink } from "react-icons/fi";
import { PROJECT } from "../lib/config.js";
import { DownloadAction } from "./DownloadAction.jsx";
import { AppPreview } from "./AppPreview.jsx";

export function Site({ release, platform }) {
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="QuilNode home">
          <img src="/images/quilnode-mark.svg" width="48" height="48" alt="" />
          <span>QuilNode</span>
        </a>
        <a
          className="source-link"
          href={PROJECT.repositoryURL}
          rel="noreferrer"
        >
          GitHub <FiExternalLink aria-hidden="true" />
        </a>
      </header>
      <main id="main" tabIndex="-1">
        <section className="intro" aria-labelledby="page-heading">
          <h1 id="page-heading">
            Operate Quilibrium
            <br />
            from your Mac.
          </h1>
          <p className="intro-description">
            Monitor your node, manage updates, and check diagnostics.
          </p>
          <DownloadAction release={release} platform={platform} />
        </section>
        <AppPreview />
      </main>
      <footer className="site-footer">
        <p>Independent project. Not affiliated with Quilibrium.</p>
        <a
          href={release.release?.notesURL || PROJECT.releasesURL}
          rel="noreferrer"
        >
          Release notes <FiExternalLink aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
