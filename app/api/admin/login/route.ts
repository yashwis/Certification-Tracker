import { NextResponse } from "next/server";
import { createAdminSession, verifyPassword } from "../../../../lib/admin-auth";
export async function POST(request: Request) {
  const { password } = await request.json() as { password?: string };
  if (!password || !verifyPassword(password)) return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
  await createAdminSession();
  return NextResponse.json({ admin: true });
}
