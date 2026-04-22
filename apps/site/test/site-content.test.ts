import {
  adjacentPeers,
  antiClaims,
  closestPeers,
  flowSteps,
  heroProofs,
  installCommand,
  pageLinks,
  packageBoundaries,
  philosophyPrinciples,
  primaryCtas,
  policyClasses
} from "../src/content/site-content";

describe("@sane/site content", () => {
  it("keeps the core trust-and-recovery messaging intact", () => {
    expect(heroProofs).toContain("Preview before apply");
    expect(heroProofs).toContain("Backup, restore, and scoped uninstall");
    expect(heroProofs).toContain("No required daily wrapper");
  });

  it("keeps the peer frame focused on verified framework and control-layer products", () => {
    expect(closestPeers.map((item) => item.name)).toEqual([
      "Superpowers",
      "gstack",
      "Everything Claude Code",
      "OpenAgentsControl"
    ]);

    expect(adjacentPeers.map((item) => item.name)).toEqual([
      "OpenAgents",
      "OpenCastle",
      "oh-my-opencode",
      "gitagent"
    ]);
  });

  it("preserves the product philosophy and implementation boundaries", () => {
    expect(flowSteps.map((item) => item.title)).toEqual([
      "Setup",
      "Inspect",
      "Repair"
    ]);

    expect(policyClasses).toEqual([
      "explorer",
      "implementation",
      "verifier",
      "realtime"
    ]);

    expect(philosophyPrinciples).toHaveLength(6);
    expect(antiClaims).toContain("Not another runtime.");
    expect(packageBoundaries).toContain("@sane/control-plane");
    expect(installCommand).toContain("cargo run -p sane");
  });

  it("keeps exported nav and install links aligned with the single-page app", () => {
    expect(pageLinks).toEqual([
      { href: "#top", label: "Home" },
      { href: "#stitched-surface", label: "Philosophy" },
      { href: "#soft-structuralism", label: "How It Works" }
    ]);

    expect(primaryCtas[0]).toEqual({
      label: "Install from source",
      href: "#install-reference"
    });
  });
});
