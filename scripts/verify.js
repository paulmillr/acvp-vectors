#!/usr/bin/env node
// Verifies every kind directory against its SHA256SUMS manifest: each
// .json.gz must decompress to content matching its recorded sha256, with no
// missing or unlisted files. Exits non-zero on any mismatch.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { ROOT, walk } from './utils.js';

const KINDS = ['acvp', 'wycheproof', 'rfc'];
let failures = 0;

const fail = (msg) => {
  failures += 1;
  console.error(`FAIL ${msg}`);
};

for (const kind of KINDS) {
  const dir = join(ROOT, kind);
  const manifestPath = join(dir, 'SHA256SUMS');
  if (!existsSync(manifestPath)) {
    fail(`${kind}: SHA256SUMS missing`);
    continue;
  }
  const expected = new Map();
  for (const line of readFileSync(manifestPath, 'utf8').trim().split('\n')) {
    const [hash, path] = line.split(/  /);
    expected.set(path, hash);
  }
  let checked = 0;
  for (const path of walk(dir)) {
    if (!path.endsWith('.json.gz')) continue;
    const rel = relative(dir, path).split(sep).join('/').slice(0, -'.gz'.length);
    const want = expected.get(rel);
    if (!want) {
      fail(`${kind}/${rel}.gz: not in SHA256SUMS`);
      continue;
    }
    expected.delete(rel);
    const got = createHash('sha256').update(gunzipSync(readFileSync(path))).digest('hex');
    if (got !== want) fail(`${kind}/${rel}.gz: sha256 ${got}, manifest says ${want}`);
    checked += 1;
  }
  for (const path of expected.keys()) fail(`${kind}/${path}.gz: listed in SHA256SUMS but missing`);
  console.log(`${kind}: ${checked} files checked`);
}

if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log('OK');
