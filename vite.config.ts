import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
  test: {
    // Without this, Vitest's default glob also picks up server/ and
    // scripts/payout/'s *.test.ts files (they live inside this directory
    // tree) and tries to run them under the frontend's browser-ish
    // environment - those are separate projects with their own configs.
    include: ["src/**/*.test.ts"],
  },
});
