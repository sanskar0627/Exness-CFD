import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
  base: "/", // important: root deployment
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Watch workspace dependencies for hot reload
      ignored: ["!**/node_modules/@prisma/**", "!**/node_modules/.prisma/**"],
    },
  },
  optimizeDeps: {
    // Force Vite to include workspace packages in dependency optimization
    include: [],
  },
});
