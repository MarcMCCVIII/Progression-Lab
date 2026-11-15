import { useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BookPlus,
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  FolderCog,
  History,
  PencilLine,
  Printer,
  RotateCcw,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/layout/app-shell";
import { ScopeBar } from "@/components/layout/scope-bar";
import {
  ChangeText,
  SectionHeading,
  StatusPill,
} from "@/components/common/progress-ui";
import { useDataStore } from "@/lib/data-store";
import {
  STATUS_META,
  STATUS_ORDER,
  buildClassAnalysis,
  buildStudentAnalysis,
  formatPercent,
  formatSigned,
  sectionAssessments,
  sectionStudents,
  scoreLookup,
} from "@/lib/progression";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassTrendChart, ProgressionChart } from "@/components/charts/progression-chart";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function RenameDialog({
  title,
  label,
  initialValue,
  onSave,
  trigger,
}: {
  title: string;
  label: string;
  initialValue: string;
  onSave: (value: string) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(initialValue);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Existing records stay linked to this record.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 py-1">
          <Label htmlFor="rename-field">{label}</Label>
          <Input
            id="rename-field"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!value.trim()) {
                toast.error("A name is required.");
                return;
              }
              onSave(value.trim());
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Reports() {
  const {
    data,
    scope,
    setScope,
    activePeriod,
    activeSection,
    activeSubject,
    addSubject,
    addPeriod,
    addSection,
    updateSubject,
    updateSection,
    updateSettings,
    resetToSample,
    clearAll,
    importDataset,
  } = useDataStore();

  const [reportType, setReportType] = useState<"class" | "student">("class");
  const [studentId, setStudentId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newSection, setNewSection] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const assessments = useMemo(
    () => sectionAssessments(data, scope.sectionId, scope.subjectId),
    [data, scope.sectionId, scope.subjectId],
  );

  const rangeIds = useMemo(() => {
    if (assessments.length === 0) return [];
    const startIndex = Math.max(
      0,
      assessments.findIndex((assessment) => assessment.id === fromId),
    );
    const endCandidate = assessments.findIndex(
      (assessment) => assessment.id === toId,
    );
    const endIndex =
      endCandidate >= 0 ? endCandidate : assessments.length - 1;
    if (startIndex <= endIndex) {
      return assessments.slice(startIndex, endIndex + 1).map((a) => a.id);
    }
    return assessments.slice(endIndex, startIndex + 1).map((a) => a.id);
  }, [assessments, fromId, toId]);

  const filtered = useMemo(
    () => assessments.filter((assessment) => rangeIds.includes(assessment.id)),
    [assessments, rangeIds],
  );

  const students = useMemo(
    () => sectionStudents(data, scope.sectionId),
    [data, scope.sectionId],
  );
  const lookup = useMemo(() => scoreLookup(data), [data]);
  const selectedStudent =
    students.find((student) => student.id === studentId) ?? students[0];

  const classAnalysis = useMemo(
    () => buildClassAnalysis(data, scope.sectionId, scope.subjectId),
    [data, scope.sectionId, scope.subjectId],
  );
  const studentAnalysis = useMemo(
    () =>
      selectedStudent
        ? buildStudentAnalysis(
            data,
            selectedStudent,
            scope.sectionId,
            scope.subjectId,
            data.settings,
            lookup,
          )
        : null,
    [data, selectedStudent, scope.sectionId, scope.subjectId, lookup],
  );

  const filteredSummaries = classAnalysis.assessments.filter((summary) =>
    filtered.some((assessment) => assessment.id === summary.assessment.id),
  );

  const classTrend = filteredSummaries.map((summary) => ({
    label: summary.assessment.name,
    mean: summary.recorded ? summary.stats.mean : null,
    low:
      summary.recorded > 1 ? summary.stats.mean - summary.stats.sd : undefined,
    high:
      summary.recorded > 1 ? summary.stats.mean + summary.stats.sd : undefined,
  }));

  const classMeanById = new Map(
    classAnalysis.assessments.map((summary) => [
      summary.assessment.id,
      summary.recorded ? summary.stats.mean : null,
    ]),
  );

  const studentTrend = (studentAnalysis?.occasions ?? [])
    .filter((occasion) =>
      filtered.some((assessment) => assessment.id === occasion.assessment.id),
    )
    .map((occasion) => ({
      label: occasion.assessment.name,
      value: occasion.percentage,
      comparison: classMeanById.get(occasion.assessment.id) ?? null,
    }));

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportWorkbook = () => {
    const workbook = XLSX.utils.book_new();
    const scoresSheet = XLSX.utils.aoa_to_sheet([
      [
        "Student number",
        "Student",
        ...filtered.map(
          (assessment) =>
            `${assessment.name} (max ${assessment.maxScore})`,
        ),
      ],
      ...students.map((student) => [
        student.studentNumber,
        student.name,
        ...filtered.map((assessment) => {
          const score = lookup.get(`${assessment.id}:${student.id}`);
          if (!score) return "Not recorded";
          if (score.status === "absent") return "Absent";
          if (score.status === "exempt") return "Exempt";
          return score.rawScore ?? "";
        }),
      ]),
    ]);
    XLSX.utils.book_append_sheet(workbook, scoresSheet, "Scores");

    const summarySheet = XLSX.utils.aoa_to_sheet([
      [
        "Assessment",
        "Date",
        "Max score",
        "Recorded",
        "Mean %",
        "Median %",
        "SD",
        "Min %",
        "Max %",
        "Missing",
      ],
      ...filteredSummaries.map((summary) => [
        summary.assessment.name,
        summary.assessment.date,
        summary.assessment.maxScore,
        summary.recorded,
        Number(summary.stats.mean.toFixed(2)),
        Number(summary.stats.median.toFixed(2)),
        summary.recorded > 1 ? Number(summary.stats.sd.toFixed(2)) : "",
        Number(summary.stats.min.toFixed(2)),
        Number(summary.stats.max.toFixed(2)),
        summary.missing + summary.absent + summary.exempt,
      ]),
    ]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Class summary");

    const progressionSheet = XLSX.utils.aoa_to_sheet([
      [
        "Student number",
        "Student",
        "Recorded occasions",
        "Average %",
        "First %",
        "Latest %",
        "Change (pp)",
        "Slope (pp/occasion)",
        "Classification",
      ],
      ...classAnalysis.analyses.map((analysis) => [
        analysis.student.studentNumber,
        analysis.student.name,
        analysis.recorded,
        Number(analysis.average.toFixed(2)),
        analysis.first === null ? "" : Number(analysis.first.toFixed(2)),
        analysis.latest === null ? "" : Number(analysis.latest.toFixed(2)),
        analysis.totalChange === null
          ? ""
          : Number(analysis.totalChange.toFixed(2)),
        Number(analysis.slope.toFixed(2)),
        STATUS_META[analysis.status].label,
      ]),
    ]);
    XLSX.utils.book_append_sheet(workbook, progressionSheet, "Progression");

    const filename = `${activeSection?.name ?? "class"}-${activeSubject?.code ?? "report"}.xlsx`.replace(
      /\s+/g,
      "-",
    );
    XLSX.writeFile(workbook, filename);
    toast.success("Excel workbook exported with scores, summary and progression.");
  };

  const exportBackup = () => {
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      `progression-lab-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
    toast.success("Backup file created.");
  };

  const handleRestore = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = importDataset(parsed);
      if (!result.ok) throw new Error(result.error);
      toast.success("Backup restored.");
    } catch {
      toast.error("That file could not be restored as a backup.");
    }
  };

  const reportTitle = `${activeSection?.name ?? "Class"} — ${activeSubject?.name ?? "Subject"}`;
  const rangeLabel =
    filtered.length > 0
      ? `${filtered[0].name} to ${filtered[filtered.length - 1].name}`
      : "All assessments";

  return (
    <AppShell
      title="Reports & data"
      description="Generate printable reports, export Excel and CSV files, and manage your private dataset, academic setup and analysis thresholds."
      actions={<ScopeBar compact />}
    >
      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList className="no-print h-auto flex-wrap justify-start gap-1 bg-secondary/60 p-1">
          <TabsTrigger value="reports" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="size-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-1.5 text-xs sm:text-sm">
            <FolderCog className="size-4" />
            Academic setup
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5 text-xs sm:text-sm">
            <History className="size-4" />
            Data & thresholds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          <section className="surface-card no-print p-4 sm:p-5">
            <SectionHeading
              title="Report builder"
              description="Choose a report type and assessment range. The preview is print-ready."
            />
            <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-1.5">
                <Label className="text-xs">Report type</Label>
                <Select
                  value={reportType}
                  onValueChange={(value) =>
                    setReportType(value as "class" | "student")
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">Class report</SelectItem>
                    <SelectItem value="student">Individual student</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {reportType === "student" ? (
                <div className="grid gap-1.5">
                  <Label className="text-xs">Student</Label>
                  <Select
                    value={selectedStudent?.id ?? ""}
                    onValueChange={setStudentId}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label className="text-xs">From assessment</Label>
                <Select
                  value={fromId || assessments[0]?.id || ""}
                  onValueChange={setFromId}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="First assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessments.map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {assessment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">To assessment</Label>
                <Select
                  value={toId || assessments[assessments.length - 1]?.id || ""}
                  onValueChange={setToId}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Last assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessments.map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {assessment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="gap-1.5" onClick={() => window.print()}>
                <Printer className="size-4" />
                Print / save as PDF
              </Button>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={exportWorkbook}
              >
                <FileSpreadsheet className="size-4" />
                Export Excel (.xlsx)
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              “Save as PDF” is available in the browser print dialog. The workbook
              contains separate score, summary and progression sheets.
            </p>
          </section>

          <article className="surface-card p-5 sm:p-8">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Progression Lab · Academic report
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
                  {reportType === "class"
                    ? reportTitle
                    : `${selectedStudent?.name ?? "Student"} — individual report`}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activePeriod
                    ? `${activePeriod.academicYear} · ${activePeriod.term}`
                    : "No academic period"}{" "}
                  · Assessed occasions: {rangeLabel}
                </p>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                <p>Generated {new Date().toLocaleDateString()}</p>
                <p>
                  {reportType === "class"
                    ? `${students.length} students · ${filtered.length} assessments`
                    : `${studentAnalysis?.recorded ?? 0} recorded of ${filtered.length}`}
                </p>
              </div>
            </header>

            {reportType === "class" ? (
              <div className="mt-5 space-y-6">
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Descriptive summary
                  </h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-2 font-semibold">Assessment</th>
                          <th className="px-2 py-2 text-right font-semibold">n</th>
                          <th className="px-2 py-2 text-right font-semibold">
                            Mean
                          </th>
                          <th className="px-2 py-2 text-right font-semibold">
                            Median
                          </th>
                          <th className="px-2 py-2 text-right font-semibold">SD</th>
                          <th className="px-2 py-2 text-right font-semibold">
                            Range
                          </th>
                          <th className="py-2 pl-2 text-right font-semibold">
                            Mean Δ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSummaries.map((summary) => (
                          <tr
                            key={summary.assessment.id}
                            className="border-b border-border/60"
                          >
                            <td className="py-2 pr-2 font-medium text-foreground">
                              {summary.assessment.name}
                              <span className="ml-1 text-muted-foreground">
                                /{summary.assessment.maxScore}
                              </span>
                            </td>
                            <td className="tabular px-2 py-2 text-right">
                              {summary.recorded}
                            </td>
                            <td className="tabular px-2 py-2 text-right">
                              {formatPercent(summary.stats.mean)}
                            </td>
                            <td className="tabular px-2 py-2 text-right">
                              {formatPercent(summary.stats.median)}
                            </td>
                            <td className="tabular px-2 py-2 text-right">
                              {summary.recorded > 1
                                ? summary.stats.sd.toFixed(1)
                                : "—"}
                            </td>
                            <td className="tabular px-2 py-2 text-right">
                              {formatPercent(summary.stats.min, 0)}–
                              {formatPercent(summary.stats.max, 0)}
                            </td>
                            <td className="tabular py-2 pl-2 text-right">
                              {summary.meanChange === null
                                ? "—"
                                : `${formatSigned(summary.meanChange)} pp`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Class mean progression
                  </h3>
                  <ClassTrendChart data={classTrend} height={240} />
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Progression status
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STATUS_ORDER.map((status) => (
                      <span
                        key={status}
                        className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-[11px]"
                      >
                        <StatusPill status={status} size="sm" />
                        {classAnalysis.statusCounts[status]}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Mean first-to-latest change among{" "}
                    {classAnalysis.pairedStudents} students with paired data:{" "}
                    {classAnalysis.meanChange === null
                      ? "not available"
                      : `${formatSigned(classAnalysis.meanChange)} percentage points`}
                    . Classification thresholds: movement{" "}
                    {data.settings.changeThreshold} pp, volatility{" "}
                    {data.settings.volatilityThreshold} pp, minimum{" "}
                    {data.settings.minObservations} observations.
                  </p>
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Student-level evidence
                  </h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-2 font-semibold">Student</th>
                          <th className="px-2 py-2 text-right font-semibold">
                            Average
                          </th>
                          <th className="px-2 py-2 text-right font-semibold">
                            First → latest
                          </th>
                          <th className="px-2 py-2 text-right font-semibold">
                            Slope
                          </th>
                          <th className="py-2 pl-2 font-semibold">
                            Classification
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {classAnalysis.analyses.map((analysis) => (
                          <tr
                            key={analysis.student.id}
                            className="border-b border-border/60"
                          >
                            <td className="py-1.5 pr-2 text-foreground">
                              {analysis.student.name}
                              <span className="ml-1 text-muted-foreground">
                                {analysis.student.studentNumber}
                              </span>
                            </td>
                            <td className="tabular px-2 py-1.5 text-right">
                              {formatPercent(analysis.average)}
                            </td>
                            <td className="tabular px-2 py-1.5 text-right">
                              {analysis.totalChange === null
                                ? "—"
                                : `${formatSigned(analysis.totalChange)} pp`}
                            </td>
                            <td className="tabular px-2 py-1.5 text-right">
                              {formatSigned(analysis.slope)} pp
                            </td>
                            <td className="py-1.5 pl-2">
                              {STATUS_META[analysis.status].label}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : (
              <div className="mt-5 space-y-6">
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Progression summary
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      {
                        label: "First recorded",
                        value: formatPercent(studentAnalysis?.first ?? null),
                      },
                      {
                        label: "Latest recorded",
                        value: formatPercent(studentAnalysis?.latest ?? null),
                      },
                      {
                        label: "Change",
                        value:
                          studentAnalysis?.totalChange === null ||
                          studentAnalysis?.totalChange === undefined
                            ? "—"
                            : `${formatSigned(studentAnalysis.totalChange)} pp`,
                      },
                      {
                        label: "Average",
                        value: formatPercent(studentAnalysis?.average ?? null),
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border border-border p-3"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="tabular mt-1 text-lg font-semibold text-foreground">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-border p-3 text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {studentAnalysis
                        ? STATUS_META[studentAnalysis.status].label
                        : "No data"}
                      .
                    </span>{" "}
                    {studentAnalysis
                      ? STATUS_META[studentAnalysis.status].description
                      : ""}{" "}
                    Trend slope {formatSigned(studentAnalysis?.slope ?? null)} pp
                    per occasion (R² ={" "}
                    {(studentAnalysis?.r2 ?? 0).toFixed(2)}), variability{" "}
                    {(studentAnalysis?.variability ?? 0).toFixed(1)} pp.
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Progression chart
                  </h3>
                  <ProgressionChart data={studentTrend} height={240} />
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Score history
                  </h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-2 font-semibold">Assessment</th>
                          <th className="px-2 py-2 text-right font-semibold">
                            Raw
                          </th>
                          <th className="px-2 py-2 text-right font-semibold">
                            Percent
                          </th>
                          <th className="py-2 pl-2 text-right font-semibold">
                            Δ points
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(studentAnalysis?.occasions ?? [])
                          .filter((occasion) =>
                            filtered.some(
                              (assessment) =>
                                assessment.id === occasion.assessment.id,
                            ),
                          )
                          .map((occasion) => (
                            <tr
                              key={occasion.assessment.id}
                              className="border-b border-border/60"
                            >
                              <td className="py-1.5 pr-2 text-foreground">
                                {occasion.assessment.name}
                                <span className="ml-1 text-muted-foreground">
                                  /{occasion.assessment.maxScore}
                                </span>
                              </td>
                              <td className="tabular px-2 py-1.5 text-right">
                                {occasion.rawScore ?? "—"}
                              </td>
                              <td className="tabular px-2 py-1.5 text-right">
                                {formatPercent(occasion.percentage)}
                              </td>
                              <td className="tabular py-1.5 pl-2 text-right">
                                {occasion.changePoints === null
                                  ? "—"
                                  : `${formatSigned(occasion.changePoints)} pp`}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            <footer className="mt-6 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
              Percentages normalize for different maximum scores but do not make
              assessments equivalent in difficulty, content or format. Missing,
              absent and exempt scores are excluded rather than treated as zero.
              Interpret findings alongside classroom evidence.
            </footer>
          </article>
        </TabsContent>

        <TabsContent value="setup" className="space-y-4">
          <section className="surface-card p-4 sm:p-5">
            <SectionHeading
              title="Academic periods"
              description="Each period holds its own sections, assessments and score history."
            />
            <div className="flex flex-wrap gap-2">
              {data.periods.map((period) => (
                <span
                  key={period.id}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                    period.id === scope.periodId
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground",
                    period.archived && "opacity-50",
                  )}
                >
                  <CalendarRange className="size-3.5" />
                  {period.academicYear} · {period.term}
                  {period.archived ? (
                    <span className="text-[10px] uppercase">archived</span>
                  ) : null}
                </span>
              ))}
              {data.periods.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  No academic periods yet.
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                value={newYear}
                onChange={(event) => setNewYear(event.target.value)}
                placeholder="Academic year (2026–2027)"
                className="h-9 sm:max-w-[220px]"
              />
              <Input
                value={newTerm}
                onChange={(event) => setNewTerm(event.target.value)}
                placeholder="Term (First Semester)"
                className="h-9 sm:max-w-[220px]"
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  if (!newYear.trim() || !newTerm.trim()) {
                    toast.error("Enter both an academic year and a term.");
                    return;
                  }
                  addPeriod(newYear, newTerm);
                  setNewYear("");
                  setNewTerm("");
                  toast.success("Academic period added and selected.");
                }}
              >
                <CalendarRange className="size-4" />
                Add period
              </Button>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="surface-card p-4 sm:p-5">
              <SectionHeading
                title="Subjects"
                description="Archive a subject to keep its history but remove it from scope pickers."
              />
              <ul className="space-y-2">
                {data.subjects.map((subject) => (
                  <li
                    key={subject.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          subject.archived
                            ? "text-muted-foreground line-through"
                            : "text-foreground",
                        )}
                      >
                        {subject.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {subject.code} ·{" "}
                        {
                          data.assessments.filter(
                            (assessment) => assessment.subjectId === subject.id,
                          ).length
                        }{" "}
                        assessments
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <RenameDialog
                        title="Rename subject"
                        label="Subject name"
                        initialValue={subject.name}
                        onSave={(value) => {
                          updateSubject(subject.id, { name: value });
                          toast.success("Subject renamed.");
                        }}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Rename ${subject.name}`}
                          >
                            <PencilLine className="size-3.5" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={
                          subject.archived
                            ? `Restore ${subject.name}`
                            : `Archive ${subject.name}`
                        }
                        onClick={() =>
                          updateSubject(subject.id, {
                            archived: !subject.archived,
                          })
                        }
                      >
                        {subject.archived ? (
                          <ArchiveRestore className="size-3.5" />
                        ) : (
                          <Archive className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Input
                  value={newSubject}
                  onChange={(event) => setNewSubject(event.target.value)}
                  placeholder="New subject name"
                  className="h-9"
                />
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (!newSubject.trim()) {
                      toast.error("Enter a subject name.");
                      return;
                    }
                    addSubject(newSubject, "");
                    setNewSubject("");
                    toast.success("Subject added.");
                  }}
                >
                  <BookPlus className="size-4" />
                  Add
                </Button>
              </div>
            </section>

            <section className="surface-card p-4 sm:p-5">
              <SectionHeading
                title="Sections"
                description="Sections group students for a period; assessments belong to a section and subject."
              />
              <ul className="space-y-2">
                {data.sections.map((section) => {
                  const period = data.periods.find(
                    (item) => item.id === section.periodId,
                  );
                  const enrolled = sectionStudents(data, section.id).length;
                  return (
                    <li
                      key={section.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            section.archived
                              ? "text-muted-foreground line-through"
                              : "text-foreground",
                          )}
                        >
                          {section.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {period
                            ? `${period.academicYear} · ${period.term}`
                            : "No period"}{" "}
                          · {enrolled} enrolled
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <RenameDialog
                          title="Rename section"
                          label="Section name"
                          initialValue={section.name}
                          onSave={(value) => {
                            updateSection(section.id, { name: value });
                            toast.success("Section renamed.");
                          }}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Rename ${section.name}`}
                            >
                              <PencilLine className="size-3.5" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={
                            section.archived
                              ? `Restore ${section.name}`
                              : `Archive ${section.name}`
                          }
                          onClick={() =>
                            updateSection(section.id, {
                              archived: !section.archived,
                            })
                          }
                        >
                          {section.archived ? (
                            <ArchiveRestore className="size-3.5" />
                          ) : (
                            <Archive className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex gap-2">
                <Input
                  value={newSection}
                  onChange={(event) => setNewSection(event.target.value)}
                  placeholder="New section name"
                  className="h-9"
                />
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (!newSection.trim() || !scope.periodId) {
                      toast.error("Enter a section name and select a period.");
                      return;
                    }
                    addSection(newSection, scope.periodId);
                    setNewSection("");
                    toast.success("Section added.");
                  }}
                >
                  <Users className="size-4" />
                  Add
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                New sections inherit the period selected in the scope bar
                {activePeriod
                  ? ` (${activePeriod.academicYear} · ${activePeriod.term})`
                  : ""}
                .
              </p>
            </section>
          </div>

          <section className="surface-card p-4 sm:p-5">
            <SectionHeading
              title="Analysis thresholds"
              description="Classification rules are transparent and adjustable; insufficient observations are never forced into a category."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  key: "changeThreshold" as const,
                  label: "Meaningful movement (pp)",
                  hint: "First-to-latest change that counts as improving or declining.",
                  min: 1,
                  max: 25,
                },
                {
                  key: "volatilityThreshold" as const,
                  label: "Volatility threshold (pp)",
                  hint: "SD of successive changes above which a trend is inconsistent.",
                  min: 2,
                  max: 30,
                },
                {
                  key: "attentionThreshold" as const,
                  label: "Attention threshold (%)",
                  hint: "Latest result below this level without gain is flagged.",
                  min: 40,
                  max: 95,
                },
                {
                  key: "minObservations" as const,
                  label: "Minimum observations",
                  hint: "Recorded occasions required before classification.",
                  min: 2,
                  max: 5,
                },
              ].map((setting) => (
                <div key={setting.key} className="grid gap-1.5">
                  <Label className="text-xs">{setting.label}</Label>
                  <Input
                    type="number"
                    min={setting.min}
                    max={setting.max}
                    value={data.settings[setting.key]}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isFinite(value)) return;
                      updateSettings({
                        [setting.key]: Math.min(
                          setting.max,
                          Math.max(setting.min, value),
                        ),
                      });
                    }}
                    className="h-9"
                  />
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {setting.hint}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="surface-card p-4 sm:p-5">
              <SectionHeading
                title="Backup & restore"
                description="Records are saved to your private account and are available when you sign in on another device. Export backups for an extra copy."
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="gap-1.5" onClick={exportBackup}>
                  <Download className="size-4" />
                  Download backup
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Restore backup
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleRestore(file);
                    event.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={exportWorkbook}
                >
                  <FileSpreadsheet className="size-4" />
                  Export Excel
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    const rows = [
                      ["Student number", "Student", ...assessments.map((a) => a.name)],
                      ...students.map((student) => [
                        student.studentNumber,
                        student.name,
                        ...assessments.map((assessment) => {
                          const score = lookup.get(
                            `${assessment.id}:${student.id}`,
                          );
                          if (!score) return "";
                          if (score.status === "absent") return "A";
                          if (score.status === "exempt") return "E";
                          return score.rawScore ?? "";
                        }),
                      ]),
                    ];
                    const csv = rows
                      .map((row) =>
                        row
                          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                          .join(","),
                      )
                      .join("\n");
                    downloadBlob(
                      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
                      `${activeSection?.name ?? "class"}-scores.csv`.replace(
                        /\s+/g,
                        "-",
                      ),
                    );
                    toast.success("Score sheet exported as CSV.");
                  }}
                >
                  <FileText className="size-4" />
                  Export CSV
                </Button>
              </div>
              <div className="mt-3 rounded-lg border border-border/70 bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                Storage used:{" "}
                {(new Blob([JSON.stringify(data)]).size / 1024).toFixed(0)} KB ·
                {" "}
                {data.students.filter((student) => !student.archived).length}{" "}
                active students · {data.scores.length} score records. Backup files
                contain identifiable student data — store them securely.
              </div>
            </section>

            <section className="surface-card p-4 sm:p-5">
              <SectionHeading
                title="Dataset actions"
                description="Reset to the demonstration dataset or clear all records."
              />
              <div className="space-y-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <RotateCcw className="size-4" />
                      Restore demonstration dataset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Replace current records?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The sample dataset will overwrite students, assessments and
                        scores currently stored in your account. Export a backup
                        first if you need to keep them.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          resetToSample();
                          toast.success("Demonstration dataset restored.");
                        }}
                      >
                        Restore sample
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Clear all records
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear the whole dataset?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Every student, enrollment, assessment and score will be
                        deleted from your account. This cannot be undone without a
                        backup.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => {
                          clearAll();
                          toast.success("All records cleared.");
                        }}
                      >
                        Clear everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="rounded-lg border border-border/70 bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  <p className="font-medium text-foreground">Privacy note</p>
                  <p className="mt-1">
                    Your records are stored securely and are private to your account.
                    Downloaded backups are not encrypted; protect exported files
                    as carefully as a grade book. Sign out when using a shared device.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="surface-card p-4 sm:p-5">
            <SectionHeading
              title="Data model"
              description="Keys and relationships maintained in your private workspace."
            />
            <div className="grid gap-3 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-3">
              <div className="rounded-lg border border-border/70 p-3">
                <p className="text-xs font-semibold text-foreground">
                  Students & enrollment
                </p>
                <p className="mt-1">
                  Unique student numbers; enrollment links students to sections so
                  movement never duplicates identity.
                </p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <p className="text-xs font-semibold text-foreground">
                  Assessments & scores
                </p>
                <p className="mt-1">
                  Each assessment keeps its own maximum score and weight. One score
                  record per student per assessment, with status and timestamp.
                </p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <p className="text-xs font-semibold text-foreground">
                  Analysis separation
                </p>
                <p className="mt-1">
                  Progression analysis uses normalized percentages; the weighted
                  grade is reported separately and never treated as evidence of
                  improvement.
                </p>
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
