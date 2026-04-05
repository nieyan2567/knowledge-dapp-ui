export const PAGE_TEST_IDS = {
  dashboard: "page-dashboard",
  profile: "page-profile",
  faucet: "page-faucet",
  stake: "page-stake",
  content: "page-content",
  rewards: "page-rewards",
  governance: "page-governance",
  system: "page-system",
} as const;

export const NAV_LINK_TEST_IDS = {
  dashboard: "nav-dashboard",
  profile: "nav-profile",
  faucet: "nav-faucet",
  stake: "nav-stake",
  content: "nav-content",
  rewards: "nav-rewards",
  governance: "nav-governance",
  system: "nav-system",
  explorer: "nav-explorer",
} as const;

export type AppPageTestId = (typeof PAGE_TEST_IDS)[keyof typeof PAGE_TEST_IDS];
export type NavLinkTestId =
  (typeof NAV_LINK_TEST_IDS)[keyof typeof NAV_LINK_TEST_IDS];
