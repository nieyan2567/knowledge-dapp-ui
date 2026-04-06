import { NextRequest, NextResponse } from "next/server";

import { getAdminRequestActor } from "@/lib/admin/access";
import { reviewRequestSchema } from "@/lib/admin/schemas";
import {
  getAdminRequestById,
  reviewAdminRequest,
} from "@/lib/admin/store";
import { parseJsonBody } from "@/lib/api-validation";
import { addNodeToAllowlist } from "@/lib/besu-admin/permissioning";
import { proposeValidatorVoteAcrossValidators } from "@/lib/besu-admin/validators";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAdminRequestActor(req);
  if (!actor.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyResult = await parseJsonBody(req, reviewRequestSchema, "审批参数无效");
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const { id } = await params;
  const request = await getAdminRequestById("validator", id);
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (request.status !== "pending") {
    return NextResponse.json(
      { error: "Request is already reviewed" },
      { status: 409 }
    );
  }

  await addNodeToAllowlist(request.enode);
  const voteReport = await proposeValidatorVoteAcrossValidators(
    request.validatorAddress,
    true
  );
  const requiredVotes = Math.floor(voteReport.urls.length / 2) + 1;

  if (voteReport.successCount < requiredVotes) {
    return NextResponse.json(
      {
        error: "Not enough validator votes were submitted successfully",
        voteReport,
        requiredVotes,
      },
      { status: 502 }
    );
  }

  const item = await reviewAdminRequest({
    kind: "validator",
    id,
    status: "approved",
    reviewedBy: actor.actor,
    reviewComment: bodyResult.value.reviewComment,
  });

  return NextResponse.json(
    { ok: true, item, voteReport, requiredVotes },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
