import { NextRequest, NextResponse } from "next/server";
import { getStatus } from "@/lib/suno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "Missing taskId." }, { status: 400 });
  }

  try {
    const result = await getStatus(taskId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Could not fetch status." },
      { status: 502 }
    );
  }
}
