import { motion } from "framer-motion";
import { ArrowLeft, LayoutDashboard, ScanSearch } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#0d1120] text-white"
    >
      {/* Background grid, consistent with the landing hero */}
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

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 text-white">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ScanSearch className="size-5" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Product<span className="text-sky-400">IQ</span>
          </span>
        </Link>
      </header>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <p className="text-[12px] font-semibold uppercase tracking-widest text-sky-400">
            Error 404
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight sm:text-6xl">
            Page not found
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/55">
            The page you're looking for doesn't exist, or it may have been moved.
            Head back to the catalog to keep working with your product data.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="gap-2">
              <Link to="/dashboard">
                <LayoutDashboard className="size-4" />
                Back to dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2 border-white/15 bg-transparent text-white/80 hover:bg-white/10 hover:text-white">
              <Link to="/">
                <ArrowLeft className="size-4" />
                Go to landing page
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
