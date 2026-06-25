#!/usr/bin/env node
// Fails if package.json declares any local-path dependency (file:/link:/portal:/relative path).
// These are fine for local development against an unpublished SDK, but must never be committed.
// Reads ./package.json by default, or the staged blob from stdin with --stdin (used by the pre-commit hook).
import { readFileSync } from 'node:fs';

const useStdin = process.argv.includes('--stdin');
const raw = useStdin ? readFileSync(0, 'utf8') : readFileSync('package.json', 'utf8');

let pkg;
try {
  pkg = JSON.parse(raw);
} catch {
  // An unparseable/empty staged blob is not our concern here.
  process.exit(0);
}

const groups = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const localSpec = /^(file:|link:|portal:|\.\.?\/)/;

const offenders = [];
for (const group of groups) {
  for (const [name, spec] of Object.entries(pkg[group] ?? {})) {
    if (typeof spec === 'string' && localSpec.test(spec)) {
      offenders.push(`  ${group}.${name} -> ${spec}`);
    }
  }
}

// Links can also be recorded in override/resolution maps (e.g. `pnpm link` on
// older pnpm, or a manual override). Scan those too.
const overrideMaps = [
  ['pnpm.overrides', pkg.pnpm?.overrides],
  ['overrides', pkg.overrides],
  ['resolutions', pkg.resolutions],
];
for (const [label, map] of overrideMaps) {
  for (const [name, spec] of Object.entries(map ?? {})) {
    if (typeof spec === 'string' && localSpec.test(spec)) {
      offenders.push(`  ${label}.${name} -> ${spec}`);
    }
  }
}

if (offenders.length > 0) {
  console.error(
    '✖ Local-path dependencies must not be committed:\n' +
      offenders.join('\n') +
      '\n\nReplace them with a published version before committing.',
  );
  process.exit(1);
}

console.log('✓ No local-path dependencies.');
