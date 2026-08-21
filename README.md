# test-vectors

Cryptographic test vectors, mirrored from their upstream repositories and
compressed with gzip.

Optimized for **git clone**: 5x faster than upstream.

| Directory | Upstream | Pin |
| --- | --- | --- |
| `acvp/` | [usnistgov/ACVP-Server](https://github.com/usnistgov/ACVP-Server) | `v1.1.0.43` (`975de31eb83d`) |
| `wycheproof/testvectors_v1/` | [C2SP/wycheproof](https://github.com/C2SP/wycheproof) | `dac1dd4729fd` |
| `rfc/6979-deterministic-ecdsa/` | [RFC 6979](https://www.rfc-editor.org/rfc/rfc6979.txt) Appendix A.2 | text sha256 |
| `rfc/8032-eddsa/` | [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032.txt) Section 7 | text sha256 |
| `rfc/9380-hash-to-curve/` | [cfrg/draft-irtf-cfrg-hash-to-curve](https://github.com/cfrg/draft-irtf-cfrg-hash-to-curve) `poc/vectors` | `664b13592116` |
| `rfc/9497-oprf/` | [RFC 9497](https://www.rfc-editor.org/rfc/rfc9497.txt) Appendix A | text sha256 |
| `rfc/9591-frost/` | [ZcashFoundation/frost](https://github.com/ZcashFoundation/frost) `frost-*/tests/helpers` | `0966bd1529aa` |

Every vector file is stored as `<name>.json.gz`. Notes:

- RFC 6979 / 8032 / 9497 vectors are parsed straight from the immutable RFC
  texts by `scripts/rfc/*.js`.
- RFC 9591 vectors come from the FROST reference implementation: RFC appendix
  vectors plus DKG, repair-share, serialization, and the non-RFC
  `secp256k1-tr` (BIP-340) suite.
- In `rfc/9380-hash-to-curve/`, `:` in suite names is replaced with `_` for
  Windows checkouts. Wycheproof's deleted legacy `testvectors/` is not
  mirrored.

## Usage

```sh
git submodule add --depth 1 https://github.com/paulmillr/acvp-vectors.git \
  test/vectors/large

git config -f .gitmodules submodule.test/vectors/large.shallow true
```

Read vectors with `utils.js` (dependency-free, typed via `utils.d.ts`):

```js
import { jsonGZ, jsonGZGroups } from './test/vectors/large/utils.js';

// whole file
const tests = jsonGZ('test/vectors/large/wycheproof/testvectors_v1/ed25519_test.json.gz');
// one testGroup at a time, bounded memory
for await (const group of jsonGZGroups('test/vectors/large/acvp/ML-DSA-sigGen-FIPS204/prompt.json.gz')) {}
```

Both accept a path string or file URL and also read uncompressed `.json`.

## Reproduce the vector trees

Each kind has a build script (Node >= 18 plus `git`, no dependencies) that
rebuilds its directory from the pinned upstream ref — commits are exact, tags
are verified against expected hashes, RFC texts are pinned by sha256. Gzip
output is deterministic (fixed header, Node zlib, max level). Upstream clones
are cached in `$TMPDIR/test-vectors-upstream` (override: `VECTORS_CACHE`), so
only the first run clones:

```sh
node scripts/acvp.js        # rebuilds acvp/
node scripts/wycheproof.js  # rebuilds wycheproof/
node scripts/rfc.js         # rebuilds rfc/
```

Each kind carries a `SHA256SUMS` manifest of **decompressed** content, written
by its build script. It is independent of gzip container bytes: hashes compare
directly against upstream's raw files, and a pin-bump diff shows which vectors
actually changed. Verify all files:

```sh
npm run verify
```

## Clone benchmark

Measured using `git clone --depth 1` on the same host.

| Repository | Clone time | Checkout size |
| --- | ---: | ---: |
| `usnistgov/ACVP-Server` + Wycheproof | 53 s | 1.45 GB |
| this repository | 19.2 s | 745 MB |

## Licenses

Vectors keep their upstream licenses; see [LICENSE](./LICENSE):
[Apache-2.0](https://github.com/C2SP/wycheproof/blob/master/LICENSE)
(wycheproof), NIST license (acvp),
[IETF Trust](https://trustee.ietf.org/documents/trust-legal-provisions/)
(RFC-text vectors), MIT/Apache-2.0
([frost](https://github.com/ZcashFoundation/frost#license)),
[CFRG draft repo terms](https://github.com/cfrg/draft-irtf-cfrg-hash-to-curve)
(hash-to-curve).
