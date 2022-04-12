import { z } from "zod";

export const isPointInterface = z.object({
    x: z.number(),
    y: z.number(),
    direction: z.string(),
    moving: z.boolean(),
});

export type PointInterface = z.infer<typeof isPointInterface>;
