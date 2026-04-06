import "server-only";

import { getAddress } from "viem";
import type { NextRequest } from "next/server";

import { readUploadSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import {
  getSystemApiToken,
  isAuthorizedSystemRequest,
} from "@/lib/system-api-auth";

function normalizeAddress(value: string) {
  try {
    return getAddress(value).toLowerCase();
  } catch {
    return null;
  }
}

export async function readAuthenticatedRequestAddress(req: NextRequest) {
  const session = await readUploadSession(req);
  return session?.sub;
}

export function getAdminAddresses() {
  return getServerEnv().ADMIN_ADDRESSES.map((value) => normalizeAddress(value)).filter(
    (value): value is string => !!value
  );
}

export function isAdminAddress(address: string | null | undefined) {
  const normalized = address ? normalizeAddress(address) : null;

  if (!normalized) {
    return false;
  }

  return getAdminAddresses().includes(normalized);
}

export async function getAdminRequestActor(req: NextRequest) {
  const systemToken = getSystemApiToken();

  if (systemToken && isAuthorizedSystemRequest(req, systemToken)) {
    return { ok: true as const, actor: "system" as const };
  }

  const address = await readAuthenticatedRequestAddress(req);
  if (!address || !isAdminAddress(address)) {
    return { ok: false as const };
  }

  return { ok: true as const, actor: getAddress(address) as `0x${string}` };
}
