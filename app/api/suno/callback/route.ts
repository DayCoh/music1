import { NextResponse } from "next/server";

// Suno requires a callBackUrl on generation. This MVP polls for results instead of
// relying on the callback (no database to persist callback payloads), so this route
// simply accepts the POST and returns 200 so Suno's callback doesn't error.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
