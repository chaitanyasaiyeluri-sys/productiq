import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Gauge,
  ListChecks,
  PlusCircle,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { ConfidenceBar, QualityRing, StatusBadge } from "@/components/product-bits";
import { formatDate, relativeTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type Product = Doc<"products">;

const CATEGORY_COLORS = [
  "#3b6cf6",
  "#0ea5e9",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0d9488",
  "#64748b",
];

function productConfidence(product: Product): number {
  const values: number[] = [];
  for (const key of Object.keys(product.fieldMetadata)) {
    const entry = product.fieldMetadata[key];
    if (entry && entry.source !== "unknown" && entry.confidence > 0) {
      values.push(entry.confidence);
    }
  }
  return values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : 0;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Boxes;
  tone?: "default" | "emerald" | "amber" | "sky";
}) {
  const tones = {
    default: "bg-primary/10 text-primary",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    sky: "bg-sky-50 text-sky-600",
  };
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`flex size-9 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-[26px] font-semibold leading-none tabular-nums tracking-tight text-zinc-900">
        {value}
      </p>
      <p className="mt-2 text-[13px] font-medium text-zinc-700">{label}</p>
      {sub && <p className="mt-0.5 text-[12px] text-zinc-400">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const stats = useQuery(api.products.stats);
  const products = useQuery(api.products.list);
  const seed = useMutation(api.products.seed);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!stats || stats.total > 0 || seededRef.current) return;
    seededRef.current = true;
    void seed({});
  }, [stats, seed]);

  const qualityBands = useMemo(() => {
    const bands = [
      { name: "0–59", min: 0, max: 59, count: 0 },
      { name: "60–74", min: 60, max: 74, count: 0 },
      { name: "75–89", min: 75, max: 89, count: 0 },
      { name: "90–100", min: 90, max: 100, count: 0 },
    ];
    for (const product of products ?? []) {
      const score = product.qualityScore.overall;
      const band = bands.find((b) => score >= b.min && score <= b.max);
      if (band) band.count += 1;
    }
    return bands;
  }, [products]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const product of products ?? []) {
      counts[product.category] = (counts[product.category] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [products]);

  const flagData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Missing fields", count: stats.flagCounts.missingFields, fill: "#a1a1aa" },
      { name: "Conflicts", count: stats.flagCounts.conflictingValues, fill: "#e11d48" },
      { name: "Suspicious", count: stats.flagCounts.suspiciousValues, fill: "#d97706" },
      { name: "Unit issues", count: stats.flagCounts.unitInconsistencies, fill: "#0ea5e9" },
    ];
  }, [stats]);

  const recent = useMemo(
    () =>
      (products ?? [])
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8),
    [products],
  );

  const loading = stats === undefined || products === undefined;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-1" />
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
            Catalog overview
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            Product intelligence at a glance
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {stats.total} products · {Object.keys(stats.categoryDistribution).length} categories ·{" "}
            {stats.sourceCounts.aiProcessed} processed live with AI
          </p>
        </div>
        <Link
          to="/add"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <PlusCircle className="size-4" />
          Add product
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Products processed"
          value={String(stats.total)}
          sub={`${stats.sourceCounts.seeded} seeded · ${stats.sourceCounts.aiProcessed} AI`}
          icon={Boxes}
        />
        <StatCard
          label="Validated products"
          value={String(stats.complete)}
          sub="No issues requiring review"
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Needing review"
          value={String(stats.needsReview)}
          sub="Conflicts, suspicions, or gaps"
          icon={TriangleAlert}
          tone="amber"
        />
        <StatCard
          label="Average confidence"
          value={`${stats.avgConfidence}%`}
          sub="Across all classified fields"
          icon={Sparkles}
          tone="sky"
        />
        <StatCard
          label="Avg quality score"
          value={`${stats.avgQuality}`}
          sub="Out of 100"
          icon={Gauge}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Products by category</h2>
            <Boxes className="size-4 text-zinc-400" />
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {categoryData.map((_, index) => (
                    <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e4e4e7",
                    fontSize: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {categoryData.slice(0, 6).map((c, index) => (
              <div key={c.name} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                />
                <span className="truncate">{c.name}</span>
                <span className="ml-auto font-medium tabular-nums text-zinc-700">{c.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Quality score distribution</h2>
            <Gauge className="size-4 text-zinc-400" />
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={qualityBands} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e4e4e7",
                    fontSize: 12,
                  }}
                  cursor={{ fill: "#fafafa" }}
                />
                <Bar dataKey="count" name="Products" radius={[6, 6, 0, 0]} fill="#3b6cf6" maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[12px] text-zinc-400">
            Score bands reflect completeness, evidence, consistency, and validation.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Validation issues</h2>
            <ListChecks className="size-4 text-zinc-400" />
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flagData} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={88}
                  tick={{ fontSize: 12, fill: "#52525b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7", fontSize: 12 }}
                  cursor={{ fill: "#fafafa" }}
                />
                <Bar dataKey="count" name="Issues" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {flagData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Link
            to="/validation"
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            Open Validation Center
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Recent products */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Recent products</h2>
          <span className="text-[12px] text-zinc-400">Newest first</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b bg-zinc-50/80 text-[11px] uppercase tracking-wide text-zinc-400">
                <th className="px-5 py-2.5 font-semibold">Product</th>
                <th className="px-4 py-2.5 font-semibold">Category</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Confidence</th>
                <th className="px-4 py-2.5 font-semibold">Quality</th>
                <th className="px-4 py-2.5 font-semibold">Added</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {recent.map((product) => (
                <tr key={product._id} className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50/60">
                  <td className="px-5 py-3">
                    <Link
                      to={`/products/${product._id}`}
                      className="font-medium text-zinc-900 hover:text-primary"
                    >
                      {product.productName}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-zinc-400">
                      {product.source === "ai_processed" ? "AI processed" : "Seeded demo"} ·{" "}
                      {relativeTime(product.createdAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-zinc-600">{product.category}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={product.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBar confidence={productConfidence(product)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <QualityRing score={product.qualityScore.overall} size={36} />
                      <span className="text-[12px] text-zinc-400">/100</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-zinc-500">{formatDate(product.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-[12px]">
                      <Link to={`/products/${product._id}`}>
                        Open
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
