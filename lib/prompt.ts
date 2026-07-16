// Turns plain-language wizard answers into Suno generation parameters.
// No music jargon leaks to the user — they answer human questions; we shape the brief.

import type { GenerateParams, SunoModel } from "./suno";

export interface WizardInput {
  occasion: string; // e.g. "Birthday", "Anniversary"
  recipient: string; // who the song is for / about
  vibe: string; // free-text or preset, e.g. "Upbeat pop celebration"
  details: string; // memories / details to weave in
  instrumental: boolean;
  model: SunoModel;
}

// We use Suno's NON-custom ("description") mode: the prompt is a brief and Suno
// WRITES original lyrics from it (per the docs: "lyrics will be automatically
// generated based on it, not strictly matching the input") and composes music
// that fits. Custom mode, by contrast, sings the prompt verbatim — which is not
// what we want. Non-custom mode caps the prompt at 500 characters.
const MAX_DESCRIPTION = 500;

function clamp(s: string, max: number): string {
  const t = (s ?? "").trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}

export function buildGenerateBody(
  input: WizardInput,
  callBackUrl: string
): GenerateParams {
  const occasion = input.occasion?.trim() || "a special moment";
  const recipient = input.recipient?.trim() || "someone special";
  const vibe = input.vibe?.trim() || "warm and heartfelt";
  const details = input.details?.trim();

  // Lead with an explicit style label so Suno strongly matches the chosen genre
  // (any world style works), then who + occasion, then personal details.
  // Suno generates ORIGINAL lyrics from this brief (non-custom mode).
  const parts = input.instrumental
    ? [
        `Style: ${vibe}.`,
        `An instrumental piece for ${recipient}, evoking ${occasion}.`,
        details ? `Mood and imagery: ${details}.` : "",
      ]
    : [
        `Style: ${vibe}.`,
        `A song for ${recipient}, celebrating ${occasion}.`,
        details ? `Weave in these personal details: ${details}.` : "",
        `Write original, heartfelt, personal lyrics that tell their story,`,
        `authentic to the ${vibe} tradition.`,
      ];

  const prompt = clamp(parts.filter(Boolean).join(" "), MAX_DESCRIPTION);

  // customMode:false → Suno authors the lyrics itself and picks fitting music.
  // In this mode style/title are not sent (the description carries the vibe).
  return {
    customMode: false,
    instrumental: input.instrumental,
    model: input.model,
    prompt,
    callBackUrl,
  };
}
