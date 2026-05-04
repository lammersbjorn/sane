interface ProfileAuditEnvelope {
  status: "installed" | "missing" | "invalid";
  recommendedChangeCount: number;
  details: string[];
}

interface ProfileApplyEnvelope {
  status: "blocked_invalid" | "already_satisfied" | "ready";
  recommendedChangeCount: number;
  appliedKeys: readonly unknown[];
  details: string[];
}

export function invalidProfileAudit<T extends ProfileAuditEnvelope>(
  details: string[],
  create: (base: ProfileAuditEnvelope) => T
): T {
  return create({
    status: "invalid",
    recommendedChangeCount: 0,
    details
  });
}

export function blockedInvalidProfileApplyResult<T extends ProfileApplyEnvelope>(
  create: (base: ProfileApplyEnvelope) => T
): T {
  return create({
    status: "blocked_invalid",
    recommendedChangeCount: 0,
    appliedKeys: [],
    details: [
      "repair ~/.codex/config.toml first",
      "Sane only writes after a clean parse"
    ]
  });
}

export function profilePreviewSummary(
  profile: string,
  audit: Pick<ProfileAuditEnvelope, "status" | "recommendedChangeCount">
): string {
  if (audit.status === "invalid") {
    return `${profile} preview: blocked by invalid config`;
  }

  return `${profile} preview: ${audit.recommendedChangeCount} recommended change(s)`;
}
