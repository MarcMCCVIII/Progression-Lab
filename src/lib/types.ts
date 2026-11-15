export type ScoreStatus = "recorded" | "absent" | "exempt";

export type AssessmentCategory =
  | "quiz"
  | "examination"
  | "activity"
  | "project"
  | "performance";

export interface AcademicPeriod {
  id: string;
  academicYear: string;
  term: string;
  archived: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  archived: boolean;
}

export interface Section {
  id: string;
  name: string;
  periodId: string;
  archived: boolean;
}

export interface Student {
  id: string;
  studentNumber: string;
  name: string;
  archived: boolean;
}

export interface Enrollment {
  id: string;
  studentId: string;
  sectionId: string;
}

export interface AssessmentRubricItem {
  id: string;
  label: string;
  percentage: number;
}

export interface Assessment {
  id: string;
  sectionId: string;
  subjectId: string;
  name: string;
  category: AssessmentCategory;
  date: string;
  maxScore: number;
  /** Overall contribution of this assessment to the weighted grade. */
  weight: number;
  /** Break-down of rubric criteria and their percentages for this assessment. */
  rubric: AssessmentRubricItem[];
  description: string;
  archived: boolean;
}

export interface Score {
  id: string;
  assessmentId: string;
  studentId: string;
  rawScore: number | null;
  status: ScoreStatus;
  updatedAt: string;
}

export interface ProgressionSettings {
  /** Minimum recorded occasions before a student can be classified. */
  minObservations: number;
  /** Percentage-point change treated as meaningful movement. */
  changeThreshold: number;
  /** Volatility (sd of successive changes) that marks a trajectory as inconsistent. */
  volatilityThreshold: number;
  /** Latest percentage below this level triggers "needs attention". */
  attentionThreshold: number;
}

export interface DataSet {
  periods: AcademicPeriod[];
  subjects: Subject[];
  sections: Section[];
  students: Student[];
  enrollments: Enrollment[];
  assessments: Assessment[];
  scores: Score[];
  settings: ProgressionSettings;
}

export const CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  quiz: "Quiz",
  examination: "Examination",
  activity: "Activity",
  project: "Project",
  performance: "Performance task",
};

export const CATEGORY_ORDER: AssessmentCategory[] = [
  "quiz",
  "activity",
  "project",
  "performance",
  "examination",
];

export const DEFAULT_SETTINGS: ProgressionSettings = {
  minObservations: 2,
  changeThreshold: 3,
  volatilityThreshold: 8,
  attentionThreshold: 70,
};

export const emptyDataset = (): DataSet => ({
  periods: [],
  subjects: [],
  sections: [],
  students: [],
  enrollments: [],
  assessments: [],
  scores: [],
  settings: { ...DEFAULT_SETTINGS },
});
