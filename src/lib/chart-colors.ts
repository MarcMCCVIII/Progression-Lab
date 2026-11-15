const CHART_VARS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const chartColor = (index: number) =>
  CHART_VARS[index % CHART_VARS.length];
