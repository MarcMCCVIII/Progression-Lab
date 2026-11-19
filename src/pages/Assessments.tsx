import { useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Ellipsis,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ScopeBar } from "@/components/layout/scope-bar";
import { EmptyState } from "@/components/common/progress-ui";
import { useDataStore } from "@/lib/data-store";
import {
  formatPercent,
  sectionAssessments,
  sectionStudents,
  scoreLookup,
} from "@/lib/progression";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types";
import type { Assessment, AssessmentCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RubricDraftItem {
  id: string;
  label: string;
  percentage: string;
}

interface DraftState {
  name: string;
  category: AssessmentCategory;
  date: string;
  maxScore: string;
  rubric: RubricDraftItem[];
  description: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const makeRubricItem = (label = "", percentage = ""): RubricDraftItem => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  label,
  percentage,
});

const blankDraft = (): DraftState => ({
  name: "",
  category: "quiz",
  date: today(),
  maxScore: "20",
  rubric: [
    makeRubricItem("Reading", "40"),
    makeRubricItem("Writing", "35"),
    makeRubricItem("Speaking", "25"),
  ],
  description: "",
});

function AssessmentDialog({
  assessment,
  trigger,
}: {
  assessment?: Assessment;
  trigger: React.ReactNode;
}) {
  const { scope, addAssessment, updateAssessment } = useDataStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(() =>
    assessment
      ? {
          name: assessment.name,
          category: assessment.category,
          date: assessment.date,
          maxScore: String(assessment.maxScore),
          rubric: (assessment.rubric?.length
            ? assessment.rubric
            : [{ id: makeRubricItem().id, label: "Criterion", percentage: "100" }]
          ).map((item) => ({
            id: item.id,
            label: item.label,
            percentage: String(item.percentage),
          })),
          description: assessment.description,
        }
      : blankDraft(),
  );

  const rubricTotal = draft.rubric.reduce(
    (total, item) => total + (Number(item.percentage) || 0),
    0,
  );

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the assessment a name.");
      return;
    }
    const maxScore = Number(draft.maxScore);
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      toast.error("Maximum score must be greater than zero.");
      return;
    }

    const rubric = draft.rubric
      .map((item) => ({
        id: item.id,
        label: item.label.trim() || "Criterion",
        percentage: Number(item.percentage) || 0,
      }))
      .filter((item) => item.label && item.percentage > 0);

    if (!rubric.length) {
      toast.error("Add at least one rubric criterion with a positive percentage.");
      return;
    }

    const totalRubric = rubric.reduce((sum, item) => sum + item.percentage, 0);
    if (Math.abs(totalRubric - 100) > 0.01) {
      toast.error("Rubric percentages should total 100%.");
      return;
    }

    if (assessment) {
      updateAssessment(assessment.id, {
        name: draft.name.trim(),
        category: draft.category,
        date: draft.date,
        maxScore,
        weight: totalRubric,
        rubric,
        description: draft.description.trim(),
      });
      toast.success("Assessment updated.");
    } else {
      addAssessment({
        sectionId: scope.sectionId,
        subjectId: scope.subjectId,
        name: draft.name,
        category: draft.category,
        date: draft.date,
        maxScore,
        weight: totalRubric,
        rubric,
        description: draft.description,
      });
      toast.success("Assessment created. Existing records were left intact.");
    }
    setOpen(false);
    if (!assessment) setDraft(blankDraft());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {assessment ? "Edit assessment" : "New assessment"}
          </DialogTitle>
          <DialogDescription>
            Each assessment keeps its own maximum score and rubric breakdown. The
            rubric percentages should add up to 100% for the assessment.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="assessment-name">Assessment name</Label>
            <Input
              id="assessment-name"
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              placeholder="e.g. Quiz 3 — Quadratics"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select
                value={draft.category}
                onValueChange={(value) =>
                  setDraft({ ...draft, category: value as AssessmentCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((category) => (
                    <SelectItem key={category} value={category}>
                      {CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assessment-date">Date</Label>
              <Input
                id="assessment-date"
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft({ ...draft, date: event.target.value })
                }
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="assessment-max">Maximum score</Label>
            <Input
              id="assessment-max"
              type="number"
              min={1}
              value={draft.maxScore}
              onChange={(event) =>
                setDraft({ ...draft, maxScore: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Rubric criteria</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft({
                    ...draft,
                    rubric: [...draft.rubric, makeRubricItem("Criterion", "")],
                  })
                }
              >
                <Plus className="mr-1 size-3.5" />
                Add criterion
              </Button>
            </div>

            <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-2">
              {draft.rubric.map((criterion, index) => (
                <div key={criterion.id} className="grid grid-cols-[1fr_110px_auto] gap-2">
                  <Input
                    value={criterion.label}
                    placeholder="e.g. Reading"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        rubric: draft.rubric.map((item) =>
                          item.id === criterion.id
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={criterion.percentage}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        rubric: draft.rubric.map((item) =>
                          item.id === criterion.id
                            ? { ...item, percentage: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        rubric: draft.rubric.filter((item) => item.id !== criterion.id),
                      })
                    }
                    disabled={draft.rubric.length === 1}
                    aria-label={`Remove ${criterion.label || `criterion ${index + 1}`}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total</span>
              <span className={rubricTotal === 100 ? "text-foreground" : "text-warning"}>
                {rubricTotal}%
              </span>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="assessment-description">Description</Label>
            <Textarea
              id="assessment-description"
              rows={3}
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              placeholder="Optional notes on coverage, format or comparability."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>
            {assessment ? "Save changes" : "Create assessment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Assessments() {
  const { data, scope, activeSection, activeSubject, deleteAssessment } =
    useDataStore();
  const [pendingDelete, setPendingDelete] = useState<Assessment | null>(null);

  const assessments = useMemo(
    () => sectionAssessments(data, scope.sectionId, scope.subjectId),
    [data, scope.sectionId, scope.subjectId],
  );
  const students = useMemo(
    () => sectionStudents(data, scope.sectionId),
    [data, scope.sectionId],
  );
  const lookup = useMemo(() => scoreLookup(data), [data]);

  const rows = assessments.map((assessment) => {
    const recorded = students.filter((student) => {
      const score = lookup.get(`${assessment.id}:${student.id}`);
      return score?.status === "recorded";
    });
    const mean = recorded.length
      ? recorded.reduce((acc, student) => {
          const score = lookup.get(`${assessment.id}:${student.id}`);
          if (!score || score.rawScore === null) return acc;
          return acc + (score.rawScore / assessment.maxScore) * 100;
        }, 0) / recorded.length
      : null;
    return { assessment, recorded: recorded.length, mean };
  });

  return (
    <AppShell
      title="Assessments"
      description={`${activeSection?.name ?? "No section"} · ${activeSubject?.name ?? "No subject"}. Unlimited assessment occasions, each with its own maximum score.`}
      actions={
        <>
          <ScopeBar compact />
          <AssessmentDialog
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" />
                New assessment
              </Button>
            }
          />
        </>
      }
    >
      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs font-medium">
              <ClipboardList className="size-3.5" />
              {assessments.length} occasions
            </Badge>
            <span className="text-xs text-muted-foreground">
              Ordered by date for progression analysis
            </span>
          </div>
        </div>

        {assessments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assessments yet"
            description="Create the first assessment for this section and subject. You can add as many occasions as the term needs."
            action={
              <AssessmentDialog
                trigger={
                  <Button className="gap-1.5">
                    <Plus className="size-4" />
                    New assessment
                  </Button>
                }
              />
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-left font-semibold">Assessment</th>
                  <th className="px-3 py-3 text-left font-semibold">Category</th>
                  <th className="px-3 py-3 text-left font-semibold">Date</th>
                  <th className="px-3 py-3 text-left font-semibold">Rubric</th>
                  <th className="px-3 py-3 text-right font-semibold">Max</th>
                  <th className="px-3 py-3 text-right font-semibold">Mean</th>
                  <th className="px-3 py-3 text-right font-semibold">Recorded</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ assessment, recorded, mean }) => (
                  <tr
                    key={assessment.id}
                    className="border-b border-border/40 last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {assessment.name}
                      </p>
                      {assessment.description ? (
                        <p className="max-w-[320px] truncate text-xs text-muted-foreground">
                          {assessment.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="text-[11px] font-medium">
                        {CATEGORY_LABELS[assessment.category]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        {new Date(assessment.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {assessment.rubric?.length ? (
                        <span className="flex flex-wrap gap-1">
                          {assessment.rubric.map((item) => (
                            <Badge key={item.id} variant="secondary" className="text-[10px] font-medium">
                              {item.label} {item.percentage}%
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span>{assessment.weight}%</span>
                      )}
                    </td>
                    <td className="tabular px-3 py-3 text-right">
                      {assessment.maxScore}
                    </td>
                    <td className="tabular px-3 py-3 text-right font-medium">
                      {formatPercent(mean)}
                    </td>
                    <td className="tabular px-3 py-3 text-right text-xs">
                      <span
                        className={
                          recorded < students.length
                            ? "text-warning"
                            : "text-success"
                        }
                      >
                        {recorded}/{students.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Actions for ${assessment.name}`}
                          >
                            <Ellipsis className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <AssessmentDialog
                            assessment={assessment}
                            trigger={
                              <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                                <PencilLine className="mr-2 size-4" />
                                Edit assessment
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setPendingDelete(assessment)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete assessment
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Normalized comparison",
            body: "Raw scores are normalized to percentages, so 16/20 and 80/100 both read as 80%. Difficulty and content still differ.",
          },
          {
            title: "Categories",
            body: "Quizzes, activities, projects, performance tasks and examinations can be created freely; each keeps its own maximum score and rubric percentage.",
          },
          {
            title: "Integrity rules",
            body: "One score per student per assessment. Absent, exempt and unrecorded values are excluded from statistics rather than set to zero.",
          },
        ].map((item) => (
          <div key={item.title} className="surface-card p-4">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {item.body}
            </p>
          </div>
        ))}
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” and its {pendingDelete ? data.scores.filter(
                (score) => score.assessmentId === pendingDelete.id,
              ).length : 0}{" "}
              score records will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) {
                  deleteAssessment(pendingDelete.id);
                  toast.success("Assessment deleted.");
                  setPendingDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
