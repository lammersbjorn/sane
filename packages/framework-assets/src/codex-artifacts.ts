import {
  createFrameworkSourceRecords,
  type FrameworkSourceRecord,
  type FrameworkSourceRecordOptions,
  type FrameworkSourceProvider
} from "./source-records.js";

export interface CodexArtifact {
  provider: FrameworkSourceProvider;
  path: string;
  mode: "file" | "block" | "config";
  ownershipMode: FrameworkSourceRecord["mode"];
  hash: string;
  sourceId: string;
  executable: boolean;
  structuredKeys: string[];
  content: string;
  blockMarker?: string;
  blockMarkers?: FrameworkSourceRecord["blockMarkers"];
  provenance?: FrameworkSourceRecord["provenance"];
}

export interface RenderCodexArtifactsOptions extends FrameworkSourceRecordOptions {
  provider?: FrameworkSourceProvider;
}

export function renderCodexArtifacts(options: RenderCodexArtifactsOptions = {}): CodexArtifact[] {
  const provider = options.provider ?? "codex";
  if (provider !== "codex") {
    throw new Error(`unsupported artifact provider: ${provider}`);
  }

  return createFrameworkSourceRecords(options).map((record) => {
    return {
      provider,
      path: record.targetPath,
      mode: artifactMode(record),
      ownershipMode: record.mode,
      hash: record.hash,
      sourceId: record.sourceId,
      executable: record.executable,
      structuredKeys: [...record.structuredKeys],
      content: record.content,
      ...(record.blockMarker ? { blockMarker: record.blockMarker } : {}),
      ...(record.blockMarkers ? { blockMarkers: record.blockMarkers } : {}),
      ...(record.provenance ? { provenance: record.provenance } : {})
    };
  });
}

function artifactMode(record: FrameworkSourceRecord): CodexArtifact["mode"] {
  if (record.kind === "hook" || record.kind === "config-fragment") {
    return "config";
  }
  if (record.kind === "agents-block") {
    return "block";
  }
  return record.blockMarker && record.kind !== "custom-agent" ? "block" : "file";
}
