import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Info,
  Printer,
  Sigma,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ScopeBar } from "@/components/layout/scope-bar";
import {
  ChangeText,
  EmptyState,
  SectionHeading,
  StatusPill,
} from "@/components/common/progress-ui";
import { ClassTrendChart } from "@/components/charts/progression-chart";
import {
  BoxPlotRow,
  Heatmap,
  StatusDistribution,
} from "@/components/charts/distribution";
import { useDataStore } from "@/lib/data-store";
import {
  buildClassAnalysis,
  formatP,
  formatPercent,
  formatSigned,
  pairedSeries,
  percentageOf,
  repeatedMeasuresMatrix,
  scoreLookup,
  sectionAssessments,
} from "@/lib/progression";
import {
  friedmanTest,
  holmAdjust,
  pairedTTest,
  wilcoxonSignedRank,
} from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function effectLabel(value: number) {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs)) return "—";
  if (abs < 0.2) return "negligible";
  if (abs < 0.5) return "small";
  if (abs < 0.8) return "moderate";
  return "large";
}

function ResultRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right text-sm font-medium text-foreground",
          mono && "tabular",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function WarningNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning/10 p-3 text-[11px] leading-relaxed text-warning">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default function ClassAnalysis() {
  const { data, scope, activeSection, activeSubject } = useDataStore();
  const analysis = useMemo(
    () => buildClassAnalysis(data, scope.sectionId, scope.subjectId),
    [data, scope.sectionId, scope.subjectId],
  );
  const assessments = analysis.assessments;
  const [pairA, setPairA] = useState<string>("");
  const [pairB, setPairB] = useState<string>("");
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);

  const availableIds = useMemo(
    () =>
      assessments
        .filter((summary) => summary.recorded > 0)
        .map((summary) => summary.assessment.id),
    [assessments],
  );

  const effectiveA = availableIds.includes(pairA)
    ? pairA
    : availableIds[0] ?? "";
  const effectiveB = availableIds.includes(pairB)
    ? pairB
    : availableIds[availableIds.length - 1] ?? "";

  const pair = useMemo(
    () =>
      pairedSeries(
        data,
        scope.sectionId,
        scope.subjectId,
        effectiveA,
        effectiveB,
      ),
    [data, scope.sectionId, scope.subjectId, effectiveA, effectiveB],
  );

  const tTest = useMemo(
    () => (pair.pre.length >= 2 ? pairedTTest(pair.pre, pair.post) : null),
    [pair],
  );
  const wilcoxon = useMemo(
    () => (pair.pre.length >= 1 ? wilcoxonSignedRank(pair.pre, pair.post) : null),
    [pair],
  );

  const effectiveOccasions = useMemo(() => {
    const chosen = selectedOccasions.filter((id) => availableIds.includes(id));
    if (chosen.length >= 3) return chosen;
    return availableIds.slice(0, Math.min(5, availableIds.length));
  }, [selectedOccasions, availableIds]);

  const repeated = useMemo(
    () =>
      repeatedMeasuresMatrix(
        data,
        scope.sectionId,
        scope.subjectId,
        effectiveOccasions,
      ),
    [data, scope.sectionId, scope.subjectId, effectiveOccasions],
  );

  const friedman = useMemo(
    () => friedmanTest(repeated.matrix),
    [repeated],
  );

  const postHoc = useMemo(() => {
    const pairs: { label: string; pre: number[]; post: number[] }[] = [];
    for (let i = 0; i < effectiveOccasions.length; i++) {
      for (let j = i + 1; j < effectiveOccasions.length; j++) {
        pairs.push(
          pairedSeries(
            data,
            scope.sectionId,
            scope.subjectId,
            effectiveOccasions[i],
            effectiveOccasions[j],
          ),
        );
      }
    }
    const results = pairs.map((item) => wilcoxonSignedRank(item.pre, item.post));
    const adjusted = holmAdjust(results.map((result) => result.p));
    return pairs.map((item, index) => ({
      label: item.label,
      n: results[index].n,
      medianDifference: item.pre.length
        ? results[index].wPlus >= results[index].wMinus
          ? "increase"
          : "decrease"
        : "—",
      raw: results[index].p,
      adjusted: adjusted[index],
      effect: results[index].effectSize,
    }));
  }, [data, scope.sectionId, scope.subjectId, effectiveOccasions]);

  const heatmapValues = useMemo(() => {
    const lookup = scoreLookup(data);
    const map = new Map<string, number | null>();
    const list = sectionAssessments(data, scope.sectionId, scope.subjectId);
    for (const student of analysis.students) {
      for (const assessment of list) {
        const score = lookup.get(`${assessment.id}:${student.id}`);
        map.set(
          `${assessment.id}:${student.id}`,
          score?.status === "recorded" && score.rawScore !== null
            ? percentageOf(score.rawScore, assessment.maxScore)
            : null,
        );
      }
    }
    return map;
  }, [data, scope.sectionId, scope.subjectId, analysis.students]);

  const chartData = assessments.map((summary) => ({
    label: summary.assessment.name,
    mean: summary.recorded ? summary.stats.mean : null,
    low:
      summary.recorded > 1 ? summary.stats.mean - summary.stats.sd : undefined,
    high:
      summary.recorded > 1 ? summary.stats.mean + summary.stats.sd : undefined,
  }));

  const boxData = assessments.map((summary) => {
    const values: number[] = [];
    const lookup = scoreLookup(data);
    for (const student of analysis.students) {
      const score = lookup.get(`${summary.assessment.id}:${student.id}`);
      if (score?.status === "recorded" && score.rawScore !== null) {
        const pct = percentageOf(score.rawScore, summary.assessment.maxScore);
        if (pct !== null) values.push(pct);
      }
    }
    return {
      label: summary.assessment.name,
      values,
      n: values.length,
    };
  });

  const totalMissing = assessments.reduce(
    (acc, summary) => acc + summary.missing + summary.absent + summary.exempt,
    0,
  );

  return (
    <AppShell
      title="Class analysis"
      description={`${activeSection?.name ?? "No section"} · ${activeSubject?.name ?? "No subject"}. Descriptive summaries and inferential tests with assumptions shown.`}
      actions={
        <>
          <ScopeBar compact />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Print
          </Button>
        </>
      }
    >
      {assessments.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No assessment data yet"
          description="Create assessments and encode scores before running class-level analysis."
          action={
            <Button asChild>
              <Link to="/assessments">Manage assessments</Link>
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue="descriptive" className="space-y-4">
          <TabsList className="no-print h-auto flex-wrap justify-start gap-1 bg-secondary/60 p-1">
            <TabsTrigger value="descriptive" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="size-4" />
              Descriptive
            </TabsTrigger>
            <TabsTrigger value="inferential" className="gap-1.5 text-xs sm:text-sm">
              <Sigma className="size-4" />
              Inferential tests
            </TabsTrigger>
            <TabsTrigger value="patterns" className="gap-1.5 text-xs sm:text-sm">
              <CheckCircle2 className="size-4" />
              Patterns & students
            </TabsTrigger>
          </TabsList>

          <TabsContent value="descriptive" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="surface-card p-4 sm:p-5 lg:col-span-2">
                <SectionHeading
                  title="Class mean progression"
                  description="Mean percentage per assessment with a ±1 SD band. Sample size shown in the table below."
                />
                <ClassTrendChart data={chartData} height={300} />
              </section>
              <section className="surface-card p-4 sm:p-5">
                <SectionHeading title="Cohort snapshot" />
                <ResultRow
                  label="Students enrolled"
                  value={analysis.students.length}
                  mono
                />
                <ResultRow
                  label="Assessments"
                  value={assessments.length}
                  mono
                />
                <ResultRow
                  label="Mean of latest results"
                  value={formatPercent(analysis.overallMean)}
                  mono
                />
                <ResultRow
                  label="Mean first → latest change"
                  value={
                    <ChangeText value={analysis.meanChange} className="text-sm" />
                  }
                />
                <ResultRow
                  label="Students with paired data"
                  value={`${analysis.pairedStudents} / ${analysis.students.length}`}
                  mono
                />
                <ResultRow
                  label="Missing / absent / exempt"
                  value={totalMissing}
                  mono
                />
                <div className="mt-3">
                  <InfoNote>
                    Missing values are excluded per assessment, so each mean can
                    rest on a different number of students. Improvement rates use
                    only students with scores on both compared occasions.
                  </InfoNote>
                </div>
              </section>
            </div>

            <section className="surface-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Assessment statistics
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Descriptive measures and paired change for each occasion.
                  </p>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  Percentages, 0–100
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-semibold sm:px-5">
                        Assessment
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">n</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Mean</th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Median
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">SD</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Min</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Max</th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Mean Δ
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold sm:px-5">
                        Up / down / same
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((summary) => (
                      <tr
                        key={summary.assessment.id}
                        className="border-b border-border/40 last:border-0 hover:bg-secondary/40"
                      >
                        <td className="px-4 py-3 sm:px-5">
                          <p className="font-medium text-foreground">
                            {summary.assessment.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            max {summary.assessment.maxScore} ·{" "}
                            {summary.recorded} recorded
                            {summary.missing + summary.absent + summary.exempt > 0
                              ? ` · ${summary.missing + summary.absent + summary.exempt} excluded`
                              : ""}
                          </p>
                        </td>
                        <td className="tabular px-3 py-3 text-right">
                          {summary.stats.n}
                        </td>
                        <td className="tabular px-3 py-3 text-right font-medium">
                          {formatPercent(summary.stats.mean)}
                        </td>
                        <td className="tabular px-3 py-3 text-right">
                          {formatPercent(summary.stats.median)}
                        </td>
                        <td className="tabular px-3 py-3 text-right text-muted-foreground">
                          {summary.recorded > 1
                            ? summary.stats.sd.toFixed(1)
                            : "—"}
                        </td>
                        <td className="tabular px-3 py-3 text-right text-muted-foreground">
                          {formatPercent(summary.stats.min, 0)}
                        </td>
                        <td className="tabular px-3 py-3 text-right text-muted-foreground">
                          {formatPercent(summary.stats.max, 0)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <ChangeText
                            value={summary.meanChange}
                            className="text-xs"
                          />
                        </td>
                        <td className="tabular px-4 py-3 text-right text-xs sm:px-5">
                          {summary.meanChange === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span>
                              <span className="text-success">{summary.improved}</span>
                              <span className="text-muted-foreground"> / </span>
                              <span className="text-destructive">
                                {summary.declined}
                              </span>
                              <span className="text-muted-foreground"> / </span>
                              {summary.unchanged}
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                (n={summary.compared})
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="surface-card p-4 sm:p-5">
              <SectionHeading
                title="Score distribution"
                description="Boxplots show median, interquartile range and observed range for each occasion."
              />
              <BoxPlotRow data={boxData} />
              <div className="mt-3">
                <InfoNote>
                  Requires at least four recorded scores per occasion. Presence of
                  a wide spread alongside a rising mean suggests some students may
                  not be sharing in the gain.
                </InfoNote>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="inferential" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="surface-card p-4 sm:p-5">
                <SectionHeading
                  title="Two related occasions"
                  description="Select two assessments taken by the same students."
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Earlier
                    </p>
                    <Select value={effectiveA} onValueChange={setPairA}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assessments
                          .filter((summary) => summary.recorded > 0)
                          .map((summary) => (
                            <SelectItem
                              key={summary.assessment.id}
                              value={summary.assessment.id}
                            >
                              {summary.assessment.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Later
                    </p>
                    <Select value={effectiveB} onValueChange={setPairB}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assessments
                          .filter((summary) => summary.recorded > 0)
                          .map((summary) => (
                            <SelectItem
                              key={summary.assessment.id}
                              value={summary.assessment.id}
                            >
                              {summary.assessment.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border border-border/70 p-3">
                    <p className="text-xs font-semibold text-foreground">
                      Paired samples t-test
                    </p>
                    {!tTest ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        At least two students need scores on both occasions.
                      </p>
                    ) : (
                      <>
                        <ResultRow
                          label="Paired students (n)"
                          value={`${tTest.n}${tTest.excluded ? ` · ${tTest.excluded} excluded` : ""}`}
                          mono
                        />
                        <ResultRow
                          label="Mean difference"
                          value={`${formatSigned(tTest.meanDifference, 2)} pp`}
                          mono
                        />
                        <ResultRow
                          label="t (df)"
                          value={`${tTest.t.toFixed(3)} (${tTest.df})`}
                          mono
                        />
                        <ResultRow
                          label="p-value"
                          value={formatP(tTest.p)}
                          mono
                        />
                        <ResultRow
                          label="Cohen's d_z"
                          value={`${tTest.effectSize.toFixed(2)} (${effectLabel(tTest.effectSize)})`}
                          mono
                        />
                        <ResultRow
                          label="95% CI of difference"
                          value={`${formatSigned(tTest.ciLow, 1)} to ${formatSigned(tTest.ciHigh, 1)} pp`}
                          mono
                        />
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                          {tTest.p < 0.05
                            ? "The mean paired change is statistically significant at α = .05, but the effect size and assessment comparability still determine practical meaning."
                            : "No statistically significant mean change at α = .05. Absence of evidence is not evidence of no learning."}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="rounded-lg border border-border/70 p-3">
                    <p className="text-xs font-semibold text-foreground">
                      Wilcoxon signed-rank test
                    </p>
                    {!wilcoxon || wilcoxon.n === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        No non-zero paired differences available.
                      </p>
                    ) : (
                      <>
                        <ResultRow
                          label="Pairs (non-zero)"
                          value={`${wilcoxon.n} · ${wilcoxon.ties} tied`}
                          mono
                        />
                        <ResultRow
                          label="W+ / W−"
                          value={`${wilcoxon.wPlus.toFixed(1)} / ${wilcoxon.wMinus.toFixed(1)}`}
                          mono
                        />
                        <ResultRow
                          label="z"
                          value={wilcoxon.z.toFixed(3)}
                          mono
                        />
                        <ResultRow
                          label="p-value (normal approx.)"
                          value={formatP(wilcoxon.p)}
                          mono
                        />
                        <ResultRow
                          label="Effect size r"
                          value={`${wilcoxon.effectSize.toFixed(2)} (${effectLabel(wilcoxon.effectSize)})`}
                          mono
                        />
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                          With fewer than ten pairs the normal approximation is
                          rough; treat the p-value as indicative.
                        </p>
                      </>
                    )}
                  </div>

                  {pair.pre.length < 10 ? (
                    <WarningNote>
                      Only {pair.pre.length} students have paired scores. Small
                      samples produce unstable p-values; report the sample size
                      alongside every test.
                    </WarningNote>
                  ) : null}
                </div>
              </section>

              <section className="surface-card p-4 sm:p-5">
                <SectionHeading
                  title="Repeated measures"
                  description="Choose at least three comparable occasions."
                />
                <div className="flex flex-wrap gap-2">
                  {assessments.map((summary) => {
                    const active = effectiveOccasions.includes(
                      summary.assessment.id,
                    );
                    return (
                      <button
                        key={summary.assessment.id}
                        type="button"
                        disabled={summary.recorded === 0}
                        onClick={() => {
                          const id = summary.assessment.id;
                          if (effectiveOccasions.includes(id)) {
                            if (effectiveOccasions.length <= 3) {
                              toast.info("Keep at least three occasions selected.");
                              return;
                            }
                            setSelectedOccasions(
                              effectiveOccasions.filter((item) => item !== id),
                            );
                          } else {
                            setSelectedOccasions([...effectiveOccasions, id]);
                          }
                        }}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/30",
                          summary.recorded === 0 && "cursor-not-allowed opacity-40",
                        )}
                      >
                        {summary.assessment.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Click to include or remove an occasion. At least three stay active.
                </p>

                <div className="mt-4 rounded-lg border border-border/70 p-3">
                  <p className="text-xs font-semibold text-foreground">
                    Friedman test
                  </p>
                  {!Number.isFinite(friedman.chiSquare) ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Needs at least two students with complete records across
                      three or more occasions.
                    </p>
                  ) : (
                    <>
                      <ResultRow
                        label="Complete cases (n)"
                        value={`${friedman.n} · ${friedman.excluded} excluded`}
                        mono
                      />
                      <ResultRow
                        label="Occasions (k)"
                        value={friedman.k}
                        mono
                      />
                      <ResultRow
                        label="χ² (df)"
                        value={`${friedman.chiSquare.toFixed(3)} (${friedman.df})`}
                        mono
                      />
                      <ResultRow
                        label="p-value"
                        value={formatP(friedman.p)}
                        mono
                      />
                      <ResultRow
                        label="Kendall's W"
                        value={`${friedman.kendallW.toFixed(3)} (${effectLabel(friedman.kendallW)})`}
                        mono
                      />
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        A rank-based alternative to repeated-measures ANOVA. It
                        tests whether at least one occasion differs; it does not
                        say which one.
                      </p>
                    </>
                  )}
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    Post hoc — Wilcoxon pairwise with Holm adjustment
                  </p>
                  <div className="scroll-shadow max-h-[240px] overflow-auto rounded-lg border border-border/70">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 bg-secondary/80">
                        <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-1.5 text-left font-semibold">
                            Comparison
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold">
                            n
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold">
                            Raw p
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold">
                            Holm p
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {postHoc.map((row) => (
                          <tr
                            key={row.label}
                            className="border-t border-border/50"
                          >
                            <td className="px-2 py-1.5 text-foreground">
                              {row.label}
                            </td>
                            <td className="tabular px-2 py-1.5 text-right text-muted-foreground">
                              {row.n}
                            </td>
                            <td className="tabular px-2 py-1.5 text-right text-muted-foreground">
                              {formatP(row.raw)}
                            </td>
                            <td
                              className={cn(
                                "tabular px-2 py-1.5 text-right font-medium",
                                row.adjusted < 0.05
                                  ? "text-success"
                                  : "text-muted-foreground",
                              )}
                            >
                              {formatP(row.adjusted)}
                            </td>
                          </tr>
                        ))}
                        {postHoc.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-2 py-4 text-center text-muted-foreground"
                            >
                              Select at least two occasions.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-3">
                  <WarningNote>
                    Only run repeated-measures tests when the selected assessments
                    measure the same outcome on a comparable scale. Different
                    content or difficulty weakens the inference regardless of the
                    p-value.
                  </WarningNote>
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="surface-card p-4 sm:p-5 lg:col-span-1">
                <SectionHeading
                  title="Status distribution"
                  description="Every student classified on their own trajectory."
                />
                <StatusDistribution
                  counts={analysis.statusCounts}
                  total={analysis.analyses.length}
                />
                <div className="mt-4">
                  <InfoNote>
                    Thresholds are configurable in Reports & data: movement{" "}
                    {data.settings.changeThreshold} pp, volatility{" "}
                    {data.settings.volatilityThreshold} pp, attention below{" "}
                    {data.settings.attentionThreshold}%, minimum{" "}
                    {data.settings.minObservations} observations.
                  </InfoNote>
                </div>
              </section>
              <section className="surface-card p-4 sm:p-5 lg:col-span-2">
                <SectionHeading
                  title="Student-by-assessment heatmap"
                  description="Darker cells indicate higher normalized scores. Dots are unrecorded occasions."
                />
                <Heatmap
                  students={analysis.students}
                  assessments={assessments.map((summary) => summary.assessment)}
                  values={heatmapValues}
                />
              </section>
            </div>

            <section className="surface-card overflow-hidden">
              <div className="border-b border-border/70 px-4 py-3 sm:px-5">
                <h2 className="text-lg font-semibold text-foreground">
                  Individual trajectories
                </h2>
                <p className="text-sm text-muted-foreground">
                  Class summaries can hide divergent individual patterns.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-semibold sm:px-5">
                        Student
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Recorded
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Average
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        First → latest
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Slope
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold">
                        Status
                      </th>
                      <th className="px-4 py-2.5 sm:px-5" />
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.analyses.map((item) => (
                      <tr
                        key={item.student.id}
                        className="border-b border-border/40 last:border-0 hover:bg-secondary/40"
                      >
                        <td className="px-4 py-2.5 font-medium text-foreground sm:px-5">
                          {item.student.name}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-xs text-muted-foreground">
                          {item.recorded}/{assessments.length}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right">
                          {formatPercent(item.average)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <ChangeText
                            value={item.totalChange}
                            className="text-xs"
                          />
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-xs text-muted-foreground">
                          {formatSigned(item.slope)} pp
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={item.status} size="sm" />
                        </td>
                        <td className="px-4 py-2.5 text-right sm:px-5">
                          <Button asChild variant="ghost" size="sm" className="text-xs">
                            <Link to={`/analysis?student=${item.student.id}`}>
                              Open
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
