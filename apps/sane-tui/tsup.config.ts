import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "bin/sane": "bin/sane-preview.ts"
  },
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire as __saneCreateRequire } from "module";',
      "const require = __saneCreateRequire(import.meta.url);"
    ].join("\n")
  },
  format: ["esm"],
  platform: "node",
  target: "node20",
  bundle: true,
  splitting: false,
  sourcemap: false,
  shims: true,
  clean: true,
  dts: false,
  outDir: "dist",
  noExternal: [/.*/]
});
