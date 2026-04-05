import { expect, test } from "@playwright/test";

import { mockKnowChainRpc } from "./support/rpc";

test.beforeEach(async ({ page }) => {
  await mockKnowChainRpc(page);
});

test("navigates across the main application pages", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("page-dashboard")).toBeVisible();

  await page.getByTestId("nav-stake").click();
  await expect(page).toHaveURL(/\/stake$/);
  await expect(page.getByTestId("page-stake")).toBeVisible();

  await page.getByTestId("nav-content").click();
  await expect(page).toHaveURL(/\/content$/);

  await page.getByTestId("nav-rewards").click();
  await expect(page).toHaveURL(/\/rewards$/);

  await page.getByTestId("nav-governance").click();
  await expect(page).toHaveURL(/\/governance$/);
  await expect(page.getByTestId("page-governance")).toBeVisible();

  await page.getByTestId("nav-system").click();
  await expect(page).toHaveURL(/\/system$/);

  await page.getByTestId("nav-faucet").click();
  await expect(page).toHaveURL(/\/faucet$/);
  await expect(page.getByTestId("page-faucet")).toBeVisible();
});
