import { BRANDING } from "@/lib/branding";

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
