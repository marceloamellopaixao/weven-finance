import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseDeleteByFilters, supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

type SupportType = "support" | "feature";

async function getAuthContext(request: NextRequest) {
  const decoded = await verifyRequestAuth(request);
  const rows = await supabaseSelect("profiles", {
    filters: { uid: decoded.uid },
    limit: 1,
  });
  if (rows.length === 0) throw new Error("user_not_found");
  const row = rows[0];
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  return {
    uid: decoded.uid,
    email: decoded.email || String(row.email || raw.email || ""),
    name: String(row.display_name || raw.displayName || raw.completeName || decoded.email || "Usuario"),
    role: String(row.role || raw.role || "client"),
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    const rows = await supabaseSelect("support_requests", {
      select: "id,uid,email,name,message,ticket_type,ticket_status,assigned_to,staff_seen_by,votes,created_at,updated_at,raw",
    });

    const tickets = rows
      .map((row) => {
        const raw = (row.raw as Record<string, unknown> | null) ?? {};
        return {
          id: String(row.id || ""),
          uid: String(row.uid || raw.uid || ""),
          email: String(row.email || raw.email || ""),
          name: String(row.name || raw.name || ""),
          message: String(row.message || raw.message || ""),
          type: String(row.ticket_type || raw.type || "support"),
          status: String(row.ticket_status || raw.status || "pending"),
          assignedTo: row.assigned_to ?? raw.assignedTo ?? null,
          staffSeenBy: Array.isArray(row.staff_seen_by)
            ? row.staff_seen_by
            : Array.isArray(raw.staffSeenBy)
              ? raw.staffSeenBy
              : [],
          votes: typeof row.votes === "number" ? row.votes : typeof raw.votes === "number" ? raw.votes : 0,
          platform: String(raw.platform || "web"),
          createdAt: String(row.created_at || raw.createdAt || ""),
          updatedAt: String(row.updated_at || raw.updatedAt || ""),
        };
      })
      .filter((ticket) => {
        if (auth.role === "support") return ticket.assignedTo === auth.uid;
        if (auth.role !== "admin" && auth.role !== "moderator") return ticket.uid === auth.uid;
        return true;
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return NextResponse.json({ ok: true, tickets }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = (await request.json()) as {
      type?: SupportType;
      message?: string;
      status?: string;
      platform?: string;
    };

    const type = body.type === "feature" ? "feature" : "support";
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const id = crypto.randomUUID();
    const raw: Record<string, unknown> = {
      uid: auth.uid,
      email: auth.email,
      name: auth.name,
      message,
      type,
      status: body.status || "pending",
      staffSeenBy: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      platform: body.platform || "web",
      ...(type === "feature" ? { votes: 0 } : {}),
    };

    await supabaseUpsertRows("support_requests", [
      {
        id,
        uid: auth.uid,
        email: auth.email,
        name: auth.name,
        message,
        ticket_type: type,
        ticket_status: body.status || "pending",
        staff_seen_by: [],
        votes: type === "feature" ? 0 : null,
        platform: body.platform || "web",
        created_at: nowIso,
        updated_at: nowIso,
        raw,
      },
    ]);

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = (await request.json()) as {
      action?: "markSeen";
      ticketIds?: string[];
      ticketId?: string;
      updates?: Record<string, unknown>;
    };

    const allRows = await supabaseSelect("support_requests", {
      select: "id,uid,assigned_to,staff_seen_by,raw",
    });

    if (body.action === "markSeen") {
      if (auth.role !== "admin" && auth.role !== "moderator" && auth.role !== "support") {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      const ids = Array.isArray(body.ticketIds)
        ? body.ticketIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      if (ids.length === 0) {
        return NextResponse.json({ ok: true, updated: 0 }, { status: 200 });
      }

      const upserts: Array<Record<string, unknown>> = [];
      for (const id of ids) {
        const row = allRows.find((entry) => String(entry.id || "") === id);
        if (!row) continue;
        const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
        const seen = Array.isArray(row.staff_seen_by)
          ? row.staff_seen_by.map((item) => String(item))
          : Array.isArray(raw.staffSeenBy)
            ? raw.staffSeenBy.map((item) => String(item))
            : [];
        if (!seen.includes(auth.uid)) seen.push(auth.uid);
        raw.staffSeenBy = seen;

        upserts.push({
          id,
          staff_seen_by: seen,
          raw,
          updated_at: new Date().toISOString(),
        });
      }

      if (upserts.length > 0) {
        await supabaseUpsertRows("support_requests", upserts, { onConflict: "id" });
      }
      return NextResponse.json({ ok: true, updated: upserts.length }, { status: 200 });
    }

    const ticketId = body.ticketId?.trim();
    if (!ticketId || !body.updates) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const row = allRows.find((entry) => String(entry.id || "") === ticketId);
    if (!row) {
      return NextResponse.json({ ok: false, error: "ticket_not_found" }, { status: 404 });
    }

    const ticketData = {
      uid: String(row.uid || ""),
      assignedTo: row.assigned_to ? String(row.assigned_to) : "",
    };

    const isManager = auth.role === "admin" || auth.role === "moderator";
    const isSupportSelfAssignment =
      auth.role === "support" &&
      (ticketData.assignedTo === auth.uid || body.updates.assignedTo === auth.uid);
    const isOwner = ticketData.uid === auth.uid;

    if (!isManager && !isSupportSelfAssignment && !isOwner) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...raw, ...body.updates, updatedAt: new Date().toISOString() };

    await supabaseUpsertRows(
      "support_requests",
      [
        {
          id: ticketId,
          assigned_to: merged["assignedTo"] ?? row.assigned_to ?? null,
          ticket_status: merged["status"] ?? null,
          raw: merged,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (auth.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim();
    if (!ticketId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    await supabaseDeleteByFilters("support_requests", { id: ticketId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

