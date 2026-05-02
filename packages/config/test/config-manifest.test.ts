import { describe, expect, it } from 'vitest';

import { parseCorePackManifest } from '../src/config-manifest.js';

describe('core pack manifest parsing', () => {
  it('rejects malformed manifest JSON', () => {
    expect(() => parseCorePackManifest('{', '/tmp/manifest.json')).toThrow(
      /failed to parse core pack manifest from \/tmp\/manifest.json/,
    );
  });

  it('rejects manifest without optionalPacks object', () => {
    expect(() => parseCorePackManifest(JSON.stringify({ optionalPacks: [] }), '/tmp/manifest.json'))
      .toThrow(/invalid core pack manifest at \/tmp\/manifest.json/);
  });
});
