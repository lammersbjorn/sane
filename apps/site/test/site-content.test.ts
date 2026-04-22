import {
  directCompetitors,
  installCommand,
  managedSurfaces,
  proofPoints
} from "../src/content/site-content";

describe("@sane/site content", () => {
  it("keeps the core trust-and-recovery messaging intact", () => {
    expect(proofPoints).toContain("Preview before apply");
    expect(proofPoints).toContain("Backup and restore paths");
  });

  it("keeps the direct competitor frame focused on framework-layer products", () => {
    expect(directCompetitors.map((item) => item.name)).toEqual([
      "openagentsbtw",
      "Superpowers",
      "gstack",
      "cc-thingz",
      "Arc",
      "Everything Claude Code"
    ]);
  });

  it("documents the managed surfaces and source install flow", () => {
    expect(managedSurfaces).toContain("~/.codex/config.toml");
    expect(installCommand).toContain("cargo run -p sane");
  });
});
