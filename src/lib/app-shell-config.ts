import { NAV_LINK_TEST_IDS } from "@/lib/test-ids";

export const APP_SHELL_COPY = {
  expandSidebar: "展开侧边栏",
  collapseSidebar: "收起侧边栏",
  workspaceLabel: "Workspace",
  footerLabel: "Local DAO Workspace",
  connectWallet: "连接钱包",
  wrongNetwork: "网络错误",
  defaultPageTitle: "Knowledge DApp",
} as const;

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
  { key: "admin", href: "/admin", label: "Admin", testId: NAV_LINK_TEST_IDS.admin },
] as const;

export const EXTERNAL_NAV_ITEMS = [
  { key: "explorer", label: "Explorer", testId: NAV_LINK_TEST_IDS.explorer },
] as const;

export function getPageTitle(pathname: string) {
  const item = INTERNAL_NAV_ITEMS.find((entry) => {
    if (entry.href === "/") {
      return pathname === "/";
    }

    return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
  });
  return item?.label || APP_SHELL_COPY.defaultPageTitle;
}
