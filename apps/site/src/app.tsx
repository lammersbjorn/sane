import {
  ArrowRight,
  GithubLogo,
  Lifebuoy,
  ShieldCheck,
  SlidersHorizontal,
  TerminalWindow
} from "@phosphor-icons/react";

import {
  directCompetitors,
  installCommand,
  integrations,
  managedSurfaces,
  policyClasses,
  practicalChanges,
  primaryCtas,
  proofPoints,
  saneWedges,
  whatSaneDoesNotChange
} from "./content/site-content";

const navLinks = [
  { href: "#changes", label: "Changes" },
  { href: "#truth", label: "Truth" },
  { href: "#compare", label: "Peers" },
  { href: "#install", label: "Install" }
] as const;

const setupFlow = ["setup", "inspect", "repair"] as const;

export function App() {
  return (
    <main className="site-shell overflow-x-hidden">
      <BackgroundWash />
      <div className="relative">
        <header className="px-4 pt-4 md:px-6 md:pt-6">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between rounded-full border border-white/12 bg-black/40 px-4 py-3 backdrop-blur-md md:px-6">
            <a
              href="#top"
              className="flex items-center gap-3 text-sm font-medium tracking-[0.18em] text-stone-100 uppercase"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[0.72rem] text-stone-50">
                S
              </span>
              Sane
            </a>
            <nav className="hidden items-center gap-2 md:flex">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-full px-4 py-2 text-sm text-stone-300 transition hover:bg-white/10 hover:text-stone-50"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <section
          id="top"
          className="mx-auto grid min-h-[100dvh] max-w-[1400px] gap-10 px-4 pb-20 pt-12 md:px-6 md:pb-28 md:pt-20 lg:grid-cols-12 lg:items-end"
        >
          <div className="flex flex-col justify-end lg:col-span-7">
            <p className="eyebrow">Codex-native setup and repair control plane</p>
            <h1 className="mt-6 max-w-5xl text-[clamp(3.1rem,7.3vw,6.8rem)] leading-[0.92] font-bold tracking-[-0.06em] text-stone-100">
              Make Codex easier to trust, tune, inspect, and recover.
            </h1>
            <p className="mt-8 max-w-[64ch] text-lg leading-8 text-stone-300 md:text-xl">
              Sane is a plain-language-first control plane for Codex. Preview
              narrow changes, install Codex-native helpers, repair drift, then
              keep using Codex normally.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href={primaryCtas[0].href}
                className="button-primary inline-flex items-center justify-center gap-2"
              >
                <GithubLogo size={18} weight="fill" />
                {primaryCtas[0].label}
              </a>
              <a
                href={primaryCtas[1].href}
                className="button-secondary inline-flex items-center justify-center gap-2"
              >
                {primaryCtas[1].label}
                <ArrowRight size={18} weight="bold" />
              </a>
            </div>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {proofPoints.map((point) => (
                <div
                  key={point}
                  className="rounded-full border border-white/12 bg-white/4 px-4 py-3 text-sm text-stone-300"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <ControlPlaneFrame />
          </div>
        </section>

        <section id="changes" className="section-shell border-t border-white/10 pt-24 md:pt-36">
          <SectionIntro
            eyebrow="What changes in practice"
            title="Onboarding, setup, inspect, and repair replace ad hoc setup drift."
            body="Sane keeps boundaries explicit: local runtime for operational state, typed control-plane actions, and Codex-native surfaces for behavior."
          />
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {practicalChanges.map((item) => (
              <article key={item.before} className="tone-panel">
                <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">Without Sane</p>
                <p className="mt-3 text-base leading-7 text-stone-300">{item.before}</p>
                <p className="mt-6 text-sm tracking-[0.18em] text-emerald-300 uppercase">With Sane</p>
                <p className="mt-3 text-base leading-7 text-stone-100">{item.after}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="truth" className="section-shell pt-24 md:pt-36">
          <SectionIntro
            eyebrow="Control-plane and runtime truth"
            title="Typed visibility for policy, integrations, and managed surfaces."
            body="Documented model availability and spawnable-here support can differ. Sane makes that boundary inspectable instead of hiding it."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-12">
            <article className="tone-panel md:col-span-7">
              <div className="flex items-center gap-3 text-stone-100">
                <ShieldCheck size={22} weight="duotone" />
                <h3 className="text-2xl font-semibold tracking-tight">Managed surfaces now</h3>
              </div>
              <div className="mt-8 grid gap-3 md:grid-cols-2">
                {managedSurfaces.map((surface) => (
                  <div key={surface} className="surface-chip">
                    <code>{surface}</code>
                  </div>
                ))}
              </div>
            </article>

            <article className="tone-panel md:col-span-5">
              <div className="flex items-center gap-3 text-stone-100">
                <SlidersHorizontal size={22} weight="duotone" />
                <h3 className="text-2xl font-semibold tracking-tight">Policy classes</h3>
              </div>
              <div className="mt-8 grid gap-3">
                {policyClasses.map((item) => (
                  <div key={item} className="claim-row">
                    <span className="claim-dot" />
                    <span className="font-mono text-sm text-stone-200">{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-7 text-stone-400">
                Task-shaped classes are inspectable. They are operating heuristics,
                not benchmark certainty.
              </p>
            </article>

            <article className="tone-panel-strong md:col-span-6">
              <div className="flex items-center gap-3 text-stone-50">
                <Lifebuoy size={22} weight="duotone" />
                <h3 className="text-2xl font-semibold tracking-tight">Integrations visibility</h3>
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.4rem] border border-white/14 bg-white/6 p-5">
                  <p className="text-xs tracking-[0.18em] text-stone-400 uppercase">Recommended</p>
                  <ul className="mt-4 space-y-3 text-sm text-stone-200">
                    {integrations.recommended.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[1.4rem] border border-white/14 bg-white/6 p-5">
                  <p className="text-xs tracking-[0.18em] text-stone-400 uppercase">Optional</p>
                  <ul className="mt-4 space-y-3 text-sm text-stone-200">
                    {integrations.optional.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>

            <article className="tone-panel md:col-span-6">
              <div className="flex items-center gap-3 text-stone-100">
                <ShieldCheck size={22} weight="duotone" />
                <h3 className="text-2xl font-semibold tracking-tight">What Sane does not change</h3>
              </div>
              <div className="mt-8 space-y-3">
                {whatSaneDoesNotChange.map((claim) => (
                  <div key={claim} className="claim-row">
                    <span className="claim-dot" />
                    <span>{claim}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section id="compare" className="section-shell pt-24 md:pt-36">
          <SectionIntro
            eyebrow="Closest peers"
            title="Strong adjacent products exist. Sane is intentionally narrower."
            body="The wedge is explicit setup-repair framing, typed inspectability, and reversible Codex-native installs."
          />
          <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {directCompetitors.map((competitor) => (
              <article key={competitor.name} className="competitor-card">
                <p className="text-lg font-semibold tracking-tight text-stone-100">{competitor.name}</p>
                <p className="mt-3 text-sm leading-7 text-stone-300">{competitor.summary}</p>
                <p className="mt-5 text-sm text-emerald-300">{competitor.angle}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {saneWedges.map((item) => (
              <article key={item.title} className="tone-panel">
                <p className="text-lg font-semibold tracking-tight text-stone-100">{item.title}</p>
                <p className="mt-4 text-sm leading-7 text-stone-300">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="install" className="section-shell py-24 md:py-36">
          <div className="grid gap-6 md:grid-cols-12">
            <div className="tone-panel md:col-span-5">
              <p className="eyebrow">Install from source</p>
              <h2 className="mt-6 max-w-2xl text-4xl leading-none font-semibold tracking-tight text-stone-100 md:text-5xl">
                Install the control plane. Keep using Codex normally.
              </h2>
              <p className="mt-6 max-w-[58ch] text-base leading-7 text-stone-300">
                Pre-release and source-first. Good fit for explicit onboarding
                and setup-repair trust before broad packaging.
              </p>
            </div>
            <div className="tone-panel-strong md:col-span-7">
              <div className="flex items-center gap-3 text-stone-50">
                <TerminalWindow size={22} weight="duotone" />
                <h3 className="text-2xl font-semibold tracking-tight">Install command</h3>
              </div>
              <pre className="code-block mt-8">
                <code>{installCommand}</code>
              </pre>
              <div className="mt-8 grid gap-3 md:grid-cols-3">
                {setupFlow.map((item) => (
                  <div key={item} className="operation-row">
                    <span className="status-dot status-dot-accent" />
                    <span className="text-sm tracking-[0.18em] text-stone-200 uppercase">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

type SectionIntroProps = {
  eyebrow: string;
  title: string;
  body: string;
};

function SectionIntro({ eyebrow, title, body }: SectionIntroProps) {
  return (
    <div className="max-w-4xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-6 text-4xl leading-[1.02] font-semibold tracking-tight text-stone-100 md:text-5xl">
        {title}
      </h2>
      <p className="mt-6 max-w-[64ch] text-base leading-7 text-stone-300">{body}</p>
    </div>
  );
}

function ControlPlaneFrame() {
  return (
    <div className="tone-panel-strong">
      <p className="text-xs tracking-[0.18em] text-stone-400 uppercase">Setup-repair boundary</p>
      <div className="mt-6 grid gap-3">
        <div className="operation-row">
          <span className="status-dot status-dot-accent" />
          <span className="text-sm text-stone-200">Control plane: typed install / inspect / doctor</span>
        </div>
        <div className="operation-row">
          <span className="status-dot" />
          <span className="text-sm text-stone-200">Runtime: thin local state under .sane/</span>
        </div>
        <div className="operation-row">
          <span className="status-dot status-dot-accent" />
          <span className="text-sm text-stone-200">Behavior: Codex-native surfaces only</span>
        </div>
      </div>
      <div className="mt-8 rounded-[1.4rem] border border-white/12 bg-black/30 p-5">
        <p className="text-xs tracking-[0.18em] text-stone-400 uppercase">What stays untouched</p>
        <p className="mt-3 text-sm leading-7 text-stone-300">
          Normal prompting flow, unrelated repo files, and non-Sane user config.
        </p>
      </div>
    </div>
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
    </div>
  );
}
