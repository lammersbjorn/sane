import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "bin/sane": "bin/sane-preview.ts"
  },
  format: ["cjs"],
  platform: "node",
  target: "node20",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  outDir: "dist",
  noExternal: [/^@sane\//]
});
