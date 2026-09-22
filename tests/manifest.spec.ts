import { readFile, readdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

/**
 * `pyre.manifest.json` is validated at deploy time, but nothing stops it drifting from
 * `functions/*.js` during local edits. These checks catch that before a deploy does.
 */

interface ManifestFunction {
  name: string;
  auth: boolean;
  holderOnly: boolean;
}

async function loadManifest(): Promise<{ name: string; functions: ManifestFunction[]; holderTier: unknown }> {
  const parsed: unknown = JSON.parse(await readFile("pyre.manifest.json", "utf8"));
  if (parsed === null || typeof parsed !== "object") throw new Error("pyre.manifest.json is not an object");
  return parsed as { name: string; functions: ManifestFunction[]; holderTier: unknown };
}

test("every functions/*.js file is declared in the manifest, and only those", async () => {
  const manifest = await loadManifest();
  const declared = manifest.functions.map((f) => f.name).sort();
  const files = (await readdir("functions"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => f.replace(/\.js$/, ""))
    .sort();
  expect(declared).toEqual(files);
});

test("holderOnly and auth flags match what each function enforces", async () => {
  const manifest = await loadManifest();
  const byName = new Map(manifest.functions.map((f) => [f.name, f]));

  // feed is the only endpoint anonymous visitors call.
  expect(byName.get("feed")).toMatchObject({ auth: false, holderOnly: false });
  // commit/reveal/draft/grade need a signed-in caller, but are not holder-gated at the
  // manifest level — commit.js itself refuses a private (holder-only) commit from a non-holder.
  for (const name of ["commit", "reveal", "draft", "grade"]) {
    expect(byName.get(name)).toMatchObject({ auth: true, holderOnly: false });
  }
  // addcategory is the one perk the platform itself gates on holding the coin.
  expect(byName.get("addcategory")).toMatchObject({ auth: true, holderOnly: true });
});

test("holderTier is set, since a HolderGate is used in the app", async () => {
  const manifest = await loadManifest();
  expect(manifest.holderTier).toMatchObject({ minHoldTokens: expect.any(Number) });
});
