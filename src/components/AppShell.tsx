import { cn } from "@/lib/utils";
import { NavLink, Link, useLocation, useNavigate } from "react-router";
import {
  ChevronDown,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PlusCircle,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** First two initials from a name or email, for the avatar fallback. */
function userInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-[12px] font-semibold text-primary">
              {userInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-[13px] font-medium text-foreground">
            {user?.name ?? "ProductIQ user"}
          </p>
          {user?.email && (
            <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/batch", label: "Batch Processing", icon: FileSpreadsheet },
  { to: "/add", label: "Add Product", icon: PlusCircle },
  { to: "/validation", label: "Validation Center", icon: ListChecks },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <ScanSearch className="size-5" />
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight">
          Product<span className="text-primary">IQ</span>
        </span>
      )}
    </Link>
  );
}

function SidebarNav() {
  const location = useLocation();
  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const active =
          to === "/dashboard"
            ? location.pathname === "/dashboard"
            : location.pathname.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const title = NAV_ITEMS.find((item) =>
    item.to === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(item.to),
  )?.label;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav />
        </div>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/60 px-3 py-2.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground">Live AI pipeline</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">
                Gemini 3.7 Flash
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-sidebar px-4 text-sidebar-foreground lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active =
                to === "/dashboard"
                  ? location.pathname === "/dashboard"
                  : location.pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              );
            })}
          </nav>
          <UserMenu />
        </div>
      </header>

      {/* Main content */}
      <div className="lg:pl-60">
        <div className="hidden h-16 items-center justify-between border-b bg-card/60 px-8 lg:flex">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Sparkles className="size-4 text-primary" />
            <span className="font-medium text-zinc-800">{title ?? "ProductIQ"}</span>
            <span className="text-zinc-300">/</span>
            <span className="text-zinc-500">Industrial product intelligence</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/add"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <PlusCircle className="size-4" />
              New product
            </Link>
            <UserMenu />
          </div>
        </div>
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
