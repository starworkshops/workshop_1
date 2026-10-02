import { defineConfig } from "vite";

export default defineConfig({
  root: "app",
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "development",
    ),
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 4173,
    strictPort: true,
  },
});
