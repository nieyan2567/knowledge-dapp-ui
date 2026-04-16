/**
 * @notice 应用外壳与导航配置。
 * @dev 集中定义侧边栏文案、内部导航项、外部入口以及页面标题解析规则。
 */
import { NAV_LINK_TEST_IDS } from "@/lib/test-ids";

/**
 * @notice 应用外壳公共文案。
 * @dev 供侧边栏、页脚和钱包连接入口复用。
 */
export const APP_SHELL_COPY = {
  expandSidebar: "展开侧边栏",
  collapseSidebar: "收起侧边栏",
  workspaceLabel: "Workspace",
  footerLabel: "Local DAO Workspace",
  connectWallet: "连接钱包",
  wrongNetwork: "网络错误",
  defaultPageTitle: "Knowledge DApp",
} as const;

/**
 * @notice 站内导航项定义。
 * @dev 每项包含导航 key、路径、显示文案和测试 ID。
 */
export const INTERNAL_NAV_ITEMS = [
  { key: "dashboard", href: "/", label: "Dashboard", testId: NAV_LINK_TEST_IDS.dashboard },
  { key: "profile", href: "/profile", label: "Profile", testId: NAV_LINK_TEST_IDS.profile },
  { key: "faucet", href: "/faucet", label: "Faucet", testId: NAV_LINK_TEST_IDS.faucet },
  { key: "stake", href: "/stake", label: "Stake", testId: NAV_LINK_TEST_IDS.stake },
  { key: "content", href: "/content", label: "Content", testId: NAV_LINK_TEST_IDS.content },
  { key: "rewards", href: "/rewards", label: "Rewards", testId: NAV_LINK_TEST_IDS.rewards },
  {
    key: "governance",
    href: "/governance",
    label: "Governance",
    testId: NAV_LINK_TEST_IDS.governance,
  },
  { key: "system", href: "/system", label: "System", testId: NAV_LINK_TEST_IDS.system },
  // { key: "admin", href: "/admin", label: "Admin", testId: NAV_LINK_TEST_IDS.admin },
] as const;

/**
 * @notice 站外导航项定义。
 * @dev 当前主要用于跳转区块浏览器等外部系统。
 */
export const EXTERNAL_NAV_ITEMS = [
  { key: "explorer", label: "Explorer", testId: NAV_LINK_TEST_IDS.explorer },
] as const;

/**
 * @notice 根据当前路径推导页面标题。
 * @param pathname 当前页面路径。
 * @returns 命中的导航标题；若未命中则返回默认标题。
 */
export function getPageTitle(pathname: string) {
  const item = INTERNAL_NAV_ITEMS.find((entry) => {
    if (entry.href === "/") {
      return pathname === "/";
    }

    return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
  });
  return item?.label || APP_SHELL_COPY.defaultPageTitle;
}
