import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoName = "analise-sped-fiscal-efd-icms-ipi";
const isCI = process.env.GITHUB_ACTIONS === "true";

// https://vitejs.dev/config/
export default defineConfig({
  base: isCI ? `/${repoName}/` : "/",
  plugins: [react()],
  server: {
    port: 3001,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
