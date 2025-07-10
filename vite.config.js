import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    proxy: {
      "/ws": {
        target: "ws://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, ""),
        ws: true,
      },
    },
  },
});
