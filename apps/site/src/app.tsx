import {
  ArrowRight,
  ArrowUpRight,
  ClockCounterClockwise,
  Files,
  GithubLogo,
  Lifebuoy,
  ShieldCheck,
  SlidersHorizontal,
  Stack,
  TerminalWindow,
  Wrench
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

import {
  adjacentPeers,
  antiClaims,
  buildStoryHref,
  closestPeers,
  flowSteps,
  heroProofs,
  howItWorksLayers,
  howItWorksSteps,
  installCommand,
  installNotes,
  integrations,
  managedSurfaces,
  packageBoundaries,
  philosophyPrinciples,
  policyClasses,
  practicalChanges,
  primaryCtas,
  runtimeArtifacts
} from "./content/site-content";

const concepts = [
  {
    id: "control-room",
    number: "01",
    name: "Control Room",
    note: "Tactical dark UI. Setup and recovery feel operational, not promotional."
  },
  {
    id: "black-ledger",
    number: "02",
    name: "Black Ledger",
    note: "Editorial dark document. Heavy on scope, reversibility, and boundaries."
  },
  {
    id: "hardware-drawer",
    number: "03",
    name: "Hardware Drawer",
    note: "Machined modular system. Every surface feels like a part you can inspect."
  },
  {
    id: "soft-structuralism",
    number: "04",
    name: "Soft Structuralism",
    note: "Calm premium dark mode. Big type, low chrome, anti-wrapper confidence."
  },
  {
    id: "field-manual",
    number: "05",
    name: "Field Manual",
    note: "Brutalist documentation system. Clear procedures, hard separators, recovery first."
  },
  {
    id: "stitched-surface",
    number: "06",
    name: "Stitched Surface",
    note: "Layered premium bento. Sane as a thin surface added to Codex, not a replacement."
  }
] as const;

export function App() {
  return (
    <main className="site-shell overflow-x-hidden">
      <BackgroundWash />
      <div className="relative">
        <header className="px-4 pt-4 md:px-6 md:pt-6">
          <div className="site-nav-shell">
            <a
              href="#top"
              className="flex items-center gap-3 text-sm font-medium tracking-[0.18em] text-stone-100 uppercase"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[0.72rem] text-stone-50">
                S
              </span>
              Sane
            </a>
            <nav className="hidden items-center gap-2 lg:flex">
              {concepts.map((concept) => (
                <a
                  key={concept.id}
                  href={`#${concept.id}`}
                  className="nav-pill"
                >
                  {concept.number}
                  <span>{concept.name}</span>
                </a>
              ))}
            </nav>
            <a
              href={primaryCtas[1].href}
              className="button-secondary inline-flex items-center justify-center gap-2"
            >
              <GithubLogo size={18} weight="fill" />
              GitHub
            </a>
          </div>
        </header>

        <section
          id="top"
          className="section-shell grid min-h-[92dvh] gap-10 pb-16 pt-14 md:pb-24 md:pt-20 lg:grid-cols-12 lg:items-end"
        >
          <div className="lg:col-span-7">
            <p className="eyebrow">Six dark directions for the Sane site</p>
            <h1 className="mt-6 max-w-5xl text-[clamp(3.1rem,7vw,6.8rem)] leading-[0.9] font-bold tracking-[-0.06em] text-stone-100">
              Same product truth. Six completely different ways to sell it.
            </h1>
            <p className="mt-8 max-w-[66ch] text-lg leading-8 text-stone-300 md:text-xl">
              All six keep Sane accurate: onboarding-first setup, inspect, and
              repair for Codex. No wrapper ritual. No fake runtime. Just very
              different ways to frame trust, reversibility, and control.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="#control-room"
                className="button-primary inline-flex items-center justify-center gap-2"
              >
                Compare concepts
                <ArrowRight size={18} weight="bold" />
              </a>
              <a
                href="#install-reference"
                className="button-secondary inline-flex items-center justify-center gap-2"
              >
                Keep install CTA in view
              </a>
            </div>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {heroProofs.map((point) => (
                <div
                  key={point}
                  className="rounded-full border border-white/12 bg-white/5 px-4 py-3 text-sm text-stone-300"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5">
            <ConceptIndex />
          </div>
        </section>

        <div className="concept-stack">
          <ConceptSection
            id="control-room"
            number="01"
            name="Control Room"
            note="Operational, tactical, and explicit about status."
            className="concept-control-room"
          >
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <p className="concept-kicker">Onboard. Inspect. Repair. Restore.</p>
                <h2 className="concept-title">
                  Make Codex easier to trust under real operating conditions.
                </h2>
                <p className="concept-body">
                  This version treats Sane like an ops console for setup and
                  recovery. It foregrounds runtime truth, touched files, and
                  repair posture before anything aspirational.
                </p>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {practicalChanges.slice(0, 2).map((item) => (
                    <article key={item.before} className="tactical-panel">
                      <p className="micro-label text-rose-300">Without Sane</p>
                      <p className="mt-3 text-sm leading-7 text-stone-300">{item.before}</p>
                      <p className="micro-label mt-6 text-emerald-300">With Sane</p>
                      <p className="mt-3 text-sm leading-7 text-stone-100">{item.after}</p>
                    </article>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="system-panel">
                  <div className="system-row">
                    <span className="system-dot system-dot-live" />
                    <span>documented models != spawnable-here support</span>
                  </div>
                  <div className="system-row">
                    <span className="system-dot system-dot-warn" />
                    <span>managed writes stay narrow and reversible</span>
                  </div>
                  <div className="system-row">
                    <span className="system-dot system-dot-live" />
                    <span>normal Codex prompting flow stays untouched</span>
                  </div>
                  <div className="mt-6 grid gap-3">
                    {flowSteps.map((step) => (
                      <div key={step.title} className="system-card">
                        <p className="micro-label text-stone-400">{step.title}</p>
                        <p className="mt-2 text-sm leading-7 text-stone-200">{step.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-4">
              <MetricPanel
                icon={<SlidersHorizontal size={20} weight="duotone" />}
                title="Policy classes"
                items={policyClasses}
              />
              <MetricPanel
                icon={<ShieldCheck size={20} weight="duotone" />}
                title="Managed surfaces"
                items={managedSurfaces.slice(0, 4)}
              />
              <MetricPanel
                icon={<Files size={20} weight="duotone" />}
                title="Runtime visibility"
                items={runtimeArtifacts.slice(0, 4)}
              />
              <MetricPanel
                icon={<Lifebuoy size={20} weight="duotone" />}
                title="Recommended adds"
                items={integrations.recommended}
              />
            </div>
          </ConceptSection>

          <ConceptSection
            id="black-ledger"
            number="02"
            name="Black Ledger"
            note="Single-column narrative. Calm, careful, deliberate."
            className="concept-black-ledger"
          >
            <div className="ledger-shell">
              <p className="concept-kicker">What Sane changes. What it leaves alone. What you can undo.</p>
              <h2 className="concept-title max-w-4xl">
                A careful site that reads like a boundary document, not a hype page.
              </h2>
              <p className="concept-body max-w-[70ch]">
                This direction leans into the reality that Sane earns trust by
                being inspectable. It sells scope control, additive behavior,
                and recovery paths in plain language.
              </p>
              <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-8">
                  <NarrativeBlock
                    label="What it changes"
                    body="Skills, overlays, hooks, custom agents, recommended integrations, and a narrow Codex profile can all be previewed and applied as explicit surfaces."
                  />
                  <NarrativeBlock
                    label="What it leaves alone"
                    body="Normal prompting, unrelated repo files, and user content outside Sane-managed blocks remain outside the product’s write scope."
                  />
                  <NarrativeBlock
                    label="What you can undo"
                    body="Preview, backup, restore, uninstall, and doctor are part of the story, not an afterthought hidden after the install step."
                  />
                </div>
                <div className="space-y-4">
                  {antiClaims.map((claim) => (
                    <div key={claim} className="ledger-callout">
                      {claim}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ConceptSection>

          <ConceptSection
            id="hardware-drawer"
            number="03"
            name="Hardware Drawer"
            note="Machined modules, square edges, one part per job."
            className="concept-hardware-drawer"
          >
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div>
                <p className="concept-kicker">Open the drawer. Review the part. Apply only what you need.</p>
                <h2 className="concept-title">
                  Sane as a modular toolkit instead of a single sweeping promise.
                </h2>
                <p className="concept-body">
                  This version frames the product as a set of bounded parts:
                  defaults, integrations, exports, and repair. Good fit if we
                  want the site to feel mechanical and exact.
                </p>
              </div>
              <div className="drawer-stack">
                <DrawerPanel
                  title="Defaults"
                  body="Preview a narrow Codex profile for model, reasoning effort, and hook support."
                />
                <DrawerPanel
                  title="Integrations"
                  body="Keep the recommended integrations profile separate from the core Codex profile."
                />
                <DrawerPanel
                  title="Exports"
                  body="Manage skills, overlays, hooks, and custom agents as explicit Codex-native pieces."
                />
                <DrawerPanel
                  title="Repair"
                  body="Use inspect, doctor, restore, and uninstall to recover without broad repo mutation."
                />
              </div>
            </div>
          </ConceptSection>

          <ConceptSection
            id="soft-structuralism"
            number="04"
            name="Soft Structuralism"
            note="Premium, quiet, wide, and anti-theater."
            className="concept-soft-structuralism"
          >
            <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
              <div>
                <p className="concept-kicker">Better defaults without process theater.</p>
                <h2 className="concept-title max-w-4xl">
                  A dark mode that feels calm enough for everyone, not just terminal maximalists.
                </h2>
                <p className="concept-body max-w-[65ch]">
                  This is the broadest-market direction. It keeps the trust and
                  reversibility message, but feels less like infrastructure and
                  more like an exact premium product page.
                </p>
              </div>
              <div className="soft-glass">
                <div className="soft-glass-inner">
                  <p className="micro-label text-emerald-300">Three-layer split</p>
                  <div className="mt-5 space-y-4">
                    {howItWorksLayers.map((layer) => (
                      <div key={layer.title} className="soft-row">
                        <p className="text-sm font-medium text-stone-100">{layer.title}</p>
                        <p className="mt-2 text-sm leading-7 text-stone-300">{layer.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {philosophyPrinciples.slice(0, 3).map((item) => (
                <article key={item.title} className="soft-panel">
                  <p className="text-lg font-semibold tracking-tight text-stone-100">{item.title}</p>
                  <p className="mt-4 text-sm leading-7 text-stone-300">{item.body}</p>
                </article>
              ))}
            </div>
          </ConceptSection>

          <ConceptSection
            id="field-manual"
            number="05"
            name="Field Manual"
            note="Brutalist documentation with procedural confidence."
            className="concept-field-manual"
          >
            <div className="manual-grid">
              <div className="manual-main">
                <p className="concept-kicker">How it works. What it writes. How to recover.</p>
                <h2 className="concept-title">
                  The site reads like an annotated operating manual.
                </h2>
                <p className="concept-body">
                  This direction is more opinionated and more technical. It
                  works if we want Sane to feel like the trustworthy manual for
                  managing Codex behavior.
                </p>
              </div>
              <aside className="manual-side">
                <p className="micro-label text-rose-300">Checklist</p>
                <ol className="manual-list">
                  {howItWorksSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </aside>
            </div>
            <div className="mt-8 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="manual-card">
                <p className="micro-label text-stone-400">What gets written</p>
                <div className="mt-4 space-y-3">
                  {managedSurfaces.slice(0, 6).map((surface) => (
                    <div key={surface} className="manual-row">
                      <span className="manual-mark">/</span>
                      <code>{surface}</code>
                    </div>
                  ))}
                </div>
              </div>
              <div className="manual-card">
                <p className="micro-label text-stone-400">Current package split</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {packageBoundaries.map((item) => (
                    <div key={item} className="manual-row">
                      <span className="manual-mark">#</span>
                      <code>{item}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ConceptSection>

          <ConceptSection
            id="stitched-surface"
            number="06"
            name="Stitched Surface"
            note="Asymmetric premium bento with a clear integration story."
            className="concept-stitched-surface"
          >
            <div className="stitch-grid">
              <article className="stitch-hero">
                <p className="concept-kicker">Small local runtime. Native Codex surfaces. Reversible changes.</p>
                <h2 className="concept-title max-w-3xl">
                  A premium product page that still tells the truth about what Sane actually is.
                </h2>
                <p className="concept-body max-w-[60ch]">
                  This is the strongest “ship it” marketing direction if we want
                  something cleaner and more premium without losing the
                  setup-repair wedge.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {heroProofs.slice(0, 4).map((proof) => (
                    <span key={proof} className="stitch-chip">
                      {proof}
                    </span>
                  ))}
                </div>
              </article>
              <article className="stitch-card">
                <div className="flex items-center gap-3 text-stone-100">
                  <Stack size={20} weight="duotone" />
                  <p className="text-lg font-semibold tracking-tight">Closest peers</p>
                </div>
                <div className="mt-5 space-y-4">
                  {closestPeers.slice(0, 3).map((peer) => (
                    <div key={peer.name} className="stitch-peer">
                      <div>
                        <p className="text-sm font-medium text-stone-100">{peer.name}</p>
                        <p className="mt-1 text-sm leading-6 text-stone-300">{peer.category}</p>
                      </div>
                      <a href={peer.href} className="peer-link">
                        <ArrowUpRight size={16} weight="bold" />
                      </a>
                    </div>
                  ))}
                </div>
              </article>
              <article className="stitch-card">
                <div className="flex items-center gap-3 text-stone-100">
                  <ClockCounterClockwise size={20} weight="duotone" />
                  <p className="text-lg font-semibold tracking-tight">Recovery rails</p>
                </div>
                <div className="mt-5 space-y-3">
                  {["preview", "backup", "restore", "doctor", "uninstall"].map((item) => (
                    <div key={item} className="stitch-row">
                      <span className="stitch-dot" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="stitch-card stitch-card-wide" id="install-reference">
                <div className="flex items-center gap-3 text-stone-100">
                  <TerminalWindow size={20} weight="duotone" />
                  <p className="text-lg font-semibold tracking-tight">Install reference</p>
                </div>
                <pre className="code-block mt-6">
                  <code>{installCommand}</code>
                </pre>
                <div className="mt-6 flex flex-wrap gap-3">
                  {installNotes.map((note) => (
                    <span key={note} className="stitch-chip">
                      {note}
                    </span>
                  ))}
                </div>
              </article>
            </div>
          </ConceptSection>
        </div>

        <section className="section-shell pb-24 pt-10 md:pb-32">
          <div className="footer-panel">
            <div>
              <p className="eyebrow">Research frame kept current</p>
              <p className="mt-5 max-w-[68ch] text-base leading-7 text-stone-300">
                Peer set now centers on skill packs, harnesses, and control
                layers like Superpowers, gstack, Everything Claude Code,
                OpenAgentsControl, and OpenAgents. Unverified names stayed out.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <CompactList
                title="Verified close peers"
                icon={<Wrench size={18} weight="duotone" />}
                items={closestPeers.map((peer) => peer.name)}
              />
              <CompactList
                title="Adjacent peers"
                icon={<Files size={18} weight="duotone" />}
                items={adjacentPeers.map((peer) => peer.name)}
              />
            </div>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href={primaryCtas[1].href}
                className="button-primary inline-flex items-center justify-center gap-2"
              >
                <GithubLogo size={18} weight="fill" />
                View repository
              </a>
              <a
                href={buildStoryHref}
                className="button-secondary inline-flex items-center justify-center gap-2"
              >
                BuildStory project note
                <ArrowUpRight size={18} weight="bold" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

type ConceptSectionProps = {
  id: string;
  number: string;
  name: string;
  note: string;
  className: string;
  children: ReactNode;
};

function ConceptSection({
  id,
  number,
  name,
  note,
  className,
  children
}: ConceptSectionProps) {
  return (
    <section id={id} className={`section-shell concept-frame ${className}`}>
      <div className="concept-header">
        <div>
          <p className="concept-id">
            {number}
            <span>{name}</span>
          </p>
          <p className="mt-3 max-w-[62ch] text-sm leading-7 text-stone-400">{note}</p>
        </div>
        <a href="#top" className="back-link">
          Back to picker
          <ArrowUpRight size={16} weight="bold" />
        </a>
      </div>
      {children}
    </section>
  );
}

function ConceptIndex() {
  return (
    <div className="concept-index">
      <p className="micro-label text-stone-400">Pick a direction to expand later</p>
      <div className="mt-6 grid gap-3">
        {concepts.map((concept) => (
          <a key={concept.id} href={`#${concept.id}`} className="concept-index-row">
            <div>
              <p className="text-sm font-medium tracking-[0.14em] text-stone-100 uppercase">
                {concept.number} {concept.name}
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-400">{concept.note}</p>
            </div>
            <ArrowRight size={18} weight="bold" className="text-stone-500" />
          </a>
        ))}
      </div>
    </div>
  );
}

type MetricPanelProps = {
  icon: ReactNode;
  title: string;
  items: readonly string[];
};

function MetricPanel({ icon, title, items }: MetricPanelProps) {
  return (
    <article className="tactical-panel">
      <div className="flex items-center gap-3 text-stone-100">
        {icon}
        <p className="text-base font-semibold tracking-tight">{title}</p>
      </div>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item} className="tactical-row">
            <span className="tactical-tick" />
            <span className="font-mono text-sm text-stone-300">{item}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

type NarrativeBlockProps = {
  label: string;
  body: string;
};

function NarrativeBlock({ label, body }: NarrativeBlockProps) {
  return (
    <article className="narrative-block">
      <p className="micro-label text-stone-500">{label}</p>
      <p className="mt-4 text-base leading-8 text-stone-200">{body}</p>
    </article>
  );
}

type DrawerPanelProps = {
  title: string;
  body: string;
};

function DrawerPanel({ title, body }: DrawerPanelProps) {
  return (
    <article className="drawer-panel">
      <div className="drawer-handle" />
      <div>
        <p className="text-sm font-medium tracking-[0.18em] text-stone-100 uppercase">{title}</p>
        <p className="mt-3 text-sm leading-7 text-stone-300">{body}</p>
      </div>
    </article>
  );
}

type CompactListProps = {
  title: string;
  icon: ReactNode;
  items: readonly string[];
};

function CompactList({ title, icon, items }: CompactListProps) {
  return (
    <article className="compact-panel">
      <div className="flex items-center gap-3 text-stone-100">
        {icon}
        <p className="text-base font-semibold tracking-tight">{title}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="compact-chip">
            {item}
          </span>
        ))}
      </div>
    </article>
  );
}

function BackgroundWash() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="wash-orb wash-orb-primary" />
      <div className="wash-orb wash-orb-secondary" />
      <div className="wash-grid" />
      <div className="wash-noise" />
    </div>
  );
}
