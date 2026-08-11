/** Small shared UI atoms used across ProductIQ pages. */
import type { SourceKind } from "@/convex/types";
import { SOURCE_LABELS } from "@/convex/scoring";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, AlertTriangle, TriangleAlert, Ruler, Boxes, FileWarning } from "lucide-react";

export const SOURCE_BADGE_STYLES: Record<SourceKind, string> = {
  original:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  ai_generated:
    "bg-sky-50 text-sky-700 ring-sky-600/20",
  ai_inferred:
    "bg-amber-50 text-amber-700 ring-amber-600/20",
  unknown:
    "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
};

export function SourceBadge({ source, className }: { source: SourceKind; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        SOURCE_BADGE_STYLES[source],
        className,
      )}
    >
      {source === "original" && <CheckCircle2 className="size-3" />}
      {source === "ai_generated" && <Boxes className="size-3" />}
      {source === "ai_inferred" && <Circle className="size-3" />}
      {source === "unknown" && <FileWarning className="size-3" />}
      {SOURCE_LABELS[source]}
    </span>
  );
}

export function StatusBadge({ status }: { status: "complete" | "needs_review" }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <CheckCircle2 className="size-3" />
        Validated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
      <TriangleAlert className="size-3" />
      Needs review
    </span>
  );
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 80) return "bg-emerald-500";
  if (confidence >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

export function ConfidenceBar({ confidence, className }: { confidence: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200/80">
        <div
          className={cn("h-full rounded-full", confidenceColor(confidence))}
          style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-zinc-600">{confidence}%</span>
    </div>
  );
}

export function QualityRing({ score, size = 72 }: { score: number; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const color = score >= 80 ? "#059669" : score >= 60 ? "#d97706" : "#e11d48";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-zinc-200/80" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-lg font-semibold tabular-nums tracking-tight" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

const COMPONENT_LABELS: { key: string; label: string; hint: string }[] = [
  { key: "completeness", label: "Completeness", hint: "Weighted presence of core fields" },
  { key: "evidenceCoverage", label: "Evidence coverage", hint: "Mean confidence across fields" },
  { key: "consistency", label: "Consistency", hint: "Penalized by conflicting values" },
  { key: "validationStatus", label: "Validation status", hint: "Penalized by validation flags" },
  { key: "commerceReadiness", label: "Commerce readiness", hint: "Descriptions and keywords ready for a catalog" },
];

export function ScoreBreakdown({ components }: { components: Record<string, number> }) {
  return (
    <div className="space-y-3">
      {COMPONENT_LABELS.map(({ key, label, hint }) => {
        const value = components[key] ?? 0;
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium text-zinc-800">{label}</span>
              <span className="text-sm font-semibold tabular-nums text-zinc-900">{value}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200/80">
              <div
                className={cn("h-full rounded-full", confidenceColor(value))}
                style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">{hint}</p>
          </div>
        );
      })}
    </div>
  );
}

export type FlagKind = "missing" | "conflict" | "suspicious" | "unit";

export const FLAG_META: Record<FlagKind, { label: string; icon: typeof AlertTriangle; classes: string }> = {
  missing: { label: "Missing field", icon: Circle, classes: "bg-zinc-100 text-zinc-700 ring-zinc-500/20" },
  conflict: { label: "Conflict", icon: AlertTriangle, classes: "bg-rose-50 text-rose-700 ring-rose-600/20" },
  suspicious: { label: "Suspicious value", icon: TriangleAlert, classes: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  unit: { label: "Unit issue", icon: Ruler, classes: "bg-sky-50 text-sky-700 ring-sky-600/20" },
};

export function FlagBadge({ kind }: { kind: FlagKind }) {
  const meta = FLAG_META[kind];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        meta.classes,
      )}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}
