/**
 * @notice 前端品牌与站点文案配置。
 * @dev 集中定义应用名称、链名称、原生代币名称以及浏览器名称等展示信息。
 */
import { getPublicRuntimeEnv } from "./env";

/**
 * @notice 当前站点的品牌展示配置。
 * @dev 其中区块浏览器地址会在运行时从公开环境变量中读取。
 */
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
