import { useEffect, useState } from "react";
import { getRelease } from "../lib/releases.js";
import { detectPlatform, readPlatform } from "../lib/platform.js";

export function useDownload() {
  const [release, setRelease] = useState({ kind: "loading" });
  const [platform, setPlatform] = useState(() => readPlatform(navigator));
  useEffect(() => {
    let current = true;
    function refresh() {
      if (document.visibilityState === "visible") {
        getRelease().then((value) => {
          if (current) setRelease(value);
        });
      }
    }
    refresh();
    detectPlatform(navigator).then((value) => {
      if (current) setPlatform(value);
    });
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return { release, platform };
}
