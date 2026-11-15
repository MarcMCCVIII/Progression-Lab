import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Table2,
  TrendingUp,
  Users,
  LogOut,
} from "lucide-react";
import { useAccount } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/lib/data-store";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/scores", label: "Score entry", icon: Table2 },
  { to: "/students", label: "Students", icon: Users },
  { to: "/assessments", label: "Assessments", icon: ClipboardList },
  { to: "/analysis", label: "Student analysis", icon: TrendingUp },
  { to: "/class", label: "Class analysis", icon: BarChart3 },
  { to: "/reports", label: "Reports & data", icon: FileText },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary ring-1 ring-sidebar-border">
        <GraduationCap className="size-5" />
      </span>
      <span className="flex flex-col">
        <span className="font-display text-lg font-semibold leading-tight text-sidebar-primary">
          Progression Lab
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/60">
          Assessment analytics
        </span>
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav className="flex flex-1 flex-col gap-1">
      <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/40">
        Workspace
      </p>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4 transition-colors",
                active
                  ? "text-sidebar-ring"
                  : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SaveIndicator() {
  const { lastSaved, data, saving } = useDataStore();
  const { user, signOut } = useAccount();
  const [signingOut, setSigningOut] = useState(false);
  const recorded = data.scores.filter(
    (score) => score.status === "recorded",
  ).length;
  return (
    <div className="rounded-lg border border-sidebar-border/80 bg-sidebar-accent/40 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground">
        <Database className="size-3.5 text-sidebar-ring" />
        {saving ? "Saving to your account…" : "Saved to your account"}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/55">
        {recorded.toLocaleString()} score records
        {lastSaved
          ? ` · ${new Date(lastSaved).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : ""}
      </p>
      <div className="mt-3 border-t border-sidebar-border pt-3">
        <p
          className="truncate text-xs text-sidebar-foreground"
          title={user.email}
        >
          {user.name || user.email}
        </p>
        {user.name && (
          <p
            className="truncate text-[11px] text-sidebar-foreground/55"
            title={user.email}
          >
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          disabled={saving || signingOut}
          onClick={async () => {
            setSigningOut(true);
            try {
              await signOut();
            } catch {
              toast.error("Could not sign out. Please try again.");
              setSigningOut(false);
            }
          }}
        >
          <LogOut className="size-3.5" />
          {signingOut
            ? "Signing out…"
            : saving
              ? "Saving before sign out…"
              : "Sign out"}
        </Button>
      </div>
    </div>
  );
}

interface AppShellProps {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen w-full">
      <aside className="no-print sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Brand />
        <NavList />
        <SaveIndicator />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md lg:hidden">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open menu">
                    <Menu className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="flex w-[280px] flex-col gap-4 border-sidebar-border bg-sidebar p-4 text-sidebar-foreground"
                >
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <Brand />
                  <NavList onNavigate={() => setMobileOpen(false)} />
                  <SaveIndicator />
                </SheetContent>
              </Sheet>
              <Brand />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1280px]">
            <div className="animate-fade-rise">
              <div className="flex flex-col gap-4 border-b border-border/70 pb-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[26px] font-semibold leading-tight text-foreground sm:text-[32px]">
                    {title}
                  </h1>
                  <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
                {actions ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {actions}
                  </div>
                ) : null}
              </div>
              <div className="mt-6">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
