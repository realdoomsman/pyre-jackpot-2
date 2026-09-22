/**
 * The public board: paginated commits, the caller's own open commits, the record, the
 * category list and the server clock (so browsers can run countdowns without trusting
 * the local clock). No login needed — sealed plaintext is never returned here.
 *
 * @param {{ category?: unknown, offset?: unknown, limit?: unknown }} input
 * @param {any} ship
 */

const DEFAULT_CATEGORIES = ["crypto", "macro", "culture", "tech", "sports"];
const MAX_LIMIT = 24;
const MAX_OWN = 25;

function callerId(ship) {
  return ship.user && typeof ship.user.id === "string" && ship.user.id !== "" ? ship.user.id : "anonymous";
}

function emptyRecord() {
  return { total: 0, pending: 0, revealed: 0, win: 0, loss: 0, partial: 0, winRate: null };
}

function tally(record, entry) {
  record.total += 1;
  if (entry.status === "revealed") {
    record.revealed += 1;
    if (entry.outcome === "win") record.win += 1;
    else if (entry.outcome === "loss") record.loss += 1;
    else if (entry.outcome === "partial") record.partial += 1;
  } else {
    record.pending += 1;
  }
}

/** Partial calls count as half a win — stated in the UI so the number is not a mystery. */
function withRate(record) {
  const graded = record.win + record.loss + record.partial;
  return { ...record, winRate: graded === 0 ? null : (record.win + record.partial / 2) / graded };
}

export default async function handler(input, ship) {
  const now = Date.now();
  const uid = callerId(ship);

  const [boardRaw, operatorRaw, categoriesRaw] = await Promise.all([
    ship.kv.get("board"),
    ship.kv.get("operator"),
    ship.kv.get("categories"),
  ]);

  const board = (Array.isArray(boardRaw) ? boardRaw : []).filter((e) => e && typeof e.id === "string");
  const categories = Array.isArray(categoriesRaw) && categoriesRaw.length > 0 ? categoriesRaw : DEFAULT_CATEGORIES;
  const operatorId = operatorRaw && typeof operatorRaw.id === "string" ? operatorRaw.id : null;

  // Sealed private commits belong to their holder until they choose to reveal.
  const visible = board.filter((e) => !e.hidden || e.owner === uid);

  const overall = emptyRecord();
  const perCategory = {};
  for (const entry of board) {
    if (entry.hidden) continue;
    tally(overall, entry);
    if (!perCategory[entry.category]) perCategory[entry.category] = emptyRecord();
    tally(perCategory[entry.category], entry);
  }

  const category = typeof input?.category === "string" && input.category !== "" ? input.category : null;
  const filtered = category ? visible.filter((e) => e.category === category) : visible;

  const offset = typeof input?.offset === "number" && input.offset > 0 ? Math.floor(input.offset) : 0;
  const limit = typeof input?.limit === "number" ? Math.min(Math.max(Math.floor(input.limit), 1), MAX_LIMIT) : 12;
  const page = filtered.slice(offset, offset + limit);

  // Revealed detail lives in its own key, so only this page's records are read.
  const details = await Promise.all(page.map((e) => (e.status === "revealed" ? ship.kv.get(`rev:${e.id}`) : null)));

  const items = page.map((entry, i) => {
    const detail = details[i];
    return {
      id: entry.id,
      hash: entry.hash,
      category: entry.category,
      committedAt: entry.committedAt,
      resolvesAt: entry.resolvesAt,
      status: entry.status,
      outcome: entry.outcome ?? null,
      holder: !!entry.holder,
      source: entry.source === "holder" ? "holder" : "operator",
      hidden: !!entry.hidden,
      mine: entry.owner === uid,
      text: detail && typeof detail.text === "string" ? detail.text : null,
      salt: detail && typeof detail.salt === "string" ? detail.salt : null,
      explanation: detail && typeof detail.explanation === "string" ? detail.explanation : null,
      revealedAt: detail && typeof detail.revealedAt === "number" ? detail.revealedAt : (entry.revealedAt ?? null),
      graded: detail && detail.graded === "llm" ? "llm" : detail ? "operator" : null,
    };
  });

  const own = visible
    .filter((e) => e.owner === uid && e.status === "pending")
    .slice(0, MAX_OWN)
    .map((e) => ({
      id: e.id,
      hash: e.hash,
      category: e.category,
      committedAt: e.committedAt,
      resolvesAt: e.resolvesAt,
      hidden: !!e.hidden,
      // Sealed private calls open on demand; public commitments wait for their date.
      revealable: !!e.hidden || now >= e.resolvesAt,
    }));

  return {
    now,
    categories,
    operator: { claimed: operatorId !== null, isYou: operatorId === uid || operatorId === null },
    items,
    own,
    total: filtered.length,
    offset,
    limit,
    stats: {
      overall: withRate(overall),
      byCategory: Object.keys(perCategory)
        .sort()
        .map((name) => ({ category: name, ...withRate(perCategory[name]) })),
    },
  };
}
