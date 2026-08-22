/**
 * ProductIQ shared domain types.
 *
 * These types describe the canonical Product record, the field-level metadata
 * contract, validation flags, quality scoring, and the AI pipeline job model.
 * They are imported by both the Convex backend and the React frontend so every
 * page renders the same shape of data.
 */
/**
 * Branded identifier, structurally identical to Convex's `Id<T>`.
 * Kept local so the shared domain types stay self-contained for both the
 * Convex backend and the React frontend.
 */
export type Id<T extends string> = string & { __tableName: T };

export const SOURCE_KINDS = [
  "original",
  "ai_generated",
  "ai_inferred",
  "unknown",
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface FieldMetadataEntry {
  /** Display value for the field (null when the value could not be determined). */
  value: string | number | string[] | boolean | null;
  source: SourceKind;
  /** 0–100 confidence that the value is correct. */
  confidence: number;
  /** Verbatim excerpt of the source text that supports this value, if any. */
  sourceTextSnippet: string | null;
  /** Identifier of the source document (e.g. "Product datasheet"). */
  sourceDocument: string | null;
  /** Concise, user-facing justification for how this value was selected. */
  explanation: string | null;
}

export const FIELD_KEYS = [
  "productName",
  "category",
  "subcategory",
  "material",
  "dimensions",
  "weight",
  "voltageRating",
  "certifications",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

/** One consistent field_metadata object across the whole application. */
export type FieldMetadata = Record<FieldKey, FieldMetadataEntry>;

/** Dynamic technical specifications carry the same provenance contract as
 *  core fields — every value must have source, confidence, and evidence,
 *  or be marked unknown. */
export type OtherSpecsMetadata = Record<string, FieldMetadataEntry>;

export interface DimensionsSpec {
  length: number | null;
  width: number | null;
  height: number | null;
  unit: string | null;
}

export interface WeightSpec {
  value: number | null;
  unit: string | null;
}

export interface ProductSpecs {
  material: string | null;
  dimensions: DimensionsSpec | null;
  weight: WeightSpec | null;
  voltageRating: string | null;
  certifications: string[];
  otherSpecs: Record<string, string>;
}

export interface ValidationFlags {
  missingFields: string[];
  conflictingValues: string[];
  suspiciousValues: string[];
  unitInconsistencies: string[];
}

export interface QualityScore {
  /** 0–100 overall score. */
  overall: number;
  components: {
    completeness: number;
    evidenceCoverage: number;
    consistency: number;
    validationStatus: number;
    commerceReadiness: number;
  };
  explanation: string;
}

export type ProductStatus = "complete" | "needs_review";
export type ProductSource = "seeded" | "ai_processed";

export interface Product {
  _id: Id<"products">;
  _creationTime: number;
  /** The unmodified text the product was built from. */
  rawInputText: string;
  /** Short label for the input (e.g. file name or "Pasted text"). */
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
  /** How this product entered the catalog. */
  source: ProductSource;
  createdAt: number;
}

export interface PipelineStageState {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail: string | null;
}

export type ProcessingStatus = "processing" | "succeeded" | "failed";

export interface ProcessingJob {
  _id: Id<"processingJobs">;
  _creationTime: number;
  rawInputText: string;
  inputName: string;
  status: ProcessingStatus;
  /** Index of the stage currently running (or last completed). */
  currentStage: number;
  stages: PipelineStageState[];
  productId: Id<"products"> | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

export const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: "extract", label: "Extracting product information" },
  { key: "enrich", label: "Enriching product attributes" },
  { key: "validate", label: "Validating information" },
  { key: "commerce", label: "Generating commerce content" },
  { key: "score", label: "Calculating quality score" },
  { key: "save", label: "Saving product" },
];

export const ERROR_CODES = {
  MISSING_API_KEY: "missing_api_key",
  LLM_API_ERROR: "llm_api_error",
  LLM_TIMEOUT: "llm_timeout",
  INVALID_JSON: "invalid_llm_json",
  INVALID_SCHEMA: "schema_validation_failed",
  EMPTY_INPUT: "empty_input",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const CATEGORY_LABELS: Record<string, string> = {
  Bearings: "Bearings",
  "Electric Motors": "Electric Motors",
  Pumps: "Pumps",
  Valves: "Valves",
  "Industrial Sensors": "Industrial Sensors",
  "Electrical Components": "Electrical Components",
  "Power Supplies": "Power Supplies",
  "Pneumatic Components": "Pneumatic Components",
};
