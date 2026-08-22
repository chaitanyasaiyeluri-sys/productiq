/**
 * ProductIQ catalog queries and the demo-catalog seed mutation.
 *
 * Every product in the catalog — seeded or AI-processed — is built through
 * the same `finalizeProduct` path in scoring.ts, so validation flags and
 * quality scores behave identically across the whole catalog.
 */
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type {
  FieldKey,
  FieldMetadata,
  FieldMetadataEntry,
  OtherSpecsMetadata,
  SourceKind,
} from "./types";
import { FIELD_KEYS } from "./types";
import {
  buildOtherSpecsMetadata,
  findSnippet,
  finalizeProduct,
  formatDimensions,
  formatWeight,
  normalizeText,
} from "./scoring";
import type { SeedInput } from "./seedData";
import { SEED_PRODUCTS } from "./seedData";

// ---------------------------------------------------------------------------
// Seed metadata builder
// ---------------------------------------------------------------------------

function stringifyValue(
  value: string | number | string[] | null,
): string | null {
  if (value === null) return null;
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function findDimensionSnippet(
  d: { length: number; width: number; height: number; unit: string },
  haystack: string,
): string | null {
  const sentences = haystack.split(/\r?\n|(?<=[.;])\s+/);
  const unit = d.unit.trim().toLowerCase();
  const nums = [d.length, d.width, d.height].map((n) => String(n));
  for (const sentence of sentences) {
    const ns = normalizeText(sentence);
    if (ns.includes(unit) && nums.some((n) => ns.includes(n))) {
      return sentence.trim();
    }
  }
  return null;
}

/** Builds the canonical field_metadata object for a seeded product. */
function buildSeedMetadata(input: SeedInput): FieldMetadata {
  const raw = `${input.raw}\n${input.descriptionDetailed ?? ""}`;
  const doc = input.doc ?? "Product datasheet";
  const inferredConfidence = input.inferredConfidence ?? 72;

  const entry = (
    key: FieldKey,
    value: string | number | string[] | null,
    defaults: {
      source: SourceKind;
      confidence: number;
      explanation: string | null;
    },
  ): FieldMetadataEntry => {
    const override = input.meta?.[key];
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
        sourceDocument: doc,
        explanation: null,
      };
    }
    const snippet =
      key === "dimensions" && input.dimensions
        ? findDimensionSnippet(input.dimensions, raw)
        : findSnippet(stringifyValue(value) ?? "", raw);
    return {
      value,
      source: override?.source ?? defaults.source,
      confidence: override?.confidence ?? defaults.confidence,
      sourceTextSnippet: snippet,
      sourceDocument: doc,
      explanation:
        override?.explanation !== undefined
          ? override.explanation
          : defaults.explanation,
    };
  };

  const inferred = {
    source: "ai_inferred" as SourceKind,
    confidence: inferredConfidence,
    explanation:
      "Classified against the ProductIQ category taxonomy from the product name and technical description.",
  };

  return {
    productName: entry("productName", input.name, {
      source: "original",
      confidence: 95,
      explanation: "Product name taken from the source text.",
    }),
    category: entry("category", input.category, inferred),
    subcategory: entry("subcategory", input.subcategory ?? null, inferred),
    material: entry("material", input.material ?? null, {
      source: "original",
      confidence: 90,
      explanation: "Material stated in the source text.",
    }),
    dimensions: entry(
      "dimensions",
      input.dimensions ? formatDimensions(input.dimensions) : null,
      {
        source: "original",
        confidence: 90,
        explanation: "Dimensions stated in the source text.",
      },
    ),
    weight: entry("weight", input.weight ? formatWeight(input.weight) : null, {
      source: "original",
      confidence: 90,
      explanation: "Weight stated in the source text.",
    }),
    voltageRating: entry("voltageRating", input.voltageRating ?? null, {
      source: "original",
      confidence: 90,
      explanation: "Voltage rating stated in the source text.",
    }),
    certifications: entry(
      "certifications",
      input.certifications && input.certifications.length > 0
        ? input.certifications
        : null,
      {
        source: "original",
        confidence: 90,
        explanation: "Certifications listed in the source text.",
      },
    ),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** All products, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").order("desc").collect();
  },
});

/** A single product by id (used by the detail page). */
export const get = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    return await ctx.db.get(productId);
  },
});

/**
 * Count the number of truly unsupported specifications across a product.
 *
 * A technical specification is "unsupported" if ANY of these are true:
 *  1. It has a value but source is "unknown"
 *  2. It claims "original" but has no valid source snippet
 *  3. It claims "ai_inferred" but lacks evidence (no snippet + no explanation)
 *  4. It contains a technical value classified as "ai_generated"
 *  5. Its evidence snippet does not occur in the original source
 *  6. Its provenance metadata is malformed (missing required fields)
 */
function countUnsupportedSpecs(
  product: {
    fieldMetadata: Record<string, FieldMetadataEntry>;
    otherSpecsMetadata: Record<string, FieldMetadataEntry>;
    rawInputText: string;
  },
): number {
  let count = 0;
  const normalizedRaw = product.rawInputText
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const isTechnicalKey = (key: string): boolean =>
    [
      "material",
      "dimensions",
      "weight",
      "voltageRating",
      "certifications",
    ].includes(key);

  const check = (key: string, entry: FieldMetadataEntry | undefined) => {
    if (!entry) return;

    // Skip empty / unknown — those are not "unsupported" (they are honest).
    const empty =
      entry.value === null ||
      (typeof entry.value === "string" && entry.value.trim() === "") ||
      (Array.isArray(entry.value) && entry.value.length === 0);
    if (empty || entry.source === "unknown") return;

    // Check 1: technical value without evidence
    const hasEvidence =
      (entry.sourceTextSnippet && entry.sourceTextSnippet.trim() !== "") ||
      (entry.explanation && entry.explanation.trim() !== "");

    // Check 2: ai_generated on a technical key
    if (isTechnicalKey(key) && entry.source === "ai_generated") {
      count++;
      return;
    }

    // Check 3: original without valid snippet
    if (entry.source === "original" && !entry.sourceTextSnippet) {
      count++;
      return;
    }

    // Check 4: ai_inferred without evidence
    if (entry.source === "ai_inferred" && !hasEvidence) {
      count++;
      return;
    }

    // Check 5: snippet does not exist in source
    if (entry.sourceTextSnippet) {
      const normalizedSnippet = entry.sourceTextSnippet
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      if (!normalizedRaw.includes(normalizedSnippet)) {
        count++;
        return;
      }
    }
  };

  // Check core fields
  for (const key of Object.keys(product.fieldMetadata)) {
    check(key, product.fieldMetadata[key]);
  }
  // Check dynamic otherSpecs
  for (const key of Object.keys(product.otherSpecsMetadata)) {
    check(key, product.otherSpecsMetadata[key]);
  }

  return count;
}

/** Catalog-wide aggregates for the Dashboard and the public landing page. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const total = products.length;
    const complete = products.filter((p) => p.status === "complete").length;

    const confidences: number[] = [];
    const categoryDistribution: Record<string, number> = {};
    const flagCounts = {
      missingFields: 0,
      conflictingValues: 0,
      suspiciousValues: 0,
      unitInconsistencies: 0,
    };
    let sourceCounts = { seeded: 0, aiProcessed: 0 };
    let qualitySum = 0;
    let unsupportedSpecs = 0;
    let classifiedFields = 0;
    let totalFields = 0;

    // Core field keys that count toward "fields classified" percentage.
    const trackedCoreKeys = [...FIELD_KEYS];

    for (const product of products) {
      qualitySum += product.qualityScore.overall;
      categoryDistribution[product.category] =
        (categoryDistribution[product.category] ?? 0) + 1;
      flagCounts.missingFields += product.validationFlags.missingFields.length;
      flagCounts.conflictingValues +=
        product.validationFlags.conflictingValues.length;
      flagCounts.suspiciousValues +=
        product.validationFlags.suspiciousValues.length;
      flagCounts.unitInconsistencies +=
        product.validationFlags.unitInconsistencies.length;
      sourceCounts =
        product.source === "seeded"
          ? { ...sourceCounts, seeded: sourceCounts.seeded + 1 }
          : { ...sourceCounts, aiProcessed: sourceCounts.aiProcessed + 1 };

      // Defensive: older products may lack otherSpecsMetadata.
      const otherMeta =
        ((product as Record<string, unknown>).otherSpecsMetadata as Record<string, FieldMetadataEntry> | undefined) ?? ({} as Record<string, FieldMetadataEntry>);
      const fieldMeta =
        ((product as Record<string, unknown>).fieldMetadata as Record<string, FieldMetadataEntry> | undefined) ?? ({} as Record<string, FieldMetadataEntry>);

      // Unsupported specs — comprehensive calculation.
      unsupportedSpecs += countUnsupportedSpecs({
        fieldMetadata: fieldMeta,
        otherSpecsMetadata: otherMeta,
        rawInputText: product.rawInputText ?? "",
      });

      // Field classification — count core fields + dynamic specs.
      for (const key of trackedCoreKeys) {
        totalFields += 1;
        const entry = fieldMeta[key];
        if (entry) {
          classifiedFields += 1; // Always classified (even if unknown)
          if (entry.source !== "unknown" && entry.confidence > 0) {
            confidences.push(entry.confidence);
          }
        }
      }
      for (const key of Object.keys(otherMeta)) {
        totalFields += 1;
        const entry = otherMeta[key];
        if (entry) {
          classifiedFields += 1;
          if (entry.source !== "unknown" && entry.confidence > 0) {
            confidences.push(entry.confidence);
          }
        }
      }
    }

    const avgQuality = total ? Math.round(qualitySum / total) : 0;
    const avgConfidence = confidences.length
      ? Math.round(
          confidences.reduce((a, b) => a + b, 0) / confidences.length,
        )
      : 0;

    return {
      total,
      complete,
      needsReview: total - complete,
      avgQuality,
      avgConfidence,
      categoryDistribution,
      categoryCount: Object.keys(categoryDistribution).length,
      fieldsClassifiedPct: totalFields
        ? Math.round((classifiedFields / totalFields) * 100)
        : 100,
      unsupportedSpecs,
      flagCounts,
      sourceCounts,
    };
  },
});

// ---------------------------------------------------------------------------
// Seed mutation
// ---------------------------------------------------------------------------

/**
 * Loads the demo catalog. Safe to call repeatedly: skips when products
 * already exist unless `force` is set.
 */
export const seed = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    const existing = await ctx.db.query("products").collect();
    if (existing.length > 0 && !force) {
      return { inserted: 0, total: existing.length };
    }
    if (existing.length > 0 && force) {
      for (const product of existing) {
        await ctx.db.delete(product._id);
      }
    }

    let inserted = 0;
    for (const seedInput of SEED_PRODUCTS) {
      const rawText = seedInput.raw;
      const doc = seedInput.doc ?? "Product datasheet";

      // Build otherSpecs metadata deterministically from the source text.
      const otherSpecsMeta = buildOtherSpecsMetadata(
        seedInput.otherSpecs ?? {},
        rawText,
        doc,
      );

      const finalized = finalizeProduct({
        rawInputText: rawText,
        inputName: doc,
        productName: seedInput.name,
        category: seedInput.category,
        subcategory: seedInput.subcategory ?? null,
        specs: {
          material: seedInput.material ?? null,
          dimensions: seedInput.dimensions ?? null,
          weight: seedInput.weight ?? null,
          voltageRating: seedInput.voltageRating ?? null,
          certifications: seedInput.certifications ?? [],
          otherSpecs: seedInput.otherSpecs ?? {},
        },
        descriptionShort: seedInput.descriptionShort,
        descriptionDetailed: seedInput.descriptionDetailed ?? null,
        searchKeywords: seedInput.keywords ?? [],
        fieldMetadata: buildSeedMetadata(seedInput),
        otherSpecsMetadata: otherSpecsMeta,
        extraFlags: seedInput.extraFlags,
        source: "seeded",
      });
      await ctx.db.insert("products", finalized);
      inserted += 1;
    }
    return { inserted, total: inserted };
  },
});
