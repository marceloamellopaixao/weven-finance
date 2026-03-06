import { NextRequest, NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi/spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const runtimeUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const serverUrl = configuredUrl || runtimeUrl;

  const spec = buildOpenApiSpec([
    {
      url: serverUrl,
      description: "Servidor atual",
    },
  ]);

  return NextResponse.json(spec, { status: 200 });
}
