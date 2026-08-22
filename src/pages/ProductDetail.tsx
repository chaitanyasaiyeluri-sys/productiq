import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  Circle,
  ClipboardCopy,
  FileSearch,
  Ruler,
  ShieldCheck,
  Store,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ConfidenceBar,
  QualityRing,
  ScoreBreakdown,
  SourceBadge,
  StatusBadge,
} from "@/components/product-bits";
import { displayValue, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import type { FieldKey } from "@/convex/types";
import { FIELD_KEYS } from "@/convex/types";

type Product = Doc<"products">;

const FIELD_LABELS: Record<FieldKey, string> = {
  productName: "Product name",
  category: "Category",
  subcategory: "Subcategory",
  material: "Material",
  dimensions: "Dimensions",
  weight: "Weight",
  voltageRating: "Voltage rating",
  certifications: "Certifications",
};

function averageConfidence(product: Product): number {
  const values: number[] = [];
  for (const key of FIELD_KEYS) {
    const entry = product.fieldMetadata[key];
    if (entry && entry.source !== "unknown" && entry.confidence > 0) {
      values.push(entry.confidence);
    }
  }
  // Include dynamic specs in the average.
  for (const entry of Object.values(product.otherSpecsMetadata ?? {})) {
    if (entry && entry.source !== "unknown" && entry.confidence > 0) {
      values.push(entry.confidence);
    }
  }
  return values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : 0;
}

function SpecCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1.5 text-sm font-medium text-zinc-900">{value || "—"}</p>
      {hint && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

function commercePayload(product: Product): string {
  return JSON.stringify(
    {
      title: product.productName,
      category: product.category,
      subcategory: product.subcategory,
      short_description: product.descriptionShort,
      detailed_description: product.descriptionDetailed,
      search_keywords: product.searchKeywords,
      specifications: {
        material: product.specs.material,
        dimensions: product.specs.dimensions,
        weight: product.specs.weight,
        voltage_rating: product.specs.voltageRating,
        certifications: product.specs.certifications,
        ...product.specs.otherSpecs,
      },
      product_quality_score: product.qualityScore.overall,
    },
    null,
    2,
  );
}

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const product = useQuery(
    api.products.get,
    productId ? { productId: productId as never } : "skip",
  );
  const [copied, setCopied] = useState(false);

  const commerce = useMemo(
    () => (product ? commercePayload(product) : ""),
    [product],
  );

  const copyCommerce = async () => {
    if (!commerce) return;
    await navigator.clipboard.writeText(commerce);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (product === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
          <XCircle className="mx-auto size-10 text-rose-500" />
          <h1 className="mt-4 text-lg font-semibold text-zinc-900">Product not found</h1>
          <p className="mt-2 text-sm text-zinc-500">
            This product may have been removed from the catalog.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const confidence = averageConfidence(product);
  const { validationFlags, qualityScore, specs, fieldMetadata, otherSpecsMetadata } = product;

  // Filter normalized_* keys from otherSpecs display.
  const dynamicSpecEntries = Object.entries(specs.otherSpecs).filter(
    ([key]) => !key.startsWith("normalized_"),
  );

  // Total field count for the evidence table: core + dynamic.
  const totalFieldCount = FIELD_KEYS.length + dynamicSpecEntries.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                {product.productName}
              </h1>
              <StatusBadge status={product.status} />
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
              <span className="font-medium text-zinc-700">{product.category}</span>
              {product.subcategory && (
                <>
                  <span className="text-zinc-300">·</span>
                  <span>{product.subcategory}</span>
                </>
              )}
              <span className="text-zinc-300">·</span>
              <span>
                {product.source === "ai_processed" ? "Processed with live AI" : "Seeded demo"} ·{" "}
                {formatDate(product.createdAt)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-5 rounded-2xl border bg-card px-5 py-4 shadow-sm">
            <div className="text-center">
              <div className="flex justify-center">
                <QualityRing score={qualityScore.overall} size={56} />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">Quality score</p>
            </div>
            <div className="h-10 w-px bg-zinc-200" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Average confidence
              </p>
              <div className="mt-2">
                <ConfidenceBar confidence={confidence} />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                Across {totalFieldCount} classified fields
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="intelligence">
        <TabsList className="w-full justify-start gap-1 rounded-xl bg-zinc-100/80 p-1 sm:w-auto">
          <TabsTrigger value="intelligence" className="gap-1.5">
            <Boxes className="size-3.5" /> Product intelligence
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-1.5">
            <FileSearch className="size-3.5" /> Evidence
          </TabsTrigger>
          <TabsTrigger value="commerce" className="gap-1.5">
            <Store className="size-3.5" /> Commerce output
          </TabsTrigger>
          <TabsTrigger value="validation" className="gap-1.5">
            <ShieldCheck className="size-3.5" /> Validation
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Intelligence ---------------- */}
        <TabsContent value="intelligence" className="mt-5 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SpecCard label="Material" value={displayValue(specs.material)} />
            <SpecCard
              label="Dimensions"
              value={
                specs.dimensions
                  ? `${[specs.dimensions.length, specs.dimensions.width, specs.dimensions.height]
                      .filter((x): x is number => x !== null)
                      .join(" × ")}${specs.dimensions.unit ? ` ${specs.dimensions.unit}` : ""}`
                  : "—"
              }
              hint={
                specs.otherSpecs.normalized_dimensions_mm
                  ? `Normalized: ${specs.otherSpecs.normalized_dimensions_mm}`
                  : undefined
              }
            />
            <SpecCard
              label="Weight"
              value={
                specs.weight && specs.weight.value !== null
                  ? `${specs.weight.value}${specs.weight.unit ? ` ${specs.weight.unit}` : ""}`
                  : "—"
              }
              hint={
                specs.otherSpecs.normalized_weight_kg
                  ? `Normalized: ${specs.otherSpecs.normalized_weight_kg}`
                  : undefined
              }
            />
            <SpecCard label="Voltage rating" value={displayValue(specs.voltageRating)} />
            <SpecCard
              label="Certifications"
              value={specs.certifications.length ? specs.certifications.join(", ") : "—"}
            />
            <SpecCard
              label="Source"
              value={product.source === "ai_processed" ? "Live AI pipeline" : "Demo catalog seed"}
              hint={`Input: ${product.inputName}`}
            />
          </div>

          {dynamicSpecEntries.length > 0 && (
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">Other specifications</h2>
              <p className="mt-1 text-[12px] text-zinc-500">
                Every dynamic specification carries the same provenance contract as core fields.
              </p>
              <div className="mt-4 space-y-3">
                {dynamicSpecEntries.map(([key, value]) => {
                  const meta = otherSpecsMetadata[key];
                  return (
                    <div
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[13px] font-medium text-zinc-700">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="ml-2 text-[13px] text-zinc-900">{value}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {meta ? (
                          <>
                            <SourceBadge source={meta.source} />
                            <ConfidenceBar confidence={meta.confidence} />
                          </>
                        ) : (
                          <span className="text-[11px] text-zinc-400">No metadata</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">Short description</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {product.descriptionShort || "No short description available."}
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">Detailed description</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {product.descriptionDetailed || "No detailed description available."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Search keywords</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.searchKeywords.length === 0 && (
                <span className="text-sm text-zinc-400">None generated.</span>
              )}
              {product.searchKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border bg-zinc-50 px-3 py-1 text-[12px] font-medium text-zinc-700"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ---------------- Evidence ---------------- */}
        <TabsContent value="evidence" className="mt-5 space-y-5">
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-[13px] text-sky-900">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-600" />
            <p>
              Evidence is drawn only from the supplied source text. Values are classified as{" "}
              <strong>original</strong> (verbatim from the input), <strong>AI-inferred</strong>{" "}
              (derived, with confidence), <strong>AI-generated</strong> (commerce copy), or{" "}
              <strong>unknown</strong>. No citation, page, or document is ever invented.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50/80 text-[11px] uppercase tracking-wide text-zinc-400">
                    <th className="px-5 py-3 font-semibold">Field</th>
                    <th className="px-4 py-3 font-semibold">Value</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 font-semibold">Confidence</th>
                    <th className="px-4 py-3 font-semibold">Why this value was selected</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Core fields */}
                  {FIELD_KEYS.map((key) => {
                    const entry = fieldMetadata[key];
                    const empty =
                      entry.value === null ||
                      (typeof entry.value === "string" && entry.value.trim() === "") ||
                      (Array.isArray(entry.value) && entry.value.length === 0);
                    return (
                      <tr key={key} className="border-b border-zinc-100 align-top last:border-0">
                        <td className="px-5 py-3.5 text-[13px] font-medium text-zinc-700">
                          {FIELD_LABELS[key]}
                        </td>
                        <td className="px-4 py-3.5">
                          {empty ? (
                            <span className="text-[13px] italic text-zinc-400">
                              Not determined — returned as unknown rather than guessed
                            </span>
                          ) : (
                            <span className="text-[13px] font-medium text-zinc-900">
                              {displayValue(entry.value)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <SourceBadge source={entry.source} />
                        </td>
                        <td className="px-4 py-3.5">
                          <ConfidenceBar confidence={entry.confidence} />
                        </td>
                        <td className="max-w-sm px-4 py-3.5">
                          {entry.sourceTextSnippet && (
                            <blockquote className="rounded-lg border-l-2 border-primary/40 bg-zinc-50 px-3 py-2 text-[12px] italic leading-relaxed text-zinc-600">
                              "{entry.sourceTextSnippet}"
                            </blockquote>
                          )}
                          {entry.explanation && (
                            <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                              {entry.explanation}
                            </p>
                          )}
                          {!entry.sourceTextSnippet && !entry.explanation && (
                            <span className="text-[12px] text-zinc-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Dynamic otherSpecs fields */}
                  {dynamicSpecEntries.map(([key, value]) => {
                    const meta = otherSpecsMetadata[key];
                    const hasMeta = !!meta;
                    const isUnknown = !hasMeta || meta.source === "unknown";
                    return (
                      <tr
                        key={`spec:${key}`}
                        className="border-b border-zinc-100 align-top last:border-0"
                      >
                        <td className="px-5 py-3.5 text-[13px] font-medium text-zinc-700">
                          {key.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3.5">
                          {isUnknown && !value ? (
                            <span className="text-[13px] italic text-zinc-400">
                              Not determined — returned as unknown rather than guessed
                            </span>
                          ) : (
                            <span className="text-[13px] font-medium text-zinc-900">
                              {value || "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <SourceBadge source={hasMeta ? meta.source : "unknown"} />
                        </td>
                        <td className="px-4 py-3.5">
                          <ConfidenceBar confidence={hasMeta ? meta.confidence : 0} />
                        </td>
                        <td className="max-w-sm px-4 py-3.5">
                          {hasMeta && meta.sourceTextSnippet && (
                            <blockquote className="rounded-lg border-l-2 border-primary/40 bg-zinc-50 px-3 py-2 text-[12px] italic leading-relaxed text-zinc-600">
                              "{meta.sourceTextSnippet}"
                            </blockquote>
                          )}
                          {hasMeta && meta.explanation && (
                            <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                              {meta.explanation}
                            </p>
                          )}
                          {!hasMeta && (
                            <span className="text-[12px] text-zinc-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t bg-zinc-50/60 px-5 py-3 text-[12px] text-zinc-400">
              Source document: {fieldMetadata.productName.sourceDocument ?? "—"} · Shown snippets
              are verbatim excerpts of the input text.
            </p>
          </div>
        </TabsContent>

        {/* ---------------- Commerce ---------------- */}
        <TabsContent value="commerce" className="mt-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-2.5 text-[13px] text-zinc-500">
              <Store className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                Catalog-ready output: technical specifications stay grounded in the source, while
                descriptions and keywords are AI-generated and clearly labeled.
              </p>
            </div>
            <Button variant="outline" onClick={copyCommerce} className="gap-2">
              {copied ? <CheckCircle2 className="size-4 text-emerald-600" /> : <ClipboardCopy className="size-4" />}
              {copied ? "Copied" : "Copy commerce JSON"}
            </Button>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Catalog entry
              </h2>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Title</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900">{product.productName}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Category</p>
                  <p className="mt-1 text-sm font-medium text-zinc-800">
                    {product.category}
                    {product.subcategory ? ` / ${product.subcategory}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Keywords</p>
                  <p className="mt-1 text-sm text-zinc-700">
                    {product.searchKeywords.join(", ") || "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Short description
                </p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                  {product.descriptionShort || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Detailed description
                </p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                  {product.descriptionDetailed || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Structured specifications
                </p>
                <div className="mt-2 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {(
                    [
                      ["Material", specs.material],
                      [
                        "Dimensions",
                        specs.dimensions
                          ? `${[specs.dimensions.length, specs.dimensions.width, specs.dimensions.height]
                              .filter((x): x is number => x !== null)
                              .join(" × ")}${specs.dimensions.unit ? ` ${specs.dimensions.unit}` : ""}`
                          : null,
                      ],
                      ["Weight", specs.weight ? `${specs.weight.value} ${specs.weight.unit ?? ""}`.trim() : null],
                      ["Voltage rating", specs.voltageRating],
                      ["Certifications", specs.certifications.join(", ") || null],
                    ] as [string, string | null][]
                  )
                    .concat(
                      dynamicSpecEntries as [string, string][],
                    )
                    .map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-4 border-b border-zinc-100 pb-2">
                        <span className="text-[13px] text-zinc-500">{label.replace(/_/g, " ")}</span>
                        <span className="text-right text-[13px] font-medium text-zinc-800">
                          {value || "—"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-[#0d1120] shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <p className="text-[12px] font-medium text-white/60">commerce_payload.json</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyCommerce}
                className="h-7 gap-1.5 text-[12px] text-white/60 hover:bg-white/10 hover:text-white"
              >
                {copied ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <ClipboardCopy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto px-5 py-4 font-mono text-[12px] leading-relaxed text-zinc-300">
              {commerce}
            </pre>
          </div>
        </TabsContent>

        {/* ---------------- Validation ---------------- */}
        <TabsContent value="validation" className="mt-5 space-y-5">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">Product quality score</h2>
                <QualityRing score={qualityScore.overall} size={48} />
              </div>
              <div className="mt-5">
                <ScoreBreakdown components={qualityScore.components} />
              </div>
              <p className="mt-4 border-t pt-4 text-[12px] leading-relaxed text-zinc-500">
                {qualityScore.explanation}
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  kind: "Missing fields",
                  icon: Circle,
                  items: validationFlags.missingFields,
                  tone: "border-zinc-200 bg-zinc-50/70 text-zinc-500",
                },
                {
                  kind: "Conflicting values",
                  icon: TriangleAlert,
                  items: validationFlags.conflictingValues,
                  tone: "border-rose-200 bg-rose-50/60 text-rose-700",
                },
                {
                  kind: "Suspicious values",
                  icon: TriangleAlert,
                  items: validationFlags.suspiciousValues,
                  tone: "border-amber-200 bg-amber-50/60 text-amber-700",
                },
                {
                  kind: "Unit inconsistencies",
                  icon: Ruler,
                  items: validationFlags.unitInconsistencies,
                  tone: "border-sky-200 bg-sky-50/60 text-sky-700",
                },
              ].map(({ kind, icon: Icon, items, tone }) => (
                <div key={kind} className="rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-zinc-400" />
                    <h3 className="text-sm font-semibold text-zinc-900">{kind}</h3>
                    <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-600">
                      {items.length}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="mt-3 flex items-center gap-1.5 text-[13px] text-zinc-400">
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      None detected
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {items.map((item) => (
                        <li
                          key={item}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed ${tone}`}
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-60" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
