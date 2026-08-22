import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/** Reusable field-metadata entry validator — one consistent shape used by
 *  core fieldMetadata, dynamic otherSpecsMetadata, and evidence views. */
const fieldMetadataEntryValidator = v.object({
  value: v.union(
    v.string(),
    v.number(),
    v.array(v.string()),
    v.boolean(),
    v.null(),
  ),
  source: v.union(
    v.literal("original"),
    v.literal("ai_generated"),
    v.literal("ai_inferred"),
    v.literal("unknown"),
  ),
  confidence: v.number(),
  sourceTextSnippet: v.union(v.string(), v.null()),
  sourceDocument: v.union(v.string(), v.null()),
  explanation: v.union(v.string(), v.null()),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    products: defineTable({
      rawInputText: v.string(),
      inputName: v.string(),
      productName: v.string(),
      category: v.string(),
      subcategory: v.string(),
      specs: v.object({
        material: v.union(v.string(), v.null()),
        dimensions: v.union(
          v.object({
            length: v.union(v.number(), v.null()),
            width: v.union(v.number(), v.null()),
            height: v.union(v.number(), v.null()),
            unit: v.union(v.string(), v.null()),
          }),
          v.null(),
        ),
        weight: v.union(
          v.object({
            value: v.union(v.number(), v.null()),
            unit: v.union(v.string(), v.null()),
          }),
          v.null(),
        ),
        voltageRating: v.union(v.string(), v.null()),
        certifications: v.array(v.string()),
        otherSpecs: v.record(v.string(), v.string()),
      }),
      descriptionShort: v.string(),
      descriptionDetailed: v.string(),
      searchKeywords: v.array(v.string()),
      fieldMetadata: v.record(v.string(), fieldMetadataEntryValidator),
      /** Per-key provenance for every dynamic specification in specs.otherSpecs.
       *  Same contract as fieldMetadata — every technical value must have
       *  source, confidence, and evidence or be marked unknown. */
      otherSpecsMetadata: v.record(v.string(), fieldMetadataEntryValidator),
      validationFlags: v.object({
        missingFields: v.array(v.string()),
        conflictingValues: v.array(v.string()),
        suspiciousValues: v.array(v.string()),
        unitInconsistencies: v.array(v.string()),
      }),
      qualityScore: v.object({
        overall: v.number(),
        components: v.object({
          completeness: v.number(),
          evidenceCoverage: v.number(),
          consistency: v.number(),
          validationStatus: v.number(),
          commerceReadiness: v.number(),
        }),
        explanation: v.string(),
      }),
      status: v.union(v.literal("complete"), v.literal("needs_review")),
      source: v.union(v.literal("seeded"), v.literal("ai_processed")),
      createdAt: v.number(),
    }).index("by_createdAt", ["createdAt"]),

    processingJobs: defineTable({
      rawInputText: v.string(),
      inputName: v.string(),
      status: v.union(
        v.literal("processing"),
        v.literal("succeeded"),
        v.literal("failed"),
      ),
      currentStage: v.number(),
      stages: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          status: v.union(
            v.literal("pending"),
            v.literal("running"),
            v.literal("done"),
            v.literal("error"),
          ),
          detail: v.union(v.string(), v.null()),
        }),
      ),
      productId: v.union(v.id("products"), v.null()),
      errorCode: v.union(v.string(), v.null()),
      errorMessage: v.union(v.string(), v.null()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_createdAt", ["createdAt"]),

    /** The canonical delivery output schema, uploaded once from the official
     *  Expected Output CSV. Stores exact header names, order, and count. */
    deliverySchema: defineTable({
      name: v.string(),
      headers: v.array(v.string()),
      headerCount: v.number(),
      createdAt: v.number(),
    }),

    /** Batch processing jobs — one per uploaded dataset. Tracks per-row
     *  processing status and output data for delivery. */
    batchJobs: defineTable({
      name: v.string(),
      status: v.union(
        v.literal("queued"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
      totalRows: v.number(),
      processedRows: v.number(),
      failedRows: v.number(),
      currentRow: v.number(),
      inputHeaders: v.array(v.string()),
      rows: v.array(
        v.object({
          index: v.number(),
          rawData: v.record(v.string(), v.string()),
          rawText: v.string(),
          status: v.union(
            v.literal("queued"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed"),
          ),
          error: v.union(v.string(), v.null()),
          productId: v.union(v.id("products"), v.null()),
          outputRow: v.union(v.record(v.string(), v.string()), v.null()),
        }),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_createdAt", ["createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
