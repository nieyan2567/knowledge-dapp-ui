import { expect, test, type Page } from "@playwright/test";

import { mockKnowChainRpc } from "./support/rpc";

async function expectToast(page: Page) {
  await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await mockKnowChainRpc(page);
});

test("shows a browser toast when proposing without a connected wallet", async ({
  page,
}) => {
  await page.goto("/governance");

  await page.getByTestId("governance-propose-button").click();

  await expectToast(page);
});

test("shows a browser toast when staking without a connected wallet", async ({
  page,
}) => {
  await page.goto("/stake");

  await page.getByTestId("stake-deposit-button").click();

  await expectToast(page);
});

test("keeps faucet claiming disabled while the wallet is disconnected", async ({
  page,
}) => {
  await page.goto("/faucet");

  await expect(page.getByTestId("faucet-claim-button")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true })
  ).toBeVisible();
});
