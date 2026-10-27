import { NextResponse } from "next/server";
import { patchStoredCase, readState, storageConfigured } from "../../../lib/blob-store";
import { isAdmin } from "../../../lib/admin-auth";
import { EDITABLE_STATUSES } from "../../../lib/types";
import { definedCaseUpdate } from "../../../lib/case-update";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { cases } = await readState();
    return NextResponse.json({ cases, updatedAt: cases.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, ""), storageConfigured: storageConfigured() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load test cases." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  if (!storageConfigured()) return NextResponse.json({ error: "Connect a Vercel Blob store before editing cases." }, { status: 503 });
  try {
    const body = await request.json() as { key?: string; status?: string; inScope?: boolean };
    if (!body.key) return NextResponse.json({ error: "Test case key is required." }, { status: 400 });
    if (body.status !== undefined && !EDITABLE_STATUSES.includes(body.status as typeof EDITABLE_STATUSES[number])) return NextResponse.json({ error: "Unsupported status." }, { status: 400 });
    const updates = definedCaseUpdate(body);
    return NextResponse.json(await patchStoredCase(body.key, updates));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update test case." }, { status: 500 });
  }
}
