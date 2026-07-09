import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCurlCommand, resolveSingBoxBinary, resetSingBoxBinaryCacheForTests } from './singboxRunner';

let tempDir: string;

function createFakeSingBox(path: string, version: string): string {
  writeFileSync(
    path,
    `#!/bin/sh
if [ "$1" = "version" ]; then
  echo "sing-box version ${version}"
  exit 0
fi
exit 0
`,
  );
  chmodSync(path, 0o755);
  return path;
}

describe('resolveSingBoxBinary', () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ipshub-sing-box-'));
    resetSingBoxBinaryCacheForTests();
  });

  afterEach(() => {
    resetSingBoxBinaryCacheForTests();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('prefers a valid SING_BOX_PATH over PATH candidates', () => {
    const envSingBox = createFakeSingBox(join(tempDir, 'env-sing-box'), '1.13.14-env');
    const pathDir = mkdtempSync(join(tempDir, 'path-'));
    createFakeSingBox(join(pathDir, 'sing-box'), '1.13.14-path');

    const result = resolveSingBoxBinary({
      env: { SING_BOX_PATH: envSingBox, PATH: pathDir },
      fallbackPaths: [],
    });

    expect(result).toMatchObject({
      found: true,
      resolvedPath: envSingBox,
      version: 'sing-box version 1.13.14-env',
      source: 'env',
    });
  });

  it('uses sing-box found in PATH when SING_BOX_PATH is not set', () => {
    const pathDir = mkdtempSync(join(tempDir, 'path-'));
    const pathSingBox = createFakeSingBox(join(pathDir, 'sing-box'), '1.13.14-path');

    const result = resolveSingBoxBinary({
      env: { PATH: pathDir },
      fallbackPaths: [],
    });

    expect(result).toMatchObject({
      found: true,
      resolvedPath: pathSingBox,
      version: 'sing-box version 1.13.14-path',
      source: 'path',
    });
  });

  it('uses fallback paths such as /opt/homebrew/bin/sing-box when PATH misses', () => {
    const fallbackSingBox = createFakeSingBox(join(tempDir, 'opt-homebrew-sing-box'), '1.13.14-fallback');

    const result = resolveSingBoxBinary({
      env: { PATH: join(tempDir, 'missing-path-dir') },
      fallbackPaths: [fallbackSingBox],
    });

    expect(result).toMatchObject({
      found: true,
      resolvedPath: fallbackSingBox,
      version: 'sing-box version 1.13.14-fallback',
      source: 'fallback',
    });
  });

  it('returns SING_BOX_NOT_FOUND with attemptedPaths when all candidates fail', () => {
    const missingPathDir = join(tempDir, 'missing-path-dir');
    const fallbackPath = join(tempDir, 'missing-fallback-sing-box');

    const result = resolveSingBoxBinary({
      env: { PATH: missingPathDir },
      fallbackPaths: [fallbackPath],
    });

    expect(result).toMatchObject({
      found: false,
      errorCode: 'SING_BOX_NOT_FOUND',
      pathEnv: missingPathDir,
    });
    expect(result.attemptedPaths).toEqual([
      join(missingPathDir, 'sing-box'),
      fallbackPath,
    ]);
    expect(result.explanation).toContain(`Current PATH: ${missingPathDir}`);
    expect(result.explanation).toContain('Attempted paths:');
    expect(result.explanation).toContain('SING_BOX_PATH');
  });
});

describe('buildCurlCommand', () => {
  it('uses socks5 hostname proxy arguments for a sing-box socks inbound', () => {
    expect(buildCurlCommand('socks', 23001, 'https://www.gstatic.com/generate_204')).toEqual([
      'curl',
      '-v',
      '--socks5-hostname',
      '127.0.0.1:23001',
      'https://www.gstatic.com/generate_204',
      '--connect-timeout',
      '5',
      '--max-time',
      '10',
    ]);
  });

  it('uses http proxy arguments for a sing-box http inbound', () => {
    expect(buildCurlCommand('http', 23002, 'https://www.gstatic.com/generate_204')).toEqual([
      'curl',
      '-v',
      '-x',
      'http://127.0.0.1:23002',
      'https://www.gstatic.com/generate_204',
      '--connect-timeout',
      '5',
      '--max-time',
      '10',
    ]);
  });
});
