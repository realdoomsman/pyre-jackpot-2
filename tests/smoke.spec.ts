import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

/**
 * The deployment manifest is the source of truth for the app's name; the page's
 * <h1> has to agree with it, so this catches a renamed app with a stale manifest
 * (or the other way round).
 */
const appName = async (): Promise<string> => {
  const manifest: unknown = JSON.parse(await readFile("pyre.manifest.json", "utf8"));
  const name = manifest !== null && typeof manifest === "object" && "name" in manifest ? manifest.name : null;
  if (typeof name !== "string" || name === "") throw new Error("pyre.manifest.json has no name");
  return name;
};

test("the home page shows the app heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(await appName());
});

test("the public feed renders signed out", async ({ page }) => {
  await page.goto("/");
  // Either there is a board or there is an explicit empty state — never a blank screen.
  await expect(
    page.getByTestId("prediction-card").first().or(page.getByText("nothing sealed yet")),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "all", exact: true })).toBeVisible();
});

test("committing a prediction publishes a hash and nothing else", async ({ page }) => {
  const prediction = `by the resolution date, this test commit ${Date.now()} is still sealed`;

  await page.goto("/");
  await page.getByRole("button", { name: "scorekeeper" }).click();
  await page.getByLabel("prediction", { exact: true }).fill(prediction);
  await page.getByLabel("category").selectOption("crypto");
  await page.getByRole("button", { name: "seal and commit" }).click();

  const result = page.getByTestId("commit-result");
  await expect(result).toBeVisible();
  const hash = ((await page.getByTestId("commit-result-hash").textContent()) ?? "").trim();
  expect(hash).toMatch(/^[0-9a-f]{64}$/);

  // The board shows the commitment, its countdown and its hash — but not the text.
  await page.getByRole("button", { name: "feed" }).click();
  const card = page.getByTestId("prediction-card").filter({ hasText: hash });
  await expect(card).toBeVisible();
  await expect(card.getByTestId("countdown")).toContainText(/\d/);
  await expect(page.getByText(prediction)).toHaveCount(0);
});

test("the verifier confirms a matching text and salt, and rejects a tampered one", async ({ page }) => {
  const text = "bitcoin closes above one hundred thousand dollars";
  const salt = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";
  const hash = createHash("sha256").update(`${text}|${salt}`, "utf8").digest("hex");

  await page.goto("/");
  await page.getByRole("button", { name: "verify" }).click();

  await page.getByLabel("revealed prediction").fill(text);
  await page.getByLabel("salt").fill(salt);
  await page.getByLabel("commit hash").fill(hash);
  await page.getByRole("button", { name: "check the hash" }).click();

  const result = page.getByTestId("verify-result");
  await expect(result).toContainText("match");
  await expect(result).toContainText(hash);

  await page.getByLabel("revealed prediction").fill(`${text} (edited)`);
  await page.getByRole("button", { name: "check the hash" }).click();
  await expect(result).toContainText("no match");
});

test("the holder panel stays closed without the coin and explains the perks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "holders" }).click();
  await expect(page.getByTestId("holder-locked")).toBeVisible();
  await expect(page.getByText("seal private calls")).toBeVisible();
});
