"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types (mirrors the shape returned by our own /api routes — see lib/suno.ts)
// ---------------------------------------------------------------------------

type SunoModel = "V4" | "V4_5" | "V4_5PLUS" | "V4_5ALL" | "V5" | "V5_5";

interface Track {
  id: string;
  title: string;
  audioUrl: string | null;
  streamAudioUrl: string | null;
  imageUrl: string | null;
  duration: number | null;
  tags: string | null;
}

interface StatusResponse {
  taskId: string;
  status: string;
  tracks: Track[];
  errorMessage: string | null;
  error?: string;
}

type Phase = "wizard" | "generating" | "reveal" | "error";

interface WizardState {
  occasion: string;
  recipient: string;
  vibe: string;
  details: string;
  instrumental: boolean;
  model: SunoModel;
}

const FAILED_STATUSES = new Set([
  "CREATE_TASK_FAILED",
  "GENERATE_AUDIO_FAILED",
  "CALLBACK_EXCEPTION",
  "SENSITIVE_WORD_ERROR",
]);

const OCCASION_PRESETS = ["Birthday", "Anniversary", "Proposal", "Just because"];
const VIBE_PRESETS = [
  "Upbeat pop celebration",
  "Acoustic & heartfelt",
  "Cinematic & epic",
];
const MODEL_OPTIONS: { value: SunoModel; label: string }[] = [
  { value: "V4", label: "V4 — classic" },
  { value: "V4_5", label: "V4.5 — recommended" },
  { value: "V4_5PLUS", label: "V4.5 Plus — richer sound" },
  { value: "V4_5ALL", label: "V4.5 All-round" },
  { value: "V5", label: "V5 — latest" },
  { value: "V5_5", label: "V5.5 — newest" },
];

const GENERATING_MESSAGES = [
  "Finding the melody…",
  "Writing your lyrics…",
  "Warming up the vocals…",
  "Mixing in the feeling…",
  "Adding the finishing touches…",
  "Almost there…",
];

const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const INITIAL_WIZARD: WizardState = {
  occasion: "",
  recipient: "",
  vibe: "",
  details: "",
  instrumental: false,
  model: "V4_5",
};

const TOTAL_STEPS = 4;

export default function Page() {
  const [phase, setPhase] = useState<Phase>("wizard");
  const [step, setStep] = useState(0);
  const [wizard, setWizard] = useState<WizardState>(INITIAL_WIZARD);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("PENDING");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sensitiveWord, setSensitiveWord] = useState(false);

  const [messageIndex, setMessageIndex] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRevealedRef = useRef(false);

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const clearMessageRotation = useCallback(() => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }
  }, []);

  // Clean up all timers on unmount.
  useEffect(() => {
    return () => {
      clearPolling();
      clearMessageRotation();
    };
  }, [clearPolling, clearMessageRotation]);

  // Rotate encouraging messages while generating.
  useEffect(() => {
    if (phase !== "generating") {
      clearMessageRotation();
      return;
    }
    setMessageIndex(0);
    messageIntervalRef.current = setInterval(() => {
      setMessageIndex((i) => (i + 1) % GENERATING_MESSAGES.length);
    }, 3200);
    return () => clearMessageRotation();
  }, [phase, clearMessageRotation]);

  useEffect(() => {
    if (phase === "generating") {
      setLiveMessage(GENERATING_MESSAGES[messageIndex]);
    }
  }, [messageIndex, phase]);

  const handleStatusResult = useCallback((json: StatusResponse) => {
    setStatus(json.status);
    setTracks(json.tracks || []);

    const playable = (json.tracks || []).find(
      (t) => t.streamAudioUrl || t.audioUrl
    );

    if (playable && !hasRevealedRef.current) {
      hasRevealedRef.current = true;
      const idx = (json.tracks || []).findIndex(
        (t) => t.streamAudioUrl || t.audioUrl
      );
      setSelectedVariant(idx >= 0 ? idx : 0);
      setPhase("reveal");
      setLiveMessage("Your song is ready.");
    }

    if (FAILED_STATUSES.has(json.status)) {
      clearPolling();
      hasRevealedRef.current = false;
      setSensitiveWord(json.status === "SENSITIVE_WORD_ERROR");
      setErrorMessage(
        json.status === "SENSITIVE_WORD_ERROR"
          ? "That description tripped a content filter. Try rephrasing a few words and give it another go."
          : json.errorMessage || "We couldn't finish your song this time."
      );
      setPhase("error");
      setLiveMessage("We ran into a problem creating your song.");
      return;
    }

    if (json.status === "SUCCESS") {
      clearPolling();
    }
  }, [clearPolling]);

  const pollStatus = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/status?taskId=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const json: StatusResponse = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Could not check your song's status.");
        }
        handleStatusResult(json);
      } catch (err) {
        // Transient network errors: keep polling silently, the timeout will
        // eventually catch a truly stuck job.
        console.error("status poll failed", err);
      }
    },
    [handleStatusResult]
  );

  const beginPolling = useCallback(
    (id: string) => {
      clearPolling();
      hasRevealedRef.current = false;
      pollStatus(id);
      pollIntervalRef.current = setInterval(() => pollStatus(id), POLL_INTERVAL_MS);
      pollTimeoutRef.current = setTimeout(() => {
        clearPolling();
        setErrorMessage(
          "This is taking longer than usual. Your song may still finish — but let's try again."
        );
        setSensitiveWord(false);
        setPhase((p) => (p === "reveal" ? p : "error"));
        setLiveMessage("Taking longer than expected.");
      }, TIMEOUT_MS);
    },
    [clearPolling, pollStatus]
  );

  const startGeneration = useCallback(async () => {
    setErrorMessage(null);
    setSensitiveWord(false);
    setTracks([]);
    setStatus("PENDING");
    hasRevealedRef.current = false;
    setPhase("generating");
    setLiveMessage("Creating your song. This usually takes under a minute.");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wizard),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json?.error || "Something went wrong. Please try again.");
      }
      setTaskId(json.taskId);
      beginPolling(json.taskId);
    } catch (err: any) {
      setErrorMessage(err?.message || "Something went wrong. Please try again.");
      setPhase("error");
      setLiveMessage("We couldn't start your song.");
    }
  }, [wizard, beginPolling]);

  const retry = useCallback(() => {
    // No endpoint to resume a prior job — start a fresh generation with the
    // same wizard answers.
    startGeneration();
  }, [startGeneration]);

  const resetAll = useCallback(() => {
    clearPolling();
    hasRevealedRef.current = false;
    setWizard(INITIAL_WIZARD);
    setStep(0);
    setTaskId(null);
    setStatus("PENDING");
    setTracks([]);
    setSelectedVariant(0);
    setErrorMessage(null);
    setSensitiveWord(false);
    setPhase("wizard");
    setLiveMessage("");
  }, [clearPolling]);

  const canAdvance = (() => {
    if (step === 0) return wizard.occasion.trim().length > 0;
    if (step === 1) return wizard.recipient.trim().length > 0;
    if (step === 2) return wizard.vibe.trim().length > 0;
    return true;
  })();

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      startGeneration();
    }
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setWizard((w) => ({ ...w, [key]: value }));
  };

  const activeTrack = tracks[selectedVariant] || tracks[0] || null;
  const stillFinishing = status !== "SUCCESS" && phase === "reveal";

  return (
    <div className="app">
      <div className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </div>

      <header className="brand">
        <span className="brand-mark">
          Anth<span>em</span>
        </span>
        <span className="brand-tagline">Be your own favorite artist</span>
      </header>

      <main className="stage">
        {phase === "wizard" && (
          <WizardCard
            step={step}
            wizard={wizard}
            update={update}
            canAdvance={canAdvance}
            onNext={goNext}
            onBack={goBack}
          />
        )}

        {phase === "generating" && (
          <GeneratingCard message={GENERATING_MESSAGES[messageIndex]} />
        )}

        {phase === "error" && (
          <ErrorCard
            message={errorMessage || "Something went wrong. Please try again."}
            onRetry={retry}
            onStartOver={resetAll}
          />
        )}

        {phase === "reveal" && activeTrack && (
          <RevealCard
            tracks={tracks}
            activeTrack={activeTrack}
            selectedVariant={selectedVariant}
            onSelectVariant={setSelectedVariant}
            stillFinishing={stillFinishing}
            onCreateAnother={resetAll}
          />
        )}
      </main>

      <p className="footnote">
        Your song is yours to keep and share — always private unless you choose
        to share it.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

function WizardCard({
  step,
  wizard,
  update,
  canAdvance,
  onNext,
  onBack,
}: {
  step: number;
  wizard: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  canAdvance: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="card phase-enter">
      <div className="progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-label={`Step ${step + 1} of ${TOTAL_STEPS}`}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span
            key={i}
            className={
              "progress-dot" +
              (i < step ? " is-filled" : i === step ? " is-current" : "")
            }
          />
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canAdvance) onNext();
        }}
      >
        {step === 0 && (
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="step-eyebrow">Step 1 of {TOTAL_STEPS}</legend>
            <h1 className="step-title">What's the occasion?</h1>
            <p className="step-help">
              Tell us what you're celebrating — this shapes the whole song.
            </p>

            <div className="field">
              <label className="field-label" htmlFor="occasion">
                Occasion
              </label>
              <input
                id="occasion"
                className="text-input"
                type="text"
                placeholder="e.g. Her 30th birthday"
                value={wizard.occasion}
                onChange={(e) => update("occasion", e.target.value)}
                autoFocus
              />
              <div className="chip-row" role="group" aria-label="Occasion presets">
                {OCCASION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={
                      "chip" + (wizard.occasion === preset ? " is-selected" : "")
                    }
                    aria-pressed={wizard.occasion === preset}
                    onClick={() => update("occasion", preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="step-eyebrow">Step 2 of {TOTAL_STEPS}</legend>
            <h1 className="step-title">Who is this song for?</h1>
            <p className="step-help">
              A name or a few words about them — whatever feels right.
            </p>

            <div className="field">
              <label className="field-label" htmlFor="recipient">
                Recipient
              </label>
              <input
                id="recipient"
                className="text-input"
                type="text"
                placeholder="e.g. My sister Maya"
                value={wizard.recipient}
                onChange={(e) => update("recipient", e.target.value)}
                autoFocus
              />
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="step-eyebrow">Step 3 of {TOTAL_STEPS}</legend>
            <h1 className="step-title">What vibe are you going for?</h1>
            <p className="step-help">
              Describe the feeling in your own words, or pick a starting point.
            </p>

            <div className="field">
              <label className="field-label" htmlFor="vibe">
                Vibe
              </label>
              <input
                id="vibe"
                className="text-input"
                type="text"
                placeholder="e.g. Fun, warm, a little silly"
                value={wizard.vibe}
                onChange={(e) => update("vibe", e.target.value)}
                autoFocus
              />
              <div className="chip-row" role="group" aria-label="Vibe presets">
                {VIBE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={
                      "chip" + (wizard.vibe === preset ? " is-selected" : "")
                    }
                    aria-pressed={wizard.vibe === preset}
                    onClick={() => update("vibe", preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="step-eyebrow">Step 4 of {TOTAL_STEPS}</legend>
            <h1 className="step-title">Any final touches?</h1>
            <p className="step-help">
              Optional — add a memory to weave in, and pick a few extras.
            </p>

            <div className="field">
              <label className="field-label" htmlFor="details">
                Details or memories{" "}
                <span className="field-optional">(optional)</span>
              </label>
              <textarea
                id="details"
                className="textarea"
                placeholder="e.g. Our road trip to the coast, her love of golden retrievers…"
                value={wizard.details}
                onChange={(e) => update("details", e.target.value)}
              />
            </div>

            <div className="field">
              <div className="toggle-row">
                <div className="toggle-copy">
                  <span className="field-label" id="instrumental-label">
                    Instrumental only
                  </span>
                  <p className="hint">No vocals — just music.</p>
                </div>
                <button
                  type="button"
                  className={"switch" + (wizard.instrumental ? " is-on" : "")}
                  role="switch"
                  aria-checked={wizard.instrumental}
                  aria-labelledby="instrumental-label"
                  onClick={() => update("instrumental", !wizard.instrumental)}
                >
                  <span className="switch-knob" />
                </button>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="model">
                Creative engine
              </label>
              <div className="select-wrap">
                <select
                  id="model"
                  className="select"
                  value={wizard.model}
                  onChange={(e) => update("model", e.target.value as SunoModel)}
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="hint">
                Not sure? The recommended default gives great results.
              </p>
            </div>
          </fieldset>
        )}

        <div className="step-actions">
          {step === TOTAL_STEPS - 1 ? (
            <button type="submit" className="btn btn-primary" disabled={!canAdvance}>
              Create my song
            </button>
          ) : (
            <div className="btn-row">
              {step > 0 && (
                <button type="button" className="btn btn-ghost" onClick={onBack}>
                  Back
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={!canAdvance}>
                Next
              </button>
            </div>
          )}
        </div>

        {step > 0 && step === TOTAL_STEPS - 1 && (
          <div className="btn-row" style={{ marginTop: "12px" }}>
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              Back
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generating
// ---------------------------------------------------------------------------

function GeneratingCard({ message }: { message: string }) {
  return (
    <div className="card generating phase-enter">
      <div className="orb" aria-hidden="true">
        <div className="orb-ring" />
        <div className="orb-ring orb-ring-2" />
        <div className="orb-core" />
      </div>
      <h1 className="generating-title">Creating your song…</h1>
      <p className="generating-message" key={message}>
        {message}
      </p>
      <p className="generating-note">
        This usually takes 30–90 seconds. Stay on this page — we'll reveal your
        song the moment it's ready.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

function ErrorCard({
  message,
  onRetry,
  onStartOver,
}: {
  message: string;
  onRetry: () => void;
  onStartOver: () => void;
}) {
  return (
    <div className="card phase-enter">
      <h1 className="step-title">We hit a snag</h1>
      <p className="step-help" style={{ marginBottom: "20px" }}>
        {message}
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onStartOver}>
          Start over
        </button>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reveal
// ---------------------------------------------------------------------------

function RevealCard({
  tracks,
  activeTrack,
  selectedVariant,
  onSelectVariant,
  stillFinishing,
  onCreateAnother,
}: {
  tracks: Track[];
  activeTrack: Track;
  selectedVariant: number;
  onSelectVariant: (i: number) => void;
  stillFinishing: boolean;
  onCreateAnother: () => void;
}) {
  const playableTracks = tracks.filter((t) => t.streamAudioUrl || t.audioUrl);
  const src = activeTrack.streamAudioUrl || activeTrack.audioUrl || "";

  return (
    <div className="card reveal phase-enter">
      <span className="reveal-eyebrow">Your song is ready</span>

      <div className="reveal-cover-wrap">
        {activeTrack.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="reveal-cover"
            src={activeTrack.imageUrl}
            alt={`Cover art for ${activeTrack.title}`}
          />
        ) : (
          <div className="reveal-cover-fallback" aria-hidden="true">
            🎁
          </div>
        )}
      </div>

      <h1 className="reveal-title">{activeTrack.title || "Your song"}</h1>
      <p className="reveal-subtitle">
        {stillFinishing
          ? "The first cut is ready to play — a fuller version is still finishing up."
          : "It's finished — yours to keep and share, whenever you're ready."}
      </p>

      {playableTracks.length > 1 && (
        <div className="variant-row" role="group" aria-label="Song versions">
          {tracks.map((t, i) =>
            t.streamAudioUrl || t.audioUrl ? (
              <button
                key={t.id || i}
                type="button"
                className={
                  "variant-btn" + (i === selectedVariant ? " is-selected" : "")
                }
                aria-pressed={i === selectedVariant}
                onClick={() => onSelectVariant(i)}
              >
                Version {i + 1}
              </button>
            ) : null
          )}
        </div>
      )}

      <div className="reveal-player">
        <audio controls src={src}>
          Your browser doesn't support inline audio playback. Use the download
          link below instead.
        </audio>
      </div>

      <p className="reveal-keepsake">
        This song is yours to keep and share — it stays private to you unless
        you decide to share it.
      </p>

      <div className="reveal-actions">
        {activeTrack.audioUrl && (
          <a
            className="download-link"
            href={activeTrack.audioUrl}
            download
            aria-label={`Download ${activeTrack.title || "your song"}`}
          >
            Download song
          </a>
        )}
        <button type="button" className="btn btn-primary" onClick={onCreateAnother}>
          Create another
        </button>
      </div>
    </div>
  );
}
