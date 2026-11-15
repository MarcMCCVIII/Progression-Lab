import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CircleHelp,
  Minus,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_META, formatSigned, type ProgressionStatus } from "@/lib/progression";

const STATUS_STYLES: Record<
  ProgressionStatus,
  { className: string; icon: LucideIcon }
> = {
  improving: {
    className: "border-success/30 bg-success/10 text-success",
    icon: TrendingUp,
  },
  stable: {
    className: "border-border bg-muted text-muted-foreground",
    icon: Minus,
  },
  inconsistent: {
    className: "border-info/35 bg-info/10 text-info",
    icon: Activity,
  },
  declining: {
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: TrendingDown,
  },
  attention: {
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: AlertTriangle,
  },
  insufficient: {
    className: "border-dashed border-border bg-transparent text-muted-foreground",
    icon: CircleHelp,
  },
};

export function StatusPill({
  status,
  size = "default",
}: {
  status: ProgressionStatus;
  size?: "sm" | "default";
}) {
  const meta = STATUS_META[status];
  const style = STATUS_STYLES[status];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        style.className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      {size === "sm" ? meta.short : meta.label}
    </span>
  );
}

export function ChangeText({
  value,
  suffix = " pp",
  digits = 1,
  className,
  showIcon = true,
}: {
  value: number | null | undefined;
  suffix?: string;
  digits?: number;
  className?: string;
  showIcon?: boolean;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }
  const tone =
    Math.abs(value) < 0.05
      ? "text-muted-foreground"
      : value > 0
        ? "text-success"
        : "text-destructive";
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 font-medium",
        tone,
        className,
      )}
    >
      {showIcon ? <Icon className="size-3.5" /> : null}
      {formatSigned(value, digits)}
      {suffix}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "accent" | "warning" | "danger";
}) {
  const toneClasses = {
    default: "bg-secondary text-secondary-foreground",
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <div className="surface-card flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              toneClasses,
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="tabular font-display text-[30px] font-semibold leading-none text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
