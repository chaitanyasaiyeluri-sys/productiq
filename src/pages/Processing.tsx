import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Database,
  FileSearch,
  Gauge,
  Loader2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Store,
  XCircle,
} from "lucide-react";
import { QualityRing } from "@/components/product-bits";
import { errorGuidance } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Job = Doc<"processingJobs">;

const STAGE_ICONS: Record<string, typeof ScanSearch> = {
  extract: ScanSearch,
  enrich: Sparkles,
  validate: ShieldCheck,
  commerce: Store,
  score: Gauge,
  save: Database,
};

function StageRow({ stage, index }: { stage: Job["stages"][number]; index: number }) {
  const Icon = STAGE_ICONS[stage.key] ?? ScanSearch;
  const status = stage.status;

  return (
    <div className="relative flex gap-4">
      {/* Track */}
      <div className="flex flex-col items-center">
        <div
          className={`relative flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
            status === "done"
              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
              : status === "running"
                ? "border-primary/30 bg-primary/10 text-primary"
                : status === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-zinc-200 bg-card text-zinc-300"
          }`}
        >
          {status === "done" && <CheckCircle2 className="size-5" />}
          {status === "running" && <Loader2 className="size-5 animate-spin" />}
          {status === "error" && <XCircle className="size-5" />}
          {status === "pending" && <Icon className="size-4" />}
        </div>
        {index < 5 && (
          <div
            className={`w-px flex-1 ${
              status === "done" ? "bg-emerald-200" : "bg-zinc-200"
            }`}
          />
        )}
      </div>
      {/* Content */}
      <div className={`pb-8 ${index === 5 ? "pb-0" : ""}`}>
        <div className="flex items-center gap-2 pt-1.5">
          <p
            className={`text-sm font-medium ${
              status === "pending"
                ? "text-zinc-400"
                : status === "done"
                  ? "text-zinc-900"
                  : status === "error"
                    ? "text-rose-700"
                    : "text-zinc-900"
            }`}
          >
            {stage.label}
          </p>
          {status === "running" && (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              In progress
            </span>
          )}
        </div>
        {stage.detail && (
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">{stage.detail}</p>
        )}
      </div>
    </div>
  );
}

export default function Processing() {
  const { jobId } = useParams<{ jobId: string }>();
  const job = useQuery(api.processing.get, { jobId: jobId as never });
  const product = useQuery(
    api.products.get,
    job?.productId ? { productId: job.productId as never } : "skip",
  );
  const process = useAction(api.processing.process);
  const retry = useMutation(api.processing.retry);

  const startedRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!job || job.status !== "processing") return;
    if (job.stages[0]?.status !== "pending") return;
    if (startedRef.current) return;
    startedRef.current = true;
    void process({ jobId: job._id as never }).catch(() => {
      startedRef.current = false;
    });
  }, [job, process]);

  const handleRetry = async () => {
    if (!job || retrying) return;
    setRetrying(true);
    try {
      await retry({ jobId: job._id as never });
      startedRef.current = false;
      await process({ jobId: job._id as never });
    } finally {
      setRetrying(false);
    }
  };

  if (job === undefined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (job === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
          <XCircle className="mx-auto size-10 text-rose-500" />
          <h1 className="mt-4 text-lg font-semibold text-zinc-900">Processing job not found</h1>
          <p className="mt-2 text-sm text-zinc-500">
            This job may have expired. Start a new one from the Add Product page.
          </p>
          <Button asChild className="mt-6">
            <Link to="/add">Add a product</Link>
          </Button>
        </div>
      </div>
    );
  }

  const succeeded = job.status === "succeeded";
  const failed = job.status === "failed";
  const guidance = errorGuidance(job.errorCode);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
          AI processing
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {job.inputName}
          </h1>
          {succeeded && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <CheckCircle2 className="size-3.5" />
              Succeeded
            </span>
          )}
          {failed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[12px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
              <XCircle className="size-3.5" />
              Failed
            </span>
          )}
          {!succeeded && !failed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[12px] font-medium text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              Processing
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Live pipeline — each stage below updates in real time as the record is built.
        </p>
      </div>

      {/* Pipeline */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {job.stages.map((stage, index) => (
          <StageRow key={stage.key} stage={stage} index={index} />
        ))}
      </div>

      {/* Success */}
      {succeeded && product && (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/50 shadow-sm">
          <div className="flex flex-wrap items-center gap-5 p-6">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-zinc-900">Product saved to the catalog</h2>
              <p className="mt-0.5 truncate text-sm text-zinc-600">
                {product.productName}
              </p>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                {product.validationFlags.missingFields.length} missing fields ·{" "}
                {product.validationFlags.conflictingValues.length} conflicts ·{" "}
                {product.validationFlags.suspiciousValues.length} suspicious values ·{" "}
                {product.validationFlags.unitInconsistencies.length} unit issues
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="flex justify-center">
                  <QualityRing score={product.qualityScore.overall} size={52} />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">Quality score</p>
              </div>
              <Button asChild className="gap-2">
                <Link to={`/products/${product._id}`}>
                  Open Product Intelligence
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Failure */}
      {failed && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-zinc-900">{guidance.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
                {guidance.hint}
              </p>
              {job.errorMessage && (
                <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-600 ring-1 ring-inset ring-rose-100">
                  {job.errorMessage}
                </p>
              )}
              <Button
                onClick={handleRetry}
                disabled={retrying}
                variant="outline"
                className="mt-4 gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                {retrying && <Loader2 className="size-4 animate-spin" />}
                Retry pipeline
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Raw input */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <FileSearch className="size-4 text-zinc-400" />
            Raw input ({job.rawInputText.length} characters)
          </span>
          <ChevronDown
            className={`size-4 text-zinc-400 transition-transform ${showRaw ? "rotate-180" : ""}`}
          />
        </button>
        {showRaw && (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t bg-zinc-50/70 px-5 py-4 font-mono text-[12px] leading-relaxed text-zinc-600">
            {job.rawInputText}
          </pre>
        )}
      </div>
    </div>
  );
}
