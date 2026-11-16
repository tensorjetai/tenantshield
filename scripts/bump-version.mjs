import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function usage() {
  console.error('Usage: pnpm version:bump <semver> [--dry-run]');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((arg) => arg !== '--dry-run');

if (positional.length !== 1 || positional[0] === '--help' || positional[0] === '-h') {
  usage();
}

const nextVersion = positional[0].replace(/^v/, '');
if (!SEMVER_RE.test(nextVersion)) {
  console.error(`Invalid semver version: "${positional[0]}"`);
  process.exit(1);
}

const rootDir = resolve(import.meta.dirname, '..');

function updateFile(relPath, replacer) {
  const fullPath = resolve(rootDir, relPath);
  const before = readFileSync(fullPath, 'utf8');
  const after = replacer(before);
  if (before === after) {
    console.log(`= ${relPath} (unchanged)`);
    return;
  }
  if (!dryRun) {
    writeFileSync(fullPath, after, 'utf8');
  }
  console.log(`${dryRun ? '~' : '+'} ${relPath}`);
}

function replaceOrFail(content, pattern, replacement, relPath) {
  if (!pattern.test(content)) {
    throw new Error(`Expected pattern ${pattern} not found in ${relPath}`);
  }
  return content.replace(pattern, replacement);
}

updateFile('package.json', (raw) => {
  const pkg = JSON.parse(raw);
  pkg.version = `${nextVersion}-dev`;
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

updateFile('apps/cli/package.json', (raw) => {
  const pkg = JSON.parse(raw);
  pkg.version = nextVersion;
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

updateFile('packages/mcp/package.json', (raw) => {
  const pkg = JSON.parse(raw);
  pkg.version = nextVersion;
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

updateFile('packages/mcp/src/index.ts', (raw) =>
  replaceOrFail(
    raw,
    /(serverInfo:\s*\{\s*name:\s*'tenantshield-mcp',\s*version:\s*')[^']+(')/,
    `$1${nextVersion}$2`,
    'packages/mcp/src/index.ts',
  ),
);

updateFile('test/e2e/version.e2e.test.ts', (raw) =>
  replaceOrFail(
    raw,
    /(expect\(result\.stdout\.trim\(\)\)\.toBe\(')[^']+('\);)/,
    `$1${nextVersion}$2`,
    'test/e2e/version.e2e.test.ts',
  ),
);

updateFile('apps/cli/README.md', (raw) =>
  raw.replaceAll(/tenantshield@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g, `tenantshield@${nextVersion}`),
);

updateFile('packages/mcp/README.md', (raw) =>
  raw.replaceAll(
    /tenantshield-mcp@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g,
    `tenantshield-mcp@${nextVersion}`,
  ),
);

console.log(
  `\n${dryRun ? '[dry-run] Would bump' : 'Bumped'} TenantShield OSS packages to v${nextVersion}.`,
);
console.log(
  `Next:\n  git commit -am "chore: bump packages to v${nextVersion}"\n  git tag -a v${nextVersion} -m "Release v${nextVersion}"\n  git push origin main --follow-tags`,
);
