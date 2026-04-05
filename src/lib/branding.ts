import { getPublicRuntimeEnv } from "./env";

export const BRANDING = {
  appName: "Knowledge DApp",
  chainName: "KnowChain",
  nativeTokenName: "Know Coin",
  nativeTokenSymbol: "KC",
  explorerName: "Blockscout",
  get explorerUrl() {
    return getPublicRuntimeEnv().NEXT_PUBLIC_BLOCKSCOUT_URL;
  },
};
