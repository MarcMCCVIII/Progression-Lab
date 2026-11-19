import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Info,
  Printer,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ScopeBar } from "@/components/layout/scope-bar";
import {
  ChangeText,
  EmptyState,
  SectionHeading,
  StatusPill,
} from "@/components/common/progress-ui";
import { ProgressionChart } from "@/components/charts/progression-chart";
import { useDataStore } from "@/lib/data-store";
import {
  STATUS_META,
  buildClassAnalysis,
  buildStudentAnalysis,
  formatPercent,
  formatSigned,
  sectionAssessments,
  sectionStudents,
  scoreLookup,
} from "@/lib/progression";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function StudentAnalysis() {
  const { data, scope, activeSection, activeSubject } = useDataStore();
  const [params, setParams] = useSearchParams();

  const students = useMemo(
    () => sectionStudents(data, scope.sectionId),
    [data, scope.sectionId],
  );
  const lookup = useMemo(() => scoreLookup(data), [data]);
  const selectedId =
    students.find((student) => student.id === params.get("student"))?.id ??
    students[0]?.id;
  const student = students.find((item) => item.id === selectedId);

  const analysis = useMemo(
    () =>
      student
        ? buildStudentAnalysis(
            data,
            student,
            scope.sectionId,
            scope.subjectId,
            data.settings,
            lookup,
          )
        : null,
    [data, student, scope.sectionId, scope.subjectId, lookup],
  );

  const classAnalysis = useMemo(
    () => buildClassAnalysis(data, scope.sectionId, scope.subjectId),
    [data, scope.sectionId, scope.subjectId],
  );

  const classMeans = classAnalysis.assessments.map((summary) =>
    summary.recorded ? summary.stats.mean : null,
  );

  const chartData =
    analysis?.occasions.map((occasion, index) => ({
      label: occasion.assessment.name,
      value: occasion.percentage,
      comparison: classMeans[index] ?? null,
    })) ?? [];

  const assessments = sectionAssessments(data, scope.sectionId, scope.subjectId);
  const firstRecorded = analysis?.occasions.find(
    (occasion) => occasion.percentage !== null,
  );
  const lastRecorded = [...(analysis?.occasions ?? [])]
    .reverse()
    .find((occasion) => occasion.percentage !== null);

  const biggestGain = analysis?.occasions.reduce<{
    label: string;
    value: number;
  } | null>((best, occasion) => {
    if (occasion.changePoints === null) return best;
    if (!best || occasion.changePoints > best.value) {
      return { label: occasion.assessment.name, value: occasion.changePoints };
    }
    return best;
  }, null);

  const biggestDrop = analysis?.occasions.reduce<{
    label: string;
    value: number;
  } | null>((worst, occasion) => {
    if (occasion.changePoints === null) return worst;
    if (!worst || occasion.changePoints < worst.value) {
      return { label: occasion.assessment.name, value: occasion.changePoints };
    }
    return worst;
  }, null);

  const rank = useMemo(() => {
    if (!student) return null;
    const scored = classAnalysis.analyses
      .filter((item) => item.average && Number.isFinite(item.average))
      .sort((a, b) => b.average - a.average);
    const index = scored.findIndex((item) => item.student.id === student.id);
    return index >= 0 ? { position: index + 1, total: scored.length } : null;
  }, [classAnalysis.analyses, student]);

  const meta = analysis ? STATUS_META[analysis.status] : null;

  return (
    <AppShell
      title="Student progression"
      description={`${activeSection?.name ?? "No section"} · ${activeSubject?.name ?? "No subject"}. Score history, normalized changes and trend evidence for one student.`}
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
            Print report
          </Button>
        </>
      }
    >
      {!student || !analysis ? (
        <EmptyState
          icon={TrendingUp}
          title="No students to analyze"
          description="Register students in this section and encode scores to see individual progression."
        />
      ) : (
        <div className="space-y-4">
          <div className="surface-card flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-xl font-semibold text-primary">
                {student.name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    {student.name}
                  </h2>
                  <StatusPill status={analysis.status} />
                </div>
                <p className="tabular mt-0.5 text-xs text-muted-foreground">
                  {student.studentNumber} · {analysis.recorded} of{" "}
                  {assessments.length} assessments recorded
                  {rank ? ` · Rank ${rank.position} of ${rank.total} by average` : ""}
                </p>
              </div>
            </div>
            <div className="no-print w-full lg:w-[260px]">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Student
              </label>
              <Select
                value={student.id}
                onValueChange={(value) => setParams({ student: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {students.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {analysis.recorded < 2 ? (
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Insufficient data for a trend</p>
                <p className="mt-0.5 text-xs leading-relaxed text-warning/90">
                  Only {analysis.recorded} recorded occasion
                  {analysis.recorded === 1 ? "" : "s"} are available. A student is
                  not classified until at least {data.settings.minObservations}{" "}
                  comparable observations exist.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="First recorded"
              value={formatPercent(analysis.first)}
              sub={firstRecorded?.assessment.name ?? "—"}
            />
            <Metric
              label="Latest recorded"
              value={formatPercent(analysis.latest)}
              sub={lastRecorded?.assessment.name ?? "—"}
            />
            <Metric
              label="First → latest change"
              valueNode={
                <ChangeText value={analysis.totalChange} className="text-2xl" />
              }
              sub={
                analysis.relativeChange !== null
                  ? `${formatSigned(analysis.relativeChange)}% relative change`
                  : "Requires two recorded occasions"
              }
            />
            <Metric
              label="Average performance"
              value={formatPercent(analysis.average)}
              sub={`SD ${analysis.recorded > 1 ? analysis.variability.toFixed(1) : "—"} pp across occasions`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Highest / lowest"
              value={`${formatPercent(analysis.highest, 0)} / ${formatPercent(analysis.lowest, 0)}`}
              sub="Observed percentages"
            />
            <Metric
              label="Trend slope"
              value={`${formatSigned(analysis.slope)} pp`}
              sub={`Per assessment occasion · R² = ${analysis.r2.toFixed(2)}`}
            />
            <Metric
              label="Weighted grade"
              value={formatPercent(analysis.weightedGrade)}
              sub="Separate from progression evidence"
            />
            <Metric
              label="Occasions up / down"
              value={`${analysis.improvementRuns} / ${analysis.declineRuns}`}
              sub={`Across ${Math.max(0, analysis.recorded - 1)} comparable changes`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="surface-card p-4 sm:p-5 lg:col-span-2">
              <SectionHeading
                title="Progression across assessments"
                description="Percentage per occasion against the class mean. Missing scores are not interpolated."
              />
              <ProgressionChart data={chartData} height={300} />
            </section>

            <section className="surface-card p-4 sm:p-5">
              <SectionHeading title="Interpretation" />
              <div className="rounded-lg border border-border/70 bg-secondary/40 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="size-4 text-accent" />
                  {meta?.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {meta?.description}
                </p>
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-success" />
                  <span>
                    Largest gain:{" "}
                    <span className="font-medium text-foreground">
                      {biggestGain ? `${biggestGain.label} (${formatSigned(biggestGain.value)} pp)` : "not available"}
                    </span>
                  </span>
                </li>
                <li className="flex gap-2">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <span>
                    Largest drop:{" "}
                    <span className="font-medium text-foreground">
                      {biggestDrop ? `${biggestDrop.label} (${formatSigned(biggestDrop.value)} pp)` : "not available"}
                    </span>
                  </span>
                </li>
                <li className="flex gap-2">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    {analysis.needsAttention
                      ? `Latest result is below the ${data.settings.attentionThreshold}% attention threshold.`
                      : `Latest result is at or above the ${data.settings.attentionThreshold}% attention threshold.`}
                  </span>
                </li>
              </ul>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Normalized percentages make scales comparable, but assessments
                  can differ in difficulty, content and format. Treat movement as
                  evidence to investigate, not proof of learning.
                </span>
              </div>
            </section>
          </div>

          <section className="surface-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Assessment history
                </h2>
                <p className="text-sm text-muted-foreground">
                  Raw score, normalization and change between consecutive recorded
                  occasions.
                </p>
              </div>
              <Badge variant="outline" className="text-[11px]">
                {assessments.length} occasions
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold sm:px-5">
                      Assessment
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">Raw</th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      Percent
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      Δ points
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      Δ relative
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold sm:px-5">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.occasions.map((occasion) => (
                    <tr
                      key={occasion.assessment.id}
                      className="border-b border-border/40 last:border-0 hover:bg-secondary/40"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <p className="font-medium text-foreground">
                          {occasion.assessment.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(occasion.assessment.date).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" },
                          )}{" "}
                          · max {occasion.assessment.maxScore}
                        </p>
                      </td>
                      <td className="tabular px-3 py-3 text-right">
                        {occasion.rawScore ?? "—"}
                      </td>
                      <td className="tabular px-3 py-3 text-right font-medium">
                        {formatPercent(occasion.percentage)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <ChangeText
                          value={occasion.changePoints}
                          className="text-xs"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        {occasion.relativeChange === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <span className="tabular text-xs text-muted-foreground">
                            {formatSigned(occasion.relativeChange)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span className="text-[11px] text-muted-foreground">
                          {occasion.status === "recorded"
                            ? "Recorded"
                            : occasion.status === "absent"
                              ? "Absent"
                              : occasion.status === "exempt"
                                ? "Exempt"
                                : "Not recorded"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function Metric({
  label,
  value,
  valueNode,
  sub,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="tabular mt-2 font-display text-xl font-semibold leading-none text-foreground">
        {valueNode ?? value}
      </div>
      {sub ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
