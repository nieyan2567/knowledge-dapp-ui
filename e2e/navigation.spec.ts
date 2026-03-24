import { expect, test } from "@playwright/test";

import { mockKnowChainRpc } from "./support/rpc";

test.beforeEach(async ({ page }) => {
  await mockKnowChainRpc(page);
});

test("navigates across the main application pages", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Knowledge DApp Dashboard" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Stake", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Stake & Voting Power" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Content", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Content Hub" })).toBeVisible();

  await page.getByRole("link", { name: "Rewards", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Rewards Center" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Governance", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Governance Center" })
  ).toBeVisible();

  await page.getByRole("link", { name: "System", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "System Overview" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Faucet", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Get starter .* for your first on-chain actions/i })
  ).toBeVisible();
});
