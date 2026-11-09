import { z } from 'zod';

/** GET /health 응답. 프론트는 /api/health 로 프록시해 호출한다. */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['ok', 'error']),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
