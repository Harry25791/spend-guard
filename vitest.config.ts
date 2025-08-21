import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",     // browser-like env if your code touches DOM/localStorage
    globals: true,            // enables describe/it/expect without imports
    setupFiles: [],           // add a setup file here later if needed
    restoreMocks: true,
  },
});
