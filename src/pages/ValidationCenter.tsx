import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { FlagBadge, QualityRing, type FlagKind } from "@/components/product-bits";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Product = Doc<"products">;

interface IssueRow {
  product: Product;
  kind: FlagKind;
  message: string;
}

const KIND_LABELS: { kind: FlagKind; label: string }[] = [
  { kind: "missing", label: "Missing fields" },
  { kind: "conflict", label: "Conflicting values" },
  { kind: "suspicious", label: "Suspicious values" },
  { kind: "unit", label: "Unit inconsistencies" },
];

export default function ValidationCenter() {
  const stats = useQuery(api.products.stats);
  const products = useQuery(api.products.list);
  const [filter, setFilter] = useState<"all" | FlagKind>("all");
  const [query, setQuery] = useState("");

  const issues = useMemo<IssueRow[]>(() => {
    const rows: IssueRow[] = [];
    for (const product of products ?? []) {
      const { validationFlags } = product;
      rows.push(
        ...validationFlags.missingFields.map((message) => ({
          product,
          kind: "missing" as const,
          message,
        })),
        ...validationFlags.conflictingValues.map((message) => ({
          product,
          kind: "conflict" as const,
          message,
        })),
        ...validationFlags.suspiciousValues.map((message) => ({
          product,
          kind: "suspicious" as const,
          message,
        })),
        ...validationFlags.unitInconsistencies.map((message) => ({
          product,
          kind: "unit" as const,
          message,
        })),
      );
    }
    return rows;
  }, [products]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return issues.filter((row) => {
      if (filter !== "all" && row.kind !== filter) return false;
      if (needle && !row.product.productName.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [issues, filter, query]);

  if (stats === undefined || products === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const summary = [
    { kind: "missing" as const, count: stats.flagCounts.missingFields, tone: "bg-zinc-100 text-zinc-700" },
    { kind: "conflict" as const, count: stats.flagCounts.conflictingValues, tone: "bg-rose-50 text-rose-700" },
    { kind: "suspicious" as const, count: stats.flagCounts.suspiciousValues, tone: "bg-amber-50 text-amber-700" },
    { kind: "unit" as const, count: stats.flagCounts.unitInconsistencies, tone: "bg-sky-50 text-sky-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
          Validation Center
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          Catalog-wide validation
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every record is scored and flagged by the same rules — missing fields, conflicts,
          suspicious values, and unit inconsistencies.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map(({ kind, count, tone }) => (
          <button
            key={kind}
            onClick={() => setFilter(filter === kind ? "all" : kind)}
            className={cn(
              "rounded-2xl border bg-card p-5 text-left shadow-sm transition-all",
              filter === kind && "ring-2 ring-primary/40",
            )}
          >
            <div className="flex items-center justify-between">
              <FlagBadge kind={kind} />
              {filter === kind && <CheckCircle2 className="size-4 text-primary" />}
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">
              {count}
            </p>
            <p className="mt-1 text-[12px] text-zinc-400">
              across {stats.total} products
            </p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-72 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors",
              filter === "all"
                ? "bg-zinc-900 text-white"
                : "border bg-card text-zinc-600 hover:bg-zinc-50",
            )}
          >
            All issues ({issues.length})
          </button>
          {KIND_LABELS.map(({ kind, label }) => (
            <button
              key={kind}
              onClick={() => setFilter(filter === kind ? "all" : kind)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors",
                filter === kind
                  ? "bg-zinc-900 text-white"
                  : "border bg-card text-zinc-600 hover:bg-zinc-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Issues table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <ShieldCheck className="size-10 text-emerald-500" />
            <p className="text-sm font-semibold text-zinc-800">No issues found</p>
            <p className="max-w-sm text-[13px] text-zinc-500">
              {filter === "all"
                ? "Every product in the catalog is clean — no validation flags detected."
                : `No ${KIND_LABELS.find((k) => k.kind === filter)?.label.toLowerCase()} detected for this filter.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b bg-zinc-50/80 text-[11px] uppercase tracking-wide text-zinc-400">
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Issue type</th>
                  <th className="px-4 py-3 font-semibold">Issue</th>
                  <th className="px-4 py-3 font-semibold">Quality</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => (
                  <tr
                    key={`${row.product._id}-${row.kind}-${index}`}
                    className="border-b border-zinc-100 align-top transition-colors last:border-0 hover:bg-zinc-50/60"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/products/${row.product._id}`}
                        className="font-medium text-zinc-900 hover:text-primary"
                      >
                        {row.product.productName}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-zinc-400">
                        {row.product.status === "complete" ? "Validated" : "Needs review"}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-zinc-600">{row.product.category}</td>
                    <td className="px-4 py-3.5">
                      <FlagBadge kind={row.kind} />
                    </td>
                    <td className="max-w-md px-4 py-3.5 text-[13px] leading-relaxed text-zinc-700">
                      {row.message}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <QualityRing score={row.product.qualityScore.overall} size={32} />
                        <span className="text-[12px] text-zinc-400">/100</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        to={`/products/${row.product._id}`}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                      >
                        Inspect
                        <ArrowUpRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
