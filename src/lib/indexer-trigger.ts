"use client";

import type { TxDomain } from "@/lib/tx-events";

export async function triggerIndexedRefresh(
  domains: TxDomain[],
  hash?: `0x${string}`
) {
  if (domains.length === 0) {
    return null;
  }

  const response = await fetch("/api/index/trigger", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      domains,
      hash,
    }),
  });

  if (response.status === 503) {
    return null;
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || `Failed to trigger indexer sync: ${response.status}`);
  }

  return response.json().catch(() => null);
}
