import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import MagicString from "magic-string";

function stripUseClient() {
  return {
    name: "strip-use-client",
    transform(code, id) {
      if (!id.includes("node_modules")) return;
      const starts = code.startsWith('"use client"') || code.startsWith("'use client'");
      if (!starts) return;
      const ms = new MagicString(code);
      const firstLineEnd = code.indexOf("\n");
      ms.remove(0, firstLineEnd + 1);
      return { code: ms.toString(), map: ms.generateMap({ hires: true }) };
    },
  };
}

const repoName = "analise-sped-fiscal-efd-icms-ipi";
const isCI = process.env.GITHUB_ACTIONS === "true";
const base = isCI ? `/${repoName}/` : "/";

function htmlBasePlugin() {
  return {
    name: "html-base-plugin",
    transformIndexHtml(html) {
      return html.replace(/href="\.\/images\//g, `href="${base}images/`);
    },
  };
}

export default defineConfig({
  base,
  plugins: [stripUseClient(), htmlBasePlugin(), react()],
  server: {
    port: 3001,
    open: true,
  },
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("chart.js") || id.includes("react-chartjs-2"))
              return "charts";
            if (id.includes("dexie")) return "dexie";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("date-fns")) return "date-fns";
            if (id.includes("jspdf") || id.includes("jspdf-autotable")) return "pdf";
            if (id.includes("xlsx") || id.includes("sheetjs")) return "xlsx";
            if (id.includes("jszip")) return "jszip";
            if (id.includes("html2canvas")) return "html2canvas";
            if (id.includes("dompurify")) return "purify";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("react-dom")) return "react-dom";
            if (id.includes("react") && !id.includes("react-")) return "react";
          }
        },
      },
    },
  },
});
