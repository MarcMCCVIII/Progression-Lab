import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColor } from "@/lib/chart-colors";

interface TrendPoint {
  label: string;
  value: number | null;
  comparison?: number | null;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  boxShadow: "var(--shadow-card)",
  fontSize: "12px",
  padding: "8px 10px",
  color: "hsl(var(--foreground))",
};

const tickStyle = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
};

export function ProgressionChart({
  data,
  comparisonLabel = "Class mean",
  height = 280,
}: {
  data: TrendPoint[];
  comparisonLabel?: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border))"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="label"
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            interval={0}
            height={52}
            tickFormatter={(value: string) =>
              value.length > 16 ? `${value.slice(0, 15)}…` : value
            }
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            formatter={(value: number, name: string) => [
              `${Number(value).toFixed(1)}%`,
              name,
            ]}
          />
          <ReferenceLine
            y={75}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="2 6"
            strokeOpacity={0.5}
            label={{
              value: "75%",
              position: "insideTopRight",
              fontSize: 10,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
          {data.some((point) => point.comparison !== undefined) ? (
            <Line
              type="monotone"
              dataKey="comparison"
              name={comparisonLabel}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.75}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="value"
            name="Student"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{
              r: 3.5,
              strokeWidth: 2,
              stroke: "hsl(var(--card))",
              fill: "hsl(var(--primary))",
            }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClassTrendChart({
  data,
  height = 300,
}: {
  data: { label: string; mean: number | null; low?: number; high?: number }[];
  height?: number;
}) {
  const band = data.map((point) => ({
    ...point,
    spread:
      point.mean !== null && point.low !== undefined && point.high !== undefined
        ? [Math.max(0, point.low), Math.min(100, point.high)]
        : undefined,
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={band}
          margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border))"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="label"
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            interval={0}
            height={52}
            tickFormatter={(value: string) =>
              value.length > 16 ? `${value.slice(0, 15)}…` : value
            }
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            formatter={(value: number | number[], name: string) => {
              if (Array.isArray(value)) {
                return [
                  `${value[0].toFixed(1)}% – ${value[1].toFixed(1)}%`,
                  "±1 SD band",
                ];
              }
              return [`${Number(value).toFixed(1)}%`, name];
            }}
          />
          <Area
            type="monotone"
            dataKey="spread"
            name="±1 SD band"
            stroke="none"
            fill={chartColor(0)}
            fillOpacity={0.12}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="mean"
            name="Class mean"
            stroke={chartColor(0)}
            strokeWidth={2.5}
            dot={{
              r: 4,
              strokeWidth: 2,
              stroke: "hsl(var(--card))",
              fill: chartColor(0),
            }}
            connectNulls
          />
          <ReferenceLine
            y={75}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="2 6"
            strokeOpacity={0.5}
            label={{
              value: "75%",
              position: "insideTopRight",
              fontSize: 10,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({
  values,
  width = 96,
  height = 28,
  className,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const points = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (points.length < 2) {
    return (
      <span className="text-[11px] text-muted-foreground tabular">No trend</span>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 1);
  const step = width / (values.length - 1 || 1);
  const coords = values
    .map((value, index) => {
      if (value === null) return null;
      const x = index * step;
      const y = height - 3 - ((value - min) / span) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean) as string[];
  const rising = points[points.length - 1] >= points[0];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={
          rising ? "hsl(var(--success))" : "hsl(var(--destructive))"
        }
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
