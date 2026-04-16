/**
 * @notice Faucet 领取签名消息构造工具。
 * @dev 定义 Faucet 挑战结构，并生成钱包签名所需的消息文本。
 */
import { BRANDING } from "@/lib/branding";

/**
 * @notice Faucet 签名挑战结构。
 * @dev 在基础站点与链信息外，还包含地址、IP 哈希与 User-Agent 哈希。
 */
export type FaucetAuthChallenge = {
  nonce: string;
  issuedAt: string;
  domain: string;
  origin: string;
  chainId: number;
  address: `0x${string}`;
  ipHash: string;
  userAgentHash: string;
};

/**
 * @notice 生成 Faucet 领取请求的钱包签名消息。
 * @param challenge 服务端发放的 Faucet 挑战对象。
 * @param address 当前签名的钱包地址。
 * @returns 可直接传给钱包签名接口的多行文本消息。
 */
export function buildFaucetClaimMessage(
  challenge: FaucetAuthChallenge,
  address: `0x${string}`
) {
  return [
    `${BRANDING.appName} Faucet Request`,
    "",
    "Sign this message to request starter funds for gas.",
    "",
    `Address: ${address}`,
    `Chain ID: ${challenge.chainId}`,
    `Domain: ${challenge.domain}`,
    `URI: ${challenge.origin}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.issuedAt}`,
  ].join("\n");
}
