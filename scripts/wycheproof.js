#!/usr/bin/env node
// Rebuilds wycheproof/ from C2SP/wycheproof (successor of google/wycheproof).
//
// Mirrors testvectors_v1/ from the pinned commit. The legacy testvectors/
// directory (deleted upstream in 156d287d) is deliberately not kept; note
// the v1 per-curve split dropped a few curves it had (FRP256v1, secp224k1
// ECDH, brainpool *t1 twists). Pinned to a commit, not a branch: a moving
// ref makes a refresh unreproducible. Bump deliberately.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, copyDir, countGz, gzipDir, upstream, writeManifest } from './utils.js';

const URL = 'https://github.com/C2SP/wycheproof.git';
const V1_COMMIT = 'dac1dd4729fd1f8dd9e1e9f3dce51d783da6c166';

const dest = join(ROOT, 'wycheproof');
rmSync(dest, { recursive: true, force: true });

const repo = upstream(URL, V1_COMMIT);
copyDir(join(repo, 'testvectors_v1'), join(dest, 'testvectors_v1'));
gzipDir(dest);
writeManifest(dest);

console.log(`wycheproof: ${countGz(dest)} files`);
console.log(`  testvectors_v1: C2SP/wycheproof ${V1_COMMIT}`);
