import { NextRequest, NextResponse } from "next/server";
import { generate, type SunoModel } from "@/lib/suno";
import { buildGenerateBody, type WizardInput } from "@/lib/prompt";

// Node runtime (needs process.env secret + no edge caching).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_MODELS: SunoModel[] = ["V4", "V4_5", "V4_5PLUS", "V4_5ALL", "V5", "V5_5"];

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => ({}));

    const model: SunoModel = VALID_MODELS.includes(raw?.model) ? raw.model : "V4_5";

    const input: WizardInput = {
      occasion: String(raw?.occasion ?? "").slice(0, 200),
      recipient: String(raw?.recipient ?? "").slice(0, 200),
      vibe: String(raw?.vibe ?? "").slice(0, 500),
      details: String(raw?.details ?? "").slice(0, 2000),
      instrumental: Boolean(raw?.instrumental),
      model,
    };

    if (!input.occasion && !input.recipient && !input.vibe) {
      return NextResponse.json(
        { error: "Tell us a little about the song first." },
        { status: 400 }
      );
    }

    // Suno requires a callBackUrl. We poll for results, so this just points back at
    // our own no-op callback route (a valid URL that harmlessly accepts the POST).
    const origin = new URL(req.url).origin;
    const callBackUrl = `${origin}/api/suno/callback`;

    const body = buildGenerateBody(input, callBackUrl);
    const { taskId } = await generate(body);

    return NextResponse.json({ taskId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Generation failed. Please try again." },
      { status: 502 }
    );
  }
}
