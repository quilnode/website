import { useEffect, useRef, useState } from "react";
import { FiX, FiMaximize2 } from "react-icons/fi";

const description =
  "QuilNode's overview: local node status, network topology, epoch progress, and worker allocations. Sensitive values are hidden with Privacy Mode.";

export function AppPreview() {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  function openPreview() {
    dialog.current.showModal();
    setExpanded(true);
  }
  function closePreview() {
    dialog.current.close();
  }

  return (
    <figure className="app-preview">
      <button
        className="preview-trigger"
        ref={trigger}
        onClick={openPreview}
        aria-label="Enlarge the QuilNode app screenshot"
        aria-haspopup="dialog"
      >
        <img
          src="/images/quilnode-overview.png"
          width="1416"
          height="910"
          alt={description}
          fetchPriority="high"
          decoding="async"
        />
        <span className="preview-zoom" aria-hidden="true">
          <FiMaximize2 />
        </span>
      </button>
      <figcaption className="visually-hidden">
        App preview with Privacy Mode enabled. Select to enlarge.
      </figcaption>
      <dialog
        ref={dialog}
        className="preview-dialog"
        aria-labelledby="preview-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) closePreview();
        }}
        onClose={() => {
          setExpanded(false);
          trigger.current.focus();
        }}
      >
        <div className="preview-dialog-header">
          <h2 id="preview-title">QuilNode · Overview</h2>
          <button
            type="button"
            className="icon-button"
            autoFocus
            onClick={closePreview}
            aria-label="Close screenshot"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
        <img
          src="/images/quilnode-overview.png"
          width="1416"
          height="910"
          alt={description}
        />
        <p>
          Privacy Mode is enabled. This is an app screenshot, not live network
          data.
        </p>
      </dialog>
    </figure>
  );
}
