#!/usr/bin/env node
// Rebuilds acvp/ from usnistgov/ACVP-Server.
// Keeps only gen-val/json-files, gzip-compressed. The tag is verified against
// the expected commit hash, protecting against moved tags.
import { join } from 'node:path';
import { ROOT, copyDir, countGz, gzipDir, upstreamTag, writeManifest } from './utils.js';

const TAG = 'v1.1.0.43';
const COMMIT = '975de31eb83d87039ec88934fdc47d8c312b892d';

const repo = upstreamTag('https://github.com/usnistgov/ACVP-Server.git', TAG, COMMIT);

const dest = join(ROOT, 'acvp');
copyDir(join(repo, 'gen-val', 'json-files'), dest);
gzipDir(dest);
writeManifest(dest);

console.log(`acvp: ${countGz(dest)} files from ACVP-Server ${TAG} (${COMMIT})`);
