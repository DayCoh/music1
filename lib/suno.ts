// SERVER-ONLY Suno provider adapter.
// This module reads SUNO_API_KEY and must never be imported into a client component.
// All provider specifics live here so the rest of the app depends on this interface only.

const SUNO_BASE_URL = "https://api.sunoapi.org";

export type SunoModel =
  | "V4"
  | "V4_5"
  | "V4_5PLUS"
  | "V4_5ALL"
  | "V5"
  | "V5_5";

export interface GenerateParams {
  prompt?: string;
  style?: string;
  title?: string;
  customMode: boolean;
  instrumental: boolean;
  model: SunoModel;
  callBackUrl: string;
}

export interface SunoTrack {
  id: string;
  title: string;
  audioUrl: string | null; // final, downloadable audio (ready on SUCCESS)
  streamAudioUrl: string | null; // playable stream (ready earlier, on FIRST_SUCCESS)
  imageUrl: string | null; // cover art
  duration: number | null;
  tags: string | null;
}

export interface StatusResult {
  taskId: string;
  status: string; // PENDING | TEXT_SUCCESS | FIRST_SUCCESS | SUCCESS | *_FAILED | SENSITIVE_WORD_ERROR ...
  tracks: SunoTrack[];
  errorMessage: string | null;
}

function apiKey(): string {
  const key = process.env.SUNO_API_KEY;
  if (!key) {
    throw new Error(
      "SUNO_API_KEY is not set. Add it to .env.local locally and to Netlify env vars in production."
    );
  }
  return key;
}

/** Submit a generation job. Returns the Suno taskId used for polling. */
export async function generate(params: GenerateParams): Promise<{ taskId: string }> {
  const res = await fetch(`${SUNO_BASE_URL}/api/v1/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(params),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json || json.code !== 200) {
    const msg = json?.msg || `Suno generate failed (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const taskId = json?.data?.taskId;
  if (!taskId) {
    throw new Error("Suno did not return a taskId.");
  }
  return { taskId };
}

/** Poll a job's status/result by taskId. */
export async function getStatus(taskId: string): Promise<StatusResult> {
  const url = `${SUNO_BASE_URL}/api/v1/generate/record-info?taskId=${encodeURIComponent(
    taskId
  )}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json || json.code !== 200) {
    const msg = json?.msg || `Suno status failed (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const data = json.data ?? {};
  const sunoData: any[] = data?.response?.sunoData ?? [];

  const tracks: SunoTrack[] = sunoData.map((t) => ({
    id: String(t.id ?? ""),
    title: t.title ?? "Untitled",
    audioUrl: t.audioUrl ?? null,
    streamAudioUrl: t.streamAudioUrl ?? null,
    imageUrl: t.imageUrl ?? null,
    duration: typeof t.duration === "number" ? t.duration : null,
    tags: t.tags ?? null,
  }));

  return {
    taskId: data.taskId ?? taskId,
    status: data.status ?? "PENDING",
    tracks,
    errorMessage: data.errorMessage ?? null,
  };
}
