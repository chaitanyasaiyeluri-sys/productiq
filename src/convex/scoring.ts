/**
 * Deterministic validation and quality-scoring engine.
 *
 * Every product — whether it arrived through the live AI pipeline or the
 * seeded catalog — passes through the same logic here, so the Validation
 * Center and quality scores behave identically across the whole catalog.
 *
 * Responsibilities:
 *  - normalize dimensions/weight to metric internally
 *  - detect missing fields, conflicting values, suspicious values, and unit
 *    inconsistencies
 *  - build deterministic provenance for dynamic otherSpecs
 *  - compute a transparent, factor-based Product Quality Score
 */
import type {
  DimensionsSpec,
  FieldKey,
  FieldMetadata,
  FieldMetadataEntry,
  OtherSpecsMetadata,
  ProductSpecs,
  ProductStatus,
  QualityScore,
  SourceKind,
  ValidationFlags,
  WeightSpec,
} from "./types";
import { FIELD_KEYS, SOURCE_KINDS } from "./types";

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

const LENGTH_UNITS: Record<string, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  inch: 25.4,
  inches: 25.4,
  ft: 304.8,
  foot: 304.8,
  feet: 304.8,
};

const MASS_UNITS: Record<string, number> = {
  g: 0.001,
  kg: 1,
  lb: 0.45359237,
  lbs: 0.45359237,
  pound: 0.45359237,
  pounds: 0.45359237,
  oz: 0.028349523125,
};

const KNOWN_UNITS = new Set([
  ...Object.keys(LENGTH_UNITS),
  ...Object.keys(MASS_UNITS),
]);

export function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? "").trim().toLowerCase();
}

export function isLengthUnit(unit: string | null | undefined): boolean {
  return normalizeUnit(unit) in LENGTH_UNITS;
}

export function isMassUnit(unit: string | null | undefined): boolean {
  return normalizeUnit(unit) in MASS_UNITS;
}

function isImperialLength(unit: string | null | undefined): boolean {
  return ["in", "inch", "inches", "ft", "foot", "feet"].includes(
    normalizeUnit(unit),
  );
}

function isMetricMass(unit: string | null | undefined): boolean {
  return ["g", "kg"].includes(normalizeUnit(unit));
}

/** Converts a value to millimetres when the unit is a length unit. */
function toMillimetres(value: number, unit: string | null | undefined): number | null {
  const factor = LENGTH_UNITS[normalizeUnit(unit)];
  return factor === undefined ? null : value * factor;
}

/** Converts a value to kilograms when the unit is a mass unit. */
function toKilograms(value: number, unit: string | null | undefined): number | null {
  const factor = MASS_UNITS[normalizeUnit(unit)];
  return factor === undefined ? null : value * factor;
}

// ---------------------------------------------------------------------------
// Implausibility ranges (per category, in metric base units)
// ---------------------------------------------------------------------------

interface Range {
  min: number;
  max: number;
}

const WEIGHT_RANGES: Record<string, Range> = {
  Bearings: { min: 0.001, max: 200 },
  "Electric Motors": { min: 0.1, max: 10000 },
  Pumps: { min: 0.5, max: 20000 },
  Valves: { min: 0.05, max: 2000 },
  "Industrial Sensors": { min: 0.001, max: 50 },
  "Electrical Components": { min: 0.001, max: 100 },
  "Power Supplies": { min: 0.01, max: 500 },
  "Pneumatic Components": { min: 0.01, max: 500 },
};

const DEFAULT_WEIGHT_RANGE: Range = { min: 0.001, max: 10000 };
const DIMENSION_RANGE_MM: Range = { min: 0.5, max: 20000 };
const VOLTAGE_MAX = 100_000;

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Finds the sentence/line of the source text that contains a value. */
export function findSnippet(value: string, rawText: string): string | null {
  const needle = normalizeText(value);
  if (!needle) return null;
  const sentences = rawText.split(/\r?\n|(?<=[.;])\s+/);
  for (const sentence of sentences) {
    if (normalizeText(sentence).includes(needle)) {
      return sentence.trim();
    }
  }
  const idx = normalizeText(rawText).indexOf(needle);
  if (idx !== -1) {
    const start = Math.max(0, idx - 60);
    return rawText.slice(start, Math.min(rawText.length, idx + needle.length + 60)).trim();
  }
  return null;
}

export function trimNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
}

export function formatDimensions(d: DimensionsSpec | null): string | null {
  if (!d) return null;
  const parts = [d.length, d.width, d.height].filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x),
  );
  if (parts.length === 0) return null;
  const unit = normalizeUnit(d.unit);
  return `${parts.map(trimNumber).join(" × ")}${unit ? ` ${unit}` : ""}`;
}

export function formatWeight(w: WeightSpec | null): string | null {
  if (!w) return null;
  if (typeof w.value !== "number" || !Number.isFinite(w.value)) return null;
  const unit = normalizeUnit(w.unit);
  return `${trimNumber(w.value)}${unit ? ` ${unit}` : ""}`;
}

export const FIELD_LABELS: Record<string, string> = {
  productName: "Product name",
  category: "Category",
  subcategory: "Subcategory",
  material: "Material",
  dimensions: "Dimensions",
  weight: "Weight",
  voltageRating: "Voltage rating",
  certifications: "Certifications",
  descriptionShort: "Short description",
  descriptionDetailed: "Detailed description",
  searchKeywords: "Search keywords",
};

// ---------------------------------------------------------------------------
// Metric normalization
// ---------------------------------------------------------------------------

export interface NormalizedMetrics {
  normalizedDimensionsMm: string | null;
  normalizedWeightKg: string | null;
}

export function normalizeToMetric(specs: ProductSpecs): NormalizedMetrics {
  let normalizedDimensionsMm: string | null = null;
  let normalizedWeightKg: string | null = null;

  const d = specs.dimensions;
  if (d) {
    const converted = [d.length, d.width, d.height]
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
      .map((x) => toMillimetres(x, d.unit))
      .filter((x): x is number => x !== null);
    if (converted.length > 0) {
      normalizedDimensionsMm = `${converted.map(trimNumber).join(" × ")} mm`;
    }
  }

  const w = specs.weight;
  if (w && typeof w.value === "number" && Number.isFinite(w.value)) {
    const kg = toKilograms(w.value, w.unit);
    if (kg !== null) {
      normalizedWeightKg = `${trimNumber(kg)} kg`;
    }
  }

  return { normalizedDimensionsMm, normalizedWeightKg };
}

// ---------------------------------------------------------------------------
// Deterministic otherSpecs metadata builder
// ---------------------------------------------------------------------------

/**
 * For every dynamic key in otherSpecs, deterministically assign provenance by
 * checking whether the value (or its containing line) appears in the raw
 * source text. This runs AFTER the LLM extraction and is never overridden
 * by the model — it is purely server-side verification.
 */
export function buildOtherSpecsMetadata(
  otherSpecs: Record<string, string>,
  rawInputText: string,
  sourceDocument: string | null,
): OtherSpecsMetadata {
  const result: OtherSpecsMetadata = {};
  for (const [key, value] of Object.entries(otherSpecs)) {
    if (!value || value.trim() === "") {
      result[key] = {
        value: null,
        source: "unknown",
        confidence: 0,
        sourceTextSnippet: null,
        sourceDocument,
        explanation: null,
      };
      continue;
    }
    const snippet = findSnippet(value, rawInputText);
    if (snippet) {
      result[key] = {
        value,
        source: "original",
        confidence: 90,
        sourceTextSnippet: snippet,
        sourceDocument,
        explanation: "Directly stated in the supplied source text.",
      };
    } else {
      // Value exists but could not be traced to the source — mark as
      // unknown rather than allowing an unsupported specification.
      result[key] = {
        value: null,
        source: "unknown",
        confidence: 0,
        sourceTextSnippet: null,
        sourceDocument,
        explanation: `The extracted value "${value}" for "${key.replace(/_/g, " ")}" could not be verified against the supplied source text.`,
      };
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Validation flag detection
// ---------------------------------------------------------------------------

export interface FlagDetectionInput {
  category: string | null;
  specs: ProductSpecs;
  fieldMetadata: FieldMetadata;
  otherSpecsMetadata: OtherSpecsMetadata;
  descriptionShort: string | null;
  descriptionDetailed: string | null;
  searchKeywords: string[];
}

export function detectValidationFlags(input: FlagDetectionInput): ValidationFlags {
  const missingFields: string[] = [];
  const conflictingValues: string[] = [];
  const suspiciousValues: string[] = [];
  const unitInconsistencies: string[] = [];

  // --- Missing fields -----------------------------------------------------
  for (const key of FIELD_KEYS) {
    const entry = input.fieldMetadata[key];
    const empty =
      entry.value === null ||
      entry.value === undefined ||
      (typeof entry.value === "string" && entry.value.trim() === "") ||
      (Array.isArray(entry.value) && entry.value.length === 0);
    if (empty) missingFields.push(FIELD_LABELS[key] ?? key);
  }
  if (!input.descriptionShort || input.descriptionShort.trim() === "") {
    missingFields.push(FIELD_LABELS.descriptionShort);
  }
  if (!input.descriptionDetailed || input.descriptionDetailed.trim() === "") {
    missingFields.push(FIELD_LABELS.descriptionDetailed);
  }
  if (!input.searchKeywords || input.searchKeywords.length === 0) {
    missingFields.push(FIELD_LABELS.searchKeywords);
  }

  const category = input.category ?? "";
  const specs = input.specs;

  // --- Unit inconsistencies ----------------------------------------------
  const d = specs.dimensions;
  if (d) {
    const dimUnit = normalizeUnit(d.unit);
    if (!dimUnit) {
      unitInconsistencies.push("Dimensions are missing a unit of measure.");
    } else if (!(dimUnit in LENGTH_UNITS)) {
      unitInconsistencies.push(
        `Dimension unit "${d.unit}" is not a valid length unit.`,
      );
    }
  }

  const w = specs.weight;
  if (w) {
    const weightUnit = normalizeUnit(w.unit);
    if (!weightUnit) {
      unitInconsistencies.push("Weight is missing a unit of measure.");
    } else if (weightUnit in LENGTH_UNITS) {
      unitInconsistencies.push(
        `Weight is expressed in "${w.unit}", which is a unit of length, not mass.`,
      );
    } else if (!(weightUnit in MASS_UNITS)) {
      unitInconsistencies.push(
        `Weight unit "${w.unit}" is not a valid mass unit.`,
      );
    }
  }

  if (d && w) {
    const dimUnit = normalizeUnit(d.unit);
    const weightUnit = normalizeUnit(w.unit);
    const mixed =
      (isImperialLength(dimUnit) && isMetricMass(weightUnit)) ||
      (dimUnit in MASS_UNITS && weightUnit in LENGTH_UNITS);
    if (mixed) {
      unitInconsistencies.push(
        `Mixed unit systems: dimensions use "${d.unit}" while weight uses "${w.unit}". Values are normalized to metric.`,
      );
    }
  }

  // --- Suspicious values --------------------------------------------------
  if (w && typeof w.value === "number" && Number.isFinite(w.value)) {
    const kg = toKilograms(w.value, w.unit);
    if (w.value <= 0) {
      suspiciousValues.push(
        `Weight value ${trimNumber(w.value)} is not a plausible positive value.`,
      );
    } else if (kg !== null) {
      const range = WEIGHT_RANGES[category] ?? DEFAULT_WEIGHT_RANGE;
      if (kg < range.min || kg > range.max) {
        suspiciousValues.push(
          `Weight ${formatWeight(w)} (~${trimNumber(kg)} kg) is implausible for a ${category || "product"} of this type.`,
        );
      }
    }
  }

  if (d) {
    const sides: [string, number | null][] = [
      ["length", d.length],
      ["width", d.width],
      ["height", d.height],
    ];
    for (const [side, value] of sides) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (value <= 0) {
        suspiciousValues.push(
          `Dimension ${side} ${trimNumber(value)} must be a positive value.`,
        );
        continue;
      }
      const mm = toMillimetres(value, d.unit);
      if (mm !== null && (mm < DIMENSION_RANGE_MM.min || mm > DIMENSION_RANGE_MM.max)) {
        suspiciousValues.push(
          `Dimension ${side} ${trimNumber(value)} ${d.unit ?? ""} (~${trimNumber(mm)} mm) is implausible for this product type.`,
        );
      }
    }
  }

  if (specs.voltageRating) {
    const match = specs.voltageRating.match(/[\d.,]+/);
    if (match) {
      const volts = parseFloat(match[0].replace(/,/g, "."));
      if (Number.isFinite(volts) && volts > VOLTAGE_MAX) {
        suspiciousValues.push(
          `Voltage rating ${specs.voltageRating} exceeds the plausible range for industrial components.`,
        );
      }
    }
  }

  // --- Unsupported dynamic specifications ---------------------------------
  // Count otherSpecs entries that have a displayed value but unknown source
  for (const [key, meta] of Object.entries(input.otherSpecsMetadata)) {
    const displayValue = input.specs.otherSpecs[key];
    if (displayValue && meta.source === "unknown") {
      suspiciousValues.push(
        `Specification "${key.replace(/_/g, " ")}" value "${displayValue}" could not be verified against the source.`,
      );
    }
  }

  return { missingFields, conflictingValues, suspiciousValues, unitInconsistencies };
}

// ---------------------------------------------------------------------------
// Quality score
// ---------------------------------------------------------------------------

export interface QualityScoreInput {
  fieldMetadata: FieldMetadata;
  otherSpecsMetadata: OtherSpecsMetadata;
  flags: ValidationFlags;
  descriptionShort: string | null;
  descriptionDetailed: string | null;
  searchKeywords: string[];
  productName: string | null;
  category: string | null;
}

const COMPLETENESS_WEIGHTS: Record<FieldKey, number> = {
  productName: 0.15,
  category: 0.12,
  subcategory: 0.06,
  material: 0.12,
  dimensions: 0.12,
  weight: 0.12,
  voltageRating: 0.08,
  certifications: 0.08,
};

export function computeQualityScore(input: QualityScoreInput): QualityScore {
  const { fieldMetadata, otherSpecsMetadata, flags } = input;

  // Completeness — weighted presence of the core fields.
  let completeness = 0;
  for (const key of FIELD_KEYS) {
    const entry = fieldMetadata[key];
    const empty =
      entry.value === null ||
      (typeof entry.value === "string" && entry.value.trim() === "") ||
      (Array.isArray(entry.value) && entry.value.length === 0);
    if (!empty) completeness += COMPLETENESS_WEIGHTS[key] ?? 0;
  }
  if (input.descriptionShort?.trim()) completeness += 0.05;
  if (input.descriptionDetailed?.trim()) completeness += 0.05;
  if (input.searchKeywords.length >= 1) completeness += 0.05;
  completeness = Math.round(completeness * 100);

  // Evidence coverage — mean confidence across the field metadata,
  // including dynamic otherSpecs.
  const coreConfidences = FIELD_KEYS.map((key) => {
    const entry = fieldMetadata[key];
    const empty =
      entry.value === null ||
      (typeof entry.value === "string" && entry.value.trim() === "") ||
      (Array.isArray(entry.value) && entry.value.length === 0);
    if (empty || entry.source === "unknown") return 0;
    return entry.confidence;
  });

  const otherConfidences = Object.values(otherSpecsMetadata).map((entry) => {
    if (
      entry.value === null ||
      entry.source === "unknown"
    )
      return 0;
    return entry.confidence;
  });

  const allConfidences = [...coreConfidences, ...otherConfidences];
  const evidenceCoverage = Math.round(
    allConfidences.reduce((a, b) => a + b, 0) / Math.max(allConfidences.length, 1),
  );

  // Consistency — penalized by detected conflicts.
  const consistency = Math.max(0, 100 - flags.conflictingValues.length * 15);

  // Validation status — penalized by each validation flag.
  const validationStatus = Math.max(
    0,
    100 -
      flags.missingFields.length * 10 -
      flags.conflictingValues.length * 12 -
      flags.suspiciousValues.length * 8 -
      flags.unitInconsistencies.length * 8,
  );

  // Commerce readiness.
  let commerceReadiness = 0;
  if (input.descriptionShort?.trim()) commerceReadiness += 20;
  if (input.descriptionDetailed?.trim()) commerceReadiness += 30;
  if (input.searchKeywords.length >= 3) commerceReadiness += 25;
  else if (input.searchKeywords.length >= 1) commerceReadiness += 15;
  if (input.category?.trim()) commerceReadiness += 25;

  const overall = Math.round(
    completeness * 0.3 +
      evidenceCoverage * 0.2 +
      consistency * 0.2 +
      validationStatus * 0.15 +
      commerceReadiness * 0.15,
  );

  const explanation = `Quality score ${overall}/100, driven by ${completeness}% field completeness, ${evidenceCoverage}% evidence coverage, ${consistency}% consistency, ${validationStatus}% validation status, and ${commerceReadiness}% commerce readiness.`;

  return {
    overall,
    components: {
      completeness,
      evidenceCoverage,
      consistency,
      validationStatus,
      commerceReadiness,
    },
    explanation,
  };
}

export function deriveStatus(
  score: QualityScore,
  flags: ValidationFlags,
  productName: string | null,
  category: string | null,
  fieldMetadata: FieldMetadata,
): ProductStatus {
  const avgConfidence =
    FIELD_KEYS.reduce((acc, key) => {
      const entry = fieldMetadata[key];
      if (entry.source === "unknown") return acc;
      return acc + entry.confidence;
    }, 0) / Math.max(FIELD_KEYS.length, 1);

  const needsReview =
    score.overall < 60 ||
    flags.conflictingValues.length > 0 ||
    flags.suspiciousValues.length > 0 ||
    flags.unitInconsistencies.length > 0 ||
    !productName ||
    !category ||
    avgConfidence < 50;

  return needsReview ? "needs_review" : "complete";
}

// ---------------------------------------------------------------------------
// Finalize — shared by the AI pipeline and the seed path
// ---------------------------------------------------------------------------

export interface FinalizeInput {
  rawInputText: string;
  inputName: string;
  productName: string | null;
  category: string | null;
  subcategory: string | null;
  specs: ProductSpecs;
  descriptionShort: string | null;
  descriptionDetailed: string | null;
  searchKeywords: string[];
  fieldMetadata: FieldMetadata;
  otherSpecsMetadata: OtherSpecsMetadata;
  extraFlags?: Partial<ValidationFlags>;
  source: "seeded" | "ai_processed";
}

export interface FinalizedProduct {
  rawInputText: string;
  inputName: string;
  productName: string;
  category: string;
  subcategory: string;
  specs: ProductSpecs;
  descriptionShort: string;
  descriptionDetailed: string;
  searchKeywords: string[];
  fieldMetadata: FieldMetadata;
  otherSpecsMetadata: OtherSpecsMetadata;
  validationFlags: ValidationFlags;
  qualityScore: QualityScore;
  status: ProductStatus;
  source: "seeded" | "ai_processed";
  createdAt: number;
}

export function finalizeProduct(input: FinalizeInput): FinalizedProduct {
  // Normalize dimensions/weight to metric internally.
  const { normalizedDimensionsMm, normalizedWeightKg } = normalizeToMetric(
    input.specs,
  );
  const otherSpecs: Record<string, string> = { ...input.specs.otherSpecs };
  if (normalizedDimensionsMm) {
    otherSpecs["normalized_dimensions_mm"] = normalizedDimensionsMm;
  }
  if (normalizedWeightKg) {
    otherSpecs["normalized_weight_kg"] = normalizedWeightKg;
  }

  const specs: ProductSpecs = { ...input.specs, otherSpecs };

  const detected = detectValidationFlags({
    category: input.category,
    specs,
    fieldMetadata: input.fieldMetadata,
    otherSpecsMetadata: input.otherSpecsMetadata,
    descriptionShort: input.descriptionShort,
    descriptionDetailed: input.descriptionDetailed,
    searchKeywords: input.searchKeywords,
  });

  const validationFlags: ValidationFlags = {
    missingFields: [
      ...new Set([
        ...detected.missingFields,
        ...(input.extraFlags?.missingFields ?? []),
      ]),
    ],
    conflictingValues: [
      ...new Set([
        ...detected.conflictingValues,
        ...(input.extraFlags?.conflictingValues ?? []),
      ]),
    ],
    suspiciousValues: [
      ...new Set([
        ...detected.suspiciousValues,
        ...(input.extraFlags?.suspiciousValues ?? []),
      ]),
    ],
    unitInconsistencies: [
      ...new Set([
        ...detected.unitInconsistencies,
        ...(input.extraFlags?.unitInconsistencies ?? []),
      ]),
    ],
  };

  const qualityScore = computeQualityScore({
    fieldMetadata: input.fieldMetadata,
    otherSpecsMetadata: input.otherSpecsMetadata,
    flags: validationFlags,
    descriptionShort: input.descriptionShort,
    descriptionDetailed: input.descriptionDetailed,
    searchKeywords: input.searchKeywords,
    productName: input.productName,
    category: input.category,
  });

  const status = deriveStatus(
    qualityScore,
    validationFlags,
    input.productName,
    input.category,
    input.fieldMetadata,
  );

  return {
    rawInputText: input.rawInputText,
    inputName: input.inputName,
    productName: input.productName?.trim() || "Unnamed product",
    category: input.category?.trim() || "Uncategorized",
    subcategory: input.subcategory?.trim() ?? "",
    specs,
    descriptionShort: input.descriptionShort ?? "",
    descriptionDetailed: input.descriptionDetailed ?? "",
    searchKeywords: input.searchKeywords,
    fieldMetadata: input.fieldMetadata,
    otherSpecsMetadata: input.otherSpecsMetadata,
    validationFlags,
    qualityScore,
    status,
    source: input.source,
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Source classification helpers
// ---------------------------------------------------------------------------

export const SOURCE_LABELS: Record<SourceKind, string> = {
  original: "Original",
  ai_generated: "AI-generated",
  ai_inferred: "AI-inferred",
  unknown: "Unknown",
};

export function isKnownSource(source: SourceKind): boolean {
  return SOURCE_KINDS.includes(source);
}
