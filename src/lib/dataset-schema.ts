import { z } from "zod";
const id = z.string().min(1).max(200);
const text = z.string().max(10000);
const archived = z.boolean();
const number = z.number().finite();
export const datasetSchema = z.object({
  periods: z.array(z.object({ id, academicYear: text, term: text, archived })),
  subjects: z.array(z.object({ id, name: text, code: text, archived })),
  sections: z.array(z.object({ id, name: text, periodId: id, archived })),
  students: z.array(
    z.object({ id, name: text, studentNumber: text, archived }),
  ),
  enrollments: z.array(z.object({ id, studentId: id, sectionId: id })),
  assessments: z.array(
    z.object({
      id,
      sectionId: id,
      subjectId: id,
      name: text,
      category: z.enum([
        "quiz",
        "examination",
        "activity",
        "project",
        "performance",
      ]),
      date: text,
      maxScore: number.positive(),
      weight: number.nonnegative(),
      rubric: z
        .array(z.object({ id, label: text, percentage: number.nonnegative() }))
        .default([]),
      description: text,
      archived,
    }),
  ),
  scores: z.array(
    z.object({
      id,
      assessmentId: id,
      studentId: id,
      rawScore: number.nullable(),
      status: z.enum(["recorded", "absent", "exempt"]),
      updatedAt: text,
    }),
  ),
  settings: z.object({
    minObservations: number.nonnegative(),
    changeThreshold: number.nonnegative(),
    volatilityThreshold: number.nonnegative(),
    attentionThreshold: number,
  }),
});
