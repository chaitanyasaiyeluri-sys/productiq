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
import { SourceBadge, StatusBadge, ConfidenceBar } from "@/components/product-bits";

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
    text: "Parse raw input — pasted text or CSV — into candidate attributes with verbatim source snippets.",
  },
  {
    icon: FileSearch,
    title: "Enrich",
    text: "Classify every field as original, AI-inferred, AI-generated, or unknown, with a confidence score.",
  },
  {
    icon: ShieldCheck,
    title: "Validate",
    text: "Detect missing fields, conflicting values, suspicious values, and unit inconsistencies.",
  },
  {
    icon: Store,
    title: "Commerce",
    text: "Generate a title, short and detailed descriptions, and search keywords ready for a catalog.",
  },
  {
    icon: Gauge,
    title: "Score",
    text: "A transparent 0–100 Product Quality Score from completeness, evidence, and consistency.",
  },
  {
    icon: CheckCircle2,
    title: "Save",
    text: "The validated, explainable record lands in the catalog — no malformed data, ever.",
  },
];

const RULES = [
  {
    title: "Never fabricate specifications",
    text: "If the source doesn't support a technical value, ProductIQ returns unknown — it never invents a spec to fill a gap.",
  },
  {
    title: "Every field is classified",
    text: "Each value carries a source label — original, AI-inferred, AI-generated, or unknown — plus a confidence score.",
  },
  {
    title: "Evidence, not invention",
    text: "Original values keep their verbatim source snippets. Claims are checked against the supplied text before they're shown.",
  },
  {
    title: "Scoring you can audit",
    text: "The quality score breaks down into completeness, evidence coverage, consistency, validation status, and commerce readiness.",
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
          <span className="font-medium text-white">Chrome steel (AISI 52100)</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-white/60">Dimensions</span>
          <span className="font-medium text-white">25 × 52 × 15 mm</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-white/60">Confidence</span>
          <ConfidenceBar confidence={88} className="[&>span]:text-white/70" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-[12px] text-emerald-300">
        <CheckCircle2 className="size-3.5 shrink-0" />
        Validated — no conflicts, units normalized to metric
      </div>
    </div>
  );
}

export default function Landing() {
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
              to="/auth"
              className="hidden rounded-lg px-3.5 py-2 text-[13px] font-medium text-white/70 transition-colors hover:text-white sm:block"
            >
              Sign in
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
            >
              Open the demo
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
                AI-powered product intelligence for industrial commerce
              </span>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                Turn scattered product data into a catalog{" "}
                <span className="text-sky-400">you can trust</span>.
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/60">
                ProductIQ ingests raw, incomplete industrial product information and returns
                structured, enriched, validated, and commerce-ready records — with every field
                labeled by source, confidence, and evidence.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:bg-primary/90"
                >
                  Open the live demo
                  <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#pipeline"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
                >
                  See the pipeline
                </a>
              </div>
              <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                {[
                  ["42", "products in the demo catalog"],
                  ["8", "industrial categories"],
                  ["100%", "of fields classified"],
                  ["0", "invented specifications"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt className="text-2xl font-semibold tabular-nums text-white">{value}</dt>
                    <dd className="mt-1 text-[12px] leading-snug text-white/50">{label}</dd>
                  </div>
                ))}
              </dl>
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
          <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
            The AI pipeline
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            From raw text to a catalog-ready record in six stages
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-500">
            The live workflow runs a real language-model call under a strict structured-output
            contract. Every stage is visible, and malformed output is rejected instead of saved.
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

      {/* ---------- Reliability rules ---------- */}
      <section id="reliability" className="border-y bg-zinc-50/80">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <motion.div {...fadeUp} className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
              Reliability by design
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              The rules that keep AI honest
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-500">
              ProductIQ is built around a strict AI reliability contract. Judges and catalog
              teams can always tell where a value came from — and why it was chosen.
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

      {/* ---------- Quality / validation showcase ---------- */}
      <section id="quality" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
              Validation Center
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              See the issues a catalog hides
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-500">
              The seeded demo catalog is deliberately imperfect: missing fields, conflicting
              values, unit inconsistencies, and implausible entries. ProductIQ surfaces every
              one and scores each record so teams know exactly what needs attention.
            </p>
            <div className="mt-6 flex items-center gap-2 text-[13px] text-zinc-500">
              <Circle className="size-3.5 text-zinc-400" />
              Weights recorded in millimetres, bearings weighing 950 kg, double voltage ratings —
              all flagged, none hidden.
            </div>
            <Link
              to="/dashboard"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Open the Validation Center
              <ArrowUpRight className="size-4" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">Catalog-wide validation</h3>
                <span className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                  <TriangleAlert className="size-3.5 text-amber-500" />
                  18 records need review
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { label: "Missing fields", count: 41, color: "bg-zinc-400" },
                  { label: "Unit inconsistencies", count: 8, color: "bg-sky-500" },
                  { label: "Suspicious values", count: 7, color: "bg-amber-500" },
                  { label: "Conflicting values", count: 8, color: "bg-rose-500" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-40 text-[13px] text-zinc-600">{row.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${row.color}`}
                        style={{ width: `${Math.min(100, (row.count / 48) * 100)}%` }}
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
                  <span className="text-xl font-semibold tabular-nums text-zinc-900">74 / 100</span>
                </div>
                <p className="mt-1 text-[12px] text-zinc-500">
                  Weighted from completeness, evidence, consistency, validation, and commerce readiness.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="bg-[#0d1120]">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <motion.div {...fadeUp}>
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to see your catalog transformed?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
              Add a product, paste a datasheet, and watch the live pipeline extract, validate,
              score, and save it — with full evidence for every field.
            </p>
            <Link
              to="/add"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-xl shadow-primary/30 transition-colors hover:bg-primary/90"
            >
              Add your first product
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
