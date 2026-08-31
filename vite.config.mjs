import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { productionSecurity } from "./scripts/security-policy.mjs";
import { thirdPartyNotices } from "./scripts/third-party-notices.mjs";

export default defineConfig({
  build: {
    outDir: "dist/client",
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
