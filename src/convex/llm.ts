/**
 * LLM client for the ProductIQ pipeline.
 *
 * Talks to Google Gemini's Interactions API (POST /v1beta/interactions) with
 * JSON response format enabled. By default this uses gemini-3.6-flash, the
 * current generation of the Flash line; the endpoint and model can be
 * overridden through GEMINI_BASE_URL and LLM_MODEL so a stronger or cheaper
 * model can be swapped in later without code changes.
 *
 * The API key is read from process.env.GEMINI_API_KEY, which is injected by
 * the Freebuff Keys UI into the Convex runtime.
 */

export class LlmError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-3.6-flash";
const DEFAULT_TIMEOUT_MS = 90_000;

interface LlmResult {
  content: string;
  model: string;
}

/**
 * Calls the LLM and returns the raw text content of the assistant reply.
 * The caller is responsible for parsing and validating the JSON.
 */
export async function callLlmForJson(
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

  const baseUrl = (process.env.GEMINI_BASE_URL ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const model = process.env.LLM_MODEL ?? DEFAULT_MODEL;

  const attempt = async (): Promise<LlmResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
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
          // Plain JSON mode (no schema): pinning a schema here can make the
          // model "comply" by returning an empty object, which fails the
          // ProductIQ schema validation downstream.
          response_format: [
            {
              type: "text",
              mime_type: "application/json",
            },
          ],
          generation_config: {
            max_output_tokens: 4096,
            thinking_level: "minimal",
          },
          // One-shot call: keep the interaction stateless so nothing is
          // retained server-side for multi-turn follow-ups we never use.
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
        `Network error while calling the language model: ${error instanceof Error ? error.message : String(error)}`,
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
        // ignore body parsing failures
      }
      const status = response.status;
      const retriable =
        status >= 500 ||
        status === 429 ||
        status === 408 ||
        status === 401 ||
        status === 403;
      const message =
        detail ||
        `The Gemini API returned HTTP ${status}.`;
      throw new LlmError(
        retriable ? "llm_api_error" : "llm_api_error",
        message,
      );
    }

    const data = (await response.json()) as {
      model?: string;
      steps?: {
        type?: string;
        content?: { type?: string; text?: string }[];
      }[];
    };
    // The final answer is the last model_output step of the interaction
    // timeline; join its text items in order. Earlier steps can carry
    // thoughts or intermediate text that would corrupt the JSON.
    const outputSteps =
      data.steps?.filter((step) => step.type === "model_output") ?? [];
    const content =
      (outputSteps[outputSteps.length - 1]?.content ?? [])
        .filter((item) => item.type === "text")
        .map((item) => item.text ?? "")
        .join("")
        .trim() ?? "";
    if (content === "") {
      throw new LlmError(
        "invalid_llm_json",
        "The language model returned an empty response.",
      );
    }
    return { content, model: data.model ?? model };
  };

  // One retry for transient network failures (5xx / 429 / connection errors).
  try {
    return await attempt();
  } catch (error) {
    if (error instanceof LlmError && error.code === "llm_api_error") {
      return await attempt();
    }
    throw error;
  }
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
