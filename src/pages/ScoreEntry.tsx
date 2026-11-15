import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ClipboardList, Download, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ScopeBar } from "@/components/layout/scope-bar";
import { EmptyState } from "@/components/common/progress-ui";
import { ScoreImportDialog } from "@/components/score-import-dialog";
import { useDataStore } from "@/lib/data-store";
import {
  formatPercent,
  percentageOf,
  sectionAssessments,
  sectionStudents,
  scoreLookup,
} from "@/lib/progression";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ScoreStatus } from "@/lib/types";

function statusLabel(value: string): ScoreStatus | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "A") return "absent";
  if (normalized === "E") return "exempt";
  return null;
}

function ScoreCell({
  value,
  status,
  max,
  onCommit,
}: {
  value: number | null;
  status: ScoreStatus | "not-recorded";
  max: number;
  onCommit: (next: { raw: number | null; status: ScoreStatus }) => boolean;
}) {
  const display =
    status === "absent"
      ? "A"
      : status === "exempt"
        ? "E"
        : status === "recorded" && value !== null
          ? String(value)
          : "";
  const [draft, setDraft] = useState(display);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(display);
      setInvalid(false);
    }
  }, [display, editing]);

  const commit = () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed === "") {
      if (display !== "") {
        const ok = onCommit({ raw: null, status: "recorded" });
        if (!ok) setDraft(display);
      }
      return;
    }
    const flagged = statusLabel(trimmed);
    if (flagged) {
      const ok = onCommit({ raw: null, status: flagged });
      if (!ok) setDraft(display);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setInvalid(true);
      toast.error("Scores must be numeric, A (absent) or E (exempt).");
      setTimeout(() => setInvalid(false), 1600);
      setDraft(display);
      return;
    }
    const rounded = Math.round(parsed * 100) / 100;
    const ok = onCommit({ raw: rounded, status: "recorded" });
    if (!ok) setDraft(display);
  };

  return (
    <input
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        setEditing(true);
      }}
      onFocus={(event) => {
        setEditing(true);
        event.currentTarget.select();
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setDraft(display);
          setEditing(false);
          event.currentTarget.blur();
        }
      }}
      inputMode="decimal"
      aria-label={`Score out of ${max}`}
      className={cn(
        "tabular h-9 w-full rounded-md border bg-transparent px-2 text-center text-sm outline-none transition-colors",
        "focus:border-primary focus:bg-card focus:ring-2 focus:ring-ring/25",
        status === "absent" && "border-warning/40 bg-warning/10 font-medium text-warning",
        status === "exempt" && "border-border bg-muted font-medium italic text-muted-foreground",
        invalid && "border-destructive bg-destructive/10",
        status === "recorded" || status === "not-recorded"
          ? "border-transparent hover:border-border"
          : "",
      )}
    />
  );
}

export default function ScoreEntry() {
  const {
    data,
    scope,
    activeSection,
    activeSubject,
    setScore,
  } = useDataStore();
  const lookup = useMemo(() => scoreLookup(data), [data]);
  const students = useMemo(
    () => sectionStudents(data, scope.sectionId),
    [data, scope.sectionId],
  );
  const assessments = useMemo(
    () => sectionAssessments(data, scope.sectionId, scope.subjectId),
    [data, scope.sectionId, scope.subjectId],
  );
  const tableRef = useRef<HTMLDivElement>(null);

  const totalCells = students.length * assessments.length;
  const recordedCells = useMemo(
    () =>
      students.reduce(
        (acc, student) =>
          acc +
          assessments.filter(
            (assessment) =>
              lookup.get(`${assessment.id}:${student.id}`)?.status === "recorded",
          ).length,
        0,
      ),
    [students, assessments, lookup],
  );

  const completion = totalCells ? (recordedCells / totalCells) * 100 : 0;
  const missing = totalCells - recordedCells;

  const classAverage = useMemo(() => {
    const values: number[] = [];
    students.forEach((student) => {
      assessments.forEach((assessment) => {
        const score = lookup.get(`${assessment.id}:${student.id}`);
        if (score?.status === "recorded" && score.rawScore !== null) {
          const pct = percentageOf(score.rawScore, assessment.maxScore);
          if (pct !== null) values.push(pct);
        }
      });
    });
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }, [students, assessments, lookup]);

  const exportCsv = () => {
    const header = [
      "Student number",
      "Student",
      ...assessments.map(
        (assessment) => `${assessment.name} (max ${assessment.maxScore})`,
      ),
    ];
    const rows = students.map((student) => [
      student.studentNumber,
      student.name,
      ...assessments.map((assessment) => {
        const score = lookup.get(`${assessment.id}:${student.id}`);
        if (!score || score.status === "absent") return "A";
        if (score.status === "exempt") return "E";
        return score.rawScore ?? "";
      }),
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeSection?.name ?? "class"}-${activeSubject?.code ?? "scores"}.csv`.replace(
      /\s+/g,
      "-",
    );
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Score sheet exported as CSV.");
  };

  if (!activeSection || !activeSubject) {
    return (
      <AppShell title="Score entry" description="Select a class section and subject.">
        <EmptyState
          icon={ClipboardList}
          title="No active class"
          description="Choose a section and subject to start encoding scores."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Score entry"
      description={`${activeSection.name} · ${activeSubject.name}. Scores save as you type. Blank cells stay unrecorded.`}
      actions={
        <>
          <ScopeBar compact />
          <ScoreImportDialog />
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="size-4" />
            Export CSV
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Completion
          </p>
          <p className="tabular mt-2 font-display text-2xl font-semibold">
            {recordedCells}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              / {totalCells}
            </span>
          </p>
          <Progress value={completion} className="mt-3 h-1.5" />
        </div>
        <div className="surface-card p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Unrecorded cells
          </p>
          <p className="tabular mt-2 font-display text-2xl font-semibold">
            {missing}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Excluded from statistics — never counted as zero
          </p>
        </div>
        <div className="surface-card p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Class average
          </p>
          <p className="tabular mt-2 font-display text-2xl font-semibold">
            {formatPercent(classAverage)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Normalized across all recorded tasks
          </p>
        </div>
      </div>

      <div className="mt-4 surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Keyboard className="size-4" />
            <span>
              Type a score, <span className="font-mono font-medium">A</span> for
              absent, <span className="font-mono font-medium">E</span> for exempt.
              Enter saves, Esc cancels.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm bg-warning/60" />
              Absent
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm bg-muted-foreground/40" />
              Exempt
            </span>
          </div>
        </div>

        {assessments.length === 0 || students.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={
              assessments.length === 0
                ? "No assessments for this class yet"
                : "No students enrolled"
            }
            description={
              assessments.length === 0
                ? "Create assessments for this section and subject, then return to encode scores."
                : "Add students to this section from the Students page."
            }
            action={
              <Button asChild>
                <Link to={assessments.length === 0 ? "/assessments" : "/students"}>
                  {assessments.length === 0 ? "Create assessment" : "Manage students"}
                </Link>
              </Button>
            }
          />
        ) : (
          <div ref={tableRef} className="scroll-shadow max-h-[70vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 min-w-[210px] border-b border-border bg-card px-4 py-3 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Student
                    </span>
                  </th>
                  {assessments.map((assessment) => (
                    <th
                      key={assessment.id}
                      className="min-w-[104px] border-b border-l border-border/60 bg-card px-2 py-2 text-center"
                    >
                      <p className="text-[11px] font-semibold leading-tight text-foreground">
                        {assessment.name}
                      </p>
                      <p className="tabular mt-0.5 text-[10px] font-normal text-muted-foreground">
                        /{assessment.maxScore} ·{" "}
                        {new Date(assessment.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </th>
                  ))}
                  <th className="min-w-[92px] border-b border-l border-border/60 bg-secondary/40 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Avg %
                  </th>
                </tr>
                <tr>
                  <th className="sticky left-0 z-30 border-b border-border bg-card px-4 pb-2 text-left text-[10px] font-medium text-muted-foreground">
                    n recorded
                  </th>
                  {assessments.map((assessment) => {
                    const count = students.filter(
                      (student) =>
                        lookup.get(`${assessment.id}:${student.id}`)?.status ===
                        "recorded",
                    ).length;
                    return (
                      <th
                        key={assessment.id}
                        className="tabular border-b border-l border-border/60 bg-card px-2 pb-2 text-center text-[10px] font-medium text-muted-foreground"
                      >
                        {count}/{students.length}
                        {count < students.length ? (
                          <AlertTriangle className="ml-1 inline size-2.5 text-warning" />
                        ) : (
                          <Check className="ml-1 inline size-2.5 text-success" />
                        )}
                      </th>
                    );
                  })}
                  <th className="border-b border-l border-border/60 bg-secondary/40" />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const percentages = assessments
                    .map((assessment) => {
                      const score = lookup.get(`${assessment.id}:${student.id}`);
                      if (score?.status !== "recorded" || score.rawScore === null)
                        return null;
                      return percentageOf(score.rawScore, assessment.maxScore);
                    })
                    .filter((value): value is number => value !== null);
                  const average = percentages.length
                    ? percentages.reduce((a, b) => a + b, 0) / percentages.length
                    : null;
                  return (
                    <tr
                      key={student.id}
                      className={cn(
                        "group transition-colors hover:bg-secondary/30",
                      )}
                    >
                      <td className="sticky left-0 z-10 border-b border-border/40 bg-card px-4 py-1.5 group-hover:bg-secondary/30">
                        <p className="truncate text-sm font-medium text-foreground">
                          {student.name}
                        </p>
                        <p className="tabular text-[10px] text-muted-foreground">
                          {student.studentNumber}
                        </p>
                      </td>
                      {assessments.map((assessment) => {
                        const score = lookup.get(
                          `${assessment.id}:${student.id}`,
                        );
                        return (
                          <td
                            key={assessment.id}
                            className="border-b border-l border-border/40 px-1.5 py-1"
                          >
                            <ScoreCell
                              value={score?.rawScore ?? null}
                              status={score?.status ?? "not-recorded"}
                              max={assessment.maxScore}
                              onCommit={({ raw, status }) => {
                                const result = setScore(
                                  assessment.id,
                                  student.id,
                                  raw,
                                  status,
                                );
                                if (!result.ok) {
                                  toast.error(result.error ?? "Score was rejected.");
                                  return false;
                                }
                                return true;
                              }}
                            />
                          </td>
                        );
                      })}
                      <td className="tabular border-b border-l border-border/40 bg-secondary/30 px-2 py-1.5 text-center text-xs font-semibold text-foreground">
                        {formatPercent(average, 1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Scores above the maximum or below zero are rejected. Existing scores keep
        their record-level timestamps, and marking absent or exempt removes the
        numeric value instead of storing a zero.
      </p>
    </AppShell>
  );
}
