// Extracts OPRF/VOPRF/POPRF test vectors from RFC 9497 (Appendix A).
//
// Same JSON structure as noble-curves' rfc9497-oprf-parser.js: a list of
// suites, each with modes, each with common data and tests.

const BATCHED_KEYS = ['Input', 'Blind', 'BlindedElement', 'EvaluationElement', 'Output'];

const SUITE_RE = /^A\.\d+\.\s+(?<name>.*)$/;
const MODE_RE = /^A\.\d+\.\d+\.\s+(?<name>.* Mode)$/;
const TEST_RE = /^A\.\d+\.\d+\.\d+\.\s+(?<name>Test Vector \d+, Batch Size (?<batch>\d+))$/;
const KV_RE = /^(?<key>[A-Za-z]+)\s*=\s*(?<value>.*)$/;

export function parseRfc9497(text) {
  // Restrict to Appendix A so trailing sections cannot be swallowed as
  // continuation lines of the last value.
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('Appendix A.'));
  const end = lines.findIndex((l) => l.startsWith('Acknowledg'));
  if (start === -1 || end === -1) throw new Error('appendix boundaries not found');

  const suites = [];
  let suite = null;
  let mode = null;
  let test = null;
  let lastKey = null;
  const target = () => (test ? test.data : mode ? mode.common : null);

  for (const raw of lines.slice(start, end)) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    // Most specific (test) to least specific (suite).
    if ((m = line.match(TEST_RE))) {
      test = { name: m.groups.name, batchSize: parseInt(m.groups.batch, 10), data: {} };
      mode.tests.push(test);
      lastKey = null;
    } else if ((m = line.match(MODE_RE))) {
      mode = { mode: m.groups.name, common: {}, tests: [] };
      suite.modes.push(mode);
      test = null;
      lastKey = null;
    } else if ((m = line.match(SUITE_RE))) {
      suite = { suite: m.groups.name, modes: [] };
      suites.push(suite);
      mode = null;
      test = null;
      lastKey = null;
    } else if ((m = line.match(KV_RE))) {
      lastKey = m.groups.key;
      const t = target();
      if (t) t[lastKey] = m.groups.value.replace(/\s/g, '');
    } else if (lastKey) {
      const t = target();
      if (t) t[lastKey] += line.replace(/\s/g, '');
    }
  }

  for (const s of suites) {
    for (const md of s.modes) {
      for (const t of md.tests) {
        for (const key of Object.keys(t.data)) {
          if (BATCHED_KEYS.includes(key)) t.data[key] = t.data[key].split(',');
        }
      }
    }
  }

  if (suites.length !== 5) throw new Error(`expected 5 suites, got ${suites.length}`);
  for (const s of suites) {
    if (s.modes.length !== 3) throw new Error(`${s.suite}: expected 3 modes, got ${s.modes.length}`);
  }
  return suites;
}
