/**
 * Batch job management for ProductIQ.
 *
 * Handles creating batch jobs from uploaded datasets, tracking per-row
 * processing status, and storing output rows mapped to the delivery schema.
 *
 * OWNERSHIP: Every batch is owned by the Convex user who created it.
 * Queries filter by userId; mutations verify ownership before writing.
 * Both anonymous (demo) and signed-in users have unique Convex IDs.
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
import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Provider-specific delays between rows. */
const GROQ_INTER_ROW_DELAY_MS = 15_000;
const GEMINI_INTER_ROW_DELAY_MS = 1_500;

/** Maximum in-place retries for 429 rate-limit errors before marking row as failed. */
const ROW_RATE_LIMIT_RETRIES = 3;

// ---------------------------------------------------------------------------
// Ownership helpers
// ---------------------------------------------------------------------------

async function getCurrentUserId(
  ctx: GenericMutationCtx<DataModel>,
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

async function getCurrentUserIdQuery(
  ctx: { auth: { getUserIdentity: () => Promise<null | { subject: string }> } },
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List batch jobs owned by the current user, newest first. Legacy/unowned
 *  batches (no userId) are excluded. */
export const listMy = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdQuery(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("batchJobs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Get a single batch job by ID — only if owned by the current user. */
export const get = query({
  args: { jobId: v.id("batchJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getCurrentUserIdQuery(ctx);
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    if (!userId || job.userId !== userId) return null;
    return job;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a batch job from parsed CSV/XLSX rows. Owner is set server-side. */
export const create = mutation({
  args: {
    name: v.string(),
    inputHeaders: v.array(v.string()),
    rows: v.array(v.record(v.string(), v.string())),
    sourceTotalRows: v.number(),
    selectedRows: v.number(),
  },
  handler: async (ctx, { name, inputHeaders, rows, sourceTotalRows, selectedRows }) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) throw new ConvexError("Authentication required to create batch jobs.");

    const now = Date.now();
    const jobId = await ctx.db.insert("batchJobs", {
      name,
      userId,
      status: "queued",
      totalRows: rows.length,
      processedRows: 0,
      failedRows: 0,
      currentRow: 0,
      sourceTotalRows,
      selectedRows,
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

/** Delete a batch job and its associated products. Only the owner can delete. */
export const deleteBatch = mutation({
  args: { jobId: v.id("batchJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) throw new ConvexError("Authentication required.");
    const job = await ctx.db.get(jobId);
    if (!job) throw new ConvexError("Batch job not found.");
    if (job.userId !== userId) throw new ConvexError("Access denied.");

    // Collect all product IDs that were created by this batch's completed rows
    const productIds = job.rows
      .filter((row): row is typeof row & { productId: NonNullable<typeof row.productId> } => !!row.productId && row.status === "completed")
      .map((row) => row.productId);

    // Delete associated products
    for (const pid of productIds) {
      try {
        await ctx.db.delete(pid);
      } catch {
        // Product may have already been deleted; ignore.
      }
    }

    // Delete the batch job itself
    await ctx.db.delete(jobId);
  },
});

/** Mark a batch job as processing. (Internal — called by processBatch action.) */
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
    llmProvider: v.optional(v.string()),
    llmModel: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, rowIndex, status, error, productId, outputRow, llmProvider, llmModel }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    const rows = job.rows.map((row, i) =>
      i === rowIndex ? { ...row, status, error, productId, outputRow } : row,
    );
    const processedRows = rows.filter((r) => r.status === "completed").length;
    const failedRows = rows.filter((r) => r.status === "failed").length;
    const patch: Record<string, unknown> = {
      rows,
      processedRows,
      failedRows,
      currentRow: rowIndex,
      updatedAt: Date.now(),
    };
    // Store provider/model from the first successful API call.
    if (llmProvider && !job.llmProvider) patch.llmProvider = llmProvider;
    if (llmModel && !job.llmModel) patch.llmModel = llmModel;
    await ctx.db.patch(jobId, patch as never);
  },
});

/** Reset all failed rows back to queued so retryFailed can reprocess them. */
export const resetFailedRows = internalMutation({
  args: { jobId: v.id("batchJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;
    const rows = job.rows.map((row) =>
      row.status === "failed"
        ? { ...row, status: "queued" as const, error: null, productId: null, outputRow: null }
        : row,
    );
    const processedRows = rows.filter((r) => r.status === "completed").length;
    const failedRows = rows.filter((r) => r.status === "failed").length;
    await ctx.db.patch(jobId, {
      rows,
      processedRows,
      failedRows,
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
  handler: async (ctx, { jobId }) => {
    await ctx.db.patch(jobId, {
      status: "failed",
      updatedAt: Date.now(),
    });
  },
});

/** Update the live rate-limit status for UI display. Pass null to clear. */
export const updateRateLimitStatus = internalMutation({
  args: {
    jobId: v.id("batchJobs"),
    status: v.union(
      v.null(),
      v.object({
        provider: v.string(),
        limit: v.number(),
        safeBudget: v.number(),
        currentUsage: v.number(),
        waitingMs: v.number(),
      }),
    ),
  },
  handler: async (ctx, { jobId, status }) => {
    await ctx.db.patch(jobId, {
      rateLimitStatus: status ?? undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Format an error into a diagnostic string that includes the error code,
 * retriable flag, and the full message. No secrets are included. */
function formatError(error: unknown): string {
  if (error instanceof LlmError) {
    const parts = [`[${error.code}]`];
    if (error.retriable) parts.push("(retriable, retries exhausted)");
    parts.push(error.message);
    return parts.join(" ");
  }
  if (error instanceof Error) {
    return `[${error.name}] ${error.message}`;
  }
  return String(error);
}

/** Check if an error is a rate-limit (429) that we should retry in-place. */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof LlmError) {
    return error.code === "llm_api_error" && error.retriable && /429|rate.*limit|too.*many.*requests/i.test(error.message);
  }
  return false;
}

// ---------------------------------------------------------------------------
// The batch processing action
// ---------------------------------------------------------------------------

/** Process all rows in a batch job sequentially with rate-limit protection. */
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

      // Per-row retry loop: 429 rate-limit errors retry the same row
      // without counting it as a failed product.
      let lastError: unknown = null;
      for (let attempt = 0; attempt <= ROW_RATE_LIMIT_RETRIES; attempt++) {
        try {
          const { content, model, provider, usage, rateLimitStatus } = await callLlmForJson(
            getAiSystemPrompt(),
            buildUserPrompt(row.rawText),
          );

          // Store rate-limit status on first successful call.
          if (rateLimitStatus && !job.rateLimitStatus) {
            await ctx.runMutation(internal.batchJobs.updateRateLimitStatus, {
              jobId,
              status: rateLimitStatus,
            });
          }

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

          const metadata = verifySnippets(buildFieldMetadata(parsed), row.rawText);
          const otherSpecsMeta = buildOtherSpecsMetadata(parsed.otherSpecs, row.rawText, null);
          const conflicts = parsed.conflicts?.map((c) => `${c.field}: ${c.values.join(" / ")}`) ?? [];

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

          await ctx.runMutation(internal.batchJobs.updateRow, {
            jobId,
            rowIndex: i,
            status: "completed",
            error: null,
            productId,
            outputRow: null,
            llmProvider: provider,
            llmModel: model,
          });
          lastError = null; // success — break out of retry loop
          break;
        } catch (error) {
          lastError = error;
          // If this is a 429 rate-limit error and we have retries left, wait and retry the same row.
          if (isRateLimitError(error) && attempt < ROW_RATE_LIMIT_RETRIES) {
            const retryMs = error instanceof LlmError ? error.retryAfterMs : null;
            const waitMs = retryMs ?? 30_000;
            await sleep(waitMs);
            await ctx.runMutation(internal.batchJobs.updateRateLimitStatus, {
              jobId,
              status: {
                provider: "groq",
                limit: 8000,
                safeBudget: 6000,
                currentUsage: 8000,
                waitingMs: waitMs,
              },
            });
            continue;
          }
          break;
        }
      }

      // If all retries failed, mark the row as failed.
      if (lastError) {
        const diagnostic = formatError(lastError);
        await ctx.runMutation(internal.batchJobs.updateRow, {
          jobId,
          rowIndex: i,
          status: "failed",
          error: diagnostic,
          productId: null,
          outputRow: null,
        });
      }

      // Provider-specific inter-row delay.
      if (i < job.rows.length - 1) {
        const currentJob = await ctx.runQuery(api.batchJobs.get, { jobId });
        const delay = currentJob?.llmProvider === "groq"
          ? GROQ_INTER_ROW_DELAY_MS
          : GEMINI_INTER_ROW_DELAY_MS;
        await sleep(delay);
      }
    }

    // Clear rate-limit status when batch completes.
    await ctx.runMutation(internal.batchJobs.updateRateLimitStatus, {
      jobId,
      status: null,
    });
    await ctx.runMutation(internal.batchJobs.markCompleted, { jobId });
  },
});

/** Retry only the failed rows in an existing batch job. */
export const retryFailed = action({
  args: { jobId: v.id("batchJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(api.batchJobs.get, { jobId });
    if (!job) throw new ConvexError("Batch job not found.");
    if (job.status !== "completed" && job.status !== "failed") return;

    await ctx.runMutation(internal.batchJobs.resetFailedRows, { jobId });
    await ctx.runMutation(internal.batchJobs.markProcessing, { jobId });

    const freshJob = await ctx.runQuery(api.batchJobs.get, { jobId });
    if (!freshJob) throw new ConvexError("Batch job not found.");

    for (let i = 0; i < freshJob.rows.length; i++) {
      const row = freshJob.rows[i];
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
        const { content, model, provider, usage } = await callLlmForJson(
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

        const metadata = verifySnippets(buildFieldMetadata(parsed), row.rawText);
        const otherSpecsMeta = buildOtherSpecsMetadata(parsed.otherSpecs, row.rawText, null);
        const conflicts = parsed.conflicts?.map((c) => `${c.field}: ${c.values.join(" / ")}`) ?? [];

        const product = finalizeProduct({
          rawInputText: row.rawText,
          inputName: freshJob.name,
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

        await ctx.runMutation(internal.batchJobs.updateRow, {
          jobId,
          rowIndex: i,
          status: "completed",
          error: null,
          productId,
          outputRow: null,
          llmProvider: provider,
          llmModel: model,
        });
      } catch (error) {
        const diagnostic = formatError(error);
        await ctx.runMutation(internal.batchJobs.updateRow, {
          jobId,
          rowIndex: i,
          status: "failed",
          error: diagnostic,
          productId: null,
          outputRow: null,
        });
      }

      if (i < freshJob.rows.length - 1) {
        const delay = freshJob.llmProvider === "groq"
          ? GROQ_INTER_ROW_DELAY_MS
          : GEMINI_INTER_ROW_DELAY_MS;
        await sleep(delay);
      }
    }

    await ctx.runMutation(internal.batchJobs.markCompleted, { jobId });
  },
});
