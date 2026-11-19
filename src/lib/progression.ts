import {
  describe,
  linearRegression,
  mean,
  standardDeviation,
  type Descriptive,
} from "./stats";
import type {
  Assessment,
  DataSet,
  ProgressionSettings,
  Score,
  ScoreStatus,
  Student,
} from "./types";

export type ProgressionStatus =
  | "improving"
  | "stable"
  | "inconsistent"
  | "declining"
  | "attention"
  | "insufficient";

export interface StatusMeta {
  label: string;
  short: string;
  description: string;
}

export const STATUS_META: Record<ProgressionStatus, StatusMeta> = {
  improving: {
    label: "Consistently improving",
    short: "Improving",
    description: "Scores trend upward beyond the configured movement threshold.",
  },
  stable: {
    label: "Relatively stable",
    short: "Stable",
    description: "Scores stay within a narrow band across comparable occasions.",
  },
  inconsistent: {
    label: "Inconsistent",
    short: "Inconsistent",
    description: "Scores fluctuate sharply; direction is not yet dependable.",
  },
  declining: {
    label: "Declining",
    short: "Declining",
    description: "Scores trend downward beyond the configured movement threshold.",
  },
  attention: {
    label: "Needs attention",
    short: "Attention",
    description: "Latest result sits below the attention threshold without gain.",
  },
  insufficient: {
    label: "Insufficient data",
    short: "No trend",
    description: "Too few recorded occasions to classify this trajectory.",
  },
};

export const STATUS_ORDER: ProgressionStatus[] = [
  "improving",
  "stable",
  "inconsistent",
  "declining",
  "attention",
  "insufficient",
];

export interface Occasion {
  assessment: Assessment;
  /** Index in the ordered assessment sequence for this class + subject. */
  index: number;
  rawScore: number | null;
  status: ScoreStatus | "not-recorded";
  percentage: number | null;
  changePoints: number | null;
  relativeChange: number | null;
}

export const percentageOf = (raw: number | null, max: number): number | null =>
  raw === null || !Number.isFinite(raw) || max <= 0
    ? null
    : (raw / max) * 100;

export function sectionStudents(data: DataSet, sectionId: string): Student[] {
  const ids = new Set(
    data.enrollments
      .filter((enrollment) => enrollment.sectionId === sectionId)
      .map((enrollment) => enrollment.studentId),
  );
  return data.students
    .filter((student) => ids.has(student.id) && !student.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function sectionAssessments(
  data: DataSet,
  sectionId: string,
  subjectId: string,
): Assessment[] {
  return data.assessments
    .filter(
      (assessment) =>
        assessment.sectionId === sectionId &&
        assessment.subjectId === subjectId &&
        !assessment.archived,
    )
    .sort((a, b) => {
      if (a.date === b.date) return a.name.localeCompare(b.name);
      return a.date.localeCompare(b.date);
    });
}

export function scoreLookup(data: DataSet): Map<string, Score> {
  const map = new Map<string, Score>();
  for (const score of data.scores) {
    map.set(`${score.assessmentId}:${score.studentId}`, score);
  }
  return map;
}

export interface StudentAnalysis {
  student: Student;
  occasions: Occasion[];
  recorded: number;
  average: number;
  first: number | null;
  latest: number | null;
  totalChange: number | null;
  relativeChange: number | null;
  highest: number | null;
  lowest: number | null;
  variability: number;
  slope: number;
  r2: number;
  status: ProgressionStatus;
  needsAttention: boolean;
  improvementRuns: number;
  declineRuns: number;
  weightedGrade: number | null;
}

export function buildStudentAnalysis(
  data: DataSet,
  student: Student,
  sectionId: string,
  subjectId: string,
  settings: ProgressionSettings,
  scores?: Map<string, Score>,
): StudentAnalysis {
  const lookup = scores ?? scoreLookup(data);
  const assessments = sectionAssessments(data, sectionId, subjectId);
  const occasions: Occasion[] = [];
  let previous: number | null = null;

  assessments.forEach((assessment, index) => {
    const score = lookup.get(`${assessment.id}:${student.id}`);
    const status: ScoreStatus | "not-recorded" = score?.status ?? "not-recorded";
    const rawScore = status === "recorded" ? score?.rawScore ?? null : null;
    const percentage =
      status === "recorded" ? percentageOf(rawScore, assessment.maxScore) : null;
    const changePoints =
      percentage !== null && previous !== null ? percentage - previous : null;
    const relativeChange =
      percentage !== null && previous !== null && previous !== 0
        ? ((percentage - previous) / previous) * 100
        : null;
    occasions.push({
      assessment,
      index,
      rawScore,
      status,
      percentage,
      changePoints,
      relativeChange,
    });
    if (percentage !== null) previous = percentage;
  });

  const values = occasions
    .map((occasion) => occasion.percentage)
    .filter((value): value is number => value !== null);
  const changes = occasions
    .map((occasion) => occasion.changePoints)
    .filter((value): value is number => value !== null);

  const gradedOccasions = occasions.filter(
    (occasion) => occasion.percentage !== null && occasion.assessment.weight > 0,
  );
  const weightTotal = gradedOccasions.reduce(
    (acc, occasion) => acc + occasion.assessment.weight,
    0,
  );
  const weightedGrade =
    weightTotal > 0
      ? gradedOccasions.reduce(
          (acc, occasion) =>
            acc + (occasion.percentage as number) * occasion.assessment.weight,
          0,
        ) / weightTotal
      : null;

  const regression = linearRegression(
    values.map((_, index) => index),
    values,
  );

  const { status, needsAttention } = classifyProgression(values, settings);

  return {
    student,
    occasions,
    recorded: values.length,
    average: values.length ? mean(values) : Number.NaN,
    first: values.length ? values[0] : null,
    latest: values.length ? values[values.length - 1] : null,
    totalChange:
      values.length >= 2 ? values[values.length - 1] - values[0] : null,
    relativeChange:
      values.length >= 2 && values[0] !== 0
        ? ((values[values.length - 1] - values[0]) / values[0]) * 100
        : null,
    highest: values.length ? Math.max(...values) : null,
    lowest: values.length ? Math.min(...values) : null,
    variability: values.length >= 2 ? standardDeviation(values) : 0,
    slope: regression.slope,
    r2: regression.r2,
    status,
    needsAttention,
    improvementRuns: changes.filter((change) => change > 0).length,
    declineRuns: changes.filter((change) => change < 0).length,
    weightedGrade,
  };
}

export function classifyProgression(
  values: number[],
  settings: ProgressionSettings,
): { status: ProgressionStatus; needsAttention: boolean } {
  if (values.length < settings.minObservations) {
    return { status: "insufficient", needsAttention: false };
  }
  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) changes.push(values[i] - values[i - 1]);
  const volatility = changes.length >= 2 ? standardDeviation(changes) : 0;
  const total = values[values.length - 1] - values[0];
  const latest = values[values.length - 1];
  const slope = linearRegression(
    values.map((_, index) => index),
    values,
  ).slope;

  let status: ProgressionStatus;
  if (volatility > settings.volatilityThreshold && changes.length >= 2) {
    status = "inconsistent";
  } else if (total >= settings.changeThreshold) {
    status = "improving";
  } else if (total <= -settings.changeThreshold) {
    status = "declining";
  } else {
    status = "stable";
  }

  const needsAttention =
    latest < settings.attentionThreshold &&
    slope <= 0 &&
    status !== "improving";

  if (needsAttention && (status === "stable" || status === "declining")) {
    status = "attention";
  }

  return { status, needsAttention };
}

export interface AssessmentSummary {
  assessment: Assessment;
  stats: Descriptive;
  recorded: number;
  absent: number;
  exempt: number;
  missing: number;
  compared: number;
  meanChange: number | null;
  improved: number;
  declined: number;
  unchanged: number;
}

export interface ClassAnalysis {
  assessments: AssessmentSummary[];
  students: Student[];
  analyses: StudentAnalysis[];
  statusCounts: Record<ProgressionStatus, number>;
  overallMean: number;
  meanChange: number | null;
  pairedStudents: number;
}

export function buildClassAnalysis(
  data: DataSet,
  sectionId: string,
  subjectId: string,
): ClassAnalysis {
  const students = sectionStudents(data, sectionId);
  const lookup = scoreLookup(data);
  const assessments = sectionAssessments(data, sectionId, subjectId);
  const analyses = students.map((student) =>
    buildStudentAnalysis(
      data,
      student,
      sectionId,
      subjectId,
      data.settings,
      lookup,
    ),
  );

  const summaries: AssessmentSummary[] = assessments.map(
    (assessment, index) => {
      const previous = assessments[index - 1];
      const percentages: number[] = [];
      let absent = 0;
      let exempt = 0;
      let missing = 0;
      let compared = 0;
      let changeTotal = 0;
      let improved = 0;
      let declined = 0;
      let unchanged = 0;

      for (const student of students) {
        const score = lookup.get(`${assessment.id}:${student.id}`);
        if (!score || score.status !== "recorded") {
          if (score?.status === "absent") absent += 1;
          else if (score?.status === "exempt") exempt += 1;
          else missing += 1;
        }
        if (score?.status === "recorded" && score.rawScore !== null) {
          const percentage = percentageOf(score.rawScore, assessment.maxScore);
          if (percentage !== null) percentages.push(percentage);
        }
        if (previous) {
          const priorScore = lookup.get(`${previous.id}:${student.id}`);
          if (
            score?.status === "recorded" &&
            score.rawScore !== null &&
            priorScore?.status === "recorded" &&
            priorScore.rawScore !== null
          ) {
            const current = percentageOf(score.rawScore, assessment.maxScore);
            const prior = percentageOf(priorScore.rawScore, previous.maxScore);
            if (current !== null && prior !== null) {
              compared += 1;
              const delta = current - prior;
              changeTotal += delta;
              if (delta > 0.5) improved += 1;
              else if (delta < -0.5) declined += 1;
              else unchanged += 1;
            }
          }
        }
      }

      return {
        assessment,
        stats: describe(percentages),
        recorded: percentages.length,
        absent,
        exempt,
        missing,
        compared,
        meanChange: compared ? changeTotal / compared : null,
        improved,
        declined,
        unchanged,
      };
    },
  );

  const statusCounts = STATUS_ORDER.reduce(
    (acc, status) => ({ ...acc, [status]: 0 }),
    {} as Record<ProgressionStatus, number>,
  );
  analyses.forEach((analysis) => {
    statusCounts[analysis.status] += 1;
  });

  const latestValues = analyses
    .map((analysis) => analysis.latest)
    .filter((value): value is number => value !== null);
  const paired = analyses.filter(
    (analysis) => analysis.occasions.length >= 2 && analysis.totalChange !== null,
  );

  return {
    assessments: summaries,
    students,
    analyses,
    statusCounts,
    overallMean: latestValues.length ? mean(latestValues) : Number.NaN,
    meanChange: paired.length
      ? mean(paired.map((analysis) => analysis.totalChange as number))
      : null,
    pairedStudents: paired.length,
  };
}

export interface ComparisonPair {
  label: string;
  pre: number[];
  post: number[];
}

export function pairedSeries(
  data: DataSet,
  sectionId: string,
  subjectId: string,
  firstId: string,
  secondId: string,
): ComparisonPair {
  const students = sectionStudents(data, sectionId);
  const lookup = scoreLookup(data);
  const assessments = sectionAssessments(data, sectionId, subjectId);
  const first = assessments.find((assessment) => assessment.id === firstId);
  const second = assessments.find((assessment) => assessment.id === secondId);
  const pre: number[] = [];
  const post: number[] = [];
  if (!first || !second) {
    return { label: "", pre, post };
  }
  for (const student of students) {
    const a = lookup.get(`${first.id}:${student.id}`);
    const b = lookup.get(`${second.id}:${student.id}`);
    if (
      a?.status === "recorded" &&
      a.rawScore !== null &&
      b?.status === "recorded" &&
      b.rawScore !== null
    ) {
      const prePct = percentageOf(a.rawScore, first.maxScore);
      const postPct = percentageOf(b.rawScore, second.maxScore);
      if (prePct !== null && postPct !== null) {
        pre.push(prePct);
        post.push(postPct);
      }
    }
  }
  return { label: `${first.name} → ${second.name}`, pre, post };
}

export function repeatedMeasuresMatrix(
  data: DataSet,
  sectionId: string,
  subjectId: string,
  assessmentIds: string[],
): { matrix: (number | null)[][]; labels: string[] } {
  const students = sectionStudents(data, sectionId);
  const lookup = scoreLookup(data);
  const assessments = sectionAssessments(data, sectionId, subjectId).filter(
    (assessment) => assessmentIds.includes(assessment.id),
  );
  const matrix = students.map((student) =>
    assessments.map((assessment) => {
      const score = lookup.get(`${assessment.id}:${student.id}`);
      if (score?.status !== "recorded" || score.rawScore === null) return null;
      return percentageOf(score.rawScore, assessment.maxScore);
    }),
  );
  return { matrix, labels: assessments.map((assessment) => assessment.name) };
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(digits)}%`;
}

export function formatSigned(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

export function formatP(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  if (value < 0.0001) return "< 0.0001";
  return value.toFixed(4);
}
