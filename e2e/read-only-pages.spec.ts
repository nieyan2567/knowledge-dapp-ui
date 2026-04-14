import { expect, test } from "@playwright/test";

import { mockKnowChainRpc } from "./support/rpc";

test.beforeEach(async ({ page }) => {
  await mockKnowChainRpc(page);
});

test("shows the disconnected profile state when no wallet is connected", async ({
  page,
}) => {
  await page.goto("/profile");

  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByText("连接钱包后查看个人中心")).toBeVisible();
  await expect(page.getByText("请先在右上角连接钱包。")).toBeVisible();
});

test("keeps the content registration flow in a safe default state while disconnected", async ({
  page,
}) => {
  await page.goto("/content");

  await expect(page.getByTestId("page-content")).toBeVisible();
  await expect(page.getByText("暂无匹配内容，请先上传并登记第一条内容。")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "上传到本地 IPFS" })
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "链上登记" })
  ).toBeDisabled();
});

test("renders system explorer links against the configured Blockscout URL", async ({
  page,
}) => {
  await page.goto("/system");

  await expect(page.getByTestId("page-system")).toBeVisible();

  const pageMain = page.locator("main");
  const topbarExplorerLink = pageMain.locator('a[href="http://127.0.0.1:8182"]');
  await expect(topbarExplorerLink).toHaveCount(1);

  const contractExplorerLinks = pageMain.locator(
    'a[href^="http://127.0.0.1:8182/address/"]'
  );
  await expect(contractExplorerLinks).toHaveCount(4);
  await expect(contractExplorerLinks.first()).toHaveAttribute("href", /\/address\//);
});

test("uses a standalone layout for the faucet page", async ({ page }) => {
  await page.goto("/faucet");

  await expect(page.getByTestId("page-faucet")).toBeVisible();
  await expect(page.getByTestId("nav-dashboard")).toHaveCount(0);
  await expect(page.getByTestId("faucet-claim-button")).toBeVisible();
});
