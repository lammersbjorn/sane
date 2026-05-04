export function opencodePluginEntries(config: Record<string, unknown>): unknown[] {
  const plugin = config.plugin;
  if (Array.isArray(plugin)) {
    return [...plugin];
  }
  if (typeof plugin === "string") {
    return [plugin];
  }
  return [];
}

export function opencodePluginReferences(config: Record<string, unknown>): string[] {
  return opencodePluginEntries(config).filter((item): item is string => typeof item === "string");
}

export function upsertOpencodePluginReference(
  config: Record<string, unknown>,
  pluginPath: string
): Record<string, unknown> {
  const plugins = opencodePluginEntries(config);
  if (!opencodePluginReferences(config).includes(pluginPath)) {
    plugins.push(pluginPath);
  }
  return { ...config, plugin: plugins };
}

export function removeOpencodePluginReference(
  config: Record<string, unknown>,
  pluginPath: string
): Record<string, unknown> {
  const plugins = opencodePluginEntries(config).filter((plugin) => plugin !== pluginPath);
  return { ...config, plugin: plugins };
}
