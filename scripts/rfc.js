#!/usr/bin/env node
// Rebuilds rfc/ — vectors defined by RFCs, reproduced from primary sources:
// either the RFC text itself (parsed by scripts/rfc/*.js) or the RFC's
// reference-implementation repository. Repos are pinned to commits, not
// branches; RFC texts are immutable but pinned by sha256 anyway. Bump
// deliberately.
import { copyFileSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, copyDir, countGz, fetchText, gzipDir, jsonStringify, upstream,
  walk, writeGz, writeManifest,
} from './utils.js';
import { parseRfc6979 } from './rfc/rfc6979.js';
import { parseRfc8032 } from './rfc/rfc8032.js';
import { parseRfc9497 } from './rfc/rfc9497.js';

// RFC texts, from rfc-editor.org.
const RFC_SHA256 = {
  6979: '456e8f17558fdbd206f968b96fc6f1b4a71ea331ab30ad17f711ab3adaa7d701',
  8032: 'ed63657ff389301282b169b0abde9b5dd2c7e4d524fdfa5da6ff3094fc93c4c3',
  9497: '95160517617374655fe23af2c6cec311eae326deb7689239f97641fd5a560432',
};
// RFC 9380, hash-to-curve: poc/vectors from the draft's reference repo.
const H2C_COMMIT = '664b13592116cecc9e52fb192dcde0ade36f904e';
// RFC 9591, FROST: vectors shipped with the ZcashFoundation reference
// implementation (includes the RFC appendix vectors plus DKG, repair-share,
// serialization, and the non-RFC secp256k1-tr/BIP-340 suite).
const FROST_COMMIT = '0966bd1529aa062ad3b621af99e277f976b1c0f0';
const FROST_SUITES = ['ed25519', 'ed448', 'p256', 'ristretto255', 'secp256k1', 'secp256k1-tr'];

const rfcTxt = (n) => fetchText(`https://www.rfc-editor.org/rfc/rfc${n}.txt`, RFC_SHA256[n]);
const dest = join(ROOT, 'rfc');

rmSync(dest, { recursive: true, force: true });

// --- Parsed from RFC text ---------------------------------------------------
mkdirSync(join(dest, '6979-deterministic-ecdsa'), { recursive: true });
writeGz(join(dest, '6979-deterministic-ecdsa', 'vectors.json.gz'),
  jsonStringify(parseRfc6979(await rfcTxt(6979))));

mkdirSync(join(dest, '8032-eddsa'));
const byAlg = parseRfc8032(await rfcTxt(8032));
for (const [alg, vectors] of Object.entries(byAlg)) {
  writeGz(join(dest, '8032-eddsa', `${alg.toLowerCase()}.json.gz`), jsonStringify(vectors));
}

mkdirSync(join(dest, '9497-oprf'));
writeGz(join(dest, '9497-oprf', 'vectors.json.gz'),
  jsonStringify(parseRfc9497(await rfcTxt(9497))));

// --- RFC 9380: hash-to-curve reference repo ---------------------------------
const h2cRepo = upstream('https://github.com/cfrg/draft-irtf-cfrg-hash-to-curve.git', H2C_COMMIT);
const h2cDest = join(dest, '9380-hash-to-curve');
copyDir(join(h2cRepo, 'poc', 'vectors'), h2cDest);
gzipDir(h2cDest);
// Upstream suite names contain ':', which is invalid on Windows filesystems.
for (const path of [...walk(h2cDest)]) {
  if (path.includes(':')) renameSync(path, path.replaceAll(':', '_'));
}

// --- RFC 9591: FROST reference implementation -------------------------------
const frostRepo = upstream('https://github.com/ZcashFoundation/frost.git', FROST_COMMIT);
const frostDest = join(dest, '9591-frost');
mkdirSync(frostDest);
for (const suite of FROST_SUITES) {
  const helpers = join(frostRepo, `frost-${suite}`, 'tests', 'helpers');
  for (const file of readdirSync(helpers)) {
    if (file.endsWith('.json')) {
      copyFileSync(join(helpers, file), join(frostDest, `${suite}-${file}`));
    }
  }
}
gzipDir(frostDest);
writeManifest(dest);

console.log(`rfc: ${countGz(dest)} files`);
console.log('  6979-deterministic-ecdsa: rfc6979.txt (parsed)');
console.log('  8032-eddsa: rfc8032.txt (parsed)');
console.log(`  9380-hash-to-curve: cfrg/draft-irtf-cfrg-hash-to-curve ${H2C_COMMIT}`);
console.log('  9497-oprf: rfc9497.txt (parsed)');
console.log(`  9591-frost: ZcashFoundation/frost ${FROST_COMMIT}`);
