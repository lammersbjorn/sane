/**
 * Public `@sane/sane-tui` barrel.
 *
 * Keep root API small and stable. Deeper modules remain available through
 * explicit compatibility subpath exports in package.json.
 */
export * from "@sane/sane-tui/command-registry.js";
export * from "@sane/sane-tui/main.js";
export * from "@sane/sane-tui/preview-launch.js";
