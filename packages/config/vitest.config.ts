import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    name: "@sane/config",
    passWithNoTests: true
  }
});
