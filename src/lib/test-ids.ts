/**
 * @notice 前端测试 ID 常量定义。
 * @dev 集中管理页面级与导航级测试标识，方便 UI 测试和页面选择器复用。
 */
/**
 * @notice 页面级测试 ID 映射表。
 * @dev 每个字段对应一个页面容器的稳定测试选择器。
 */
export const PAGE_TEST_IDS = {
  dashboard: "page-dashboard",
  profile: "page-profile",
  faucet: "page-faucet",
  stake: "page-stake",
  content: "page-content",
  rewards: "page-rewards",
  governance: "page-governance",
  system: "page-system",
  admin: "page-admin",
} as const;

/**
 * @notice 导航链接测试 ID 映射表。
 * @dev 用于在导航测试中稳定定位各功能入口。
 */
export const NAV_LINK_TEST_IDS = {
  dashboard: "nav-dashboard",
  profile: "nav-profile",
  faucet: "nav-faucet",
  stake: "nav-stake",
  content: "nav-content",
  rewards: "nav-rewards",
  governance: "nav-governance",
  system: "nav-system",
  admin: "nav-admin",
  explorer: "nav-explorer",
} as const;

/**
 * @notice 页面测试 ID 的联合类型。
 * @dev 由 `PAGE_TEST_IDS` 的所有字面量值组成。
 */
export type AppPageTestId = (typeof PAGE_TEST_IDS)[keyof typeof PAGE_TEST_IDS];

/**
 * @notice 导航测试 ID 的联合类型。
 * @dev 由 `NAV_LINK_TEST_IDS` 的所有字面量值组成。
 */
export type NavLinkTestId =
  (typeof NAV_LINK_TEST_IDS)[keyof typeof NAV_LINK_TEST_IDS];
