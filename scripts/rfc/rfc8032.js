// Extracts EdDSA test vectors from RFC 8032 (sections 7.1-7.5).
//
// Returns a map of algorithm -> vectors: {Ed25519, Ed25519ctx, Ed25519ph,
// Ed448, Ed448ph}. Each vector: {name, secretKey, publicKey, message,
// signature[, context]}.

const FIELD_MAP = {
  'ALGORITHM': 'algorithm',
  'SECRET KEY': 'secretKey',
  'PUBLIC KEY': 'publicKey',
  'MESSAGE': 'message',
  'CONTEXT': 'context',
  'SIGNATURE': 'signature',
};

function cleanLines(text) {
  return text.split('\n').filter((line) => !line.includes('\f')
    && !/\[Page \d+\]$/.test(line) && !line.startsWith('RFC 8032')
    && !line.startsWith('Josefsson'));
}

export function parseRfc8032(text) {
  const tests = [];
  let test = null;
  let field = null;

  for (const raw of cleanLines(text)) {
    const line = raw.trim();
    if (/^\d+(\.\d+)*\.\s/.test(line)) { // section heading ends any block
      test = null;
      field = null;
      continue;
    }
    const block = line.match(/^-----(.*)$/);
    if (block) {
      const name = block[1].trim();
      field = null;
      if (name) {
        test = { name: name.replace(/^TEST /, '') };
        tests.push(test);
      } else {
        test = null; // bare "-----" terminator
      }
      continue;
    }
    if (test === null) continue;
    const header = line.match(/^([A-Z ]+?)(\s*\(length[^)]*\))?:$/);
    if (header && FIELD_MAP[header[1]]) {
      field = FIELD_MAP[header[1]];
      test[field] = '';
      continue;
    }
    if (field && line) {
      if (field === 'algorithm') test[field] = line;
      else if (/^[0-9a-fA-F]+$/.test(line)) test[field] += line;
    }
    // blank lines and page furniture inside a field are skipped;
    // a wrapped value continues on the next hex line
  }

  const byAlg = {};
  for (const t of tests) {
    const { algorithm, ...vector } = t;
    for (const key of ['secretKey', 'publicKey', 'message', 'signature']) {
      if (!(key in vector)) throw new Error(`${algorithm} "${vector.name}": missing ${key}`);
    }
    (byAlg[algorithm] ??= []).push(vector);
  }
  const expected = ['Ed25519', 'Ed25519ctx', 'Ed25519ph', 'Ed448', 'Ed448ph'];
  const actual = Object.keys(byAlg).sort();
  if (actual.join() !== [...expected].sort().join()) throw new Error(`algorithms: ${actual}`);
  return byAlg;
}
