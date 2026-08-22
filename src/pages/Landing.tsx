import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  FileSearch,
  Gauge,
  ScanSearch,
  ShieldCheck,
  Store,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { SourceBadge, StatusBadge, ConfidenceBar } from "@/components/product-bits";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const PIPELINE_STEPS = [
  {
    icon: ScanSearch,
    title: "Extract",
    text: "Find product information and evidence in raw input.",
  },
  {
    icon: FileSearch,
    title: "Enrich",
    text: "Classify fields, normalize values, and identify supported inferences.",
  },
  {
    icon: ShieldCheck,
    title: "Validate",
    text: "Check missing fields, conflicts, suspicious values, and inconsistent units.",
  },
  {
    icon: Store,
    title: "Commerce",
    text: "Create catalog-ready titles, descriptions, and search keywords.",
  },
  {
    icon: Gauge,
    title: "Score",
    text: "Calculate an explainable Product Quality Score.",
  },
  {
    icon: CheckCircle2,
    title: "Save",
    text: "Store only validated, traceable product records.",
  },
];

const RULES = [
  {
    title: "Never invent technical specifications",
    text: "When the source does not support a technical value, ProductIQ marks it Unknown instead of guessing.",
  },
  {
    title: "Evidence before confidence",
    text: "Every technical value carries provenance, confidence, and supporting evidence.",
  },
  {
    title: "Validation beyond the model",
    text: "ProductIQ independently checks units, missing fields, conflicts, and suspicious values instead of blindly trusting AI output.",
  },
  {
    title: "Quality you can measure",
    text: "A deterministic Product Quality Score combines completeness, evidence, consistency, validation, and commerce readiness.",
  },
];

function MockProductCard() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-sky-300/70">
            Product intelligence · Bearings
          </p>
          <h3 className="mt-1 text-[15px] font-semibold text-white">
            SKF 6205-2RS1 Deep Groove Ball Bearing
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status="complete" />
            <SourceBadge source="original" />
            <SourceBadge source="ai_inferred" />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold tabular-nums text-emerald-400">92</span>
          <span className="text-[10px] uppercase tracking-wide text-white/50">Quality</span>
        </div>
      </div>
      <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-white/60">Material</span>
          <span className="flex items-center gap-2 font-medium text-white">
            Chrome steel (AISI 52100)
            <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
              Original
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-white/60">Dimensions</span>
          <span className="flex items-center gap-2 font-medium text-white">
            25 × 52 × 15 mm
            <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
              Original
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-white/60">Load capacity</span>
          <span className="flex items-center gap-2 font-medium text-white/70">
            Unknown
            <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
              No source value
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-white/60">Confidence</span>
          <ConfidenceBar confidence={88} className="[&>span]:text-white/70" />
        </div>
      </div>
      <blockquote className="mt-4 rounded-lg border-l-2 border-sky-400/50 bg-white/[0.04] px-3 py-2 text-[12px] italic leading-relaxed text-white/60">
        "Bore 25 mm, outside diameter 52 mm, width 15 mm. Chrome steel rings and
        balls. Static load rating 7.8 kN."
      </blockquote>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-[12px] text-emerald-300">
        <CheckCircle2 className="size-3.5 shrink-0" />
        Validated — no conflicts, units normalized to metric, no invented specifications
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="h-[76px] animate-pulse rounded-lg bg-white/[0.06]" />
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const stats = useQuery(api.products.stats);
  const seed = useMutation(api.products.seed);
  const seededRef = useRef(false);

  // The landing page presents live figures from the demo catalog, so seed it
  // on first visit (idempotent — the Dashboard does the same).
  useEffect(() => {
    if (!stats || stats.total > 0 || seededRef.current) return;
    seededRef.current = true;
    void seed({});
  }, [stats, seed]);

  const demoHref = isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard";
  const runHref = "/add";

  const metrics = stats
    ? [
        { value: String(stats.total), label: "Products in demo catalog" },
        { value: String(stats.categoryCount), label: "Industrial categories" },
        { value: `${stats.fieldsClassifiedPct}%`, label: "Core fields classified" },
        { value: String(stats.unsupportedSpecs), label: "Unsupported specifications" },
      ]
    : null;

  const flagRows = stats
    ? [
        { label: "Missing fields", count: stats.flagCounts.missingFields, color: "bg-zinc-400" },
        { label: "Unit inconsistencies", count: stats.flagCounts.unitInconsistencies, color: "bg-sky-500" },
        { label: "Suspicious values", count: stats.flagCounts.suspiciousValues, color: "bg-amber-500" },
        { label: "Conflicting values", count: stats.flagCounts.conflictingValues, color: "bg-rose-500" },
      ]
    : null;
  const maxFlagCount = stats
    ? Math.max(
        stats.flagCounts.missingFields,
        stats.flagCounts.conflictingValues,
        stats.flagCounts.suspiciousValues,
        stats.flagCounts.unitInconsistencies,
        1,
      )
    : 1;

  return (
    <div className="min-h-screen bg-background">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d1120]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-white">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ScanSearch className="size-5" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Product<span className="text-sky-400">IQ</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-white/60 md:flex">
            <a href="#pipeline" className="transition-colors hover:text-white">Pipeline</a>
            <a href="#reliability" className="transition-colors hover:text-white">Reliability</a>
            <a href="#quality" className="transition-colors hover:text-white">Quality scoring</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link
              to={isAuthenticated ? "/dashboard" : "/auth"}
              className="hidden rounded-lg px-3.5 py-2 text-[13px] font-medium text-white/70 transition-colors hover:text-white sm:block"
            >
              {isAuthenticated ? "Dashboard" : "Sign in"}
            </Link>
            <Link
              to={demoHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
            >
              {isAuthenticated ? "Dashboard" : "Open the demo"}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-[#0d1120] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_1fr]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[12px] font-medium text-sky-300">
                <span className="size-1.5 rounded-full bg-sky-400" />
                Live AI product intelligence
              </span>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                Turn scattered product data into a catalog{" "}
                <span className="text-sky-400">you can trust</span>.
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/60">
                ProductIQ transforms raw product data from text, spreadsheets, and
                supplier documents into structured, validated, catalog-ready records.
                Every core field is traceable to its source, scored for confidence, and
                checked for inconsistencies before it reaches your catalog.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={runHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:bg-primary/90"
                >
                  Run a product through ProductIQ
                  <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#pipeline"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
                >
                  Explore the AI pipeline
                  <ArrowRight className="size-4" />
                </a>
              </div>
              <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                {metrics
                  ? metrics.map(({ value, label }) => (
                      <div key={label}>
                        <dt className="text-2xl font-semibold tabular-nums text-white">{value}</dt>
                        <dd className="mt-1 text-[12px] leading-snug text-white/50">{label}</dd>
                      </div>
                    ))
                  : Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}
              </dl>
              <p className="mt-6 text-[11px] text-white/35">
                Live figures computed from the demo catalog — no invented numbers.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="flex justify-center lg:justify-end"
            >
              <MockProductCard />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---------- Pipeline ---------- */}
      <section id="pipeline" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <motion.div {...fadeUp} className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
              The AI pipeline
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live AI pipeline
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            From raw product data to a trusted catalog record
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-500">
            ProductIQ combines Gemini-powered extraction with deterministic validation
            and scoring to turn messy product information into structured, explainable
            catalog data.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-zinc-200/70 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_STEPS.map(({ icon: Icon, title, text }, index) => (
            <motion.div
              key={title}
              {...fadeUp}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className="group bg-card p-6 transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-zinc-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-zinc-900">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- Reliability ---------- */}
      <section id="reliability" className="border-y bg-zinc-50/80">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <motion.div {...fadeUp} className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
              Reliability by design
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              AI built to show its work
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-500">
              ProductIQ does not treat AI output as fact. Every technical value must be
              supported by evidence, every field has a clear provenance state, and every
              record is checked before it becomes catalog-ready.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {RULES.map((rule, index) => (
              <motion.div
                key={rule.title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: index * 0.06 }}
                className="rounded-2xl border bg-card p-6 shadow-sm"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-zinc-900">{rule.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{rule.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Validation ---------- */}
      <section id="quality" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
              Validation Center
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              Find the problems hidden in your catalog
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-500">
              Product data can look complete while hiding missing fields, conflicting
              values, inconsistent units, and suspicious specifications. ProductIQ
              surfaces these issues before they become catalog problems.
            </p>
            <div className="mt-6 flex items-center gap-2 text-[13px] text-zinc-500">
              <Circle className="size-3.5 text-zinc-400" />
              The demo catalog is deliberately imperfect — weights recorded in millimetres,
              bearings weighing 950 kg, double voltage ratings. All flagged, none hidden.
            </div>
            <Link
              to="/validation"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Open the Validation Center
              <ArrowUpRight className="size-4" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
            {stats && flagRows ? (
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">Catalog-wide validation</h3>
                  <span className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                    <TriangleAlert className="size-3.5 text-amber-500" />
                    {stats.needsReview} records need review
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {flagRows.map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="w-40 text-[13px] text-zinc-600">{row.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={`h-full rounded-full ${row.color}`}
                          style={{ width: `${Math.min(100, (row.count / maxFlagCount) * 100)}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-[13px] font-semibold tabular-nums text-zinc-800">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t pt-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-medium text-zinc-700">Average product quality</span>
                    <span className="text-xl font-semibold tabular-nums text-zinc-900">
                      {stats.avgQuality} / 100
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-zinc-500">
                    Weighted from completeness, evidence, consistency, validation, and commerce readiness.
                  </p>
                </div>
                <p className="mt-4 border-t pt-3 text-[11px] text-zinc-400">
                  Live counts from the demo catalog — every figure computed from the current records.
                </p>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border bg-card p-6 shadow-sm">
                <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-2 animate-pulse rounded-full bg-zinc-100" />
                ))}
                <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="bg-[#0d1120]">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <motion.div {...fadeUp}>
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Turn raw product data into trusted product intelligence.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
              Add a product or paste your source data and watch ProductIQ extract,
              verify, validate, score, and prepare it for your catalog.
            </p>
            <Link
              to={runHref}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-xl shadow-primary/30 transition-colors hover:bg-primary/90"
            >
              Run ProductIQ
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ScanSearch className="size-3.5" />
            </span>
            <span className="font-medium text-zinc-700">ProductIQ</span>
            <span className="text-zinc-300">·</span>
            <span>AI-powered product intelligence for industrial commerce</span>
          </div>
          <p className="text-[12px] text-zinc-400">
            Built for the UniHack AI hackathon · Live AI pipeline with explainable, evidence-backed output
          </p>
        </div>
      </footer>
    </div>
  );
}
