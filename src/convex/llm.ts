/**
 * LLM client for the ProductIQ pipeline.
 *
 * Supports two providers selected via the LLM_PROVIDER env var:
 *
 *   groq  (default) — OpenAI-compatible chat completions API
 *   gemini          — Google Gemini Interactions API
 *
 * The provider and model can be overridden through environment variables
 * set in the Convex Keys UI:
 *
 *   LLM_PROVIDER  — "groq" or "gemini"
 *   LLM_MODEL     — model ID (provider-specific default if omitted)
 *   GROQ_API_KEY  — required when provider = groq
 *   GEMINI_API_KEY — required when provider = gemini
 *   GEMINI_BASE_URL — optional Gemini endpoint override
 *
 * Security: all API keys are read server-side from process.env.
 * The callLlmForJson function returns the provider name so the UI
 * can display which LLM backend produced the result.
 */

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class LlmError extends Error {
  code: string;
  retriable: boolean;
  retryAfterMs: number | null;
  /** Whether a hard quota limit was hit (should pause, not retry). */
  quotaExhausted: boolean;

  constructor(
    code: string,
    message: string,
    retriable = false,
    retryAfterMs: number | null = null,
    quotaExhausted = false,
  ) {
    super(message);
    this.code = code;
    this.retriable = retriable;
    this.retryAfterMs = retryAfterMs;
    this.quotaExhausted = quotaExhausted;
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type LlmProvider = "groq" | "gemini";

export interface LlmResult {
  content: string;
  model: string;
  provider: LlmProvider;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export const AVAILABLE_MODELS: Record<LlmProvider, { id: string; label: string }[]> = {
  groq: [
    { id: "openai/gpt-oss-120b", label: "OpenAI GPT-OSS 120B" },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
  ],
  gemini: [
    { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
    { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  ],
};

export function getConfiguredProvider(): LlmProvider {
  const raw = (process.env.LLM_PROVIDER ?? "groq").toLowerCase().trim();
  return raw === "gemini" ? "gemini" : "groq";
}

export function getConfiguredModel(provider: LlmProvider): string {
  if (process.env.LLM_MODEL?.trim()) return process.env.LLM_MODEL.trim();
  return provider === "groq" ? "openai/gpt-oss-120b" : "gemini-3.7-flash";
}

// ---------------------------------------------------------------------------
// Retry / backoff helpers
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableStatus(status: number): boolean {
  return [429, 500, 502, 503, 504, 408].includes(status);
}

function isQuotaExhausted(status: number, message: string): boolean {
  // Hard quota / billing limit — do not retry.
  if (status === 402) return true;
  if (status === 429 && /quota|exceed|limit.*daily|limit.*monthly/i.test(message)) return true;
  // Groq: request too large for model (TPM limit exceeded)
  if (/request.*too.*large|TPM.*limit|requested.*exceeds/i.test(message)) return true;
  return false;
}

function parseRetryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

// ---------------------------------------------------------------------------
// Groq provider (OpenAI-compatible chat completions)
// ---------------------------------------------------------------------------

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
): Promise<LlmResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new LlmError(
      "missing_api_key",
      "The Groq API key is not configured. Add GROQ_API_KEY in the project's Keys/API keys tab, then run the pipeline again.",
    );
  }

  const model = getConfiguredModel("groq");
  const baseUrl = "https://api.groq.com/openai/v1";

  const attempt = async (): Promise<LlmResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_completion_tokens: 4096,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new LlmError(
          "llm_timeout",
          "The language model request timed out after 90 seconds. Try again, or check that the model endpoint is reachable.",
        );
      }
      throw new LlmError(
        "llm_api_error",
        `Network error while calling Groq: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as {
          error?: { message?: string; type?: string; code?: string };
        };
        detail = body.error?.message ?? "";
      } catch {
        // ignore
      }

      const status = response.status;
      const retriable = isRetriableStatus(status);
      const quotaExhausted = isQuotaExhausted(status, detail);
      const retryAfterMs = retriable ? parseRetryAfterMs(response) : null;
      const message = detail || `Groq API returned HTTP ${status}.`;

      throw new LlmError("llm_api_error", message, retriable, retryAfterMs, quotaExhausted);
    }

    const data = (await response.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      throw new LlmError(
        "invalid_llm_json",
        `Groq returned an empty response. Raw response snippet: ${JSON.stringify(data).slice(0, 500)}`,
      );
    }

    return {
      content,
      model: data.model ?? model,
      provider: "groq" as const,
      usage: data.usage,
    };
  };

  // Exponential backoff with jitter for transient failures.
  let lastError: unknown;
  for (let attemptNum = 0; attemptNum <= MAX_RETRIES; attemptNum++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      const retriable = error instanceof LlmError && error.retriable;
      const quotaExhausted = error instanceof LlmError && error.quotaExhausted;

      // Hard quota: do not retry.
      if (quotaExhausted) throw error;
      if (!retriable || attemptNum === MAX_RETRIES) throw error;

      const retryAfterMs =
        error instanceof LlmError ? error.retryAfterMs : null;
      const delay = retryAfterMs != null
        ? Math.min(retryAfterMs + Math.random() * 1_000, MAX_DELAY_MS)
        : Math.min(
            BASE_DELAY_MS * Math.pow(2, attemptNum) + Math.random() * 1_000,
            MAX_DELAY_MS,
          );
      await sleep(delay);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Gemini provider (Interactions API)
// ---------------------------------------------------------------------------

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
): Promise<LlmResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new LlmError(
      "missing_api_key",
      "The Gemini API key is not configured. Add GEMINI_API_KEY in the project's Keys/API keys tab, then run the pipeline again.",
    );
  }

  const baseUrl = (process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const model = getConfiguredModel("gemini");

  const attempt = async (): Promise<LlmResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model,
          input: userPrompt,
          system_instruction: systemPrompt,
          response_format: [{ type: "text", mime_type: "application/json" }],
          generation_config: {
            max_output_tokens: 16384,
            thinking_level: "minimal",
          },
          store: false,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new LlmError(
          "llm_timeout",
          "The language model request timed out after 90 seconds. Try again, or check that the model endpoint is reachable.",
        );
      }
      throw new LlmError(
        "llm_api_error",
        `Network error while calling Gemini: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as {
          error?: { message?: string; status?: string };
        };
        detail = body.error?.message ?? "";
      } catch {
        // ignore
      }

      const status = response.status;
      const retriable = isRetriableStatus(status);
      const quotaExhausted = isQuotaExhausted(status, detail);
      const retryAfterMs = retriable ? parseRetryAfterMs(response) : null;
      const message = detail || `Gemini API returned HTTP ${status}.`;

      throw new LlmError("llm_api_error", message, retriable, retryAfterMs, quotaExhausted);
    }

    const rawBody = await response.json();
    const data = rawBody as Record<string, unknown> & {
      model?: string;
      steps?: {
        type?: string;
        content?: { type?: string; text?: string }[];
      }[];
    };

    // --- Content extraction with multiple fallbacks ---
    let content = "";

    // Primary: Interactions API steps array
    const steps = data.steps;
    if (Array.isArray(steps)) {
      const outputSteps = steps.filter(
        (step) => (step as { type?: string }).type === "model_output",
      );
      const lastStep = outputSteps[outputSteps.length - 1] as
        | { content?: { type?: string; text?: string }[] }
        | undefined;
      content =
        (lastStep?.content ?? [])
          .filter((item) => item.type === "text")
          .map((item) => item.text ?? "")
          .join("")
          .trim() ?? "";
    }

    // Fallback 1: top-level "output" / "result" / "text" string
    if (!content) {
      const fallback =
        typeof data.output === "string"
          ? data.output
          : typeof data.result === "string"
            ? data.result
            : typeof data.text === "string"
              ? data.text
              : "";
      if (fallback.trim()) content = fallback.trim();
    }

    // Fallback 2: entire response IS the text
    if (!content && typeof rawBody === "string") {
      content = rawBody.trim();
    }

    if (content === "") {
      const snippet = JSON.stringify(rawBody).slice(0, 500);
      throw new LlmError(
        "invalid_llm_json",
        `Gemini returned an empty response. Raw API response snippet: ${snippet}`,
      );
    }

    return { content, model: data.model ?? model, provider: "gemini" as const };
  };

  // Exponential backoff with jitter for transient failures.
  let lastError: unknown;
  for (let attemptNum = 0; attemptNum <= MAX_RETRIES; attemptNum++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      const retriable = error instanceof LlmError && error.retriable;
      const quotaExhausted = error instanceof LlmError && error.quotaExhausted;

      if (quotaExhausted) throw error;
      if (!retriable || attemptNum === MAX_RETRIES) throw error;

      const retryAfterMs =
        error instanceof LlmError ? error.retryAfterMs : null;
      const delay = retryAfterMs != null
        ? Math.min(retryAfterMs + Math.random() * 1_000, MAX_DELAY_MS)
        : Math.min(
            BASE_DELAY_MS * Math.pow(2, attemptNum) + Math.random() * 1_000,
            MAX_DELAY_MS,
          );
      await sleep(delay);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calls the configured LLM and returns the raw text content of the assistant
 * reply, plus which provider and model produced it.
 *
 * The caller is responsible for parsing and validating the JSON.
 */
export async function callLlmForJson(
  systemPrompt: string,
  userPrompt: string,
): Promise<LlmResult> {
  const provider = getConfiguredProvider();
  if (provider === "groq") {
    return callGroq(systemPrompt, userPrompt);
  }
  return callGemini(systemPrompt, userPrompt);
}

/** Extracts a JSON object from an LLM reply, tolerating markdown fences. */
export function extractJsonObject(content: string): Record<string, unknown> {
  let text = content.trim();
  // Strip ```json ... ``` fences if present.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new LlmError(
      "invalid_llm_json",
      "The language model did not return a JSON object. The reply could not be parsed.",
    );
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new LlmError(
      "invalid_llm_json",
      `The language model returned invalid JSON (${error instanceof Error ? error.message : String(error)}). No data was saved.`,
    );
  }
}
