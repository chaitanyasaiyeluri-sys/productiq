/**
 * The AI processing contract.
 *
 * The language model must return strict structured JSON matching the Product
 * schema. This module defines that contract with zod, validates the raw LLM
 * reply against it, and converts the validated result into the canonical
 * field_metadata object used everywhere in ProductIQ.
 *
 * Reliability rules (enforced both in the prompt and deterministically):
 *  - Technical specs are never ai_generated; unsupported guesses become unknown
 *  - Every original field must have a verifiable source snippet
 *  - Every ai_inferred field must have evidence and explanation
 *  - Missing evidence → unknown, never a plausible guess
 */
import { z } from "zod";
import type {
  FieldKey,
  FieldMetadata,
  FieldMetadataEntry,
  SourceKind,
} from "./types";
import { FIELD_KEYS } from "./types";
import { formatDimensions, formatWeight } from "./scoring";

const sourceKindSchema = z.enum([
  "original",
  "ai_generated",
  "ai_inferred",
  "unknown",
]);

const fieldMetaSchema = z.object({
  source: sourceKindSchema,
  confidence: z.number().min(0).max(100),
  /** Exact substring of the source text supporting this value, or null. */
  snippet: z.string().nullable(),
  /** Concise user-facing justification for this value. */
  explanation: z.string().nullable(),
});

export const llmResponseSchema = z.object({
  productName: z.string().nullable(),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  material: z.string().nullable(),
  dimensions: z
    .object({
      length: z.coerce.number().nullable(),
      width: z.coerce.number().nullable(),
      height: z.coerce.number().nullable(),
      unit: z.string().nullable(),
    })
    .nullable(),
  weight: z
    .object({
      value: z.coerce.number().nullable(),
      unit: z.string().nullable(),
    })
    .nullable(),
  voltageRating: z.string().nullable(),
  certifications: z.array(z.string()),
  otherSpecs: z.record(z.string(), z.string()),
  descriptionShort: z.string().nullable(),
  descriptionDetailed: z.string().nullable(),
  searchKeywords: z.array(z.string()),
  fieldMetadata: z.object({
    productName: fieldMetaSchema,
    category: fieldMetaSchema,
    subcategory: fieldMetaSchema,
    material: fieldMetaSchema,
    dimensions: fieldMetaSchema,
    weight: fieldMetaSchema,
    voltageRating: fieldMetaSchema,
    certifications: fieldMetaSchema,
  }),
  /** Places where the source text states different values for the same field. */
  conflicts: z.array(
    z.object({
      field: z.string(),
      values: z.array(z.string()),
      snippets: z.array(z.string()),
    }),
  ),
});

export type LlmResponse = z.infer<typeof llmResponseSchema>;

const AI_SYSTEM_PROMPT = `You are ProductIQ, an expert industrial product data analyst working for a B2B catalog intelligence platform. You transform raw, incomplete industrial product information into structured, grounded, commerce-ready product data.

=== CRITICAL RELIABILITY RULES (MANDATORY — VIOLATION IS A BUG) ===

1. NEVER FABRICATE A TECHNICAL SPECIFICATION that is not directly supported by the provided source data. If the source does not mention a value, the field MUST be null with source "unknown".

2. NEVER GUESS, COMPLETE, or SUPPLY a technical value because it is "common" for that product type. ProductIQ marks missing evidence as unknown — it does not fill gaps with assumptions.

3. NEVER INFER A NUMERICAL SPECIFICATION (load capacity, pressure rating, current, speed, etc.) without explicit evidence in the source text. If the number does not appear in the source, set the field to null and source to "unknown".

4. EVERY FIELD must be classified exactly as one of:
   - "original" — directly stated in the source text, with the exact verbatim snippet
   - "ai_inferred" — logically derived from source evidence (e.g. category from product name), with explanation of derivation
   - "ai_generated" — ONLY for commercial copy (descriptions, titles, keywords), NEVER for technical specifications
   - "unknown" — no supporting evidence found; value must be null

5. IF THE SOURCE DOES NOT SUPPORT A VALUE: return null for the value and "unknown" for the source. This is the correct behavior, not a failure.

6. NEVER present an inferred value as an original manufacturer specification.

7. PRESERVE SOURCE WORDING for snippets — use exact verbatim substrings from the source text, character-for-character. Do not paraphrase or reconstruct.

8. EVIDENCE SNIPPETS for "original" fields MUST be exact substrings that can be found verbatim in the source text. If you cannot extract an exact substring, the field is not "original".

=== FIELD RULES ===

TECHNICAL SPECIFICATIONS (material, dimensions, weight, voltage_rating, certifications):
- Allowed sources: "original", "ai_inferred" (with evidence), "unknown"
- NEVER use "ai_generated" for these fields
- If uncertain, use "unknown" with null value

COMMERCIAL CONTENT (description_short, description_detailed, search_keywords):
- Allowed sources: "ai_generated", "unknown"
- These are your generated copy — clearly labeled as such

IDENTIFICATION (product_name, category, subcategory):
- product_name: "original" if directly from source
- category: "ai_inferred" — derived from product name/type against the taxonomy
- subcategory: "ai_inferred" if derived from context

=== EXAMPLES OF CORRECT BEHAVIOR ===

Source: "SKF 6205-2RS1 deep groove ball bearing, sealed both sides. Bore 25 mm, OD 52 mm, width 15 mm."
- material: null, source "unknown" ← source does not mention material
- dimensions: {25, 52, 15, "mm"}, source "original", snippet "Bore 25 mm, OD 52 mm, width 15 mm"
- load_capacity: null, source "unknown" ← source does not mention load capacity

Source: "Chrome steel rings and balls."
- material: "Chrome steel", source "original", snippet "Chrome steel rings and balls"

=== EXAMPLES OF INCORRECT BEHAVIOR (NEVER DO THIS) ===

WRONG: material: "Chrome steel", source "original" ← when source only says "SKF bearing" (fabricated)
WRONG: load_capacity: "14.8 kN", source "ai_inferred" ← when source has no load data (hallucinated)
WRONG: dimensions: {25, 52, 15, "mm"}, source "ai_generated" ← technical spec labeled as generated (wrong category)

=== CATEGORIES ===
Bearings, Electric Motors, Pumps, Valves, Industrial Sensors, Electrical Components, Power Supplies, Pneumatic Components. Choose the closest match.

=== UNITS ===
Keep units exactly as stated. Do not convert. Unit validation happens downstream.

=== CONFLICTS ===
If the source contains conflicting values for the same field, list it in "conflicts" with the differing values and their verbatim snippets.

=== OUTPUT ===
Return ONLY a single valid JSON object matching the schema. No markdown, no commentary, no extra text.

{
  "productName": string|null,
  "category": string|null,
  "subcategory": string|null,
  "material": string|null,
  "dimensions": {"length": number|null, "width": number|null, "height": number|null, "unit": string|null} | null,
  "weight": {"value": number|null, "unit": string|null} | null,
  "voltageRating": string|null,
  "certifications": string[],
  "otherSpecs": {"key": "value"},
  "descriptionShort": string|null,
  "descriptionDetailed": string|null,
  "searchKeywords": string[],
  "fieldMetadata": {
    "productName": {"source": "original"|"ai_generated"|"ai_inferred"|"unknown", "confidence": 0-100, "snippet": string|null, "explanation": string|null},
    "category": {...}, "subcategory": {...}, "material": {...}, "dimensions": {...}, "weight": {...}, "voltageRating": {...}, "certifications": {...}
  },
  "conflicts": [{"field": string, "values": [string], "snippets": [string]}]
}`;

export function buildUserPrompt(rawInputText: string): string {
  return `Here is the raw product information to analyze. It may be messy, incomplete, or contain errors.

<source_text>
${rawInputText}
</source_text>

Analyze this text and return the structured JSON per the schema in your system instructions.
REMEMBER:
- Only return JSON.
- If a field is not supported by the source, set it to null with source "unknown".
- Never guess technical values. Missing evidence = unknown.
- Technical specifications must NEVER be classified as "ai_generated".`;
}

export function getAiSystemPrompt(): string {
  return AI_SYSTEM_PROMPT;
}

/** Keys where "ai_generated" is never allowed — a generated value must never
 *  be presented as a manufacturer specification. These are downgraded to
 *  "unknown" (not ai_inferred) to prevent hallucinated specs from looking
 *  trustworthy. */
const TECHNICAL_KEYS: FieldKey[] = [
  "material",
  "dimensions",
  "weight",
  "voltageRating",
  "certifications",
];

export function buildFieldMetadata(result: LlmResponse): FieldMetadata {
  const mk = (
    key: FieldKey,
    value: string | number | string[] | null,
  ): FieldMetadataEntry => {
    const meta = result.fieldMetadata[key];
    let source: SourceKind = meta.source;
    let confidence = Math.round(meta.confidence);

    // RULE: Technical specifications must NEVER be ai_generated.
    // If the model labeled a technical field as generated, it means the
    // value is not grounded in evidence — mark it unknown, not inferred.
    if (TECHNICAL_KEYS.includes(key) && source === "ai_generated") {
      source = "unknown";
      confidence = 0;
    }

    const empty =
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);
    if (empty) {
      return {
        value: null,
        source: "unknown",
        confidence: 0,
        sourceTextSnippet: null,
        sourceDocument: null,
        explanation: null,
      };
    }

    // RULE: ai_inferred fields must have supporting evidence.
    // If the model says inferred but provides no snippet and no explanation,
    // downgrade to unknown — we cannot verify the inference.
    if (source === "ai_inferred" && !meta.snippet && !meta.explanation) {
      source = "unknown";
      confidence = 0;
    }

    return {
      value,
      source,
      confidence,
      sourceTextSnippet: meta.snippet,
      sourceDocument: null,
      explanation: meta.explanation,
    };
  };

  return {
    productName: mk("productName", result.productName),
    category: mk("category", result.category),
    subcategory: mk("subcategory", result.subcategory),
    material: mk("material", result.material),
    dimensions: mk("dimensions", formatDimensions(result.dimensions)),
    weight: mk("weight", formatWeight(result.weight)),
    voltageRating: mk("voltageRating", result.voltageRating),
    certifications: mk("certifications", result.certifications),
  };
}

/**
 * Deterministic evidence verification.
 *
 * For every field in the metadata:
 *  - "original" → verify the snippet exists verbatim in the source. If not,
 *    downgrade to "ai_inferred" and cap confidence.
 *  - "ai_inferred" → if there is no snippet AND no explanation, the inference
 *    is unsupported → downgrade to "unknown".
 *  - "ai_generated" on a technical key → downgrade to "unknown" (belt &
 *    suspenders with buildFieldMetadata).
 *  - "unknown" → unchanged.
 *
 * This function never trusts the LLM's source label at face value.
 */
export function verifySnippets(
  metadata: FieldMetadata,
  rawInputText: string,
): FieldMetadata {
  const normalizedRaw = rawInputText.toLowerCase().replace(/\s+/g, " ").trim();
  const next: FieldMetadata = { ...metadata };
  for (const key of FIELD_KEYS) {
    const entry = metadata[key];

    // Rule: ai_generated on a technical key → unknown (defensive)
    if (TECHNICAL_KEYS.includes(key) && entry.source === "ai_generated") {
      next[key] = {
        ...entry,
        source: "unknown",
        confidence: 0,
        sourceTextSnippet: null,
        explanation:
          "AI-generated technical specifications are not allowed — no evidence found.",
      };
      continue;
    }

    // Rule: ai_inferred without evidence → unknown
    if (
      entry.source === "ai_inferred" &&
      !entry.sourceTextSnippet &&
      !entry.explanation
    ) {
      next[key] = {
        ...entry,
        source: "unknown",
        confidence: 0,
        sourceTextSnippet: null,
        explanation:
          "No supporting evidence or derivation explanation found — marked unknown.",
      };
      continue;
    }

    if (!entry.sourceTextSnippet) continue;
    const normalizedSnippet = entry.sourceTextSnippet
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!normalizedRaw.includes(normalizedSnippet)) {
      // Snippet not found verbatim — the claimed evidence is fabricated.
      next[key] = {
        ...entry,
        sourceTextSnippet: null,
        source: entry.source === "original" ? "ai_inferred" : entry.source,
        confidence: Math.min(entry.confidence, 60),
        explanation:
          "The claimed source excerpt could not be matched verbatim to the input text, so this value is treated as inferred rather than original.",
      };
    }
  }
  return next;
}
