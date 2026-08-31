import { Site } from "./components/Site.jsx";
import { useDownload } from "./hooks/useDownload.js";

export function App() {
  const { release, platform } = useDownload();
  return <Site release={release} platform={platform} />;
}
