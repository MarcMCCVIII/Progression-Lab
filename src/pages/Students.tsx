import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Ellipsis,
  FileUp,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ScopeBar } from "@/components/layout/scope-bar";
import {
  ChangeText,
  EmptyState,
  StatusPill,
} from "@/components/common/progress-ui";
import { Sparkline } from "@/components/charts/progression-chart";
import { useDataStore } from "@/lib/data-store";
import {
  buildStudentAnalysis,
  formatPercent,
  sectionStudents,
  scoreLookup,
} from "@/lib/progression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

function AddStudentDialog({ defaultSection }: { defaultSection: string }) {
  const { data, addStudent, scope } = useDataStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [sectionId, setSectionId] = useState(defaultSection || scope.sectionId);

  useEffect(() => {
    if (open) setSectionId(defaultSection || scope.sectionId);
  }, [open, defaultSection, scope.sectionId]);

  const submit = () => {
    const result = addStudent({ name, studentNumber: number, sectionId });
    if (!result.ok) {
      toast.error(result.error ?? "Student could not be saved.");
      return;
    }
    toast.success(`${name.trim()} added to the roster.`);
    setName("");
    setNumber("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="size-4" />
          Add student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register a student</DialogTitle>
          <DialogDescription>
            Student numbers must be unique. Enrollment links the student to one
            section without duplicating identity.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="student-name">Full name</Label>
            <Input
              id="student-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Alyssa Marie Bautista"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="student-number">Student number</Label>
            <Input
              id="student-number"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="e.g. 2025-0041"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Section</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {data.sections
                  .filter((section) => !section.archived)
                  .map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Save student</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ defaultSection }: { defaultSection: string }) {
  const { data, importStudents, scope } = useDataStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sectionId, setSectionId] = useState(defaultSection || scope.sectionId);

  useEffect(() => {
    if (open) setSectionId(defaultSection || scope.sectionId);
  }, [open, defaultSection, scope.sectionId]);

  const runImport = () => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^student/i.test(line));
    if (lines.length === 0) {
      toast.error("Paste at least one row of student data.");
      return;
    }
    const rows = lines.map((line) => {
      const [first, second] = line.split(",").map((part) => part.trim());
      const hasNumberFirst = /^\d/.test(first ?? "");
      return {
        studentNumber: (hasNumberFirst ? first : second) ?? "",
        name: (hasNumberFirst ? second : first) ?? "",
      };
    });
    const { added, skipped } = importStudents(rows, sectionId);
    if (added === 0) {
      toast.error(
        skipped
          ? "No rows were imported — check for duplicates or missing values."
          : "No rows were imported.",
      );
      return;
    }
    toast.success(
      `${added} students imported${skipped ? `, ${skipped} skipped` : ""}.`,
    );
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <FileUp className="size-4" />
          Import list
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import student list</DialogTitle>
          <DialogDescription>
            Paste CSV rows as <span className="font-mono">student_number,name</span>{" "}
            or <span className="font-mono">name,student_number</span>. A header row
            is ignored. Duplicate student numbers are skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Target section</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.sections
                  .filter((section) => !section.archived)
                  .map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="csv-input">Rows</Label>
            <Textarea
              id="csv-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={7}
              placeholder={"2025-0101, Juan Dela Cruz\n2025-0102, Maria Santos"}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={runImport}>Import rows</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Students() {
  const {
    data,
    scope,
    activeSection,
    activeSubject,
    archiveStudent,
    moveStudent,
  } = useDataStore();
  const [query, setQuery] = useState("");

  const students = useMemo(
    () => sectionStudents(data, scope.sectionId),
    [data, scope.sectionId],
  );
  const lookup = useMemo(() => scoreLookup(data), [data]);
  const analyses = useMemo(
    () =>
      students.map((student) =>
        buildStudentAnalysis(
          data,
          student,
          scope.sectionId,
          scope.subjectId,
          data.settings,
          lookup,
        ),
      ),
    [students, data, scope.sectionId, scope.subjectId, lookup],
  );

  const visible = analyses.filter(
    (analysis) =>
      analysis.student.name.toLowerCase().includes(query.toLowerCase()) ||
      analysis.student.studentNumber.toLowerCase().includes(query.toLowerCase()),
  );

  const flagged = analyses.filter(
    (analysis) =>
      analysis.status === "declining" || analysis.status === "attention",
  ).length;

  return (
    <AppShell
      title="Students"
      description={`${activeSection?.name ?? "No section"} · ${activeSubject?.name ?? "No subject"}. Manage the roster, enrollments and student-level records.`}
      actions={
        <>
          <ScopeBar compact />
          <AddStudentDialog defaultSection={scope.sectionId} />
        </>
      }
    >
      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs font-medium">
              <Users className="size-3.5" />
              {students.length} enrolled
            </Badge>
            {flagged > 0 ? (
              <Badge
                variant="outline"
                className="border-destructive/30 bg-destructive/10 text-xs font-medium text-destructive"
              >
                {flagged} need review
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or number"
                className="h-9 pl-8"
              />
            </div>
            <ImportDialog defaultSection={scope.sectionId} />
          </div>
        </div>

        {students.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students in this section"
            description="Register students individually or paste a CSV list to build the roster."
            action={<AddStudentDialog defaultSection={scope.sectionId} />}
          />
        ) : (
          <div className="scroll-shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-left font-semibold">Student</th>
                  <th className="px-3 py-3 text-left font-semibold">Section</th>
                  <th className="px-3 py-3 text-right font-semibold">Latest</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    First → latest
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">Trend</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((analysis) => {
                  const enrollment = data.enrollments.find(
                    (item) => item.studentId === analysis.student.id,
                  );
                  const section = data.sections.find(
                    (item) => item.id === enrollment?.sectionId,
                  );
                  return (
                    <tr
                      key={analysis.student.id}
                      className="border-b border-border/40 last:border-0 hover:bg-secondary/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/analysis?student=${analysis.student.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {analysis.student.name}
                        </Link>
                        <p className="tabular text-[11px] text-muted-foreground">
                          {analysis.student.studentNumber}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {section?.name ?? "—"}
                      </td>
                      <td className="tabular px-3 py-3 text-right font-medium">
                        {formatPercent(analysis.latest)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <ChangeText value={analysis.totalChange} className="text-xs" />
                      </td>
                      <td className="px-3 py-3">
                        <Sparkline
                          values={analysis.occasions.map(
                            (occasion) => occasion.percentage,
                          )}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={analysis.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Actions for ${analysis.student.name}`}
                            >
                              <Ellipsis className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem asChild>
                              <Link to={`/analysis?student=${analysis.student.id}`}>
                                <ArrowUpRight className="mr-2 size-4" />
                                Open analysis
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Move to section
                            </DropdownMenuLabel>
                            {data.sections
                              .filter(
                                (item) =>
                                  !item.archived && item.id !== enrollment?.sectionId,
                              )
                              .map((item) => (
                                <DropdownMenuItem
                                  key={item.id}
                                  onClick={() => {
                                    moveStudent(analysis.student.id, item.id);
                                    toast.success(
                                      `${analysis.student.name} moved to ${item.name}.`,
                                    );
                                  }}
                                >
                                  {item.name}
                                </DropdownMenuItem>
                              ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                archiveStudent(analysis.student.id);
                                toast.success(
                                  `${analysis.student.name} archived. Score history is retained.`,
                                );
                              }}
                            >
                              Archive student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No students match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Archiving keeps a student's assessment history for reporting while
        removing them from active rosters. Sections can be reassigned without
        creating a duplicate student record.
      </p>
    </AppShell>
  );
}
