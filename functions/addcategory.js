/**
 * Holder perk: add a category the board can commit predictions against.
 * Declared `holderOnly` in the manifest, so the platform answers 403 for everyone else.
 *
 * @param {{ name?: unknown }} input
 * @param {any} ship
 */

const DEFAULT_CATEGORIES = ["crypto", "macro", "culture", "tech", "sports"];
const MAX_CATEGORIES = 24;

export default async function handler(input, ship) {
  const name = typeof input?.name === "string" ? input.name.trim().toLowerCase().replace(/\s+/g, " ") : "";
  if (!/^[a-z0-9][a-z0-9 -]{1,23}$/.test(name)) {
    return { error: "a category is 2–24 characters, lowercase letters, numbers, spaces or dashes" };
  }

  const stored = await ship.kv.get("categories");
  const categories = Array.isArray(stored) && stored.length > 0 ? stored.slice() : DEFAULT_CATEGORIES.slice();
  if (categories.includes(name)) return { categories, added: false };
  if (categories.length >= MAX_CATEGORIES) return { error: "the board already has the maximum number of categories" };

  categories.push(name);
  await ship.kv.set("categories", categories);
  return { categories, added: true };
}
