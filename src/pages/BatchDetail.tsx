/**
 * Batch Detail page — shows processing progress for a batch job,
 * delivery preview with header validation, and CSV/XLSX export.
 */
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QualityRing } from "@/components/product-bits";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv } from "@/lib/csvExport";
import { downloadXlsx } from "@/lib/xlsxExport";
import { mapProductToRow } from "@/lib/deliveryMapper";
import type { Doc } from "@/convex/_generated/dataModel";

type BatchJob = Doc<"batchJobs">;

export default function BatchDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const job = useQuery(
    api.batchJobs.get,
    jobId ? { jobId: jobId as never } : "skip",
  );
  const deliverySchema = useQuery(api.deliverySchema.get);

  // Fetch all products that were created by this batch
  const allProducts = useQuery(api.products.list);

  // Map batch row products to delivery output
  const outputRows = useMemo(() => {
    if (!job || !allProducts) return [];
    const productMap = new Map(allProducts.map((p) => [p._id, p]));
    return job.rows
      .filter((row) => row.productId && row.status === "completed")
      .map((row) => {
        const product = productMap.get(row.productId!);
        if (!product) return null;
        const headers = deliverySchema?.headers ?? [];
        return mapProductToRow(product, headers, row.rawData);
      })
      .filter(Boolean) as Record<string, string>[];
  }, [job, allProducts, deliverySchema]);

  // Product details for each completed row
  const productDetails = useMemo(() => {
    if (!job || !allProducts) return [];
    const productMap = new Map(allProducts.map((p) => [p._id, p]));
    return job.rows
      .filter((row) => row.productId && row.status === "completed")
      .map((row) => ({
        ...row,
        product: productMap.get(row.productId!) ?? null,
      }));
  }, [job, allProducts]);

  if (job === undefined) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (job === null) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
          <XCircle className="mx-auto size-10 text-rose-500" />
          <h1 className="mt-4 text-lg font-semibold text-zinc-900">Batch job not found</h1>
          <Button asChild className="mt-6">
            <Link to="/batch">Back to batch upload</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isProcessing = job.status === "processing";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const progress = job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0;
  const successRate = job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0;

  const headers = deliverySchema?.headers ?? [];
  const headersValid = headers.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/batch"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Batch upload
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{job.name}</h1>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset ${
                isCompleted ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" :
                isProcessing ? "bg-primary/10 text-primary ring-primary/20" :
                isFailed ? "bg-rose-50 text-rose-700 ring-rose-600/20" :
                "bg-zinc-100 text-zinc-600 ring-zinc-500/20"
              }`}>
                {isProcessing && <Loader2 className="size-3 animate-spin" />}
                {isCompleted && <CheckCircle2 className="size-3" />}
                {isFailed && <XCircle className="size-3" />}
                {job.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {job.inputHeaders.length} input columns · Started {new Date(job.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatusCard label="Total products" value={String(job.totalRows)} />
        <StatusCard label="Processed" value={String(job.processedRows)} tone="emerald" />
        <StatusCard label="Failed" value={String(job.failedRows)} tone={job.failedRows > 0 ? "rose" : "default"} />
        <StatusCard label="Success rate" value={`${successRate}%`} tone="sky" />
        <StatusCard label="Output columns" value={String(headers.length)} tone={headersValid ? "emerald" : "amber"} />
      </div>

      {/* Progress bar */}
      {isProcessing && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-zinc-600">
              Processing row {job.currentRow + 1} of {job.totalRows}
            </span>
            <span className="font-medium text-zinc-900">{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Delivery Preview */}
      {isCompleted && headersValid && (
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-zinc-900">Delivery Preview</h2>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => downloadCsv(headers, outputRows, `${job.name}_output.csv`)}
                disabled={outputRows.length === 0}
                className="gap-1.5"
              >
                <FileText className="size-3.5" />
                Download CSV
              </Button>
              <Button
                size="sm"
                onClick={() => downloadXlsx(headers, outputRows, `${job.name}_output.xlsx`)}
                disabled={outputRows.length === 0}
                className="gap-1.5"
              >
                <FileSpreadsheet className="size-3.5" />
                Download XLSX
              </Button>
            </div>
          </div>

          {/* Validation summary */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Products" value={`${outputRows.length} / ${job.totalRows}`} ok={outputRows.length === job.totalRows} />
            <MiniStat label="Columns" value={`${headers.length} / ${headers.length}`} ok={headersValid} />
            <MiniStat label="Schema" value={headersValid ? "VALID" : "MISSING"} ok={headersValid} />
            <MiniStat
              label="Evidence"
              value={`${job.processedRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0}%`}
              ok
            />
          </div>

          {/* Scrollable preview table */}
          {outputRows.length > 0 && (
            <div className="mt-4 overflow-auto rounded-lg border max-h-96">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-zinc-50">
                  <tr>
                    {headers.slice(0, 20).map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold text-zinc-500">{h}</th>
                    ))}
                    {headers.length > 20 && <th className="px-3 py-2 text-zinc-400">+{headers.length - 20} more</th>}
                  </tr>
                </thead>
                <tbody>
                  {outputRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t">
                      {headers.slice(0, 20).map((h) => (
                        <td key={h} className="max-w-[150px] truncate px-3 py-1.5 text-zinc-700">{row[h] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {outputRows.length > 20 && (
                <p className="border-t bg-zinc-50 px-3 py-2 text-[11px] text-zinc-400">
                  Showing 20 of {outputRows.length} rows · Download for full output
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* No schema warning */}
      {isCompleted && !headersValid && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 text-amber-600" />
            <div>
              <h2 className="text-sm font-semibold text-amber-900">No delivery schema configured</h2>
              <p className="mt-1 text-[13px] text-amber-700">
                Upload the official Expected Output CSV in the Batch Upload page to enable export.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/batch">Configure schema</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Per-product details */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Processed products</h2>
        <div className="mt-3 space-y-2">
          {productDetails.map((row) => (
            <div
              key={row.index}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-zinc-900 truncate">
                  Row {row.index + 1}: {row.product?.productName ?? row.rawData[Object.keys(row.rawData)[0]] ?? "Unknown"}
                </p>
                {row.error && (
                  <p className="mt-0.5 text-[12px] text-rose-600 truncate">{row.error}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {row.product && (
                  <div className="flex items-center gap-2">
                    <QualityRing score={row.product.qualityScore.overall} size={28} />
                    <span className="text-[11px] text-zinc-400">/100</span>
                  </div>
                )}
                {row.productId ? (
                  <Link
                    to={`/products/${row.productId}`}
                    className="text-[12px] font-medium text-primary hover:underline"
                  >
                    View
                  </Link>
                ) : (
                  <span className="text-[12px] text-zinc-400">
                    {row.status === "failed" ? "Failed" : "Processing"}
                  </span>
                )}
              </div>
            </div>
          ))}
          {productDetails.length === 0 && (
            <p className="py-8 text-center text-[13px] text-zinc-400">
              {isProcessing ? "Processing products..." : "No products processed yet."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value, tone = "default" }: { label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    default: "bg-zinc-50 text-zinc-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className={`rounded-xl p-4 ${tones[tone] ?? tones.default}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
      {ok ? (
        <CheckCircle2 className="size-3.5 text-emerald-500" />
      ) : (
        <XCircle className="size-3.5 text-amber-500" />
      )}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
        <p className="text-[13px] font-medium text-zinc-800">{value}</p>
      </div>
    </div>
  );
}
