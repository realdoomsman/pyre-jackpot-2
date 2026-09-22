/**
 * Reveal a committed prediction: unseal the plaintext, re-hash it, and publish the
 * outcome only if the recomputed hash still equals the hash committed earlier.
 *
 * Sandbox functions cannot import, so the SHA-256 implementation is the same code as in
 * `functions/commit.js` — keep both copies (and `src/lib/hash.ts`) in step.
 *
 * @param {{ id?: unknown, outcome?: unknown, explanation?: unknown, graded?: unknown }} input
 * @param {any} ship
 */

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];

function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    } else if (c < 0xd800 || c > 0xdfff) {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    } else if (c <= 0xdbff && i + 1 < str.length && str.charCodeAt(i + 1) >= 0xdc00 && str.charCodeAt(i + 1) <= 0xdfff) {
      const cp = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(i + 1) - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      i += 1;
    } else {
      out.push(0xef, 0xbf, 0xbd);
    }
  }
  return out;
}

function rotr(x, n) {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function hex8(n) {
  return `0000000${(n >>> 0).toString(16)}`.slice(-8);
}

function sha256Hex(message) {
  const bytes = utf8Bytes(message);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Array(64);

  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i += 1) {
      const p = off + i * 4;
      w[i] = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let hh = h7;
    for (let i = 0; i < 64; i += 1) {
      const t1 = (hh + ((rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0) + (((e & f) ^ (~e & g)) >>> 0) + K[i] + w[i]) >>> 0;
      const t2 = (((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0) + (((a & b) ^ (a & c) ^ (b & c)) >>> 0)) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + hh) >>> 0;
  }
  return hex8(h0) + hex8(h1) + hex8(h2) + hex8(h3) + hex8(h4) + hex8(h5) + hex8(h6) + hex8(h7);
}

const OUTCOMES = ["win", "loss", "partial"];
const MAX_EXPLANATION = 400;
const BOARD_BUDGET = 58_000;

function callerId(ship) {
  return ship.user && typeof ship.user.id === "string" && ship.user.id !== "" ? ship.user.id : "anonymous";
}

export default async function handler(input, ship) {
  const now = Date.now();
  const uid = callerId(ship);

  const id = typeof input?.id === "string" ? input.id : "";
  if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(id)) return { error: "unknown prediction" };

  const outcome = typeof input?.outcome === "string" ? input.outcome : "";
  if (!OUTCOMES.includes(outcome)) return { error: "mark the call win, loss or partial" };

  const explanation = typeof input?.explanation === "string" ? input.explanation.trim() : "";
  if (explanation.length < 4) return { error: "add a short explanation of the result" };
  if (explanation.length > MAX_EXPLANATION) return { error: `keep the explanation under ${MAX_EXPLANATION} characters` };

  const graded = input?.graded === "llm" ? "llm" : "operator";

  const [boardRaw, operatorRaw, seal] = await Promise.all([
    ship.kv.get("board"),
    ship.kv.get("operator"),
    ship.kv.get(`seal:${id}`),
  ]);

  const board = Array.isArray(boardRaw) ? boardRaw.slice() : [];
  const index = board.findIndex((e) => e && e.id === id);
  if (index < 0) return { error: "unknown prediction" };
  const entry = board[index];
  if (entry.status === "revealed") return { error: "this prediction is already revealed" };

  const operatorId = operatorRaw && typeof operatorRaw.id === "string" ? operatorRaw.id : null;
  const isOwner = entry.owner === uid;
  const isOperator = operatorId === uid;
  if (entry.hidden ? !isOwner : !(isOperator || isOwner)) {
    return { error: "only the author of a commit can reveal it" };
  }
  // A sealed private call is the holder's to open whenever they like; a public
  // commitment cannot be opened before the date it was committed against.
  if (!entry.hidden && now < entry.resolvesAt) {
    return { error: "this prediction cannot be revealed before its resolution date" };
  }

  if (!seal || typeof seal.text !== "string" || typeof seal.salt !== "string") {
    return { error: "the sealed text for this commit is missing; it cannot be revealed" };
  }

  const recomputed = sha256Hex(`${seal.text}|${seal.salt}`);
  if (recomputed !== entry.hash) {
    return { error: "the sealed text does not hash to the published commit; nothing was published" };
  }

  const revealed = {
    text: seal.text,
    salt: seal.salt,
    explanation,
    outcome,
    revealedAt: now,
    graded,
  };
  await ship.kv.set(`rev:${id}`, revealed);

  board[index] = {
    ...entry,
    status: "revealed",
    outcome,
    revealedAt: now,
    // A revealed private call joins the public record — that is the point of revealing.
    hidden: false,
  };
  while (JSON.stringify(board).length > BOARD_BUDGET && board.length > 1) board.pop();
  await ship.kv.set("board", board);
  await ship.kv.del(`seal:${id}`);

  return {
    entry: { ...board[index], ...revealed, mine: true },
    hash: entry.hash,
    recomputed,
    verified: true,
  };
}
