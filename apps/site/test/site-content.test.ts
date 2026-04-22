import {
  bottomColumns,
  diagramInputs,
  diagramOutputs,
  heroBadges,
  heroTitle,
  installCommand,
  lowerCards,
  navLinks,
  setupRail
} from "../src/content/site-content";

describe("@sane/site content", () => {
  it("keeps the hero message tied to the current Sane frame", () => {
    expect(heroTitle).toBe("The control plane for Codex.");
    expect(heroBadges).toContain("Not another runtime");
    expect(heroBadges).toContain("Plain-language first");
  });

  it("keeps the reference-matched information architecture intact", () => {
    expect(setupRail.map((item) => item.title)).toEqual([
      "Setup",
      "Inspect",
      "Repair"
    ]);

    expect(lowerCards.map((card) => card.title)).toEqual([
      "Managed surfaces",
      "Closest peers",
      "Install from source"
    ]);
  });

  it("preserves diagram and footer content that sells reversibility", () => {
    expect(diagramInputs.map((item) => item.title)).toEqual([
      "Files",
      "Diffs",
      "Hooks",
      "Skills"
    ]);

    expect(diagramOutputs.map((item) => item.title)).toEqual([
      "Preview",
      "Backup",
      "Restore",
      "Uninstall"
    ]);

    expect(bottomColumns[2]?.title).toBe("Why Sane is narrower");
    expect(navLinks.at(-1)?.label).toBe("GitHub");
    expect(installCommand).toContain("cargo run -p sane");
  });
});
