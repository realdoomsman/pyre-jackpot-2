import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * The commitment scheme itself, exercised against the real server functions with a
 * stand-in `ship` (the same shape the platform sandbox injects). These tests are the
 * reason the app can claim a reveal is tamper-evident: the hash the sandbox's pure-JS
 * SHA-256 publishes has to equal Node's, and a doctored seal must be refused.
 */

type Handler = (input: unknown, ship: unknown) => Promise<unknown>;

interface Caller {
  id: string | null;
  isHolder: boolean;
}

const handlers = new Map<string, Handler>();

async function load(name: string): Promise<Handler> {
  const cached = handlers.get(name);
  if (cached) return cached;
  // Dynamic specifier: the same way `dev/pyre-local-host.ts` runs a function.
  const module: unknown = await import(pathToFileURL(resolve("functions", `${name}.js`)).href);
  const handler = (module as { default?: unknown }).default;
  if (typeof handler !== "function") throw new Error(`functions/${name}.js has no default export`);
  handlers.set(name, handler as Handler);
  return handler as Handler;
}

function shipFor(store: Map<string, unknown>, caller: Caller): unknown {
  return {
    user: { id: caller.id, wallet: null, isHolder: caller.isHolder },
    kv: {
      get: async (key: string) => (store.has(key) ? store.get(key) : null),
      set: async (key: string, value: unknown) => {
        store.set(key, value);
      },
      del: async (key: string) => {
        store.delete(key);
      },
    },
  };
}

async function run(name: string, input: unknown, store: Map<string, unknown>, caller: Caller): Promise<Record<string, unknown>> {
  const handler = await load(name);
  const result = await handler(input, shipFor(store, caller));
  if (result === null || typeof result !== "object") throw new Error(`functions/${name}.js returned a non-object`);
  return result as Record<string, unknown>;
}

const asString = (value: unknown): string => {
  expect(typeof value).toBe("string");
  return value as string;
};

const record = (value: unknown): Record<string, unknown> => {
  expect(value !== null && typeof value === "object").toBe(true);
  return value as Record<string, unknown>;
};

const OPERATOR: Caller = { id: "user-operator", isHolder: false };
const HOLDER: Caller = { id: "user-holder", isHolder: true };
const VISITOR: Caller = { id: "user-visitor", isHolder: false };
const MINUTE = 60_000;

test("a public commit publishes only the hash, and the hash is sha256(text + | + salt)", async () => {
  const store = new Map<string, unknown>();
  const text = "eth  gas   stays under 5 gwei for a full week";
  const committed = await run(
    "commit",
    { text, category: "crypto", resolvesAt: Date.now() + 2 * MINUTE, visibility: "public" },
    store,
    OPERATOR,
  );
  expect(committed.error).toBeUndefined();

  const entry = record(committed.entry);
  const hash = asString(committed.hash);
  const seal = record(store.get(`seal:${asString(entry.id)}`));
  const salt = asString(seal.salt);

  // The plaintext is normalised before hashing, and never lands on the public board.
  expect(seal.text).toBe("eth gas stays under 5 gwei for a full week");
  expect(salt).toMatch(/^[0-9a-f]{32}$/);
  expect(hash).toBe(createHash("sha256").update(`${String(seal.text)}|${salt}`, "utf8").digest("hex"));
  expect(entry.status).toBe("pending");
  expect(JSON.stringify(store.get("board"))).not.toContain("gwei");

  const feed = await run("feed", {}, store, VISITOR);
  const items = feed.items as Record<string, unknown>[];
  expect(items).toHaveLength(1);
  expect(items[0]?.text).toBeNull();
  expect(items[0]?.hash).toBe(hash);
});

test("a public commit cannot be revealed before its resolution date", async () => {
  const store = new Map<string, unknown>();
  const committed = await run(
    "commit",
    { text: "the fed cuts rates at the next meeting", category: "macro", resolvesAt: Date.now() + 2 * MINUTE },
    store,
    OPERATOR,
  );
  const id = asString(record(committed.entry).id);

  const early = await run("reveal", { id, outcome: "win", explanation: "too soon" }, store, OPERATOR);
  expect(asString(early.error)).toContain("before its resolution date");
});

test("only the scorekeeper commits publicly; other callers are refused", async () => {
  const store = new Map<string, unknown>();
  await run("commit", { text: "the first commit claims the board", category: "crypto", resolvesAt: Date.now() + 2 * MINUTE }, store, OPERATOR);

  const refused = await run(
    "commit",
    { text: "a stranger tries to post to the public board", category: "crypto", resolvesAt: Date.now() + 2 * MINUTE },
    store,
    VISITOR,
  );
  expect(asString(refused.error)).toContain("only the scorekeeper");

  const notHolder = await run(
    "commit",
    { text: "a stranger tries to seal a private call", category: "crypto", resolvesAt: Date.now() + 2 * MINUTE, visibility: "private" },
    store,
    VISITOR,
  );
  expect(asString(notHolder.error)).toContain("holder perk");
});

test("a holder sealing a private call first does not claim the operator seat", async () => {
  const store = new Map<string, unknown>();
  // A holder seals a private call before anyone has committed publicly.
  await run(
    "commit",
    { text: "a holder seals a private call before any public commit exists", category: "crypto", resolvesAt: Date.now() + 5 * MINUTE, visibility: "private" },
    store,
    HOLDER,
  );
  expect(store.get("operator")).toBeUndefined();

  // The intended operator can still claim the public board afterwards.
  const claimed = await run(
    "commit",
    { text: "the intended operator claims the public board afterwards", category: "crypto", resolvesAt: Date.now() + 5 * MINUTE },
    store,
    OPERATOR,
  );
  expect(claimed.error).toBeUndefined();
  expect(record(store.get("operator") as Record<string, unknown>).id).toBe(OPERATOR.id);

  // The holder cannot now also claim the public board.
  const refused = await run(
    "commit",
    { text: "the holder tries to also post to the public board", category: "crypto", resolvesAt: Date.now() + 5 * MINUTE },
    store,
    HOLDER,
  );
  expect(asString(refused.error)).toContain("only the scorekeeper");
});

test("a holder's private commit is sealed from everyone else, then joins the board on reveal", async () => {
  const store = new Map<string, unknown>();
  const text = "the next cycle's top culture story comes from a game, not a film";
  const committed = await run(
    "commit",
    { text, category: "culture", resolvesAt: Date.now() + 30 * MINUTE, visibility: "private" },
    store,
    HOLDER,
  );
  const id = asString(record(committed.entry).id);
  const hash = asString(committed.hash);

  const hiddenFeed = await run("feed", {}, store, VISITOR);
  expect(hiddenFeed.items).toHaveLength(0);
  expect(record(hiddenFeed.stats).overall).toMatchObject({ total: 0 });

  const ownFeed = await run("feed", {}, store, HOLDER);
  expect(ownFeed.items).toHaveLength(1);
  const own = ownFeed.own as Record<string, unknown>[];
  expect(own).toHaveLength(1);
  // A sealed private call is revealable on demand, whatever its resolution date says.
  expect(own[0]).toMatchObject({ id, hidden: true, revealable: true });

  // A sealed private call opens whenever its holder decides to.
  const revealed = await run(
    "reveal",
    { id, outcome: "partial", explanation: "half right: a game led, but a film shared the cycle" },
    store,
    HOLDER,
  );
  expect(revealed.error).toBeUndefined();
  expect(revealed.verified).toBe(true);
  expect(revealed.recomputed).toBe(hash);

  const entry = record(revealed.entry);
  expect(entry.text).toBe(text);
  expect(entry.hidden).toBe(false);
  expect(asString(entry.salt)).toMatch(/^[0-9a-f]{32}$/);
  expect(createHash("sha256").update(`${text}|${asString(entry.salt)}`, "utf8").digest("hex")).toBe(hash);
  // The seal is consumed: the plaintext now lives in the public reveal record.
  expect(store.get(`seal:${id}`)).toBeUndefined();

  const publicFeed = await run("feed", {}, store, VISITOR);
  const items = publicFeed.items as Record<string, unknown>[];
  expect(items[0]).toMatchObject({ status: "revealed", outcome: "partial", holder: true, text });
  expect(record(publicFeed.stats).overall).toMatchObject({ revealed: 1, partial: 1, winRate: 0.5 });
});

test("a doctored seal cannot be revealed", async () => {
  const store = new Map<string, unknown>();
  const committed = await run(
    "commit",
    { text: "this text is what was actually committed", category: "tech", resolvesAt: Date.now() + 5 * MINUTE, visibility: "private" },
    store,
    HOLDER,
  );
  const id = asString(record(committed.entry).id);

  const seal = record(store.get(`seal:${id}`));
  store.set(`seal:${id}`, { ...seal, text: "this text was swapped in after the fact" });

  const refused = await run("reveal", { id, outcome: "win", explanation: "called it" }, store, HOLDER);
  expect(asString(refused.error)).toContain("does not hash to the published commit");

  const feed = await run("feed", {}, store, HOLDER);
  expect((feed.items as Record<string, unknown>[])[0]?.status).toBe("pending");
});

test("bad input is rejected with a message a person can act on", async () => {
  const store = new Map<string, unknown>();
  const short = await run("commit", { text: "too short", category: "crypto", resolvesAt: Date.now() + MINUTE * 5 }, store, OPERATOR);
  expect(asString(short.error)).toContain("at least 12 characters");

  const past = await run("commit", { text: "a prediction about the past", category: "crypto", resolvesAt: Date.now() - MINUTE }, store, OPERATOR);
  expect(asString(past.error)).toContain("in the future");

  const unknownCategory = await run(
    "commit",
    { text: "a prediction in a category nobody added", category: "astrology", resolvesAt: Date.now() + 5 * MINUTE },
    store,
    OPERATOR,
  );
  expect(asString(unknownCategory.error)).toContain("unknown category");

  const tooFar = await run(
    "commit",
    { text: "a prediction resolving absurdly far in the future", category: "crypto", resolvesAt: Date.now() + 6 * 365 * 24 * 60 * MINUTE },
    store,
    OPERATOR,
  );
  expect(asString(tooFar.error)).toContain("within five years");

  const added = await run("addcategory", { name: "Elections " }, store, HOLDER);
  expect(added.added).toBe(true);
  expect(added.categories).toContain("elections");
});
