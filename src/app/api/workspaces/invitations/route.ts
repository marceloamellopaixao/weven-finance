import type { NextRequest } from "next/server";

import {
  DELETE as handleDeleteInvitation,
  GET as handleGetInvitations,
  POST as handleAcceptInvitation,
} from "../family/accept/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleGetInvitations(request);
}

export function POST(request: NextRequest) {
  return handleAcceptInvitation(request);
}

export function DELETE(request: NextRequest) {
  return handleDeleteInvitation(request);
}
