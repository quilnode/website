import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { productionSecurity } from "./scripts/security-policy.mjs";
import { thirdPartyNotices } from "./scripts/third-party-notices.mjs";

export default defineConfig({
  appType: "mpa",
  build: {
    outDir: "dist/client",
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL("./index.html", import.meta.url)),
        guide: fileURLToPath(new URL("./guide/index.html", import.meta.url)),
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), productionSecurity(), thirdPartyNotices()],
});
