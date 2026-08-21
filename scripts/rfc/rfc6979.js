// Extracts deterministic-ECDSA test vectors from RFC 6979 (Appendix A.2).
//
// Parses every "ECDSA, ... Bits" section: key pair (curve, q, x, Ux, Uy) and
// all (hash, message) -> (k, r, s) cases. DSA sections A.2.1-A.2.2 are
// skipped. Returns a list of {curve, q, private, Ux, Uy, cases}.

// Drops RFC pagination: form feeds, page footers, running headers.
function cleanLines(text) {
  return text.split('\n').filter((line) => !line.includes('\f')
    && !/\[Page \d+\]$/.test(line) && !line.startsWith('RFC 6979'));
}

export function parseRfc6979(text) {
  const entries = [];
  let entry = null;
  let testCase = null;
  let last = null; // [object, key] receiving hex continuation lines

  for (const raw of cleanLines(text)) {
    const line = raw.trim();
    if (/^A\.2\.\d+\.\s+ECDSA,/.test(line) && !line.includes('..')) { // ".."-lines are ToC
      entry = { curve: null, q: null, private: null, Ux: null, Uy: null, cases: [] };
      entries.push(entry);
      testCase = null;
      last = null;
      continue;
    }
    if (/^(A\.\d|Appendix|Acknowledg|Authors)/.test(line)) {
      entry = null;
      testCase = null;
      last = null;
      continue;
    }
    if (entry === null || !line) continue;

    let m = line.match(/^curve:\s+(.*)$/);
    if (m) {
      entry.curve = m[1];
      last = null;
      continue;
    }
    m = line.match(/^With ([A-Z0-9-]+), message = "(.*)":$/);
    if (m) {
      testCase = { hash: m[1], message: m[2], k: null, r: null, s: null };
      entry.cases.push(testCase);
      last = null;
      continue;
    }
    m = line.match(/^([A-Za-z]+)\s*=\s*([0-9A-Fa-f]+)$/);
    if (m) {
      const [, key, value] = m;
      if (testCase !== null && ['k', 'r', 's'].includes(key)) {
        testCase[key] = value;
        last = [testCase, key];
      } else if (testCase === null && ['q', 'x', 'Ux', 'Uy'].includes(key)) {
        const field = key === 'x' ? 'private' : key;
        entry[field] = value;
        last = [entry, field];
      } else {
        last = null;
      }
      continue;
    }
    if (last && /^[0-9A-Fa-f]+$/.test(line)) {
      last[0][last[1]] += line;
      continue;
    }
    last = null; // "(qlen = ...)", "Key pair:", "Signatures:", ...
  }

  if (entries.length < 5) throw new Error(`expected >=5 ECDSA sections, got ${entries.length}`);
  for (const e of entries) {
    if (!(e.curve && e.q && e.private && e.Ux && e.Uy)) throw new Error(`incomplete key pair: ${e.curve}`);
    if (e.cases.length !== 10) throw new Error(`${e.curve}: expected 10 cases, got ${e.cases.length}`);
    for (const c of e.cases) {
      if (!(c.k && c.r && c.s)) throw new Error(`incomplete case: ${e.curve} ${c.hash}`);
    }
  }
  return entries;
}
