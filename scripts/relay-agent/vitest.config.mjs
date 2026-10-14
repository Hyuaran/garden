import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/relay-agent/tests/**/*.test.mjs"],
    environment: "node",
  },
});
