import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { quantile } from "@/lib/stats";
import { STATUS_META, STATUS_ORDER, type ProgressionStatus } from "@/lib/progression";
import type { Assessment, Student } from "@/lib/types";

export function Heatmap({
  students,
  assessments,
  values,
  onSelect,
  selectedId,
}: {
  students: Student[];
  assessments: Assessment[];
  values: Map<string, number | null>;
  onSelect?: (studentId: string) => void;
  selectedId?: string;
}) {
  if (students.length === 0) return null;
  return (
    <div className="scroll-shadow overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[160px] bg-card px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Student
            </th>
            {assessments.map((assessment) => (
              <th
                key={assessment.id}
                className="min-w-[64px] px-1.5 py-2 text-center align-bottom text-[10px] font-medium leading-tight text-muted-foreground"
                title={`${assessment.name} (max ${assessment.maxScore})`}
              >
                <span className="line-clamp-2">
                  {assessment.name.split(/[—·-]/)[0].trim()}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr
              key={student.id}
              onClick={() => onSelect?.(student.id)}
              className={cn(
                "transition-colors",
                onSelect ? "cursor-pointer hover:bg-secondary/50" : "",
                selectedId === student.id ? "bg-primary/5" : "",
              )}
            >
              <td className="sticky left-0 z-10 max-w-[220px] truncate border-t border-border/60 bg-card px-3 py-1.5 font-medium text-foreground">
                {student.name}
              </td>
              {assessments.map((assessment) => {
                const value = values.get(`${assessment.id}:${student.id}`);
                return (
                  <td
                    key={assessment.id}
                    className="border-t border-border/60 p-0.5 text-center"
                  >
                    <div
                      className={cn(
                        "tabular flex h-7 items-center justify-center rounded-md text-[11px] font-medium",
                        value === null
                          ? "border border-dashed border-border text-muted-foreground/60"
                          : "text-foreground",
                      )}
                      style={
                        value === null
                          ? undefined
                          : {
                              backgroundColor: `hsl(var(--primary) / ${(
                                0.06 +
                                (value / 100) * 0.42
                              ).toFixed(3)})`,
                              color:
                                value > 68 ? "hsl(var(--primary-foreground))" : undefined,
                            }
                      }
                    >
                      {value === null ? "·" : Math.round(value)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BoxPlotRow({
  data,
}: {
  data: { label: string; values: number[]; n: number }[];
}) {
  return (
    <div className="scroll-shadow flex gap-3 overflow-x-auto pb-1">
      {data.map((series) => {
        const hasData = series.values.length >= 4;
        const q1 = hasData ? quantile(series.values, 0.25) : null;
        const q3 = hasData ? quantile(series.values, 0.75) : null;
        const med = hasData ? quantile(series.values, 0.5) : null;
        const min = hasData ? Math.min(...series.values) : null;
        const max = hasData ? Math.max(...series.values) : null;
        const y = (value: number) => 100 - value;
        return (
          <div key={series.label} className="min-w-[104px] flex-1">
            <svg
              viewBox="0 0 100 112"
              className="h-[150px] w-full"
              role="img"
              aria-label={`Boxplot for ${series.label}`}
            >
              <line
                x1="8"
                x2="92"
                y1={y(0)}
                y2={y(0)}
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />
              <line
                x1="8"
                x2="92"
                y1={y(50)}
                y2={y(50)}
                stroke="hsl(var(--border))"
                strokeWidth="0.75"
                strokeDasharray="2 3"
              />
              <line
                x1="8"
                x2="92"
                y1={y(100)}
                y2={y(100)}
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />
              {hasData && min !== null && max !== null && q1 !== null && q3 !== null && med !== null ? (
                <g>
                  <line
                    x1="50"
                    x2="50"
                    y1={y(min)}
                    y2={y(max)}
                    stroke="hsl(var(--chart-2))"
                    strokeWidth="1.25"
                    strokeOpacity="0.7"
                  />
                  <line
                    x1="36"
                    x2="64"
                    y1={y(max)}
                    y2={y(max)}
                    stroke="hsl(var(--chart-2))"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="36"
                    x2="64"
                    y1={y(min)}
                    y2={y(min)}
                    stroke="hsl(var(--chart-2))"
                    strokeWidth="1.5"
                  />
                  <rect
                    x="28"
                    y={y(q3)}
                    width="44"
                    height={Math.max(1, y(q1) - y(q3))}
                    rx="3"
                    fill="hsl(var(--chart-2) / 0.22)"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="28"
                    x2="72"
                    y1={y(med)}
                    y2={y(med)}
                    stroke="hsl(var(--chart-2))"
                    strokeWidth="2.5"
                  />
                </g>
              ) : (
                <text
                  x="50"
                  y="58"
                  textAnchor="middle"
                  fontSize="9"
                  fill="hsl(var(--muted-foreground))"
                >
                  {series.n < 4 ? "n < 4" : "No data"}
                </text>
              )}
              <text
                x="50"
                y="108"
                textAnchor="middle"
                fontSize="7.5"
                fill="hsl(var(--muted-foreground))"
              >
                n = {series.n}
              </text>
            </svg>
            <p className="line-clamp-2 text-center text-[10px] leading-tight text-muted-foreground">
              {series.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function StatusDistribution({
  counts,
  total,
}: {
  counts: Record<ProgressionStatus, number>;
  total: number;
}) {
  const segments = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        count: counts[status] ?? 0,
      })),
    [counts],
  );

  const fill: Record<ProgressionStatus, string> = {
    improving: "hsl(var(--success))",
    stable: "hsl(var(--muted-foreground) / 0.45)",
    inconsistent: "hsl(var(--info))",
    declining: "hsl(var(--destructive))",
    attention: "hsl(var(--warning))",
    insufficient: "hsl(var(--muted-foreground) / 0.22)",
  };

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No students are enrolled in this section yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((segment) =>
          segment.count > 0 ? (
            <div
              key={segment.status}
              style={{
                width: `${(segment.count / total) * 100}%`,
                backgroundColor: fill[segment.status],
              }}
              title={`${STATUS_META[segment.status].label}: ${segment.count}`}
            />
          ) : null,
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {segments.map((segment) => (
          <li
            key={segment.status}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-foreground">
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: fill[segment.status] }}
              />
              {STATUS_META[segment.status].label}
            </span>
            <span className="tabular text-xs font-semibold text-muted-foreground">
              {segment.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
