import { NextResponse } from "next/server";
import { clearAdminSession, isAdmin } from "../../../../lib/admin-auth";
export async function GET() { return NextResponse.json({ admin: await isAdmin() }); }
export async function DELETE() { await clearAdminSession(); return NextResponse.json({ admin: false }); }
