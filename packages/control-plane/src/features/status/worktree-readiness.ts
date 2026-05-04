import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { type ProjectPaths } from "../../platform.js";

export type WorktreeReadinessStatus = "ready" | "limited" | "missing";

export interface WorktreeReadinessSnapshot {
  mode: "read-only-worktree-readiness";
  status: WorktreeReadinessStatus;
  summary: string;
  path: string | null;
  linkedWorktree: boolean;
  reasons: string[];
}

export function inspectWorktreeReadiness(paths: ProjectPaths): WorktreeReadinessSnapshot {
  const gitPath = join(paths.projectRoot, ".git");

  if (!existsSync(gitPath)) {
    return {
      mode: "read-only-worktree-readiness",
      status: "missing",
      summary: "no git metadata found; parallel lanes need a git repo or explicit workspace copies",
      path: null,
      linkedWorktree: false,
      reasons: [
        "parallel lane ownership can still be planned",
        "worktree isolation is unavailable until git metadata exists"
      ]
    };
  }

  try {
    const stat = statSync(gitPath);
    if (stat.isDirectory()) {
      return {
        mode: "read-only-worktree-readiness",
        status: "ready",
        summary: "git checkout detected; parallel lanes should use separate worktrees or strict write boundaries",
        path: gitPath,
        linkedWorktree: false,
        reasons: [
          "main checkout can host additional worktrees",
          "lane plans still need explicit ownership boundaries before agents start"
        ]
      };
    }

    if (stat.isFile()) {
      const body = readFileSync(gitPath, "utf8").trim();
      if (body.startsWith("gitdir:")) {
        return {
          mode: "read-only-worktree-readiness",
          status: "ready",
          summary: "linked git worktree detected",
          path: gitPath,
          linkedWorktree: true,
          reasons: [
            "checkout is already backed by a worktree gitdir",
            "parallel lanes still need disjoint write ownership"
          ]
        };
      }
    }
  } catch {
    return {
      mode: "read-only-worktree-readiness",
      status: "limited",
      summary: "git metadata exists but could not be inspected",
      path: gitPath,
      linkedWorktree: false,
      reasons: ["inspect could not read .git metadata"]
    };
  }

  return {
    mode: "read-only-worktree-readiness",
    status: "limited",
    summary: "git metadata shape is not recognized",
    path: gitPath,
    linkedWorktree: false,
    reasons: ["use explicit owned write boundaries before parallel work"]
  };
}
