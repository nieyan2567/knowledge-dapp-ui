import { expect, test } from "@playwright/test";

import { mockKnowChainRpc } from "./support/rpc";

test.beforeEach(async ({ page }) => {
  await mockKnowChainRpc(page);
});

test("keeps governance proposing disabled while the wallet is disconnected", async ({
  page,
}) => {
  await page.goto("/governance");

  await expect(page.getByTestId("governance-propose-button")).toBeDisabled();
});

test("keeps staking actions disabled while the wallet is disconnected", async ({
  page,
}) => {
  await page.goto("/stake");

  await expect(page.getByTestId("stake-deposit-button")).toBeDisabled();
  await expect(page.getByTestId("stake-activate-button")).toBeDisabled();
  await expect(page.getByTestId("stake-request-withdraw-button")).toBeDisabled();
  await expect(page.getByTestId("stake-withdraw-button")).toBeDisabled();
});

test("keeps faucet claiming disabled while the wallet is disconnected", async ({
  page,
}) => {
  await page.goto("/faucet");

  await expect(page.getByTestId("faucet-claim-button")).toBeDisabled();
});
