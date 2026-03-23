import { getPublicEnv } from "./env";

const env = getPublicEnv();

export const BRANDING = {
  appName: "Knowledge DApp",
  chainName: "KnowChain",
  nativeTokenName: "Know Coin",
  nativeTokenSymbol: "KC",
  explorerName: "Chainlens",
  explorerUrl: env.NEXT_PUBLIC_CHAINLENS_URL,
};
