import type {
  AcademicPeriod,
  Assessment,
  AssessmentCategory,
  DataSet,
  Enrollment,
  Score,
  Section,
  Student,
  Subject,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

/** Deterministic PRNG so the demonstration dataset is stable across reloads. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const RIZAL_NAMES = [
  "Alyssa Marie Bautista",
  "Joshua Emmanuel Reyes",
  "Kiana Grace Delgado",
  "Marco Luis Villanueva",
  "Patricia Anne Santiago",
  "Rafael Antonio Cruz",
  "Sofia Isabel Mendoza",
  "Nathaniel James Aquino",
  "Bea Camille Torres",
  "Gabriel Dominic Ramos",
  "Liana Rose Castillo",
  "Miguel Angelo Navarro",
  "Trisha Nicole Salazar",
  "Andre Philippe Garcia",
  "Jasmine Faith Lim",
  "Carlo Vincent Espinosa",
  "Danica Joy Ferrer",
  "Ethan Rafael Domingo",
  "Hannah Beatriz Ong",
  "Paolo Sebastian Rivera",
  "Ysabel Marie Padilla",
  "Lorenzo Gabriel Tan",
];

const MABINI_NAMES = [
  "Aira Nicole Manalo",
  "Daniel Luis Soriano",
  "Chloe Anne Vergara",
  "Kyle Adrian Baltazar",
  "Mikaela Rose Alonzo",
  "Jerome Patrick Dizon",
  "Samantha Claire Yulo",
  "Aaron Miguel Lacson",
  "Nicole Andrea Panganiban",
  "Lucas Rafael Arellano",
  "Bianca Louise Marquez",
  "Diego Emmanuel Fontanilla",
  "Erika Janine Robles",
  "Ivan Christopher Tiu",
  "Marielle Angelica Uy",
  "Renz Aldrin Cabrera",
  "Camille Therese Belmonte",
  "Sebastian Luis Herrera",
];

const period: AcademicPeriod = {
  id: "per-2025-1",
  academicYear: "2025–2026",
  term: "First Semester",
  archived: false,
};

const subjects: Subject[] = [
  { id: "sub-math", name: "Mathematics", code: "MATH-9", archived: false },
  {
    id: "sub-science",
    name: "Integrated Science",
    code: "SCI-9",
    archived: false,
  },
  { id: "sub-english", name: "English", code: "ENG-9", archived: false },
];

const sections: Section[] = [
  {
    id: "sec-rizal",
    name: "Grade 9 — Rizal",
    periodId: period.id,
    archived: false,
  },
  {
    id: "sec-mabini",
    name: "Grade 9 — Mabini",
    periodId: period.id,
    archived: false,
  },
];

const ASSESSMENT_BLUEPRINT: {
  name: string;
  category: AssessmentCategory;
  date: string;
  maxScore: number;
  weight: number;
  description: string;
  rubric: { label: string; percentage: number }[];
}[] = [
  {
    name: "Diagnostic Quiz",
    category: "quiz",
    date: "2025-08-18",
    maxScore: 20,
    weight: 10,
    description: "Baseline check on prerequisite skills.",
    rubric: [
      { label: "Reading", percentage: 40 },
      { label: "Writing", percentage: 35 },
      { label: "Speaking", percentage: 25 },
    ],
  },
  {
    name: "Quiz 2 — Core Concepts",
    category: "quiz",
    date: "2025-09-08",
    maxScore: 25,
    weight: 10,
    description: "Short quiz covering the first two learning units.",
    rubric: [
      { label: "Recall", percentage: 35 },
      { label: "Application", percentage: 40 },
      { label: "Reasoning", percentage: 25 },
    ],
  },
  {
    name: "Activity — Problem Set",
    category: "activity",
    date: "2025-09-29",
    maxScore: 30,
    weight: 15,
    description: "Guided practice set completed in class.",
    rubric: [
      { label: "Accuracy", percentage: 45 },
      { label: "Process", percentage: 35 },
      { label: "Completion", percentage: 20 },
    ],
  },
  {
    name: "Long Test",
    category: "examination",
    date: "2025-10-20",
    maxScore: 50,
    weight: 25,
    description: "Mid-quarter written test with mixed item formats.",
    rubric: [
      { label: "Knowledge", percentage: 30 },
      { label: "Understanding", percentage: 30 },
      { label: "Application", percentage: 40 },
    ],
  },
  {
    name: "Performance Task",
    category: "performance",
    date: "2025-11-10",
    maxScore: 100,
    weight: 20,
    description: "Applied task assessed with a teacher rubric.",
    rubric: [
      { label: "Content", percentage: 30 },
      { label: "Delivery", percentage: 35 },
      { label: "Reflection", percentage: 35 },
    ],
  },
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function createSampleDataset(): DataSet {
  const random = createRandom(20251112);
  const students: Student[] = [];
  const enrollments: Enrollment[] = [];
  const assessments: Assessment[] = [];
  const scores: Score[] = [];

  const cohorts: { section: Section; names: string[]; offset: number }[] = [
    { section: sections[0], names: RIZAL_NAMES, offset: 0 },
    { section: sections[1], names: MABINI_NAMES, offset: 40 },
  ];

  cohorts.forEach(({ section, names, offset }) => {
    names.forEach((name, index) => {
      const student: Student = {
        id: `stu-${slug(name)}`,
        studentNumber: `2025-${String(offset + index + 1).padStart(4, "0")}`,
        name,
        archived: false,
      };
      students.push(student);
      enrollments.push({
        id: `enr-${student.id}`,
        studentId: student.id,
        sectionId: section.id,
      });
    });
  });

  for (const section of sections) {
    for (const subject of subjects) {
      ASSESSMENT_BLUEPRINT.forEach((blueprint, index) => {
        const assessment: Assessment = {
          id: `asm-${section.id}-${subject.id}-${index + 1}`,
          sectionId: section.id,
          subjectId: subject.id,
          name: blueprint.name,
          category: blueprint.category,
          date: blueprint.date,
          maxScore: blueprint.maxScore,
          weight: blueprint.weight,
          rubric: blueprint.rubric.map((item, rubricIndex) => ({
            id: `${section.id}-${subject.id}-rubric-${index + 1}-${rubricIndex + 1}`,
            label: item.label,
            percentage: item.percentage,
          })),
          description: blueprint.description,
          archived: false,
        };
        assessments.push(assessment);
      });
    }
  }

  const cohortBySection = new Map(
    cohorts.map(({ section, names }) => [section.id, names]),
  );

  for (const section of sections) {
    const names = cohortBySection.get(section.id) ?? [];
    const enrolled = students.filter((student) =>
      enrollments.some(
        (enrollment) =>
          enrollment.sectionId === section.id &&
          enrollment.studentId === student.id,
      ),
    );
    names.forEach(() => undefined);

    for (const subject of subjects) {
      const subjectAssessments = assessments.filter(
        (assessment) =>
          assessment.sectionId === section.id &&
          assessment.subjectId === subject.id,
      );
      enrolled.forEach((student, studentIndex) => {
        const ability = 58 + random() * 34;
        const trend = (random() - 0.42) * 7;
        const volatility = random() < 0.18 ? 9 + random() * 7 : 2.5 + random() * 3;
        let wander = 0;

        subjectAssessments.forEach((assessment, assessmentIndex) => {
          wander = wander * 0.55 + (random() - 0.5) * volatility * 2;
          const difficulty =
            assessment.category === "examination" ? -4 : assessmentIndex === 0 ? -3 : 0;
          let percentage =
            ability + trend * assessmentIndex + wander + difficulty;
          if (studentIndex % 11 === 3) percentage -= 9;
          percentage = Math.min(99, Math.max(28, percentage));

          const roll = random();
          let status: Score["status"] = "recorded";
          let rawScore: number | null = Math.round(
            (percentage / 100) * assessment.maxScore,
          );

          if (roll > 0.975) {
            status = "absent";
            rawScore = null;
          } else if (roll > 0.955) {
            status = "exempt";
            rawScore = null;
          } else if (roll > 0.93) {
            status = "absent";
            rawScore = null;
          }

          scores.push({
            id: `scr-${assessment.id}-${student.id}`,
            assessmentId: assessment.id,
            studentId: student.id,
            rawScore,
            status,
            updatedAt: `${assessment.date}T09:${String(
              10 + (studentIndex % 40),
            ).padStart(2, "0")}:00.000Z`,
          });
        });
      });
    }
  }

  return {
    periods: [period],
    subjects,
    sections,
    students,
    enrollments,
    assessments,
    scores,
    settings: { ...DEFAULT_SETTINGS },
  };
}
