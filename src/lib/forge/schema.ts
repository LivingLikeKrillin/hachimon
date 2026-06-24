import { z } from 'zod';

/** Claude 호출①(노트정리+분류) 출력 */
export const StructureSchema = z.object({
  title: z.string(),
  body: z.string(),
  deck: z.string(),
  rationale: z.string(),
});
export type StructureResult = z.infer<typeof StructureSchema>;

const QuizCardSchema = z.object({ q: z.string(), a: z.string() });

/** Claude 호출②(퀴즈 생성) 출력. 티어별 0개 이상. */
export const QuizSchema = z.object({
  foundation: z.array(QuizCardSchema),
  mechanism: z.array(QuizCardSchema),
  diagnosis: z.array(QuizCardSchema),
});
export type QuizResult = z.infer<typeof QuizSchema>;
export type QuizCard = z.infer<typeof QuizCardSchema>;
