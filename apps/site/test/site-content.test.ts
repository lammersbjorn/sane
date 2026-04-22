import {
  directCompetitors,
  integrations,
  installCommand,
  managedSurfaces,
  policyClasses,
  proofPoints
} from "../src/content/site-content";

describe("@sane/site content", () => {
  it("keeps the core trust-and-recovery messaging intact", () => {
    expect(proofPoints).toContain("Preview before apply");
    expect(proofPoints).toContain("Backup and restore paths");
    expect(proofPoints).toContain("Typed inspect visibility");
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

  it("documents managed surfaces, integrations, policy classes, and install flow", () => {
    expect(managedSurfaces).toContain("~/.codex/config.toml");
    expect(integrations.recommended).toContain("Context7");
    expect(policyClasses).toEqual([
      "explorer",
      "implementation",
      "verifier",
      "realtime"
    ]);
    expect(installCommand).toContain("cargo run -p sane");
  });
});
