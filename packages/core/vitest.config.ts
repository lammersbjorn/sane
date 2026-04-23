import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    name: "@sane/core",
    passWithNoTests: true
  }
});
