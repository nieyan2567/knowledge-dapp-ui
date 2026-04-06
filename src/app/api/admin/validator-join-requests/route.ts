import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";

import { isAdminAddress, readAuthenticatedRequestAddress } from "@/lib/admin/access";
import { validatorJoinRequestSchema } from "@/lib/admin/schemas";
import {
  createValidatorJoinRequest,
  listAdminRequests,
} from "@/lib/admin/store";
import { parseJsonBody } from "@/lib/api-validation";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const address = await readAuthenticatedRequestAddress(req);
  const normalizedAddress = address ? (getAddress(address) as `0x${string}`) : undefined;
  const admin = !!normalizedAddress && isAdminAddress(normalizedAddress);
  const items = admin
    ? await listAdminRequests("validator")
    : normalizedAddress
      ? await listAdminRequests("validator", {
          applicantAddress: normalizedAddress,
        })
      : [];

  return NextResponse.json(
    {
      authenticated: !!normalizedAddress,
      isAdmin: admin,
      address: normalizedAddress,
      items,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const address = await readAuthenticatedRequestAddress(req);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await parseJsonBody(
    req,
    validatorJoinRequestSchema,
    "验证者申请参数无效"
  );
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const record = await createValidatorJoinRequest({
    applicantAddress: getAddress(address) as `0x${string}`,
    payload: {
      ...bodyResult.value,
      validatorAddress: getAddress(bodyResult.value.validatorAddress) as `0x${string}`,
    },
  });

  return NextResponse.json(
    { ok: true, item: record },
    {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
