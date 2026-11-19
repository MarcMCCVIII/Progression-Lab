import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createSampleDataset } from "./sample-data";
import {
  emptyDataset,
  type Assessment,
  type AssessmentCategory,
  type DataSet,
  type Enrollment,
  type ProgressionSettings,
  type Score,
  type ScoreStatus,
  type Section,
  type Student,
  type Subject,
} from "./types";

const STORAGE_KEY = "progression-lab.dataset.v1";
const SCOPE_KEY = "progression-lab.scope.v1";

export interface Scope {
  periodId: string;
  sectionId: string;
  subjectId: string;
}

interface StoreValue {
  data: DataSet;
  scope: Scope;
  setScope: (patch: Partial<Scope>) => void;
  activePeriod: DataSet["periods"][number] | undefined;
  activeSection: Section | undefined;
  activeSubject: Subject | undefined;
  addStudent: (input: {
    name: string;
    studentNumber: string;
    sectionId: string;
  }) => { ok: boolean; error?: string };
  importStudents: (
    rows: { name: string; studentNumber: string }[],
    sectionId: string,
  ) => { added: number; skipped: number };
  updateStudent: (id: string, patch: Partial<Student>) => void;
  archiveStudent: (id: string) => void;
  moveStudent: (studentId: string, sectionId: string) => void;
  addPeriod: (academicYear: string, term: string) => void;
  addSection: (name: string, periodId: string) => void;
  updateSection: (id: string, patch: Partial<Section>) => void;
  addSubject: (name: string, code: string) => void;
  updateSubject: (id: string, patch: Partial<Subject>) => void;
  addAssessment: (input: {
    sectionId: string;
    subjectId: string;
    name: string;
    category: AssessmentCategory;
    date: string;
    maxScore: number;
    weight: number;
    rubric: { id: string; label: string; percentage: number }[];
    description: string;
  }) => void;
  updateAssessment: (id: string, patch: Partial<Assessment>) => void;
  deleteAssessment: (id: string) => void;
  setScore: (
    assessmentId: string,
    studentId: string,
    rawScore: number | null,
    status: ScoreStatus,
    criterionScores?: Record<string, number>,
  ) => { ok: boolean; error?: string };
  bulkSetScores: (
    entries: {
      assessmentId: string;
      studentId: string;
      rawScore: number | null;
      status: ScoreStatus;
    }[],
  ) => { saved: number; rejected: number };
  updateSettings: (patch: Partial<ProgressionSettings>) => void;
  resetToSample: () => void;
  clearAll: () => void;
  importDataset: (incoming: DataSet) => { ok: boolean; error?: string };
  lastSaved: number | null;
}

const StoreContext = createContext<StoreValue | null>(null);

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

function loadDataset(): DataSet {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSampleDataset();
    const parsed = JSON.parse(raw) as DataSet;
    if (!parsed || !Array.isArray(parsed.students)) {
      return createSampleDataset();
    }
    const normalized: DataSet = {
      ...emptyDataset(),
      ...parsed,
      assessments: (parsed.assessments ?? []).map((assessment) => ({
        ...assessment,
        rubric: Array.isArray(assessment.rubric)
          ? assessment.rubric.map((item) => ({
              id: item.id || `${assessment.id}-${Math.random().toString(36).slice(2, 8)}`,
              label: item.label || "Criterion",
              percentage: Math.max(0, Number(item.percentage) || 0),
            }))
          : [],
      })),
    };
    return normalized;
  } catch {
    return createSampleDataset();
  }
}

function loadScope(data: DataSet): Scope {
  const fallback: Scope = {
    periodId: data.periods[0]?.id ?? "",
    sectionId: data.sections[0]?.id ?? "",
    subjectId: data.subjects[0]?.id ?? "",
  };
  try {
    const raw = localStorage.getItem(SCOPE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Scope;
    return {
      periodId: data.periods.some((period) => period.id === parsed.periodId)
        ? parsed.periodId
        : fallback.periodId,
      sectionId: data.sections.some((section) => section.id === parsed.sectionId)
        ? parsed.sectionId
        : fallback.sectionId,
      subjectId: data.subjects.some((subject) => subject.id === parsed.subjectId)
        ? parsed.subjectId
        : fallback.subjectId,
    };
  } catch {
    return fallback;
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataSet>(() => loadDataset());
  const [scope, setScopeState] = useState<Scope>(() => loadScope(loadDataset()));
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setLastSaved(Date.now());
    } catch {
      // Storage may be unavailable; the session keeps working in memory.
    }
  }, [data]);

  useEffect(() => {
    try {
      localStorage.setItem(SCOPE_KEY, JSON.stringify(scope));
    } catch {
      // Ignore scope persistence failures.
    }
  }, [scope]);

  const setScope = useCallback((patch: Partial<Scope>) => {
    setScopeState((current) => ({ ...current, ...patch }));
  }, []);

  const addStudent = useCallback<StoreValue["addStudent"]>(
    ({ name, studentNumber, sectionId }) => {
      const trimmedName = name.trim();
      const trimmedNumber = studentNumber.trim();
      if (!trimmedName) return { ok: false, error: "Student name is required." };
      if (!trimmedNumber)
        return { ok: false, error: "Student number is required." };
      if (
        data.students.some(
          (student) =>
            student.studentNumber.toLowerCase() === trimmedNumber.toLowerCase(),
        )
      ) {
        return { ok: false, error: "That student number is already registered." };
      }
      const student: Student = {
        id: uid("stu"),
        name: trimmedName,
        studentNumber: trimmedNumber,
        archived: false,
      };
      setData((current) => ({
        ...current,
        students: [...current.students, student],
        enrollments: [
          ...current.enrollments,
          { id: uid("enr"), studentId: student.id, sectionId },
        ],
      }));
      return { ok: true };
    },
    [data.students],
  );

  const importStudents = useCallback<StoreValue["importStudents"]>(
    (rows, sectionId) => {
      const seen = new Set(
        data.students.map((student) => student.studentNumber.toLowerCase()),
      );
      const newStudents: Student[] = [];
      const newEnrollments: Enrollment[] = [];
      let skipped = 0;
      rows.forEach((row) => {
        const name = row.name.trim();
        const studentNumber = row.studentNumber.trim();
        if (!name || !studentNumber) {
          skipped += 1;
          return;
        }
        const key = studentNumber.toLowerCase();
        if (seen.has(key)) {
          skipped += 1;
          return;
        }
        seen.add(key);
        const student: Student = {
          id: uid("stu"),
          name,
          studentNumber,
          archived: false,
        };
        newStudents.push(student);
        newEnrollments.push({
          id: uid("enr"),
          studentId: student.id,
          sectionId,
        });
      });
      if (newStudents.length > 0) {
        setData((current) => ({
          ...current,
          students: [...current.students, ...newStudents],
          enrollments: [...current.enrollments, ...newEnrollments],
        }));
      }
      return { added: newStudents.length, skipped };
    },
    [data.students],
  );

  const updateStudent = useCallback<StoreValue["updateStudent"]>((id, patch) => {
    setData((current) => ({
      ...current,
      students: current.students.map((student) =>
        student.id === id ? { ...student, ...patch } : student,
      ),
    }));
  }, []);

  const archiveStudent = useCallback<StoreValue["archiveStudent"]>((id) => {
    setData((current) => ({
      ...current,
      students: current.students.map((student) =>
        student.id === id ? { ...student, archived: true } : student,
      ),
    }));
  }, []);

  const moveStudent = useCallback<StoreValue["moveStudent"]>(
    (studentId, sectionId) => {
      setData((current) => ({
        ...current,
        enrollments: [
          ...current.enrollments.filter(
            (enrollment) => enrollment.studentId !== studentId,
          ),
          { id: uid("enr"), studentId, sectionId },
        ],
      }));
    },
    [],
  );

  const addPeriod = useCallback<StoreValue["addPeriod"]>(
    (academicYear, term) => {
      const year = academicYear.trim();
      const trimmedTerm = term.trim();
      if (!year || !trimmedTerm) return;
      if (
        !data.periods.some(
          (period) =>
            period.academicYear === year && period.term === trimmedTerm,
        )
      ) {
        const id = uid("per");
        setData((current) => ({
          ...current,
          periods: [
            ...current.periods,
            { id, academicYear: year, term: trimmedTerm, archived: false },
          ],
        }));
        setScopeState((scope) => ({ ...scope, periodId: id }));
      }
    },
    [data.periods],
  );

  const addSection = useCallback<StoreValue["addSection"]>((name, periodId) => {
    setData((current) => {
      const trimmed = name.trim();
      if (!trimmed) return current;
      return {
        ...current,
        sections: [
          ...current.sections,
          { id: uid("sec"), name: trimmed, periodId, archived: false },
        ],
      };
    });
  }, []);

  const updateSection = useCallback<StoreValue["updateSection"]>((id, patch) => {
    setData((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === id ? { ...section, ...patch } : section,
      ),
    }));
  }, []);

  const addSubject = useCallback<StoreValue["addSubject"]>((name, code) => {
    setData((current) => {
      const trimmed = name.trim();
      if (!trimmed) return current;
      return {
        ...current,
        subjects: [
          ...current.subjects,
          {
            id: uid("sub"),
            name: trimmed,
            code: code.trim() || trimmed.slice(0, 4).toUpperCase(),
            archived: false,
          },
        ],
      };
    });
  }, []);

  const updateSubject = useCallback<StoreValue["updateSubject"]>((id, patch) => {
    setData((current) => ({
      ...current,
      subjects: current.subjects.map((subject) =>
        subject.id === id ? { ...subject, ...patch } : subject,
      ),
    }));
  }, []);

  const addAssessment = useCallback<StoreValue["addAssessment"]>((input) => {
    setData((current) => {
      if (!input.sectionId || !input.subjectId) return current;
      const assessment: Assessment = {
        id: uid("asm"),
        sectionId: input.sectionId,
        subjectId: input.subjectId,
        name: input.name.trim() || "Untitled assessment",
        category: input.category,
        date: input.date,
        maxScore: Math.max(1, input.maxScore),
        weight: Math.max(0, input.weight),
        rubric: (input.rubric ?? []).map((item) => ({
          id: item.id || uid("rub"),
          label: item.label.trim() || "Criterion",
          percentage: Math.max(0, Number(item.percentage) || 0),
        })),
        description: input.description.trim(),
        archived: false,
      };
      return {
        ...current,
        assessments: [...current.assessments, assessment],
      };
    });
  }, []);

  const updateAssessment = useCallback<StoreValue["updateAssessment"]>(
    (id, patch) => {
      setData((current) => {
        const nextScores = current.scores.map((score) => {
          if (score.assessmentId !== id) return score;
          const assessment = current.assessments.find((item) => item.id === id);
          if (
            !assessment ||
            patch.maxScore === undefined ||
            score.rawScore === null
          ) {
            return score;
          }
          if (score.rawScore > patch.maxScore) {
            return { ...score, rawScore: patch.maxScore };
          }
          return score;
        });
        return {
          ...current,
          assessments: current.assessments.map((assessment) =>
            assessment.id === id ? { ...assessment, ...patch } : assessment,
          ),
          scores: nextScores,
        };
      });
    },
    [],
  );

  const deleteAssessment = useCallback<StoreValue["deleteAssessment"]>((id) => {
    setData((current) => ({
      ...current,
      assessments: current.assessments.filter(
        (assessment) => assessment.id !== id,
      ),
      scores: current.scores.filter((score) => score.assessmentId !== id),
    }));
  }, []);

  const setScore = useCallback<StoreValue["setScore"]>(
    (assessmentId, studentId, rawScore, status, criterionScores) => {
      const assessment = data.assessments.find((item) => item.id === assessmentId);
      if (!assessment) return { ok: false, error: "Assessment not found." };
      if (
        status === "recorded" &&
        rawScore !== null &&
        !Number.isFinite(rawScore)
      ) {
        return { ok: false, error: "Enter a numeric score." };
      }
      if (
        status === "recorded" &&
        rawScore !== null &&
        (rawScore < 0 || rawScore > assessment.maxScore)
      ) {
        return {
          ok: false,
          error: `Score must be between 0 and ${assessment.maxScore}.`,
        };
      }
      if (status === "recorded" && criterionScores) {
        const criteria = assessment.rubric ?? [];
        if (
          criteria.length === 0 ||
          Object.keys(criterionScores).length !== criteria.length
        ) {
          return {
            ok: false,
            error: "Enter a score for every assessment criterion.",
          };
        }
        let criterionTotal = 0;
        for (const criterion of criteria) {
          const value = criterionScores[criterion.id];
          const criterionMax =
            (assessment.maxScore * criterion.percentage) / 100;
          if (
            !Number.isFinite(value) ||
            value < 0 ||
            value > criterionMax
          ) {
            return {
              ok: false,
              error: "A criterion score is outside its allowed range.",
            };
          }
          criterionTotal += value;
        }
        if (rawScore === null || Math.abs(criterionTotal - rawScore) > 0.01) {
          return {
            ok: false,
            error: "Criterion scores must add up to the assessment total.",
          };
        }
      }
      const now = new Date().toISOString();
      setData((current) => {
        const existing = current.scores.find(
          (score) =>
            score.assessmentId === assessmentId && score.studentId === studentId,
        );
        if (status === "recorded" && rawScore === null) {
          return {
            ...current,
            scores: current.scores.filter((score) => score.id !== existing?.id),
          };
        }
        if (existing) {
          return {
            ...current,
            scores: current.scores.map((score) =>
              score.id === existing.id
                ? {
                    ...score,
                    rawScore: status === "recorded" ? rawScore : null,
                    criterionScores:
                      status === "recorded" ? criterionScores : undefined,
                    status,
                    updatedAt: now,
                  }
                : score,
            ),
          };
        }
        const score: Score = {
          id: uid("scr"),
          assessmentId,
          studentId,
          rawScore: status === "recorded" ? rawScore : null,
          criterionScores:
            status === "recorded" ? criterionScores : undefined,
          status,
          updatedAt: now,
        };
        return { ...current, scores: [...current.scores, score] };
      });
      return { ok: true };
    },
    [data.assessments],
  );

  const bulkSetScores = useCallback<StoreValue["bulkSetScores"]>(
    (entries) => {
      const now = new Date().toISOString();
      const assessmentById = new Map(
        data.assessments.map((assessment) => [assessment.id, assessment]),
      );
      const existingByKey = new Map(
        data.scores.map((score) => [
          `${score.assessmentId}:${score.studentId}`,
          score,
        ]),
      );
      const accepted = new Map<string, Score>();
      let rejected = 0;
      entries.forEach((entry) => {
        const assessment = assessmentById.get(entry.assessmentId);
        if (!assessment) {
          rejected += 1;
          return;
        }
        if (
          entry.status === "recorded" &&
          (entry.rawScore === null ||
            !Number.isFinite(entry.rawScore) ||
            entry.rawScore < 0 ||
            entry.rawScore > assessment.maxScore)
        ) {
          rejected += 1;
          return;
        }
        const key = `${entry.assessmentId}:${entry.studentId}`;
        accepted.set(key, {
          id: existingByKey.get(key)?.id ?? uid("scr"),
          assessmentId: entry.assessmentId,
          studentId: entry.studentId,
          rawScore: entry.status === "recorded" ? entry.rawScore : null,
          status: entry.status,
          updatedAt: now,
        });
      });
      if (accepted.size > 0) {
        setData((current) => ({
          ...current,
          scores: [
            ...current.scores.filter(
              (score) =>
                !accepted.has(`${score.assessmentId}:${score.studentId}`),
            ),
            ...accepted.values(),
          ],
        }));
      }
      return { saved: accepted.size, rejected };
    },
    [data.assessments, data.scores],
  );

  const updateSettings = useCallback<StoreValue["updateSettings"]>((patch) => {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  }, []);

  const resetToSample = useCallback(() => {
    const sample = createSampleDataset();
    setData(sample);
    setScopeState({
      periodId: sample.periods[0]?.id ?? "",
      sectionId: sample.sections[0]?.id ?? "",
      subjectId: sample.subjects[0]?.id ?? "",
    });
  }, []);

  const clearAll = useCallback(() => {
    setData(emptyDataset());
    setScopeState({ periodId: "", sectionId: "", subjectId: "" });
  }, []);

  const importDataset = useCallback<StoreValue["importDataset"]>((incoming) => {
    if (
      !incoming ||
      !Array.isArray(incoming.periods) ||
      !Array.isArray(incoming.subjects) ||
      !Array.isArray(incoming.sections) ||
      !Array.isArray(incoming.enrollments) ||
      !Array.isArray(incoming.students) ||
      !Array.isArray(incoming.assessments) ||
      !Array.isArray(incoming.scores)
    ) {
      return { ok: false, error: "This file is not a valid backup." };
    }
    const merged: DataSet = { ...emptyDataset(), ...incoming };
    setData(merged);
    setScopeState({
      periodId: merged.periods[0]?.id ?? "",
      sectionId: merged.sections[0]?.id ?? "",
      subjectId: merged.subjects[0]?.id ?? "",
    });
    return { ok: true };
  }, []);

  const activePeriod = data.periods.find(
    (period) => period.id === scope.periodId,
  );
  const activeSection = data.sections.find(
    (section) => section.id === scope.sectionId,
  );
  const activeSubject = data.subjects.find(
    (subject) => subject.id === scope.subjectId,
  );

  const value = useMemo<StoreValue>(
    () => ({
      data,
      scope,
      setScope,
      activePeriod,
      activeSection,
      activeSubject,
      addStudent,
      importStudents,
      updateStudent,
      archiveStudent,
      moveStudent,
      addPeriod,
      addSection,
      updateSection,
      addSubject,
      updateSubject,
      addAssessment,
      updateAssessment,
      deleteAssessment,
      setScore,
      bulkSetScores,
      updateSettings,
      resetToSample,
      clearAll,
      importDataset,
      lastSaved,
    }),
    [
      data,
      scope,
      setScope,
      activePeriod,
      activeSection,
      activeSubject,
      addStudent,
      importStudents,
      updateStudent,
      archiveStudent,
      moveStudent,
      addPeriod,
      addSection,
      updateSection,
      addSubject,
      updateSubject,
      addAssessment,
      updateAssessment,
      deleteAssessment,
      setScore,
      bulkSetScores,
      updateSettings,
      resetToSample,
      clearAll,
      importDataset,
      lastSaved,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDataStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useDataStore must be used within DataProvider");
  return context;
}
