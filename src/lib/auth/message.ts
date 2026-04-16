/**
 * @notice 上传鉴权签名消息构造工具。
 * @dev 定义上传鉴权挑战结构，并将挑战与地址序列化为钱包签名文案。
 */
import { BRANDING } from "@/lib/branding";

/**
 * @notice 上传鉴权挑战的数据结构。
 * @dev 该结构由服务端发放，并作为钱包签名消息的核心内容。
 */
export type UploadAuthChallenge = {
  nonce: string;
  issuedAt: string;
  domain: string;
  origin: string;
  chainId: number;
};

/**
 * @notice 生成上传鉴权所需的钱包签名消息。
 * @param challenge 服务端发放的上传鉴权挑战。
 * @param address 当前进行签名的钱包地址。
 * @returns 传给钱包签名接口的多行文本消息。
 */
export function buildUploadAuthMessage(
  challenge: UploadAuthChallenge,
  address: `0x${string}`
) {
  return [
    `${BRANDING.appName} Upload Authentication`,
    "",
    "Sign this message to authenticate file uploads.",
    "",
    `Address: ${address}`,
    `Chain ID: ${challenge.chainId}`,
    `Domain: ${challenge.domain}`,
    `URI: ${challenge.origin}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.issuedAt}`,
  ].join("\n");
}
