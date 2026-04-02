import { getPublicEnv } from "./env";

const env = getPublicEnv();

export const BRANDING = {
  appName: "Knowledge DApp",
  chainName: "KnowChain",
  nativeTokenName: "Know Coin",
  nativeTokenSymbol: "KC",
  explorerName: "Blockscout",
  explorerUrl: env.NEXT_PUBLIC_BLOCKSCOUT_URL,
};
