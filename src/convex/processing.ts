/**
 * ProductIQ AI processing pipeline.
 *
 * The Add Product flow creates a ProcessingJob (`start`), then the Processing
 * page runs the `process` action, which drives the visible stages:
 *
 *   Raw input → Extract → Enrich → Validate → Commerce → Score → Save
 *
 * The MVP performs the extraction/enrichment/commerce generation in a single
 * real LLM call (Google Gemini Interactions API with JSON response format),
 * but the job model exposes every stage separately so the UI can animate the
 * pipeline and surface per-stage state, progress, and errors.
 *
 * Reliability contract: the LLM reply is parsed and validated against a strict
 * zod schema before anything is saved. On any failure the job is marked
 * "failed" with a visible error code and message — the live flow never falls
 * back to fake or hardcoded results.
 *
 * Security: mutations verify the caller's identity. The process action uses
 * a server-side claim mechanism to prevent double-processing.
 */
import { v, ConvexError } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { PipelineStageState } from "./types";
import type { FinalizedProduct } from "./scoring";
import { ERROR_CODES, PIPELINE_STAGES } from "./types";
import { callLlmForJson, extractJsonObject, LlmError } from "./llm";
import {
  buildFieldMetadata,
  buildUserPrompt,
  getAiSystemPrompt,
  llmResponseSchema,
  verifySnippets,
} from "./aiPrompt";
import { buildOtherSpecsMetadata, finalizeProduct } from "./scoring";

// ---------------------------------------------------------------------------
// Job lifecycle
// ---------------------------------------------------------------------------

/** Creates a processing job for a raw product text. Returns the job id. */
export const start = mutation({
  args: { rawInputText: v.string(), inputName: v.string() },
  handler: async (ctx, { rawInputText, inputName }) => {
    // Verify the caller is authenticated.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("You must be signed in to process products.");
    }

    const text = rawInputText.trim();
    if (!text) {
      throw new ConvexError({
        code: ERROR_CODES.EMPTY_INPUT,
        message: "Paste some product information before starting the pipeline.",
      });
    }
    const now = Date.now();
    const jobId = await ctx.db.insert("processingJobs", {
      rawInputText: text,
      inputName: inputName.trim() || "Pasted text",
      status: "processing",
      currentStage: 0,
      stages: PIPELINE_STAGES.map((stage) => ({
        key: stage.key,
        label: stage.label,
        status: "pending" as const,
        detail: null,
      })),
      productId: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });
    return jobId;
  },
});

/** Reads a processing job (reactive subscription for the pipeline page). */
export const get = query({
  args: { jobId: v.id("processingJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

/** Resets a failed job so the pipeline can be retried. */
export const retry = mutation({
  args: { jobId: v.id("processingJobs") },
  handler: async (ctx, { jobId }) => {
    // Verify the caller is authenticated.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("You must be signed in to retry processing.");
    }

    const job = await ctx.db.get(jobId);
    if (!job) throw new ConvexError("Processing job not found.");

    // Only failed jobs can be retried.
    if (job.status !== "failed") {
      throw new ConvexError("Only failed jobs can be retried.");
    }

    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: "processing",
      currentStage: 0,
      stages: PIPELINE_STAGES.map((stage) => ({
        key: stage.key,
        label: stage.label,
        status: "pending" as const,
        detail: null,
      })),
      productId: null,
      errorCode: null,
      errorMessage: null,
      updatedAt: now,
    });
    return jobId;
  },
});

// ---------------------------------------------------------------------------
// Internal stage mutations (called from the action)
// ---------------------------------------------------------------------------

export const setStage = internalMutation({
  args: {
    jobId: v.id("processingJobs"),
    index: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("error"),
    ),
    detail: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { jobId, index, status, detail }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    const stages = job.stages.map((stage, i) =>
      i === index ? { ...stage, status, detail } : stage,
    );
    await ctx.db.patch(jobId, {
      stages,
      currentStage: index,
      updatedAt: Date.now(),
    });
  },
});

export const finish = internalMutation({
  args: { jobId: v.id("processingJobs"), productId: v.id("products") },
  handler: async (ctx, { jobId, productId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    await ctx.db.patch(jobId, {
      status: "succeeded",
      productId,
      updatedAt: Date.now(),
    });
  },
});

export const fail = internalMutation({
  args: {
    jobId: v.id("processingJobs"),
    errorCode: v.string(),
    errorMessage: v.string(),
    stageIndex: v.number(),
  },
  handler: async (ctx, { jobId, errorCode, errorMessage, stageIndex }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    const stages = job.stages.map((stage, i) =>
      i === stageIndex
        ? { ...stage, status: "error" as const, detail: errorMessage }
        : stage,
    );
    await ctx.db.patch(jobId, {
      status: "failed",
      stages,
      currentStage: stageIndex,
      errorCode,
      errorMessage,
      updatedAt: Date.now(),
    });
  },
});

/** Server-side claim: atomically transition a job from processing (stage 0
 *  pending) to "claimed". Returns true if this call won the race. */
export const claimJob = internalMutation({
  args: { jobId: v.id("processingJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return false;
    // Only claimable when: status=processing, stage 0 is pending, and no
    // prior claim has started the pipeline.
    if (job.status !== "processing") return false;
    if (job.currentStage !== 0) return false;
    if (job.stages[0]?.status !== "pending") return false;
    // Atomically mark stage 0 as "running" to claim the job.
    const stages = job.stages.map((stage, i) =>
      i === 0
        ? { ...stage, status: "running" as const, detail: "Claimed by pipeline" }
        : stage,
    );
    await ctx.db.patch(jobId, {
      stages,
      currentStage: 0,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const insertProduct = internalMutation({
  args: {
    rawInputText: v.string(),
    inputName: v.string(),
    productName: v.string(),
    category: v.string(),
    subcategory: v.string(),
    specs: v.any(),
    descriptionShort: v.string(),
    descriptionDetailed: v.string(),
    searchKeywords: v.array(v.string()),
    fieldMetadata: v.any(),
    otherSpecsMetadata: v.any(),
    validationFlags: v.any(),
    qualityScore: v.any(),
    status: v.string(),
    source: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, product) => {
    return await ctx.db.insert("products", product as never);
  },
});

// ---------------------------------------------------------------------------
// The pipeline action
// ---------------------------------------------------------------------------

function describeFlags(product: FinalizedProduct): string {
  const { validationFlags } = product;
  const parts: string[] = [];
  if (validationFlags.missingFields.length) {
    parts.push(`${validationFlags.missingFields.length} missing`);
  }
  if (validationFlags.conflictingValues.length) {
    parts.push(`${validationFlags.conflictingValues.length} conflicts`);
  }
  if (validationFlags.suspiciousValues.length) {
    parts.push(`${validationFlags.suspiciousValues.length} suspicious`);
  }
  if (validationFlags.unitInconsistencies.length) {
    parts.push(`${validationFlags.unitInconsistencies.length} unit issues`);
  }
  return parts.length ? parts.join(", ") : "no issues found";
}

/** Runs the full AI pipeline for a job, updating stages as it goes. */
export const process = action({
  args: { jobId: v.id("processingJobs") },
  handler: async (ctx, { jobId }) => {
    // --- Claim the job (server-side double-processing prevention) ----------
    const claimed = await ctx.runMutation(internal.processing.claimJob, {
      jobId,
    });
    if (!claimed) {
      // Another invocation already claimed this job — exit cleanly.
      return;
    }

    // Re-read the job after claiming to get the updated state.
    const job = await ctx.runQuery(api.processing.get, { jobId });
    if (!job) throw new ConvexError("Processing job not found.");

    const setStage = (index: number, status: string, detail: string | null) =>
      ctx.runMutation(internal.processing.setStage, {
        jobId,
        index,
        status: status as PipelineStageState["status"],
        detail,
      });

    try {
      // --- Extract --------------------------------------------------------
      await setStage(
        0,
        "running",
        "Sending raw input to the language model for extraction",
      );
      const { content, model, provider, usage } = await callLlmForJson(
        getAiSystemPrompt(),
        buildUserPrompt(job.rawInputText),
      );

      let parsed: ReturnType<typeof llmResponseSchema.parse>;
      try {
        const json = extractJsonObject(content);
        parsed = llmResponseSchema.parse(json);
      } catch (error) {
        throw new LlmError(
          ERROR_CODES.INVALID_SCHEMA,
          `The language model returned data that did not match the ProductIQ schema (${error instanceof Error ? error.message : "parse error"}). No data was saved — the pipeline stopped instead of storing malformed output.`,
        );
      }
      const tokenInfo = usage ? ` · ${usage.prompt_tokens ?? 0} prompt / ${usage.completion_tokens ?? 0} completion tokens` : "";
      await setStage(
        0,
        "done",
        `Extracted ${parsed.productName ? "product identity" : "attributes"} (Provider: ${provider}, Model: ${model}${tokenInfo})`,
      );

      // --- Enrich ---------------------------------------------------------
      await setStage(
        1,
        "running",
        "Classifying each field as original, inferred, generated, or unknown",
      );

      // Build core field metadata with deterministic rules.
      const metadata = verifySnippets(
        buildFieldMetadata(parsed),
        job.rawInputText,
      );

      // Build otherSpecs metadata deterministically — every dynamic spec
      // gets provenance by checking against the source text.
      const otherSpecsMeta = buildOtherSpecsMetadata(
        parsed.otherSpecs,
        job.rawInputText,
        null,
      );

      // Count how many fields have been classified with evidence.
      const classifiedCount = Object.values(metadata).filter(
        (e) => e.source !== "unknown",
      ).length;
      const verifiedCount = Object.values(otherSpecsMeta).filter(
        (e) => e.source !== "unknown",
      ).length;

      await setStage(
        1,
        "done",
        `Enriched ${classifiedCount} core fields + ${verifiedCount} dynamic specs with provenance`,
      );

      // --- Validate -------------------------------------------------------
      await setStage(
        2,
        "running",
        "Checking units, conflicts, plausibility, and completeness",
      );
      const conflicts =
        parsed.conflicts?.map(
          (conflict) =>
            `${conflict.field}: ${conflict.values.join(" / ")}`,
        ) ?? [];
      const product = finalizeProduct({
        rawInputText: job.rawInputText,
        inputName: job.inputName,
        productName: parsed.productName,
        category: parsed.category,
        subcategory: parsed.subcategory,
        specs: {
          material: parsed.material,
          dimensions: parsed.dimensions,
          weight: parsed.weight,
          voltageRating: parsed.voltageRating,
          certifications: parsed.certifications,
          otherSpecs: parsed.otherSpecs,
        },
        descriptionShort: parsed.descriptionShort,
        descriptionDetailed: parsed.descriptionDetailed,
        searchKeywords: parsed.searchKeywords,
        fieldMetadata: metadata,
        otherSpecsMetadata: otherSpecsMeta,
        extraFlags: { conflictingValues: conflicts },
        source: "ai_processed",
      });
      await setStage(
        2,
        "done",
        `Validation complete: ${describeFlags(product)}`,
      );

      // --- Commerce -------------------------------------------------------
      await setStage(
        3,
        "running",
        "Assembling title, descriptions, and search keywords",
      );
      await setStage(
        3,
        "done",
        `Commerce content ready (${product.searchKeywords.length} keywords)`,
      );

      // --- Score ----------------------------------------------------------
      await setStage(
        4,
        "running",
        "Scoring completeness, evidence, consistency, validation, and commerce readiness",
      );
      await setStage(
        4,
        "done",
        `Product quality score: ${product.qualityScore.overall}/100`,
      );

      // --- Save -----------------------------------------------------------
      await setStage(5, "running", "Writing the validated product to the catalog");
      const productId = await ctx.runMutation(internal.processing.insertProduct, {
        rawInputText: product.rawInputText,
        inputName: product.inputName,
        productName: product.productName,
        category: product.category,
        subcategory: product.subcategory,
        specs: product.specs,
        descriptionShort: product.descriptionShort,
        descriptionDetailed: product.descriptionDetailed,
        searchKeywords: product.searchKeywords,
        fieldMetadata: product.fieldMetadata,
        otherSpecsMetadata: product.otherSpecsMetadata,
        validationFlags: product.validationFlags,
        qualityScore: product.qualityScore,
        status: product.status,
        source: product.source,
        createdAt: product.createdAt,
      });
      await setStage(5, "done", "Product saved to catalog");
      await ctx.runMutation(internal.processing.finish, { jobId, productId });
    } catch (error) {
      const code =
        error instanceof LlmError ? error.code : ERROR_CODES.LLM_API_ERROR;
      const message =
        error instanceof Error ? error.message : String(error);
      const currentStage =
        (await ctx.runQuery(api.processing.get, { jobId }))?.currentStage ?? 0;
      await ctx.runMutation(internal.processing.fail, {
        jobId,
        errorCode: code,
        errorMessage: message,
        stageIndex: currentStage,
      });
    }
  },
});
