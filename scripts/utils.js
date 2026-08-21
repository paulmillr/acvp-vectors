import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync, constants as zc } from 'node:zlib';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Upstream repos are cloned fully, once, into a shared cache and reused by
// later runs (pin bumps only need a `git fetch`, not a re-clone).
export const CACHE = process.env.VECTORS_CACHE
  ?? join(tmpdir(), 'test-vectors-upstream');

export function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] })
    .toString().trim();
}

function hasCommit(dir, commit) {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`],
      { cwd: dir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Returns the cached clone of `url` with the pinned commit checked out.
// Clones on first use; fetches only if the commit is not present yet.
export function upstream(url, commit) {
  const dir = join(CACHE, basename(url, '.git'));
  if (!existsSync(join(dir, '.git'))) {
    console.log(`cloning ${url} into ${dir} (kept for later runs)`);
    mkdirSync(dir, { recursive: true });
    execFileSync('git', ['clone', '--quiet', url, dir],
      { stdio: ['ignore', 'ignore', 'inherit'] });
  }
  if (!hasCommit(dir, commit)) git(dir, 'fetch', '--quiet', '--tags', 'origin');
  if (!hasCommit(dir, commit)) throw new Error(`${url}: commit ${commit} not found`);
  git(dir, 'checkout', '--quiet', '--force', commit);
  return dir;
}

// Like upstream(), but pins a tag and verifies it still points at the
// expected commit, protecting against moved tags.
export function upstreamTag(url, tag, expectedCommit) {
  const dir = upstream(url, expectedCommit);
  const actual = git(dir, 'rev-parse', `${tag}^{commit}`);
  if (actual !== expectedCommit) throw new Error(`unexpected ${tag} commit: ${actual}`);
  return dir;
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Fetches a URL, verifies the sha256 of the raw bytes (.text() would strip
// the UTF-8 BOM that v3 RFC txt files start with, changing the hash) and
// caches the file next to the clones. Returns text with the BOM stripped.
export async function fetchText(url, expectedSha256) {
  const cached = join(CACHE, basename(url));
  if (existsSync(cached)) {
    const raw = readFileSync(cached);
    if (sha256(raw) === expectedSha256) return decode(raw);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  const actual = sha256(raw);
  if (actual !== expectedSha256) throw new Error(`unexpected sha256 for ${url}: ${actual}`);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cached, raw);
  return decode(raw);
}

const decode = (raw) => raw.toString('utf8').replace(/^\uFEFF/, '');

export function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

// `gzip -n` equivalent: no timestamp, no original name. The OS byte is forced
// to 3 (Unix) so output does not depend on the build platform of Node's zlib.
export function gzip(buf) {
  const out = gzipSync(buf, { level: zc.Z_BEST_COMPRESSION });
  out[9] = 0x03;
  return out;
}

export function writeGz(path, data) {
  writeFileSync(path, gzip(Buffer.from(data)));
}

// Compresses every .json in-place and drops everything else (schema indexes,
// READMEs, ...), so a directory holds vectors only.
export function gzipDir(dir) {
  for (const path of [...walk(dir)]) {
    if (path.endsWith('.json')) {
      writeGz(`${path}.gz`, readFileSync(path));
      unlinkSync(path);
    } else if (!path.endsWith('.json.gz')) {
      unlinkSync(path);
    }
  }
}

export function countGz(dir) {
  return [...walk(dir)].filter((p) => p.endsWith('.json.gz')).length;
}

// Writes <dir>/SHA256SUMS: sorted `<sha256-of-decompressed>  <path>.json`
// lines, one per vector. Content-level, so it is independent of the gzip
// container bytes: pin-bump diffs show which vectors actually changed, and
// the hashes can be compared against upstream's raw files directly.
export function writeManifest(dir) {
  const lines = [];
  for (const path of walk(dir)) {
    if (!path.endsWith('.json.gz')) continue;
    const hash = createHash('sha256').update(gunzipSync(readFileSync(path))).digest('hex');
    const rel = relative(dir, path).split(sep).join('/');
    lines.push(`${hash}  ${rel.slice(0, -'.gz'.length)}`);
  }
  lines.sort();
  writeFileSync(join(dir, 'SHA256SUMS'), `${lines.join('\n')}\n`);
  return lines.length;
}

// Replaces `to` with a copy of `from`; `from` stays untouched, since sources
// live in the shared clone cache.
export function copyDir(from, to) {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

export function jsonStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
