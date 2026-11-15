import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Info,
  Minus,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ScopeBar } from "@/components/layout/scope-bar";
import {
  ChangeText,
  EmptyState,
  SectionHeading,
  StatTile,
  StatusPill,
} from "@/components/common/progress-ui";
import { ClassTrendChart, Sparkline } from "@/components/charts/progression-chart";
import { StatusDistribution } from "@/components/charts/distribution";
import { useDataStore } from "@/lib/data-store";
import {
  buildClassAnalysis,
  formatPercent,
} from "@/lib/progression";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data, scope, activeSection, activeSubject, activePeriod } =
    useDataStore();

  const analysis = useMemo(
    () => buildClassAnalysis(data, scope.sectionId, scope.subjectId),
    [data, scope.sectionId, scope.subjectId],
  );

  const enrolledCount = analysis.students.length;
  const chartData = analysis.assessments.map((summary) => ({
    label: summary.assessment.name,
    mean: summary.recorded ? summary.stats.mean : null,
    low:
      summary.recorded > 1 ? summary.stats.mean - summary.stats.sd : undefined,
    high:
      summary.recorded > 1 ? summary.stats.mean + summary.stats.sd : undefined,
  }));

  const latest = analysis.assessments[analysis.assessments.length - 1];
  const latestMean = latest?.recorded ? latest.stats.mean : null;
  const firstToLatest = useMemo(() => {
    const withData = analysis.assessments.filter((item) => item.recorded > 0);
    if (withData.length < 2) return null;
    const first = withData[0];
    const last = withData[withData.length - 1];
    return {
      from: first.assessment.name,
      to: last.assessment.name,
      change: last.stats.mean - first.stats.mean,
    };
  }, [analysis.assessments]);

  const watchlist = analysis.analyses
    .filter(
      (item) =>
        (item.status === "declining" || item.status === "attention") &&
        item.latest !== null,
    )
    .sort((a, b) => (a.latest ?? 0) - (b.latest ?? 0))
    .slice(0, 5);

  const missingCount = analysis.assessments.reduce(
    (acc, item) => acc + item.missing + item.absent + item.exempt,
    0,
  );

  const actions = (
    <>
      <ScopeBar compact />
      <Button asChild size="sm" className="gap-1.5">
        <Link to="/scores">
          Enter scores
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </>
  );

  if (!activeSection || !activeSubject) {
    return (
      <AppShell
        title="Overview"
        description="Set up a class section and subject to begin tracking performance."
      >
        <EmptyState
          icon={ClipboardList}
          title="No active class selected"
          description="Create a section and subject in Reports & data, or restore the demonstration dataset to explore the workspace."
          action={
            <Button asChild>
              <Link to="/reports">Open data tools</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Class overview"
      description={`${activeSection.name} · ${activeSubject.name} · ${activePeriod?.academicYear ?? ""} ${activePeriod?.term ?? ""}`}
      actions={actions}
    >
      {data.sections.some((section) => section.id === "sec-rizal") ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/50 px-3 py-2.5">
          <Info className="size-4 shrink-0 text-info" />
          <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Demonstration dataset loaded.
            </span>{" "}
            Two sections, three subjects and five assessment occasions are
            prefilled so you can explore the analysis. Replace them with your own
            roster whenever you are ready.
          </p>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to="/reports">Manage data</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Enrolled students"
          value={enrolledCount}
          hint={`${analysis.assessments.length} assessments recorded this term`}
          icon={Users}
          tone="primary"
        />
        <StatTile
          label="Latest class mean"
          value={formatPercent(latestMean)}
          hint={latest ? latest.assessment.name : "No assessments yet"}
          icon={TrendingUp}
          tone="accent"
        />
        <StatTile
          label="Mean change"
          value={
            firstToLatest ? (
              <ChangeText
                value={firstToLatest.change}
                className="text-[26px]"
              />
            ) : (
              "—"
            )
          }
          hint={
            firstToLatest
              ? `${firstToLatest.from} → ${firstToLatest.to}`
              : "Needs two assessments with scores"
          }
          icon={UserRoundCheck}
        />
        <StatTile
          label="Missing / absent"
          value={missingCount}
          hint="Excluded from statistics, never treated as zero"
          icon={ClipboardList}
          tone={missingCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="surface-card p-4 sm:p-5 lg:col-span-2">
          <SectionHeading
            title="Class mean progression"
            description="Mean percentage per assessment with a ±1 SD band. Assessment difficulty may differ."
            action={
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/class">
                  Full analysis
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          />
          {analysis.assessments.length ? (
            <ClassTrendChart data={chartData} />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No assessments yet for this class and subject.
            </p>
          )}
        </section>

        <section className="surface-card p-4 sm:p-5">
          <SectionHeading
            title="Progression status"
            description="Classified from each student's own score history."
          />
          <StatusDistribution
            counts={analysis.statusCounts}
            total={analysis.analyses.length}
          />
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/70 bg-secondary/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Categories use transparent thresholds:{" "}
              {data.settings.changeThreshold} pp movement,{" "}
              {data.settings.volatilityThreshold} pp volatility, minimum{" "}
              {data.settings.minObservations} observations.
            </span>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <section className="surface-card overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 p-4 sm:px-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Assessment summary
              </h2>
              <p className="text-sm text-muted-foreground">
                Descriptive statistics with included and excluded counts.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/assessments">Manage</Link>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold sm:px-5">
                    Assessment
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">Mean</th>
                  <th className="px-3 py-2.5 text-right font-semibold">SD</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Change
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold sm:px-5">
                    n
                  </th>
                </tr>
              </thead>
              <tbody>
                {analysis.assessments.map((summary) => (
                  <tr
                    key={summary.assessment.id}
                    className="border-b border-border/40 last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 sm:px-5">
                      <p className="font-medium text-foreground">
                        {summary.assessment.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        max {summary.assessment.maxScore} ·{" "}
                        {new Date(summary.assessment.date).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="tabular px-3 py-3 text-right font-medium">
                      {formatPercent(summary.stats.mean)}
                    </td>
                    <td className="tabular px-3 py-3 text-right text-muted-foreground">
                      {summary.recorded > 1 ? summary.stats.sd.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {summary.meanChange === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : Math.abs(summary.meanChange) < 0.05 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Minus className="size-3" />0.0
                        </span>
                      ) : (
                        <ChangeText
                          value={summary.meanChange}
                          className="text-xs"
                        />
                      )}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-xs text-muted-foreground sm:px-5">
                      {summary.recorded}/{enrolledCount}
                    </td>
                  </tr>
                ))}
                {analysis.assessments.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-muted-foreground"
                    >
                      No assessments created for this section and subject.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface-card p-4 sm:p-5 lg:col-span-2">
          <SectionHeading
            title="Watchlist"
            description="Declining or low-performing trajectories."
            action={
              <Badge variant="outline" className="text-[10px] font-medium">
                {watchlist.length} flagged
              </Badge>
            }
          />
          <ul className="space-y-2">
            {watchlist.map((item) => (
              <li key={item.student.id}>
                <Link
                  to={`/analysis?student=${item.student.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 transition-colors hover:border-primary/30 hover:bg-secondary/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.student.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusPill status={item.status} size="sm" />
                      <span className="tabular text-[11px] text-muted-foreground">
                        {formatPercent(item.latest)} latest
                      </span>
                    </div>
                  </div>
                  <Sparkline
                    values={item.occasions.map((occasion) => occasion.percentage)}
                  />
                </Link>
              </li>
            ))}
            {watchlist.length === 0 && (
              <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                No students currently flagged for decline.
              </li>
            )}
          </ul>
          {firstToLatest ? (
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Class mean moved{" "}
              <ChangeText
                value={firstToLatest.change}
                className="text-[11px]"
              />{" "}
              between {firstToLatest.from} and {firstToLatest.to}. Individual
              results can move differently — review student-level evidence
              before drawing conclusions.
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
