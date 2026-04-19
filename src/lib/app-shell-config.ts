/**
 * @file 定义应用外壳的导航结构、默认标题和页面标题解析逻辑。
 */

import { NAV_LINK_TEST_IDS } from "@/lib/test-ids";

/**
 * @notice 应用外壳中的通用文案配置。
 */
export const APP_SHELL_COPY = {
  expandSidebar: "展开侧边栏",
  collapseSidebar: "收起侧边栏",
  workspaceLabel: "工作台",
  footerLabel: "本地 DAO 工作台",
  connectWallet: "连接钱包",
  wrongNetwork: "网络错误",
  defaultPageTitle: "知识协作系统",
} as const;

/**
 * @notice 站内导航项定义。
 */
export const INTERNAL_NAV_ITEMS = [
  { key: "dashboard", href: "/", label: "总览", testId: NAV_LINK_TEST_IDS.dashboard },
  { key: "profile", href: "/profile", label: "个人中心", testId: NAV_LINK_TEST_IDS.profile },
  { key: "faucet", href: "/faucet", label: "启动资金", testId: NAV_LINK_TEST_IDS.faucet },
  { key: "stake", href: "/stake", label: "质押投票", testId: NAV_LINK_TEST_IDS.stake },
  { key: "content", href: "/content", label: "内容广场", testId: NAV_LINK_TEST_IDS.content },
  { key: "rewards", href: "/rewards", label: "奖励中心", testId: NAV_LINK_TEST_IDS.rewards },
  {
    key: "governance",
    href: "/governance",
    label: "治理中心",
    testId: NAV_LINK_TEST_IDS.governance,
  },
  { key: "system", href: "/system", label: "系统信息", testId: NAV_LINK_TEST_IDS.system },
  // { key: "admin", href: "/admin", label: "管理后台", testId: NAV_LINK_TEST_IDS.admin },
] as const;

/**
 * @notice 站外导航项定义。
 */
export const EXTERNAL_NAV_ITEMS = [
  {
    key: "explorer",
    label: "区块浏览器",
    testId: NAV_LINK_TEST_IDS.explorer,
  },
] as const;

/**
 * @notice 根据当前路由解析页面标题。
 * @param pathname 当前路径名。
 * @returns 对应导航项标题，未命中时返回默认标题。
 */
export function getPageTitle(pathname: string): string {
  const matchedItem = INTERNAL_NAV_ITEMS.find((item) => {
    if (item.href === "/") {
      return pathname === "/";
    }

    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
  return matchedItem?.label ?? APP_SHELL_COPY.defaultPageTitle;
}
