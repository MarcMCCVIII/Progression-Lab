import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Assessment, Score, ScoreStatus, Student } from "@/lib/types";

function ScoreCell({
  score,
  status,
  onEdit,
}: {
  score: Score | undefined;
  status: ScoreStatus | "not-recorded";
  onEdit: () => void;
}) {
  const display =
    status === "absent"
      ? "A"
      : status === "exempt"
        ? "E"
        : status === "recorded" && score && score.rawScore !== null
          ? String(score.rawScore)
          : "";

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Enter scores by criterion${display ? `; current total ${display}` : ""}`}
      title="Enter scores by criterion"
      className={cn(
        "tabular h-9 w-full rounded-md border border-transparent px-2 text-center text-sm outline-none transition-colors",
        "hover:border-border focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25",
        status === "absent" && "border-warning/40 bg-warning/10 font-medium text-warning",
        status === "exempt" && "border-border bg-muted font-medium italic text-muted-foreground",
        status === "not-recorded" && "text-muted-foreground/50",
      )}
    >
      {display || "—"}
    </button>
  );
}

function ScoreSheet({
  assessment,
  student,
  score,
  onSave,
  onCancel,
}: {
  assessment: Assessment;
  student: Student;
  score: Score | undefined;
  onSave: (
    rawScore: number | null,
    status: ScoreStatus,
    criterionScores?: Record<string, number>,
  ) => boolean;
  onCancel: () => void;
}) {
  const criteria = assessment.rubric?.length
    ? assessment.rubric
    : [{ id: "__overall__", label: "Overall score", percentage: 100 }];
  const [status, setStatus] = useState<ScoreStatus>(score?.status ?? "recorded");
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      criteria.map((criterion) => {
        const saved = score?.criterionScores?.[criterion.id];
        const legacyTotal =
          criteria.length === 1 &&
          criterion.id === "__overall__" &&
          score?.status === "recorded"
            ? score.rawScore
            : null;
        const value = saved ?? legacyTotal;
        return [criterion.id, value === null || value === undefined ? "" : String(value)];
      }),
    ),
  );
  const parsedScores = criteria.map((criterion) => {
    const raw = drafts[criterion.id]?.trim() ?? "";
    return raw === "" ? null : Number(raw);
  });
  const complete = parsedScores.every(
    (value) => value !== null && Number.isFinite(value),
  );
  const total = complete
    ? Math.round((parsedScores.reduce((sum, value) => sum + (value ?? 0), 0) + Number.EPSILON) * 100) / 100
    : null;
  const rubricMax = (criterion: (typeof criteria)[number]) =>
    assessment.maxScore * (criterion.percentage / 100);
  const incompleteCount = parsedScores.filter(
    (value) => value === null || !Number.isFinite(value),
  ).length;

  const submit = () => {
    if (status !== "recorded") {
      if (onSave(null, status)) toast.success("Score status saved.");
      return;
    }
    if (!complete) {
      toast.error("Enter a score for every criterion.");
      return;
    }
    const criterionScores: Record<string, number> = Object.fromEntries(
      criteria.map((criterion, index) => [
        criterion.id,
        Math.round(((parsedScores[index] ?? 0) + Number.EPSILON) * 100) / 100,
      ]),
    );
    if (
      criteria.some(
        (criterion) =>
          criterionScores[criterion.id] < 0 ||
          criterionScores[criterion.id] > rubricMax(criterion),
      )
    ) {
      toast.error("A criterion score is outside its maximum.");
      return;
    }
    if (
      onSave(
        total,
        "recorded",
        assessment.rubric?.length ? criterionScores : undefined,
      )
    ) {
      toast.success("Criterion scores saved.");
    }
  };

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-border/70 pb-4 pr-8 text-left">
        <SheetTitle>Enter assessment scores</SheetTitle>
        <SheetDescription>
          {student.name} · {assessment.name}. Score each criterion; the total is
          calculated automatically.
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-5 overflow-y-auto py-5">
        <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{student.name}</p>
              <p className="text-xs text-muted-foreground">
                {student.studentNumber} · Maximum {assessment.maxScore} points
              </p>
            </div>
            {score?.status === "recorded" &&
              score.rawScore !== null &&
              !score.criterionScores &&
              assessment.rubric?.length > 1 && (
                <p className="max-w-40 text-right text-xs text-muted-foreground">
                  Existing total: {score.rawScore}/{assessment.maxScore}. Add the
                  criterion breakdown to update it.
                </p>
              )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Attendance / score status</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["recorded", "absent", "exempt"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={status === value ? "default" : "outline"}
                onClick={() => setStatus(value)}
                className="capitalize"
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        {status === "recorded" && (
          <div className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Criterion</span>
              <span className="text-right">Score / max</span>
            </div>
            {criteria.map((criterion, index) => (
              <div
                key={criterion.id}
                className="grid grid-cols-[minmax(0,1fr)_112px] items-center gap-3 rounded-lg border border-border/70 p-3"
              >
                <div className="min-w-0">
                  <Label htmlFor={`criterion-${criterion.id}`} className="text-sm">
                    {criterion.label}
                  </Label>
                  {assessment.rubric?.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {criterion.percentage}% of assessment
                    </p>
                  ) : null}
                </div>
                <div>
                  <Input
                    id={`criterion-${criterion.id}`}
                    type="number"
                    min={0}
                    max={rubricMax(criterion)}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0"
                    value={drafts[criterion.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [criterion.id]: event.target.value,
                      }))
                    }
                    aria-label={`${criterion.label} score, maximum ${rubricMax(criterion)}`}
                    className="tabular text-right"
                  />
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">
                    / {rubricMax(criterion)}
                  </p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-3 text-sm">
              <span className="font-medium">Assessment total</span>
              <span className="tabular font-semibold">
                {total ?? "—"} / {assessment.maxScore}
              </span>
            </div>
            {incompleteCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {incompleteCount} {incompleteCount === 1 ? "criterion" : "criteria"} remaining.
              </p>
            )}
          </div>
        )}
      </div>
      <SheetFooter className="shrink-0 border-t border-border/70 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={status === "recorded" && !complete}
        >
          Save score
        </Button>
      </SheetFooter>
    </>
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
  const [selectedEntry, setSelectedEntry] = useState<{
    assessmentId: string;
    studentId: string;
  } | null>(null);

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
      description={`${activeSection.name} · ${activeSubject.name}. Enter each assessment criterion; the total saves when all criteria are scored. Blank cells stay unrecorded.`}
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
              Select a cell to enter scores for each assessment criterion. Set
              attendance or score status in the sheet.
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
          <div className="scroll-shadow max-h-[70vh] overflow-auto">
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
                              score={score}
                              status={score?.status ?? "not-recorded"}
                              onEdit={() =>
                                setSelectedEntry({
                                  assessmentId: assessment.id,
                                  studentId: student.id,
                                })
                              }
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

      <Sheet
        open={selectedEntry !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null);
        }}
      >
        {selectedEntry && (() => {
          const assessment = assessments.find(
            (item) => item.id === selectedEntry.assessmentId,
          );
          const student = students.find((item) => item.id === selectedEntry.studentId);
          if (!assessment || !student) return null;
          const score = lookup.get(`${assessment.id}:${student.id}`);
          return (
            <SheetContent
              side="right"
              className="flex h-full w-full flex-col overflow-hidden sm:max-w-lg"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <ScoreSheet
                key={`${assessment.id}:${student.id}`}
                assessment={assessment}
                student={student}
                score={score}
                onCancel={() => setSelectedEntry(null)}
                onSave={(rawScore, status, criterionScores) => {
                  const result = setScore(
                    assessment.id,
                    student.id,
                    rawScore,
                    status,
                    criterionScores,
                  );
                  if (!result.ok) {
                    toast.error(result.error ?? "Score was rejected.");
                    return false;
                  }
                  setSelectedEntry(null);
                  return true;
                }}
              />
            </SheetContent>
          );
        })()}
      </Sheet>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Scores above a criterion maximum or below zero are rejected. Criterion
        scores are saved as the assessment total; marking absent or exempt clears
        numeric values instead of storing zero.
      </p>
    </AppShell>
  );
}
