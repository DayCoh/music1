// Turns plain-language wizard answers into Suno generation parameters.
// No music jargon leaks to the user — they answer human questions; we shape the prompt.

import type { GenerateParams, SunoModel } from "./suno";

export interface WizardInput {
  occasion: string; // e.g. "Birthday", "Anniversary"
  recipient: string; // who the song is for / about
  vibe: string; // free-text or preset, e.g. "Upbeat pop celebration"
  details: string; // memories / details to weave in
  instrumental: boolean;
  model: SunoModel;
}

// Max lengths per Suno docs for V4_5+/V5 models (we stay well under).
const MAX_TITLE = 100;
const MAX_STYLE = 1000;
const MAX_PROMPT = 5000;

function clamp(s: string, max: number): string {
  const t = (s ?? "").trim();
  return t.length > max ? t.slice(0, max) : t;
}

export function buildGenerateBody(input: WizardInput, callBackUrl: string): GenerateParams {
  const occasion = input.occasion?.trim() || "a special moment";
  const recipient = input.recipient?.trim() || "someone special";
  const vibe = input.vibe?.trim() || "warm and heartfelt";
  const details = input.details?.trim();

  const title = clamp(`${occasion} for ${recipient}`, MAX_TITLE);
  const style = clamp(vibe, MAX_STYLE);

  // Lyric direction for a vocal track.
  const promptParts = [
    `Write a heartfelt, original song for ${recipient} to celebrate ${occasion}.`,
    `The mood should feel ${vibe}.`,
    details ? `Weave in these personal details: ${details}.` : "",
    `Make it feel personal, uplifting, and unmistakably theirs.`,
  ].filter(Boolean);

  const prompt = clamp(promptParts.join(" "), MAX_PROMPT);

  // customMode: true gives us control over title + style; prompt carries the lyric direction.
  const body: GenerateParams = {
    customMode: true,
    instrumental: input.instrumental,
    model: input.model,
    style,
    title,
    callBackUrl,
  };

  // prompt (lyric direction) is required for vocal tracks; omitted for instrumental.
  if (!input.instrumental) {
    body.prompt = prompt;
  }

  return body;
}
