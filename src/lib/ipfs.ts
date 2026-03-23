import { getPublicEnv } from "./env";

export function getIpfsGatewayBase() {
  return getPublicEnv().NEXT_PUBLIC_IPFS_GATEWAY_URL;
}

export function getIpfsFileUrl(cid: string) {
  return `${getIpfsGatewayBase()}/${cid}`;
}
