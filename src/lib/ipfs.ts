const defaultGatewayBase = "http://127.0.0.1:8080/ipfs";

export function getIpfsGatewayBase() {
  return process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || defaultGatewayBase;
}

export function getIpfsFileUrl(cid: string) {
  return `${getIpfsGatewayBase()}/${cid}`;
}
