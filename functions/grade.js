/**
 * Ask the model to grade one of the caller's own commits. It reads the sealed text, so
 * it is restricted to the commit's author and to calls that are already revealable.
 * The suggestion is returned to the author, never written to the board — `reveal` does that.
 *
 * @param {{ id?: unknown, note?: unknown }} input
 * @param {any} ship
 */

const OUTCOMES = ["win", "loss", "partial"];

function callerId(ship) {
  return ship.user && typeof ship.user.id === "string" && ship.user.id !== "" ? ship.user.id : "anonymous";
}

function asText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.content === "string") return value.content;
    if (typeof value.output === "string") return value.output;
  }
  return "";
}

export default async function handler(input, ship) {
  const now = Date.now();
  const uid = callerId(ship);

  const id = typeof input?.id === "string" ? input.id : "";
  if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(id)) return { error: "unknown prediction" };

  const note = typeof input?.note === "string" ? input.note.trim().slice(0, 600) : "";
  if (note.length < 4) return { error: "describe what actually happened so the grade has something to go on" };

  const [boardRaw, seal] = await Promise.all([ship.kv.get("board"), ship.kv.get(`seal:${id}`)]);
  const board = Array.isArray(boardRaw) ? boardRaw : [];
  const entry = board.find((e) => e && e.id === id);
  if (!entry) return { error: "unknown prediction" };
  if (entry.owner !== uid) return { error: "only the author of a commit can grade it" };
  if (entry.status === "revealed") return { error: "this prediction is already revealed" };
  if (!entry.hidden && now < entry.resolvesAt) return { error: "this prediction is not due yet" };
  if (!seal || typeof seal.text !== "string") return { error: "the sealed text for this commit is missing" };

  const prompt = [
    "You grade a prediction against what happened. Be strict and brief.",
    `Prediction: ${seal.text}`,
    `Committed: ${new Date(entry.committedAt).toISOString()}`,
    `Resolution date: ${new Date(entry.resolvesAt).toISOString()}`,
    `What happened, from the author: ${note}`,
    "Answer on one line in exactly this form: OUTCOME | explanation",
    "OUTCOME is win, loss or partial. The explanation is one sentence under 200 characters.",
  ].join("\n");

  let raw;
  try {
    raw = await ship.llm(prompt, { maxTokens: 220 });
  } catch (cause) {
    return { error: `the model call failed: ${cause && cause.message ? cause.message : String(cause)}` };
  }

  const line = asText(raw).replace(/\s+/g, " ").trim();
  const split = line.indexOf("|");
  const head = (split < 0 ? line : line.slice(0, split)).toLowerCase();
  const outcome = OUTCOMES.find((o) => head.includes(o)) ?? null;
  const explanation = (split < 0 ? line : line.slice(split + 1)).replace(/^[\s:—-]+/, "").slice(0, 400).trim();

  if (!outcome || explanation.length < 4) return { error: "the model did not return a usable grade; try again" };
  return { outcome, explanation };
}
