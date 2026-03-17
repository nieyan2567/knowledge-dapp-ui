import { BRANDING } from "@/lib/branding";

export type UploadAuthChallenge = {
  nonce: string;
  issuedAt: string;
  domain: string;
  origin: string;
  chainId: number;
};

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
