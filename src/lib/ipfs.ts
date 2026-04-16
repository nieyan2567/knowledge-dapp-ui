/**
 * @notice IPFS 访问地址辅助工具。
 * @dev 负责从公开环境变量中读取网关地址，并拼接具体文件的访问 URL。
 */
import { getPublicEnv } from "./env";

/**
 * @notice 获取当前前端配置使用的 IPFS 网关基地址。
 * @returns IPFS 网关的基础 URL。
 */
export function getIpfsGatewayBase() {
  return getPublicEnv().NEXT_PUBLIC_IPFS_GATEWAY_URL;
}

/**
 * @notice 根据 CID 构造可直接访问的 IPFS 文件地址。
 * @param cid 目标内容的 IPFS CID。
 * @returns 指向该 CID 内容的完整网关 URL。
 */
export function getIpfsFileUrl(cid: string) {
  return `${getIpfsGatewayBase()}/${cid}`;
}
