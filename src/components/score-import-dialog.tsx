import { useMemo, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/lib/data-store";
import { sectionAssessments, sectionStudents } from "@/lib/progression";
import type { ScoreStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ParsedRow {
  studentId: string;
  cells: string[];
}

export function ScoreImportDialog() {
  const { data, scope, bulkSetScores } = useDataStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const students = useMemo(
    () => sectionStudents(data, scope.sectionId),
    [data, scope.sectionId],
  );
  const assessments = useMemo(
    () => sectionAssessments(data, scope.sectionId, scope.subjectId),
    [data, scope.sectionId, scope.subjectId],
  );

  const preview = useMemo(() => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return { matched: 0, skipped: 0, cells: 0, rows: [] as ParsedRow[] };
    }
    const byNumber = new Map(
      students.map((student) => [
        student.studentNumber.trim().toLowerCase(),
        student.id,
      ]),
    );
    const rows: ParsedRow[] = [];
    let skipped = 0;
    let cellCount = 0;
    lines.forEach((line) => {
      const cells = line
        .split(/[,\t]/)
        .map((cell) => cell.trim().replace(/^"|"$/g, ""));
      const studentId = byNumber.get((cells[0] ?? "").toLowerCase());
      if (!studentId) {
        skipped += 1;
        return;
      }
      const values = cells.slice(1, assessments.length + 1);
      cellCount += values.filter(Boolean).length;
      rows.push({ studentId, cells: values });
    });
    return { matched: rows.length, skipped, cells: cellCount, rows };
  }, [text, students, assessments]);

  const apply = () => {
    if (preview.rows.length === 0) {
      toast.error("No pasted rows matched a student number in this section.");
      return;
    }
    const entries: {
      assessmentId: string;
      studentId: string;
      rawScore: number | null;
      status: ScoreStatus;
    }[] = [];
    preview.rows.forEach((row) => {
      row.cells.forEach((cell, index) => {
        const assessment = assessments[index];
        if (!assessment || !cell) return;
        const normalized = cell.toUpperCase();
        if (normalized === "A" || normalized === "ABSENT") {
          entries.push({
            assessmentId: assessment.id,
            studentId: row.studentId,
            rawScore: null,
            status: "absent",
          });
          return;
        }
        if (normalized === "E" || normalized === "EXEMPT") {
          entries.push({
            assessmentId: assessment.id,
            studentId: row.studentId,
            rawScore: null,
            status: "exempt",
          });
          return;
        }
        const value = Number(cell);
        entries.push({
          assessmentId: assessment.id,
          studentId: row.studentId,
          rawScore: Number.isFinite(value)
            ? Math.round(value * 100) / 100
            : Number.NaN,
          status: "recorded",
        });
      });
    });
    const { saved, rejected } = bulkSetScores(entries);
    if (saved === 0) {
      toast.error("No scores passed validation.");
      return;
    }
    toast.success(
      `${saved} scores imported${rejected ? `, ${rejected} rejected (out of range)` : ""}.`,
    );
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileUp className="size-4" />
          Import scores
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import scores from a spreadsheet</DialogTitle>
          <DialogDescription>
            Paste rows copied from CSV or Excel. Column 1 is the student number,
            then one column per assessment in the order shown below. Use A for
            absent, E for exempt, or leave a cell blank.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-secondary/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Expected columns
            </p>
            <p className="mt-1 text-xs text-foreground">
              Student number
              {assessments.map((assessment) => (
                <span key={assessment.id}>
                  {" · "}
                  {assessment.name}{" "}
                  <span className="text-muted-foreground">
                    (max {assessment.maxScore})
                  </span>
                </span>
              ))}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="score-import">Paste rows</Label>
            <Textarea
              id="score-import"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={7}
              className="font-mono text-xs"
              placeholder={"2025-0001,16,20,25,42,88\n2025-0002,18,A,28,45,92"}
            />
          </div>

          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>
              Matched rows:{" "}
              <span className="font-semibold text-foreground">
                {preview.matched}
              </span>
            </span>
            <span>
              Cells to import:{" "}
              <span className="font-semibold text-foreground">
                {preview.cells}
              </span>
            </span>
            <span>
              Unmatched rows:{" "}
              <span className="font-semibold text-foreground">
                {preview.skipped}
              </span>
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Scores outside 0 to the assessment maximum are rejected rather than
            saved. Imported records replace existing values for the same student
            and assessment.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={preview.matched === 0}>
            Import scores
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
