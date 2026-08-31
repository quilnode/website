import { FiDownload, FiExternalLink, FiLoader } from "react-icons/fi";
import { presentDownload } from "../lib/download-presentation.js";

export function DownloadAction({ release, platform }) {
  const presentation = presentDownload(release, platform);
  const Icon =
    presentation.icon === "loading"
      ? FiLoader
      : presentation.icon === "external"
        ? FiExternalLink
        : FiDownload;
  const contents = (
    <>
      <Icon
        aria-hidden="true"
        className={presentation.icon === "loading" ? "loading-icon" : undefined}
      />
      <span>{presentation.label}</span>
    </>
  );
  return (
    <div className="download-area">
      {presentation.href ? (
        <a
          className="download-button"
          href={presentation.href}
          aria-describedby="download-detail"
          rel="noreferrer"
          data-download={presentation.download || undefined}
        >
          {contents}
        </a>
      ) : (
        <button
          className="download-button"
          type="button"
          disabled
          aria-describedby="download-detail"
          aria-busy={presentation.icon === "loading"}
        >
          {contents}
        </button>
      )}
      <p
        className="download-detail"
        id="download-detail"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="visually-hidden">
          {presentation.announcement || presentation.label}.{" "}
        </span>
        {presentation.detail}
      </p>
    </div>
  );
}
