/**
 * Ask the model for one falsifiable prediction in a niche. The scorekeeper still edits
 * and commits it by hand — nothing is published from here.
 *
 * @param {{ niche?: unknown, category?: unknown, horizonDays?: unknown }} input
 * @param {any} ship
 */

const MAX_TEXT = 280;

/** `ship.llm` returns a string on the platform; accept the obvious object shapes too. */
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
  const niche = typeof input?.niche === "string" ? input.niche.trim().slice(0, 120) : "";
  if (niche.length < 2) return { error: "name a niche to predict about" };

  const category = typeof input?.category === "string" ? input.category.trim().slice(0, 24) : "";
  const horizonDays =
    typeof input?.horizonDays === "number" && Number.isFinite(input.horizonDays)
      ? Math.min(Math.max(Math.round(input.horizonDays), 1), 365)
      : 30;

  const prompt = [
    "You write single, falsifiable predictions for a public scoreboard.",
    `Niche: ${niche}.`,
    category ? `Category: ${category}.` : "",
    `Horizon: it must be decidable ${horizonDays} days from today.`,
    "Rules: one sentence, under 240 characters, concrete and checkable by a neutral reader,",
    "no hedging words like maybe or probably, no dates beyond the horizon, no financial advice.",
    "Answer with the prediction sentence only, no preamble and no quotation marks.",
  ]
    .filter(Boolean)
    .join(" ");

  let raw;
  try {
    raw = await ship.llm(prompt, { maxTokens: 200 });
  } catch (cause) {
    return { error: `the model call failed: ${cause && cause.message ? cause.message : String(cause)}` };
  }

  const text = asText(raw)
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .slice(0, MAX_TEXT)
    .trim();
  if (text.length < 12) return { error: "the model did not return a usable prediction; try again" };

  return { text, horizonDays };
}
