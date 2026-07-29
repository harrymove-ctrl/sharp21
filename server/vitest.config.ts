import { defineConfig } from "vitest/config";

// Explicit, empty-plugin config so this backend's tests never inherit the
// frontend's vite.config.ts (React plugin, etc.) just because Vite's config
// resolution walks up from server/ into the parent sharp21/ directory.
export default defineConfig({
  test: {
    environment: "node",
  },
});
