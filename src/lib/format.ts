/** Shared frontend formatting helpers for ProductIQ. */

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(timestamp);
}

/** Renders a field-metadata value (string | number | array | null) as text. */
export function displayValue(
  value: string | number | string[] | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Short, human-friendly guidance for a pipeline error code. */
export const ERROR_GUIDANCE: Record<string, { title: string; hint: string }> = {
  missing_api_key: {
    title: "API key not configured",
    hint: "Add a GEMINI_API_KEY in the project's Keys/API keys tab, then retry the pipeline. No data was saved.",
  },
  llm_api_error: {
    title: "Language model request failed",
    hint: "The model provider rejected or could not reach the request. Check the API key and retry. No data was saved.",
  },
  llm_timeout: {
    title: "Language model timed out",
    hint: "The request took longer than 90 seconds. Retry — no data was saved.",
  },
  invalid_llm_json: {
    title: "Invalid model output",
    hint: "The model reply could not be parsed as JSON. Retry — no data was saved.",
  },
  schema_validation_failed: {
    title: "Schema validation failed",
    hint: "The model output did not match the ProductIQ schema, so the pipeline stopped instead of storing malformed data.",
  },
  empty_input: {
    title: "Empty input",
    hint: "Paste or upload product information before starting the pipeline.",
  },
};

export function errorGuidance(code: string | null | undefined) {
  return ERROR_GUIDANCE[code ?? ""] ?? {
    title: "Processing failed",
    hint: "The pipeline could not complete. Retry, or check the input text.",
  };
}

export const SCORE_COLOR = (score: number): string => {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-600";
};
