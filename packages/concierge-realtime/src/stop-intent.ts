import type {
  RealtimeStopIntentClassifier,
  StopIntentOptions,
} from "./types.js";

const DEFAULT_PHRASES: ReadonlyArray<string> = Object.freeze([
  "stop",
  "stop it",
  "cancel",
  "cancel that",
  "never mind",
  "nevermind",
  "hold on",
  "wait",
  "that's enough",
]);

const DEFAULT_FILLERS: ReadonlyArray<string> = Object.freeze([
  "uh",
  "um",
  "er",
  "ah",
  "well",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTranscript(transcript: string): string {
  return transcript
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripLeadingFillers(text: string, fillers: ReadonlyArray<string>): string {
  if (fillers.length === 0) return text;
  const pattern: RegExp = new RegExp(
    `^(?:${fillers.map(escapeRegExp).join("|")})\\b[^\\p{L}\\p{N}]*`,
    "iu",
  );
  let current: string = text;
  for (let step: number = 0; step < 8; step += 1) {
    const next: string = current.replace(pattern, "").trim();
    if (next === current) break;
    current = next;
  }
  return current;
}

/** Matches only a whole committed transcript, never a partial prefix. */
export function createStopIntentClassifier(
  options?: StopIntentOptions,
): RealtimeStopIntentClassifier {
  const phrases: ReadonlyArray<string> = options?.phrases ?? DEFAULT_PHRASES;
  const fillers: ReadonlyArray<string> = options?.fillers ?? DEFAULT_FILLERS;
  const normalizedPhrases: ReadonlyArray<string> = Object.freeze(
    phrases
      .map((phrase) => phrase.trim().toLowerCase())
      .filter((phrase) => phrase.length > 0),
  );
  const matcher: RegExp | null =
    normalizedPhrases.length === 0
      ? null
      : new RegExp(
          `^(?:${normalizedPhrases.map(escapeRegExp).join("|")})$`,
          "u",
        );

  return (transcript: string): boolean => {
    if (matcher === null || typeof transcript !== "string") return false;
    const cleaned: string = stripLeadingFillers(
      normalizeTranscript(transcript),
      fillers,
    );
    return cleaned.length > 0 && matcher.test(cleaned);
  };
}
