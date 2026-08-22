/**
 * Batch job management for ProductIQ.
 *
 * Handles creating batch jobs from uploaded datasets, tracking per-row
 * processing status, and storing output rows mapped to the delivery schema.
 */
import { v, ConvexError } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { callLlmForJson, extractJsonObject, LlmError } from "./llm";
import {
  buildFieldMetadata,
  buildUserPrompt,
  getAiSystemPrompt,
  llmResponseSchema,
  verifySnippets,
} from "./aiPrompt";
import { buildOtherSpecsMetadata, finalizeProduct } from "./scoring";
import { ERROR_CODES } from "./types";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List all batch jobs, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("batchJobs").order("desc").collect();
  },
});

/** Get a single batch job by ID. */
export const get = query({
  args: { jobId: v.id("batchJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a batch job from parsed CSV/XLSX rows. */
export const create = mutation({
  args: {
    name: v.string(),
    inputHeaders: v.array(v.string()),
    rows: v.array(v.record(v.string(), v.string())),
  },
  handler: async (ctx, { name, inputHeaders, rows }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("You must be signed in to create batch jobs.");
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("batchJobs", {
      name,
      status: "queued",
      totalRows: rows.length,
      processedRows: 0,
      failedRows: 0,
      currentRow: 0,
      inputHeaders,
      rows: rows.map((rawData, index) => ({
        index,
        rawData,
        rawText: Object.entries(rawData)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n"),
        status: "queued" as const,
        error: null,
        productId: null,
        outputRow: null,
      })),
      createdAt: now,
      updatedAt: now,
    });
    return jobId;
  },
});

/** Mark a batch job as processing. */
export const markProcessing = internalMutation({
  args: { jobId: v.id("batchJobs") },
  handler: async (ctx, { jobId }) => {
    await ctx.db.patch(jobId, {
      status: "processing",
      updatedAt: Date.now(),
    });
  },
});

/** Update a single row's status within a batch job. */
export const updateRow = internalMutation({
  args: {
    jobId: v.id("batchJobs"),
    rowIndex: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.union(v.string(), v.null()),
    productId: v.union(v.id("products"), v.null()),
    outputRow: v.union(v.record(v.string(), v.string()), v.null()),
  },
  handler: async (ctx, { jobId, rowIndex, status, error, productId, outputRow }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    const rows = job.rows.map((row, i) =>
      i === rowIndex ? { ...row, status, error, productId, outputRow } : row,
    );
    const processedRows = rows.filter((r) => r.status === "completed").length;
    const failedRows = rows.filter((r) => r.status === "failed").length;
    await ctx.db.patch(jobId, {
      rows,
      processedRows,
      failedRows,
      currentRow: rowIndex,
      updatedAt: Date.now(),
    });
  },
});

/** Mark a batch job as completed. */
export const markCompleted = internalMutation({
  args: { jobId: v.id("batchJobs") },
  handler: async (ctx, { jobId }) => {
    await ctx.db.patch(jobId, {
      status: "completed",
      updatedAt: Date.now(),
    });
  },
});

/** Mark a batch job as failed. */
export const markFailed = internalMutation({
  args: { jobId: v.id("batchJobs"), errorMessage: v.string() },
  handler: async (ctx, { jobId, errorMessage }) => {
    await ctx.db.patch(jobId, {
      status: "failed",
      updatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// The batch processing action
// ---------------------------------------------------------------------------

/** Process all rows in a batch job sequentially. */
export const processBatch = action({
  args: { jobId: v.id("batchJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(api.batchJobs.get, { jobId });
    if (!job) throw new ConvexError("Batch job not found.");
    if (job.status !== "queued") return;

    await ctx.runMutation(internal.batchJobs.markProcessing, { jobId });

    for (let i = 0; i < job.rows.length; i++) {
      const row = job.rows[i];
      if (row.status !== "queued") continue;

      await ctx.runMutation(internal.batchJobs.updateRow, {
        jobId,
        rowIndex: i,
        status: "processing",
        error: null,
        productId: null,
        outputRow: null,
      });

      try {
        // Run the same Gemini extraction pipeline as single-product processing
        const { content, model } = await callLlmForJson(
          getAiSystemPrompt(),
          buildUserPrompt(row.rawText),
        );

        let parsed: ReturnType<typeof llmResponseSchema.parse>;
        try {
          const json = extractJsonObject(content);
          parsed = llmResponseSchema.parse(json);
        } catch (error) {
          throw new LlmError(
            ERROR_CODES.INVALID_SCHEMA,
            `Schema validation failed: ${error instanceof Error ? error.message : "parse error"}`,
          );
        }

        // Build provenance
        const metadata = verifySnippets(
          buildFieldMetadata(parsed),
          row.rawText,
        );
        const otherSpecsMeta = buildOtherSpecsMetadata(
          parsed.otherSpecs,
          row.rawText,
          null,
        );

        const conflicts =
          parsed.conflicts?.map(
            (c) => `${c.field}: ${c.values.join(" / ")}`,
          ) ?? [];

        const product = finalizeProduct({
          rawInputText: row.rawText,
          inputName: job.name,
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

        // Save to products table
        const productId = await ctx.runMutation(
          internal.processing.insertProduct,
          {
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
          },
        );

        await ctx.runMutation(internal.batchJobs.updateRow, {
          jobId,
          rowIndex: i,
          status: "completed",
          error: null,
          productId,
          outputRow: null, // Will be populated by delivery mapper
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        await ctx.runMutation(internal.batchJobs.updateRow, {
          jobId,
          rowIndex: i,
          status: "failed",
          error: message,
          productId: null,
          outputRow: null,
        });
      }
    }

    await ctx.runMutation(internal.batchJobs.markCompleted, { jobId });
  },
});
