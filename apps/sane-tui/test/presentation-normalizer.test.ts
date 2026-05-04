import { describe, expect, it } from "vitest";

import { compactActionLabel, compactStatusSummary } from "../src/presentation-normalizer.js";

describe("presentation normalizer", () => {
  it("compacts action labels", () => {
    expect(compactActionLabel("Get this repo ready")).toBe("Set up local files");
  });

  it("compacts .sane path tokens without regex backtracking", () => {
    const summary = `${"/tmp/project/".repeat(400)}.sane ready`;

    expect(compactStatusSummary(summary)).toBe(".sane ready");
    expect(compactStatusSummary("/tmp/project/.sane-file kept")).toBe(".sane-file kept");
  });
});
