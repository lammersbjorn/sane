import {
  ArrowRight,
  ArrowUpRight,
  Cube,
  Eye,
  GithubLogo,
  MagnifyingGlass,
  Package,
  Stack,
  Wrench,
  UploadSimple
} from "@phosphor-icons/react";
import { motion } from "motion/react";

import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import {
  bottomColumns,
  commandPreview,
  diagramInputs,
  diagramOutputs,
  footerStatement,
  heroActions,
  heroBadges,
  heroBody,
  heroSubBody,
  heroTitle,
  installCommand,
  installMeta,
  lowerCards,
  navLinks,
  setupRail
} from "./content/site-content";

const lowerIcons = [Package, Stack, UploadSimple] as const;

export function App() {
  return (
    <main className="site-shell overflow-x-hidden">
      <BackgroundWash />
      <div className="relative">
        <header className="px-4 pt-4 md:px-6 md:pt-6">
          <div className="site-nav-shell">
            <a
              href="#top"
              className="flex items-center gap-3 text-[2.1rem] font-semibold tracking-[-0.05em] text-stone-50"
            >
              <span className="brand-mark">
                <Stack size={20} weight="regular" />
              </span>
              Sane
            </a>

            <nav className="hidden items-center gap-10 xl:flex">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="nav-link"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-4 lg:flex">
              <div className="command-pill">
                <span className="text-emerald-300">$</span>
                <code>{commandPreview}</code>
              </div>
              <a
                href="https://github.com/lammersbjorn/sane"
                className="icon-button"
                aria-label="View Sane on GitHub"
              >
                <GithubLogo size={22} weight="fill" />
              </a>
            </div>
          </div>
        </header>

        <section
          id="top"
          className="section-shell grid min-h-[88dvh] gap-10 pb-10 pt-14 xl:grid-cols-[1.02fr_0.98fr] xl:items-center xl:pb-14"
        >
          <div className="hero-copy">
            <div className="eyebrow-row">
              <span className="eyebrow-dot" />
              <span>Onboarding-first by design</span>
            </div>

            <h1 className="hero-title">
              {heroTitle.split("Codex").map((part, index, array) => (
                <span key={`${part}-${index}`}>
                  {part}
                  {index < array.length - 1 ? (
                    <span className="hero-title-accent">Codex</span>
                  ) : null}
                </span>
              ))}
            </h1>

            <p className="hero-lead">{heroBody}</p>
            <p className="hero-sublead">{heroSubBody}</p>

            <div className="hero-badge-row">
              {heroBadges.map((badge) => (
                <span key={badge} className="hero-badge">
                  {badge}
                </span>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button asChild>
                <a href={heroActions[0].href}>
                  <span className="font-mono text-base">{">_"}</span>
                  {heroActions[0].label}
                </a>
              </Button>
              <Button asChild variant="secondary">
                <a href={heroActions[1].href}>
                  {heroActions[1].label}
                  <ArrowUpRight size={18} weight="bold" />
                </a>
              </Button>
            </div>

            <div className="hero-meta">
              <code>npm i -g @sane/cli</code>
              <span className="divider-dot" />
              <span className="text-emerald-300">Open Source</span>
            </div>
          </div>

          <HeroDiagram />
        </section>

        <section className="section-shell">
          <Card className="rail-card">
            <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-center">
              {setupRail.map((item, index) => (
                <div key={item.title} className="contents">
                  <div className="rail-step">
                    <div className="rail-icon">
                      {index === 0 ? (
                        <UploadSimple size={34} weight="regular" />
                      ) : index === 1 ? (
                        <MagnifyingGlass size={34} weight="regular" />
                      ) : (
                        <Wrench size={34} weight="regular" />
                      )}
                    </div>
                    <div>
                      <p className="rail-count">{item.step}</p>
                      <h2 className="rail-title">{item.title}</h2>
                      <p className="rail-body">{item.body}</p>
                    </div>
                  </div>
                  {index < setupRail.length - 1 ? (
                    <div className="rail-arrow" aria-hidden="true">
                      <ArrowRight size={20} weight="bold" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="section-shell py-6 md:py-8">
          <div className="grid gap-4 xl:grid-cols-[1.18fr_0.98fr_1fr]">
            {lowerCards.map((card, index) => {
              const Icon = lowerIcons[index];

              if (card.title === "Install from source") {
                return (
                  <Card key={card.title} className="lower-card p-6">
                    <div className="card-header">
                      <div className="card-icon-wrap">
                        <Icon size={20} weight="regular" />
                      </div>
                      <h3 className="card-title">{card.title}</h3>
                    </div>

                    <pre className="install-block">
                      <code>{installCommand}</code>
                    </pre>

                    <div className="install-footer">
                      <span>{installMeta[0]}</span>
                      <a
                        href="https://github.com/lammersbjorn/sane"
                        className="inline-flex items-center gap-2 text-emerald-300 transition hover:text-emerald-200"
                      >
                        {installMeta[2]}
                        <ArrowRight size={16} weight="bold" />
                      </a>
                    </div>
                  </Card>
                );
              }

              return (
                <Card key={card.title} className="lower-card p-6">
                  <div className="card-header">
                    <div className="card-icon-wrap">
                      <Icon size={20} weight="regular" />
                    </div>
                    <h3 className="card-title">{card.title}</h3>
                  </div>

                  {card.title === "Managed surfaces" ? (
                    <div className="managed-grid">
                      <div className="managed-list">
                        {card.items.map((item) => (
                          <div key={item.label} className="managed-item">
                            <p className="managed-label">{item.label}</p>
                            <p className="managed-body">{item.body}</p>
                          </div>
                        ))}
                      </div>
                      <StackPreview />
                    </div>
                  ) : (
                    <div className="peer-grid">
                      <div className="space-y-4">
                        {card.items.map((item) => (
                          <div key={item.label} className="peer-item">
                            <p className="peer-label">{item.label}</p>
                            <p className="peer-body">{item.body}</p>
                          </div>
                        ))}
                      </div>
                      <div className="peer-summary">
                        <p className="text-[1.7rem] leading-[1.1] font-medium tracking-[-0.04em] text-emerald-300">
                          Sane is purpose-built for Codex.
                        </p>
                        <p className="mt-6 text-base leading-8 text-stone-400">
                          Onboarding-first. Reversible by default. Plain-language first. Not a runtime.
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        <section className="section-shell border-t border-white/8 pb-10 pt-12 md:pb-16 md:pt-14">
          <div className="grid gap-8 xl:grid-cols-3">
            <article id="why" className="bottom-column">
              <h2 className="bottom-title">{bottomColumns[0].title}</h2>
              <p className="bottom-body">{bottomColumns[0].body}</p>
              <Button asChild variant="ghost" className="mt-8">
                <a href="#how">
                  {bottomColumns[0].cta}
                  <ArrowRight size={16} weight="bold" />
                </a>
              </Button>
            </article>

            <article id="peers" className="bottom-column column-divider">
              <h2 className="bottom-title">{bottomColumns[1].title}</h2>
              <div className="mt-8 space-y-6">
                {bottomColumns[1].list?.map((item) => (
                  <div key={item.label} className="bottom-list-item">
                    <p className="bottom-list-label">{item.label}</p>
                    <p className="bottom-list-body">{item.body}</p>
                  </div>
                ))}
              </div>
            </article>

            <article id="how" className="bottom-column column-divider">
              <h2 className="bottom-title">{bottomColumns[2].title}</h2>
              <p className="bottom-body">{bottomColumns[2].body}</p>
              <Button asChild variant="ghost" className="mt-8">
                <a href={heroActions[1].href}>
                  {bottomColumns[2].cta}
                  <ArrowRight size={16} weight="bold" />
                </a>
              </Button>
            </article>
          </div>
        </section>

        <footer className="section-shell border-t border-white/8 pb-12 pt-8 md:pb-16">
          <div className="footer-shell">
            <div className="footer-mark">S</div>
            <div>
              <h2 className="text-[2.4rem] leading-none tracking-[-0.05em] text-stone-100">
                {footerStatement.title}
              </h2>
              <p className="mt-3 text-base leading-8 text-stone-400">
                {footerStatement.body}
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function HeroDiagram() {
  return (
    <motion.div
      className="diagram-shell"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="diagram-grid" aria-hidden="true" />

      <div className="diagram-rail diagram-rail-left">
        {diagramInputs.map((item, index) => (
          <Card key={item.title} className="diagram-card">
            <div className="diagram-card-inner">
              <p className="diagram-card-title">{item.title}</p>
              <p className="diagram-card-meta">{item.meta}</p>
            </div>
            <span className={`connector connector-left connector-left-${index + 1}`} />
          </Card>
        ))}
      </div>

      <div className="diagram-center">
        <motion.div
          className="center-stack"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="center-layer center-layer-1" />
          <div className="center-layer center-layer-2" />
          <div className="center-layer center-layer-3" />
          <div className="center-core">
            <Cube size={42} weight="regular" />
          </div>
        </motion.div>
        <div className="center-tag">Sane</div>
        <div className="reversible-pill">Reversible by default</div>
      </div>

      <div className="diagram-rail diagram-rail-right">
        {diagramOutputs.map((item, index) => (
          <Card key={item.title} className="diagram-card">
            <div className="diagram-card-inner">
              <p className="diagram-card-title">{item.title}</p>
              <p className="diagram-card-meta">{item.meta}</p>
            </div>
            <span className={`connector connector-right connector-right-${index + 1}`} />
            <div className="diagram-output-icon">
              {index === 0 ? (
                <Eye size={18} weight="regular" />
              ) : index === 1 ? (
                <Package size={18} weight="regular" />
              ) : index === 2 ? (
                <ArrowRight size={18} weight="bold" />
              ) : (
                <Wrench size={18} weight="regular" />
              )}
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

function StackPreview() {
  return (
    <div className="stack-preview" aria-hidden="true">
      <div className="stack-card stack-card-1" />
      <div className="stack-card stack-card-2" />
      <div className="stack-card stack-card-3" />
      <div className="stack-card stack-card-4" />
      <div className="stack-line stack-line-1" />
      <div className="stack-line stack-line-2" />
      <div className="stack-line stack-line-3" />
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
      <div className="wash-rings" />
      <div className="wash-grid" />
      <div className="wash-noise" />
    </div>
  );
}
