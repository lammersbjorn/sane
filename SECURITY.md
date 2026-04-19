# Security Policy

## Supported Versions

`Sane` is pre-release.
Right now, only the current `main` branch should be considered supported.

## Reporting a Vulnerability

Please do **not** open a public issue for a security vulnerability.

If GitHub private vulnerability reporting is enabled for this repository, use that.
If it is not available, contact the maintainer through the repository owner's GitHub profile contact method.

Please include:

- what you found
- affected files or area
- how it can be reproduced
- impact if known
- any suggested mitigation

## What Counts as Security-Sensitive Here

Examples include:

- unsafe config mutation
- accidental exposure of API keys or secrets in session summaries or `.sane` state files
- destructive uninstall or restore behavior
- trust-boundary failures around managed Codex assets
- unexpected network or telemetry behavior

## Response Goals

For valid reports, the goal is to:

- confirm receipt
- reproduce the issue
- prepare a fix or mitigation
- publish details after users have a chance to update

Because the project is still early, timelines may vary, but responsible disclosure is appreciated.

## Non-Security Bugs

For normal bugs, use the public issue tracker and the templates in `.github/ISSUE_TEMPLATE`.
